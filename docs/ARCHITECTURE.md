# Arquitectura

## Vista general

```
navegador ──► web (nginx :8080) ──► /api/* ──► api (NestJS :3000) ──► db (PostgreSQL 16)
                 │                                   │
                 └ build de React (Vite)             └ catálogo ──► valorant-api.com (caché en memoria, 1 h)

imágenes: el navegador las carga directamente de media.valorant-api.com
```

- **Mismo origen.** nginx sirve la SPA y reenvía `/api` a la API; en desarrollo lo hace el proxy de Vite. No hay CORS y la cookie de sesión funciona igual en ambos entornos.
- **Arranque.** `docker compose up` levanta `db`. Cuando está sana, arranca `api`, que aplica las migraciones de Prisma y responde en `/api/health`. Cuando la API está sana, arranca `web`. nginx resuelve `api` en cada petición, así que recrear la API no deja una IP antigua.

## Estructura

```
apps/api/src
  auth/        registro, login, logout, me; scrypt; JWT en cookie; SessionGuard
  catalog/     descarga, filtra y recorta Valorant API; caché; GET /api/catalog
  votes/       PUT del voto y GET de resultados por mapa
  setup.ts     prefijo /api, filtro de errores, guard de escrituras, validación
apps/api/test  pruebas e2e contra PostgreSQL (base valorant_test)
apps/web/src
  api/         cliente fetch, tipos del contrato, consultas (TanStack Query)
  features/    auth (acceso), maps (exploración), map-detail (voto y resultados)
  styles/      tokens (paleta y tipografía) y base
```

El backend se organiza por responsabilidad y el frontend por funcionalidad. No hay paquete compartido: el contrato vive en `apps/web/src/api/types.ts` y en el servicio del catálogo; para dos apps no compensaba la configuración extra.

## Modelo de datos

```
User (id, email único, passwordHash, createdAt)
Vote (id, userId → User, mapId, category AGENT|WEAPON, optionId, updatedAt)
      UNIQUE (userId, mapId, category)
      INDEX  (mapId, category, optionId)
```

- Mapas, agentes y armas **no se guardan**: son datos de Valorant API, cambian con los parches y basta su uuid.
- **Un voto es una fila que se sobrescribe, no un evento que se acumula.** La restricción única garantiza un voto por usuario, mapa y categoría. Votar dos veces lo mismo reescribe la misma fila; cambiar de opción actualiza `optionId`; el arma y los demás mapas no se tocan.
- El voto se escribe con **una sola sentencia atómica**: `INSERT … ON CONFLICT (userId, mapId, category) DO UPDATE`. Con peticiones repetidas o concurrentes, PostgreSQL deja una sola fila; no hay leer-y-luego-escribir.
- Los resultados son un `GROUP BY optionId` sobre los votos reales, sin contadores aparte que puedan desincronizarse. Con millones de votos habría que cachear o materializar; para este alcance el índice basta.

## API

| Método y ruta | Sesión | Respuesta |
|---|---|---|
| `POST /api/auth/register` | — | 201 `{ id, email }` + cookie · 409 email en uso · 400 validación |
| `POST /api/auth/login` | — | 200 + cookie · 401 mensaje genérico |
| `POST /api/auth/logout` | — | 204, borra la cookie |
| `GET /api/auth/me` | sí | 200 `{ id, email }` · 401 |
| `GET /api/catalog` | — | 200 `{ maps, agents, weapons }` · 503 si nunca se pudo cargar |
| `GET /api/maps/:mapId/results` | opcional | 200 recuentos por categoría + `myVotes` (null sin sesión) · 404 mapa desconocido |
| `PUT /api/maps/:mapId/votes/:category` | sí | 200 resultados ya recalculados · 401 · 404 mapa · 422 opción de otra categoría · 503 sin catálogo |

Los errores siempre tienen la forma `{ statusCode, message, fields? }`, en español y sin trazas.

## Autenticación y protección de escrituras

- Contraseñas con `crypto.scrypt` de Node (sal aleatoria, comparación en tiempo constante). Un email inexistente también calcula un hash, para no revelar por tiempos qué emails existen.
- Al registrarse, además del formato, se consulta el DNS del dominio del email. Solo se rechaza con certeza: el dominio no existe (ni MX ni A, tras tres intentos) o declara un «MX nulo». Ante cualquier duda (sin red, timeout, respuesta vacía) se acepta, porque rechazar a un usuario real es peor que aceptar un dominio falso. Los reintentos existen porque el DNS interno de Docker falla de forma intermitente en la primera consulta de un dominio. No comprueba que el buzón exista: eso exigiría enviar un correo de verificación.
- Sesión: JWT de 7 días en la cookie `vc_session` con `HttpOnly` (no la lee JavaScript), `SameSite=Lax` y `Secure` cuando `COOKIE_SECURE=true`.
- Escrituras protegidas por tres capas: `SameSite=Lax` (el navegador no envía la cookie en un POST/PUT desde otro sitio), un guard que rechaza con 403 un `Origin` no incluido en `APP_ORIGIN`, y solo `application/json` (415 en otro caso), que impide formularios HTML entre sitios. Con mismo origen y estas capas, un token CSRF no aportaba nada más.
- Límites conocidos: no hay revocación de sesiones en el servidor ni límite de intentos.

## Integración con Valorant API

- Se descargan `maps`, `agents?isPlayableCharacter=true` y `weapons` en español, con un tiempo máximo de 5 s, y se recortan a lo que pinta la interfaz. La respuesta de armas pesa unos 3,6 MB por las skins y nunca llega al navegador.
- **Mapas competitivos:** la API no los marca. Son los únicos con `tacticalDescription` (13); se excluyen The Range, Skirmish y los de Team Deathmatch.
- **Armas:** se excluye el cuerpo a cuerpo (sin `shopData`). La categoría se etiqueta por categoría de tienda: en español, Warden traía «Rifles» y el resto de su categoría «Rifles de asalto».
- **Imágenes de agente:** `killfeedPortrait` (256×128, ~28 KB) en la rejilla de 30 y `fullPortrait` (cuerpo entero, ~600 KB) solo en la ficha «Tu voto», donde se carga uno a la vez. Con retratos grandes en la rejilla, la página descargaba 12 MB.
- **Caché en memoria de 1 h.** Una sola descarga en curso a la vez. Si una renovación falla, o devuelve listas vacías por un cambio de formato, se sigue sirviendo la caché anterior. Solo si nunca se cargó se responde 503 y la interfaz muestra «No pudimos cargar los mapas de VALORANT…» con Reintentar.
- Los identificadores del voto se validan contra esa caché: no se puede votar un mapa no competitivo, un arma como agente ni un uuid inventado.

## Frontend

- React 19, React Router 7 y TanStack Query: caché del catálogo, sesión y estados de la mutación del voto. Una mutación por categoría, así que guardar el agente no bloquea el arma.
- **La interfaz no adelanta números:** la selección se marca al instante como pendiente, pero recuentos y barras solo cambian con la respuesta del servidor. Si falla, el aviso dice qué voto sigue registrado y ofrece Reintentar.
- CSS Modules con custom properties (paleta de 8 tokens); sin librerías de UI ni de animación. Las barras se animan con `transform: scaleX` y, con `prefers-reduced-motion`, el cambio es inmediato.

## Decisiones de versiones

npm ya publica NestJS 12, Prisma 7/8, TypeScript 7 y Vite 8, pero se fijaron las líneas estables anteriores (NestJS 11, Prisma 6, TypeScript 5.9, Vite 7). Las mayores nuevas cambian la configuración y no había margen para validar esos cambios en una jornada.

## Verificación

- 28 pruebas e2e de la API (`pnpm test:api`).
- Recorrido completo en Chrome headless, en escritorio y en móvil: visitante → acceso → vuelta al mapa, voto con teclado, voto repetido, cambio de voto, error del servidor con Reintentar, recarga, movimiento reducido y sin scroll horizontal a 360 px.
- Revisión de diseño y técnica con Impeccable (`critique` y `audit`); hallazgos y decisiones en `PLAN.md` (hito H6) y capturas en `docs/capturas/`.

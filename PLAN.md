# PLAN — Valorant Community (prueba técnica Lucidbot)

> Estado: **solo planificación**. No hay código, dependencias ni configuración creados. Todos los comandos y pruebas de este documento están **pendientes** de ejecutar.
> Repositorio al inicio de la sesión: carpeta vacía, sin `git init`.
> Plan elaborado el viernes 20-11-2026.

## 0. Resumen ejecutivo

- **Producto:** por cada mapa competitivo de VALORANT, cada usuario elige su mejor agente y su mejor arma; cualquiera puede ver cómo se reparten los votos.
- **Stack:** monorepo pnpm · `apps/api` NestJS + Prisma + PostgreSQL · `apps/web` React + Vite + TypeScript · Docker Compose (db, api, web con nginx).
- **Regla central:** un voto por `(userId, mapId, category)`, garantizado por una restricción única en la base de datos y escrito con un upsert atómico.
- **Dirección visual:** «tablero táctico»: fondo azul-negro oficial, tipografía condensada en mayúsculas, rojo reservado a *tu elección*, el arte del mapa como única imagen grande.
- **Forma de trabajo:** implementación con agentes de Claude Code en carriles paralelos, con un contrato de API congelado antes de dividir el trabajo (§9).
- **Plazo:** sábado 21-11-2026 a las 14:00, hora de Colombia. Ver §1.4.

---

## 1. Requisitos: qué pide Lucidbot, qué decido yo, qué es opcional

Fuente: <https://david-lucidbot.github.io/technical-test/> (leído completo en esta sesión; no enlaza subpáginas).

### 1.1 Requisitos oficiales (obligatorios)

| # | Requisito | Tarea que lo cubre | Cómo se verifica |
|---|---|---|---|
| R1 | Backend con **NestJS** | H1, H2, H3 | `apps/api` arranca y responde `/api/health` |
| R2 | Frontend con **Vite** | H1, H4 | `apps/web` compila con `vite build` |
| R3 | **Monorepo** (front y back en un repositorio) | H1 | Un solo repo con `pnpm-workspace.yaml` |
| R4 | **Registro e inicio de sesión** | H2 | Pruebas e2e de auth + recorrido manual |
| R5 | Ejecutable con **Docker** | H1 (esqueleto), H7 (arranque limpio) | `docker compose up --build` desde un clon nuevo |
| R6 | **Persistencia** en base de datos | H1, H3 | Votos sobreviven a `docker compose restart` |
| R7 | Integración con **Valorant API** | H3 | `/api/catalog` devuelve mapas, agentes y armas reales |
| R8 | **Uso de IA** durante el desarrollo, documentado | Todo; registro en §11 y `docs/AI.md` (H7) | Documento con herramientas, tareas, correcciones y validación |
| R9 | Explorar y seleccionar mapas | H4 | Recorrido manual, teclado |
| R10 | Votar agente y arma por mapa | H3, H5 | Pruebas e2e + recorrido manual |
| R11 | Ver resultados agregados por mapa | H3, H5 | Prueba e2e de agregación + UI |
| R12 | Entregables: repo Git con historial legible, README, documentación técnica breve, descripción del uso de IA, archivo de entorno de ejemplo sin secretos | H7 | Lista de comprobación de entrega (§10) |

El enunciado declara explícitamente que **no** espera una plataforma social ni contenido publicado por usuarios, que el alcance es flexible y que valora priorizar y documentar lo no implementado. No hay sección de extras o bonus.

### 1.2 Decisiones de producto propias (no impuestas por el enunciado)

| Decisión | ¿Conflicto con el enunciado? |
|---|---|
| Visitantes pueden explorar y ver resultados; votar exige sesión | **No.** El enunciado pide cuenta «para participar en las votaciones»; no exige ocultar los resultados. Además reduce la fricción para el evaluador. |
| Una elección de agente y otra de arma por usuario y mapa, modificables por separado | No. El enunciado deja las reglas de negocio a mi criterio («votos consistentes, resultados fiables»). |
| Repetir la solicitud (también en concurrencia) cuenta como un voto | No. Es la forma concreta de «votos consistentes». |
| Cambiar la elección mueve el voto | No. |
| Solo se listan los **13 mapas competitivos** (los que tienen `tacticalDescription`), no The Range, Skirmish ni los de Team Deathmatch | No, pero es una interpretación de «mapas disponibles»: se documenta en el README. |
| Se excluye el arma cuerpo a cuerpo (`shopData = null`): quedan 20 armas | No. Interpretación documentada. |
| No se puede retirar un voto, solo cambiarlo | No. Recorte consciente, documentado. |

### 1.3 Mejoras opcionales (solo si sobra tiempo, en este orden)

1. Transición de continuidad mapa → detalle (View Transitions API).
2. Prueba de humo con Playwright del recorrido completo.
3. Filtro de agentes por rol en el selector.
4. Retirar un voto (`DELETE`).

### 1.4 Plazo

La página dice literalmente **«Plazo: Hasta mañana sábado a las 2:00 PM»**, sin fecha ni zona horaria.
**Plazo confirmado por mí: sábado 21-11-2026 a las 14:00, hora de Colombia (UTC−5).** Objetivo interno: entrega enviada a las 13:00 como tarde, con H7 terminado antes.

---

## 2. Recorrido que debe funcionar

1. Clonar, `cp .env.example .env`, `docker compose up --build`, abrir `http://localhost:8080`.
2. Crear cuenta e iniciar sesión.
3. Explorar mapas (datos de Valorant API) y abrir uno.
4. Elegir agente y arma.
5. Ver la distribución de votos de ambas categorías.
6. Cambiar una elección, ver el efecto y comprobar que se conserva al recargar.

Todo lo que no sirva a estos seis pasos es recortable.

---

## 3. Arquitectura

### 3.1 Evaluación de la propuesta inicial

| Elección | Veredicto | Motivo (coste/utilidad para una jornada) |
|---|---|---|
| Monorepo **pnpm workspaces** | Se mantiene | Coste casi nulo; un `pnpm-lock.yaml`, scripts raíz. Sin Turborepo/Nx: dos apps no lo justifican. |
| **React + Vite + TS** | Se mantiene | Requisito (Vite) + lo más rápido de montar. |
| **NestJS + Prisma + PostgreSQL** | Se mantiene | La restricción única y el `ON CONFLICT` de Postgres son el núcleo de la regla de negocio; Prisma da migraciones versionadas que se aplican solas al arrancar el contenedor. |
| **Docker Compose** | Se mantiene | Tres servicios: `db`, `api`, `web`. |
| **Cookie HttpOnly** | Se mantiene | El token nunca es legible desde JS; con front y API bajo el mismo origen no hace falta CORS. |
| Paquete compartido de tipos (`packages/shared`) | **No se crea** | Añade configuración de build entre paquetes. El contrato vive en §3.5; el front declara sus tipos en un único archivo `api/types.ts`. Se añadiría si el contrato creciera. |

**Versiones (decidido en H1):** npm ya publica NestJS 12, Prisma 7/8, TypeScript 7 y Vite 8, pero se fijan las líneas estables anteriores (NestJS 11, Prisma 6, TypeScript 5.9, Vite 7, React Router 7). Motivo: las mayores nuevas cambian la configuración (Prisma 7 exige adaptadores y `prisma.config.ts`; TypeScript 7 es la reescritura nativa) y no hay margen en una jornada para validar esos cambios. pnpm 11 bloquea los scripts de instalación: solo se permiten los de Prisma y esbuild (`allowBuilds` en `pnpm-workspace.yaml`), y se respeta su protección contra versiones recién publicadas (React Query fijado en 5.107.1).

Cambios respecto a la propuesta: ninguno de fondo. Se precisan tres puntos:

- **Mismo origen en Docker y en desarrollo.** En Docker, nginx (`web`) sirve el build y hace proxy de `/api` a `api`. En desarrollo, el proxy de Vite hace lo mismo. Problema que resuelve: elimina CORS y hace que la cookie funcione igual en ambos entornos.
- **Hash de contraseñas con `crypto.scrypt` de Node** (stdlib) en lugar de bcrypt/argon2. Problema que resuelve: sin módulos nativos que compilar en la imagen Docker y sin dependencia adicional; scrypt es un KDF aceptado para contraseñas.
- **Upsert en SQL explícito** (`INSERT … ON CONFLICT … DO UPDATE`) para el voto, en vez de leer-y-luego-escribir. Problema que resuelve: la concurrencia la decide la base de datos en una sola sentencia.

### 3.2 Estructura prevista

```
valorant-community/
├─ apps/
│  ├─ api/                    NestJS
│  │  ├─ prisma/              schema.prisma + migraciones
│  │  ├─ src/
│  │  │  ├─ auth/             registro, login, logout, me, guard de sesión, guard de origen
│  │  │  ├─ catalog/          cliente de Valorant API, caché, validación de ids
│  │  │  ├─ votes/            emitir/cambiar voto, resultados agregados
│  │  │  ├─ prisma/           PrismaService
│  │  │  └─ main.ts
│  │  ├─ test/                e2e (Jest + supertest contra Postgres)
│  │  └─ Dockerfile
│  └─ web/                    React + Vite
│     ├─ src/
│     │  ├─ api/              cliente fetch + tipos del contrato
│     │  ├─ features/auth/    páginas de acceso, sesión actual
│     │  ├─ features/maps/    exploración
│     │  ├─ features/map-detail/  selección, voto actual, resultados
│     │  ├─ styles/           tokens.css, base.css
│     │  └─ main.tsx
│     ├─ nginx.conf
│     └─ Dockerfile
├─ docs/                      ARCHITECTURE.md, AI.md, capturas de revisión
├─ docker-compose.yml
├─ .env.example
├─ pnpm-workspace.yaml
├─ PLAN.md
└─ README.md
```

Backend por responsabilidades (auth / catalog / votes), frontend por funcionalidades (auth / maps / map-detail).

### 3.3 Modelo de datos

```prisma
enum Category { AGENT WEAPON }

model User {
  id           String   @id @default(uuid())
  email        String   @unique        // normalizado a minúsculas
  passwordHash String                  // scrypt: salt + hash
  createdAt    DateTime @default(now())
  votes        Vote[]
}

model Vote {
  id        String   @id @default(uuid())
  userId    String
  mapId     String                     // uuid de Valorant API
  category  Category
  optionId  String                     // uuid de agente o arma
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, mapId, category])  // la regla de negocio
  @@index([mapId, category, optionId]) // la agregación
}
```

**Evaluación de la restricción única `(userId, mapId, category)`:** es la decisión correcta y se adopta.

- Un voto es una *fila que se sobrescribe*, no un evento que se acumula. Votar dos veces por Sage escribe dos veces la misma fila; cambiar a Omen actualiza `optionId`. No hay «voto anterior» que restar.
- La garantía no depende del código de la aplicación: aunque dos peticiones lleguen a la vez, Postgres solo admite una fila.
- La categoría forma parte de la clave, así que el arma queda intacta al cambiar el agente; `mapId` también, así que los demás mapas no se tocan.
- Los resultados son un `GROUP BY optionId` sobre votos reales; no hay contadores desnormalizados que puedan desincronizarse. Límite conocido: con millones de votos convendría cachear o materializar; para esta prueba el índice basta.
- No se guardan en la base de datos mapas, agentes ni armas: son datos de otro, cambian con cada parche y bastan sus uuid. La integridad de esos identificadores se valida contra el catálogo en el momento de votar (§3.6).

### 3.4 Autenticación y protección de escrituras

- **Sesión:** JWT firmado (`@nestjs/jwt`, caducidad 7 días) dentro de una cookie `vc_session` con `HttpOnly`, `SameSite=Lax`, `Path=/`, y `Secure` controlado por la variable `COOKIE_SECURE` (falso en `http://localhost`, verdadero tras HTTPS). Sin tabla de sesiones: cerrar sesión borra la cookie. Límite conocido: no hay revocación en servidor; aceptable para la prueba y documentado.
- **CSRF (protección de escrituras):** tres capas baratas:
  1. `SameSite=Lax`: el navegador no envía la cookie en `POST/PUT` iniciados desde otro sitio.
  2. Guard global en métodos no seguros que rechaza (403) si la cabecera `Origin` existe y no coincide con `APP_ORIGIN`.
  3. La API solo acepta `application/json` en escrituras, lo que impide formularios HTML simples entre sitios.
  No se añade token CSRF: con mismo origen y estas tres capas no resuelve un problema adicional aquí.
- **Validación de entrada:** `ValidationPipe` global con `whitelist` y DTOs (`class-validator`): email válido, contraseña de 8 a 72 caracteres, `optionId` uuid, `category` ∈ {agent, weapon}.
- **Errores de auth:** registro con email existente → 409 con mensaje para el campo email; login incorrecto → 401 con mensaje genérico («Email o contraseña incorrectos»), sin revelar cuál falla.
- **Límite de intentos:** fuera de alcance (se documenta como no implementado).
- **Cómo probarlo desde Docker (pendiente):** con la pila levantada, `curl -i -c jar.txt` contra `/api/auth/register` para ver `Set-Cookie` con `HttpOnly; SameSite=Lax`; `curl -b jar.txt` contra `/api/auth/me` → 200; `PUT` de voto sin cookie → 401; `PUT` con cookie y `-H "Origin: http://evil.test"` → 403; y el recorrido en navegador sobre `http://localhost:8080` comprobando en DevTools que la cookie no es accesible desde `document.cookie`.

### 3.5 Contrato de API (se congela en H1; lo consumen los agentes de api y web)

Prefijo `/api`. Errores siempre como `{ "statusCode", "message", "fields"?: { campo: mensaje } }`.

| Método y ruta | Auth | Cuerpo | Respuesta |
|---|---|---|---|
| `GET /health` | — | — | `{ status: "ok" }` |
| `POST /auth/register` | — | `{ email, password }` | 201 `{ id, email }` + cookie · 409 email en uso · 400 validación |
| `POST /auth/login` | — | `{ email, password }` | 200 `{ id, email }` + cookie · 401 |
| `POST /auth/logout` | — | — | 204, borra cookie |
| `GET /auth/me` | cookie | — | 200 `{ id, email }` · 401 |
| `GET /catalog` | — | — | 200 `Catalog` · 503 si no hay catálogo disponible |
| `GET /maps/:mapId/results` | opcional | — | 200 `MapResults` · 404 mapa desconocido |
| `PUT /maps/:mapId/votes/:category` | cookie | `{ optionId }` | 200 `MapResults` (ya actualizado) · 401 · 404 mapa · 422 opción inválida · 503 catálogo no disponible |

```ts
type Catalog = {
  maps:    { id: string; name: string; sites: string; coordinates: string; image: string; thumb: string }[];
  agents:  { id: string; name: string; role: string; icon: string; portrait: string }[];
  weapons: { id: string; name: string; category: string; icon: string }[];
};

type CategoryResults = { total: number; counts: { optionId: string; count: number }[] }; // solo opciones con votos, orden descendente
type MapResults = {
  mapId: string;
  agent: CategoryResults;
  weapon: CategoryResults;
  myVotes: { agent: string | null; weapon: string | null } | null; // null = sin sesión
};
```

Decisiones del contrato:

- `PUT` porque la operación es idempotente por definición: «mi elección en este mapa y categoría es X».
- El `PUT` devuelve los resultados ya recalculados: la interfaz anima desde el estado anterior al confirmado por el servidor sin una segunda petición.
- Un solo `GET /catalog` (13 mapas + 30 agentes + 20 armas, unos pocos KB una vez recortados los campos) en lugar de tres endpoints: el front lo cachea una vez y resuelve nombres e imágenes en local.
- Los porcentajes los calcula el front a partir de `count/total`; el servidor entrega enteros.

### 3.6 Integración con Valorant API

Hechos **verificados en esta sesión** con peticiones reales:

- Sin API key. Envoltorio `{ status, data }`. `?language=es-ES` funciona (devuelve p. ej. «Rifles de asalto»).
- `/v1/maps`: 27 entradas; no existe campo «competitivo». Las 13 con `tacticalDescription` no nulo son exactamente los mapas estándar (Ascent, Split, Fracture, Bind, Breeze, Abyss, Lotus, Sunset, Pearl, Summit, Icebox, Corrode, Haven). «The Range» aparece duplicado con dos uuid.
- `/v1/agents`: 31 entradas, 30 con `isPlayableCharacter = true` (hay un KAY/O no jugable duplicado) → usar siempre `?isPlayableCharacter=true`.
- `/v1/weapons`: 21 armas; la respuesta pesa ~3,6 MB porque incluye todas las skins → **el backend debe recortarla**, nunca reenviarla. «Cuerpo a cuerpo» tiene `shopData = null`.
- Uuid desconocido → 404 `{"status":404,"error":"the requested uuid was not found"}`.
- No verificado: límites de uso (la documentación `dash.valorant-api.com` no resolvió por DNS). Se asume uso moderado y se cachea.

Diseño:

- `CatalogService` descarga las tres colecciones, **filtra y recorta** a la forma `Catalog` de §3.5 y las guarda en memoria con TTL de 1 h. Timeout de 5 s por petición con `fetch` nativo.
- **Servir obsoleto si falla la actualización:** si la API externa cae y hay catálogo en memoria, se sigue sirviendo. Solo si nunca se llegó a cargar se responde 503.
- **Validación de identificadores:** al votar, `mapId` debe estar en `catalog.maps` (si no, 404) y `optionId` en `catalog.agents` o `catalog.weapons` según `category` (si no, 422). Así es imposible votar un arma como agente, un mapa no competitivo o un uuid inventado. La validación usa el catálogo en caché, no una llamada externa por voto.
- **Qué necesita la interfaz** (y nada más): mapa → nombre, sitios, coordenadas, imagen grande (`splash`), miniatura (`listViewIcon`); agente → nombre, rol, `displayIcon`, `fullPortrait`; arma → nombre, categoría de tienda en español, `displayIcon`.
  - **Cambiado en H6 (audit):** agente `icon` = `killfeedPortrait` (256×128, ~28 KB) y `portrait` = `displayIcon`; `fullPortrait` ya no se usa. La categoría de arma es una etiqueta propia por categoría de tienda, porque `categoryText` en español separaba a Warden del resto de rifles.
- Las imágenes se enlazan directamente a `media.valorant-api.com` (no se copian al repositorio; el arte es de Riot).
- **Qué ve el usuario si el servicio externo falla:**
  - Sin catálogo (503): pantalla de exploración con mensaje «No pudimos cargar los mapas de VALORANT. El servicio de datos del juego no responde.» y botón **Reintentar**. No se muestran tarjetas vacías ni datos inventados.
  - Imagen individual que no carga: se mantiene el bloque con color de superficie y el nombre en texto; la opción sigue siendo seleccionable.
  - Los resultados (`/maps/:id/results`) dependen solo de nuestra base de datos; lo único que requiere catálogo es poner nombre e imagen a cada uuid.

### 3.7 Frontend

- **React Router** (rutas: `/`, `/mapas/:mapId`, `/acceso`).
- **TanStack Query**: caché del catálogo, estados `pending/success/error` de la mutación de voto y sustitución de los resultados con la respuesta del `PUT`. Justificación concreta: los seis estados de la pantalla de detalle (§6.4) salen casi directos de su modelo; a mano serían varios `useState` por categoría.
- **CSS propio** con custom properties y CSS Modules. Sin Tailwind ni kit de componentes: la identidad visual es el objetivo y los componentes son pocos.
- Sin librería de animación (§7).
- Fuentes autoalojadas (`@fontsource`) para que el arranque en Docker no dependa de Google Fonts.

### 3.8 Docker

- `db`: `postgres:16-alpine`, volumen con nombre, `healthcheck` con `pg_isready`.
- `api`: build multi-etapa; al arrancar ejecuta `prisma migrate deploy` y luego el servidor. Depende de `db` sano.
- `web`: build de Vite servido por `nginx:alpine`, con `try_files` para rutas de SPA y `proxy_pass` de `/api` a `api:3000`. Publica el puerto `8080`.
- Variables en `.env.example`: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`, `JWT_SECRET` (valor de ejemplo evidente, con instrucción de cambiarlo), `APP_ORIGIN=http://localhost:8080`, `COOKIE_SECURE=false`, `WEB_PORT=8080`.
- Riesgo de Windows: finales de línea CRLF en scripts de arranque → `.gitattributes` con `* text=auto eol=lf` desde el primer commit, y arranque del contenedor mediante `CMD` en formato JSON en vez de un script `.sh` cuando sea posible.

---

## 4. Investigación visual

### 4.1 Skills de diseño: qué se consultó y qué se ejecutó

| Skill | Estado | Qué se hizo en esta sesión | Decisión del proyecto a la que ayudó |
|---|---|---|---|
| **Impeccable** (Paul Bakaus) | **No instalada** (búsqueda en `~/.claude` sin resultados; no figura entre las skills disponibles) | **Consultada, no ejecutada.** Se leyó en GitHub el README, `skill/SKILL.src.md` y `skill/reference/craft-floor.md`. `impeccable.style` no resolvió por DNS. | Su lista de «tells» definió las prohibiciones concretas de §5.3 y los umbrales de verificación (contraste 4.5:1, medida de 65–75ch, «un momento de movimiento con autoría»). |
| **frontend-design** (Anthropic) | Instalada | **Ejecutada** (cargada en esta sesión) como guía de dirección. | Obligó a elegir una dirección única y extrema («tablero táctico») y a descartar tipografías genéricas antes de definir la paleta. |
| Skill complementaria | No se añade | — | Impeccable ya cubre composición, tipografía y movimiento (`layout`, `typeset`, `animate`); una tercera skill solo duplicaría criterio. |

**Uso de Impeccable previsto en la implementación (formas verificadas en su README, pendientes de ejecutar):**

**Resultado real de la instalación (H1):** `npx impeccable install --providers=claude --scope=project --no-hooks` falló porque descarga desde `impeccable.style`, que no resuelve por DNS en esta máquina; no instaló nada. Se aplicó la alternativa documentada en su README: copia manual de `.claude/skills/impeccable` desde GitHub (commit `b49177d`, skill 4.10.0), sin su `.claude/settings.json` (que contiene los hooks) y sin los subagentes del modo `live`. `impeccable telemetry status` confirma la telemetría desactivada por `.impeccable/config.json`; `impeccable doctor` no detecta problemas. El motor se descarga de las releases de GitHub y se verifica contra los checksums incluidos.

Decisiones tomadas sobre la instalación (aplicadas en H1, en un commit propio):

- **Alcance:** solo Claude Code y solo este proyecto. Comando previsto: `npx impeccable install --providers=claude --scope=project` desde la raíz.
- **Hook automático: rechazado.** Si el instalador lo ofrece, se responde que no. No está verificado que exista una opción de línea de comandos para omitirlo; si la instalación no interactiva lo activara, se retira antes del commit y se comprueba que `.claude/settings.json` no contiene hooks de Impeccable.
- **Telemetría: desactivada en la configuración del proyecto**, con `"telemetry": false` en `.impeccable/config.json` (versionado). Se comprueba el archivo antes del primer uso.
- **No se usará el modo `live`** (puede invocar `claude` con permisos omitidos).

Uso:

- Preparación: `/impeccable init` (genera `PRODUCT.md`; se alimentará con §5 de este plan).
- **Revisión manual** cuando funcione la pantalla de detalle (H6): `/impeccable critique` y `/impeccable audit`, ejecutados a mano sobre **el flujo de votar y cambiar el voto**, en **escritorio y móvil** (cuatro pasadas). Nada automático.
- Opcional, si sobra tiempo: `/impeccable polish` como cierre.
- No verificado: si `critique` acepta capturas locales como entrada. Plan alternativo: apuntarlo a la app en ejecución y adjuntar las capturas en la conversación.

### 4.2 Referencias

Honestidad sobre el método: no se dispuso de navegador con renderizado. «Observado» significa aquí que se descargó el HTML/CSS o la imagen y se inspeccionó directamente. Varias referencias previstas no fueron accesibles; se listan aparte y **no se les atribuye ningún detalle visual**.

**Observadas**

| # | Referencia | Cómo se observó | Detalle observado | Dónde se adapta | Para qué sirve |
|---|---|---|---|---|---|
| 1 | Página oficial de mapas — <https://playvalorant.com/es-mx/maps/> | HTML y CSS descargados (sin render) | Cada mapa es un bloque con el **nombre en mayúsculas**, un párrafo descriptivo y una galería numerada de capturas apaisadas (recursos de 915×515, ≈16:9). Pila tipográfica de títulos: `Tungsten-Bold` con `Oswald` y `Anton` como alternativas. Colores más repetidos: `#0f1923`, `#ff4655`, `#ece8e1`. | Exploración y cabecera del detalle | Fija la paleta y la voz tipográfica con datos reales, y el encuadre 16:9 con el nombre como rótulo. |
| 2 | Página oficial de agentes — <https://playvalorant.com/es-mx/agents/> | Solo marcado parcial (las imágenes llegaban como marcadores vacíos) | Estructura: título «AGENTES» y 30 entradas de **imagen + nombre + enlace**, sin texto adicional por agente. No se pudo ver el tratamiento del retrato. | Selector de agentes | Confirma que la unidad mínima reconocible es retrato + nombre; el selector no necesita descripción ni estadísticas. |
| 3 | Arte del catálogo — <https://valorant-api.com/> (imágenes de `media.valorant-api.com`) | **Imágenes descargadas y vistas** (Ascent, Sova, Odin) | Mapa: `listViewIconTall` es una vista aérea 1920×1080 con el motivo principal centrado (la torre de Ascent) y bordes brumosos; `listViewIcon` es una franja 456×100 del mismo arte. Agente: `displayIcon` es un rostro 1024×1024 sobre **fondo transparente** que llena el encuadre; `fullPortrait` es cuerpo entero con mucho aire alrededor y manchas de color planas detrás. Arma: `displayIcon` es una **silueta clara, apaisada (≈4:1)**, sin fondo. | Las tres pantallas | Decide los encuadres de §5.4: el mapa admite recorte central; el rostro funciona en casillas cuadradas pequeñas; el arma necesita una fila ancha, no una casilla cuadrada. |
| 4 | Selector de campeones — <https://www.leagueoflegends.com/en-us/champions/> | Solo marcado parcial | Rejilla de ~170 entradas de imagen + nombre + enlace, encabezada por un título y una línea de introducción. No se observaron filtros ni estados de selección. | Selector de agentes | Respalda una rejilla densa de retratos como patrón de «elegir personaje»; el estado de selección es diseño propio. |

**Revisadas por mí en el navegador** (la sesión de IA no pudo abrirlas: DNS o dominio bloqueado; la decisión de qué adaptar de cada una es mía)

| # | Referencia | Qué se adapta | Dónde | Para qué sirve |
|---|---|---|---|---|
| 5 | Identidad VCT — <https://valorantesports.com/> | La forma de **destacar la selección activa** | Casilla elegida en los selectores y fila «tu voto» en la clasificación | Que la elección actual se distinga de un vistazo del resto de opciones. |
| 6 | Resultados electorales, BBC — <https://www.bbc.com/news/election/2024/uk/results> | Comparación con **barras horizontales, recuento y porcentaje visibles** | Clasificación de la comunidad | Confirma el diseño de resultados de §5.5, que se mantiene sin cambios, con **un total independiente para agentes y otro para armas**. |
| 7 | Ficha deportiva — <https://www.premierleague.com/players> | La presentación de **retrato, nombre y rol** | Bloque «Tu voto» de agente | Componer la elección como una ficha: imagen, nombre en grande y rol debajo. |

No utilizadas: The Guardian (la referencia electoral revisada fue la BBC) y la guía de marca de Riot (la URL probada redirigía a una página ajena; la paleta ya se obtuvo del CSS de la referencia 1).

Al implementar, el Agente Web no debe inventar detalles de las referencias 5–7: si necesita concretar el tratamiento (por ejemplo, cómo es exactamente el realce de VCT), me lo pregunta o le paso una captura.

---

## 5. Dirección de diseño

### 5.1 Concepto: «tablero táctico»

La pantalla se comporta como el panel previo a una partida: un fondo oscuro y plano, rótulos condensados en mayúsculas, datos alineados con precisión y **un solo color de acento que significa siempre lo mismo: tu elección**. El arte del mapa es la única imagen grande; todo lo demás cede.

Lo que debe recordarse: al entrar en un mapa, el nombre enorme sobre su vista aérea y, debajo, tu agente y tu arma marcados en rojo dentro de la clasificación de la comunidad.

### 5.2 Paleta (cada color tiene una función; no hay más)

| Token | Valor | Función |
|---|---|---|
| `--surface-0` | `#0f1923` | Fondo de página (azul-negro oficial, observado en ref. 1) |
| `--surface-1` | `#1a2632` | Paneles y filas |
| `--surface-2` | `#263443` | Hover, pista de las barras |
| `--text` | `#ece8e1` | Texto principal (blanco hueso oficial) |
| `--text-muted` | `#9aa7b2` | Texto secundario (tintado del tono de la superficie, no gris neutro) |
| `--accent` | `#ff4655` | **Solo** elección confirmada y acción principal |
| `--focus` | `#ece8e1` | Anillo de foco de 2 px con separación de 2 px |
| `--error` | `#ffb224` | Errores, siempre con icono y texto |

- El error es ámbar y no rojo a propósito: el rojo ya significa «tu voto», y un error rojo junto a una selección roja sería ambiguo.
- Pendiente en H4: medir contrastes reales (objetivo ≥ 4.5:1 en texto, ≥ 3:1 en texto grande y bordes de control). `--text-muted` y `--accent` sobre `--surface-1` son los pares a vigilar.
- Sin degradados decorativos. El único degradado permitido es el velo oscuro bajo el nombre del mapa, cuya función es la legibilidad del rótulo.

### 5.3 Tipografía y prohibiciones

- **Títulos: Anton** (mayúsculas, condensada). Es una de las alternativas que la propia web oficial declara para Tungsten (ref. 1); Tungsten es de pago y no se usa.
- **Texto, formularios y resultados: IBM Plex Sans**, con `font-variant-numeric: tabular-nums` en los recuentos para que las cifras se alineen en columna.
- Escala corta: rótulo de mapa (fluido, hasta ~6rem), título de sección, cuerpo, pequeño.

Prohibido en este proyecto (derivado de la lista de Impeccable y del encargo): eslóganes de relleno, insignias decorativas, cifras inventadas (no hay «jugadores activos» ni «tendencias»), texto con degradado, tarjetas anidadas, tarjetas con borde lateral de color, emojis como iconos, sombras difusas bajo bordes de 1 px, rejillas de tarjetas idénticas de icono + título + texto, cejas («eyebrows») sobre los títulos y la misma animación de entrada en todas las secciones.

### 5.4 Uso y encuadre de imágenes

| Elemento | Recurso | Escritorio | Móvil |
|---|---|---|---|
| Mapa en exploración | `splash` (pendiente comprobar peso y proporción en H3; alternativa `listViewIconTall`, 1920×1080 pero ~2 MB) | Bloque 16:9, `object-fit: cover` centrado; nombre en Anton abajo a la izquierda sobre velo oscuro | Franja 3:1 a ancho completo con recorte central (el motivo del arte está centrado); nombre superpuesto |
| Mapa en cabecera de detalle | Misma imagen | Banda de ~280 px de alto a ancho completo, recorte central; rótulo grande + sitios y coordenadas en pequeño | Banda de ~160 px; solo rótulo |
| Agente en selector | `displayIcon` (rostro, fondo transparente) | Casilla cuadrada de ~72 px sobre `--surface-1`, nombre debajo | Casilla de ~56 px; 5 por fila |
| Agente elegido («tu voto») | `displayIcon` (cambiado en H6: `fullPortrait` dejaba el cuerpo entero diminuto) | Rostro recortado a 120×160, cabeza y hombros | Resumen fijo con el rostro ligero a 40 px |
| Arma | `displayIcon` (silueta apaisada) | Fila ancha: silueta a la izquierda (~120×32, `object-fit: contain`), nombre y categoría | Igual, silueta de ~88 px |

- Imágenes con `loading="lazy"`, dimensiones reservadas (sin saltos de maquetación) y `alt` con el nombre.
- Riesgo: peso de las imágenes de mapa (PNG de hasta ~2 MB). Mitigación: en la rejilla móvil usar la franja `listViewIcon` (65 KB) y reservar la imagen grande para escritorio y detalle. No se monta un proxy de imágenes.

### 5.5 Las tres vistas

**1. Acceso (`/acceso`)**

- Una sola página con dos modos (Iniciar sesión / Crear cuenta) y un formulario estrecho alineado a la izquierda sobre fondo plano; sin imagen decorativa ni panel lateral.
- Campos con `<label>` visible, `autocomplete` correcto (`email`, `current-password` / `new-password`), requisito de contraseña visible antes de escribir.
- Errores **junto al campo**, enlazados con `aria-describedby`; el error general de login va sobre el botón. Tras un error, el foco pasa al primer campo inválido.
- **Retorno:** si se llega desde una votación, la URL lleva `?volver=/mapas/<id>` (solo rutas internas que empiecen por `/`, para no crear una redirección abierta); al autenticarse se vuelve allí. El título lo refleja: «Inicia sesión para votar en Ascent».

**2. Exploración (`/`)**

- Los 13 mapas como bloques de imagen grandes con el nombre encima. Escritorio: rejilla de 2 columnas, **el primero a ancho completo** para romper la rejilla uniforme; el orden es alfabético y estable. Móvil: una columna de franjas.
- Cada bloque es un único `<a>` (toda la superficie es clicable, un solo punto de tabulación), dentro de una lista `<ul>` con encabezado. Orden de tabulación = orden visual.
- Si el usuario tiene sesión y ya votó en un mapa, el bloque muestra en texto pequeño «Tu voto: Sage · Vandal». Es información real, no una insignia. (Recortable: requiere un endpoint o campo extra; ver §8.)

**3. Detalle del mapa (`/mapas/:mapId`)** — pantalla principal

Las tres preguntas y dónde se responden:

- *¿En qué mapa estoy?* → banda superior con el arte y el rótulo.
- *¿Por quién voté?* → bloque «Tu voto» al inicio de cada categoría, y la fila correspondiente marcada en rojo en los resultados.
- *¿Qué prefiere la comunidad?* → clasificación con barras a escala común, justo debajo.

Escritorio (≥ 960 px):

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ← Mapas                                              ana@correo · Salir   │
├───────────────────────────────────────────────────────────────────────────┤
│ ░░░░░░░░░░░░░░░░░ arte del mapa (recorte central) ░░░░░░░░░░░░░░░░░░░░░░░ │
│ ASCENT                                                                    │
│ Sites A/B · 45°26' N 12°20' E                                             │
├─────────────────────────────────────┬─────────────────────────────────────┤
│ AGENTE                              │ ARMA                                │
│ ┌────────┐ Tu voto                  │ Tu voto                             │
│ │ busto  │ SAGE · Centinela         │ ▬▬▬═══▬▬  VANDAL · Rifles de asalto │
│ └────────┘ ✓ Guardado               │ ✓ Guardado                          │
│                                     │                                     │
│ La comunidad · 128 votos            │ La comunidad · 117 votos            │
│ ● Sage   ██████████░░░░░  41 · 32 % │ ● Vandal  ███████████░░░ 52 · 44 %  │
│   Omen   ███████░░░░░░░░  29 · 23 % │   Phantom █████████░░░░░ 40 · 34 %  │
│   Jett   █████░░░░░░░░░░  20 · 16 % │   Operator ███░░░░░░░░░░ 12 · 10 %  │
│   Ver los 9 restantes ▾             │   Ver las 5 restantes ▾             │
│                                     │                                     │
│ Elige agente                        │ Elige arma                          │
│ [☺][☺][☺][☺][☺][☺]                  │ ( ) ▬▬═▬ Vandal   Rifles de asalto  │
│ [☺][☻][☺][☺][☺][☺]  ← rejilla 6×5   │ ( ) ▬▬═▬ Phantom  Rifles de asalto  │
│ [☺][☺][☺][☺][☺][☺]                  │ ( ) ▬═▬  Spectre  Subfusiles  …     │
└─────────────────────────────────────┴─────────────────────────────────────┘
```

Móvil (< 960 px):

```
┌─────────────────────────────┐
│ ← Mapas             Salir   │
│ ░░░ arte del mapa ░░░░░░░░░ │
│ ASCENT                      │
├─────────────────────────────┤
│ Tu voto                     │  ← resumen fijo al hacer scroll
│ ☻ Sage   ·   ▬═▬ Vandal     │
├─────────────────────────────┤
│ [  AGENTE  ] [   ARMA   ]   │  ← pestañas (una categoría visible)
├─────────────────────────────┤
│ La comunidad · 128 votos    │
│ ● Sage                      │
│ ██████████░░░░░   41 · 32 % │  ← nombre arriba, barra debajo
│   Omen                      │
│ ███████░░░░░░░░   29 · 23 % │
│   Ver los 9 restantes ▾     │
├─────────────────────────────┤
│ Elige agente                │
│ [☺][☺][☺][☺][☺]             │
│ [☺][☻][☺][☺][☺]  5 por fila │
└─────────────────────────────┘
```

Reglas de la clasificación (comparación honesta):

- **Escala común:** el ancho de cada barra es `count / total` de la categoría, sobre una pista del 100 %. No se normaliza al máximo: así un líder con el 32 % se ve como un tercio, no como una barra llena.
- Nombre a la izquierda, barra en medio, **recuento y porcentaje alineados a la derecha** con cifras tabulares. Porcentajes enteros.
- Solo aparecen opciones con al menos un voto, ordenadas de mayor a menor; empates por orden alfabético. Se muestran 5 y el resto se despliega.
- Tu opción lleva marca de punto + texto «tu voto» y barra en `--accent`; las demás barras, en `--text-muted`. El color nunca es la única señal.
- Para lectores de pantalla, la clasificación es una lista con texto completo por elemento («Sage, 41 votos, 32 por ciento, tu voto»).

Selectores:

- Agentes: `radiogroup` de 30 casillas con rostro y nombre; flechas para moverse, Espacio/Enter para elegir. Armas: `radiogroup` en filas agrupadas por categoría de tienda.
- Elegir una opción **envía el voto directamente** (sin botón «Confirmar»): es reversible y barato; un paso extra no protege de nada.

### 5.6 Estados de la pantalla de detalle

| Estado | Qué se ve |
|---|---|
| **Carga** | La banda del mapa aparece en cuanto hay catálogo (suele estar en caché desde la exploración). En las dos columnas, bloques de esqueleto con las dimensiones finales; sin spinner a pantalla completa. |
| **Mapa sin votos** | En lugar de barras vacías: «Aún no hay votos en Ascent. El primero puede ser el tuyo.» El selector queda justo debajo. No se dibujan barras al 0 %. |
| **Visitante sin sesión** | Los resultados se ven completos. El bloque «Tu voto» dice «Inicia sesión para votar» con un enlace a `/acceso?volver=/mapas/<id>`. Los selectores se muestran pero al pulsar una opción llevan a ese mismo acceso (no se deshabilitan en silencio). |
| **Voto en curso** | La casilla elegida se marca **al instante** con contorno discontinuo en `--text` y el texto «Guardando…» junto a «Tu voto». Las barras **no cambian todavía**. La elección confirmada anterior sigue visible con su marca roja. El selector de esa categoría queda en `aria-busy`, ignorando nuevas pulsaciones hasta la respuesta. |
| **Voto confirmado** | La casilla pasa a contorno sólido rojo, «✓ Guardado», el bloque «Tu voto» cambia y las barras se animan del resultado anterior al nuevo (§7). Una región `aria-live="polite"` anuncia «Voto guardado: Omen». El foco permanece en la casilla elegida. |
| **Error al guardar** | La marca pendiente se retira y la selección vuelve a la última confirmada. Junto al selector, en ámbar con icono: «No se pudo guardar tu voto por Omen. **Tu voto registrado sigue siendo Sage.**» y un botón **Reintentar** que repite el mismo envío. Si antes no había voto: «Todavía no tienes voto registrado en esta categoría.» Los resultados no se tocan. Si el error es 401 (sesión caducada), el mensaje ofrece iniciar sesión conservando el retorno. |

La interfaz no es optimista con los números: la selección se refleja al instante, pero los recuentos solo cambian con la respuesta del servidor. Así nunca se muestra un resultado que no existe.

---

## 6. Accesibilidad mínima comprometida

- Todo operable con teclado; foco siempre visible (`:focus-visible` con `--focus`), igual de claro que el hover.
- Estructura semántica: un `h1` por vista, `nav`, `main`, listas reales, `radiogroup` con nombre accesible.
- El estado nunca depende solo del color (icono o texto siempre presentes).
- `prefers-reduced-motion` respetado en todas las animaciones (§7).
- Objetivos táctiles ≥ 44 px en móvil. Sin scroll horizontal a 360 px.

---

## 7. Animaciones y transiciones

Todo con CSS (transiciones sobre `transform`, `opacity` y `width`/`scaleX`). **Ninguna librería de animación.** La única API adicional es la nativa View Transitions, como mejora progresiva y recortable. Curva común: ease-out exponencial, `cubic-bezier(0.16, 1, 0.3, 1)`.

| # | Interacción | Elemento que cambia | Duración | Con `prefers-reduced-motion` | Prioridad |
|---|---|---|---|---|---|
| 1 | Elegir agente o arma | La casilla: contorno discontinuo (pendiente) → sólido rojo (confirmada); texto «Guardando…» → «✓ Guardado» | 120 ms al marcar; 180 ms al confirmar | Cambio inmediato de contorno y texto; el texto de estado ya comunica lo mismo | **Imprescindible** |
| 2 | Servidor confirma un cambio de voto | Barras: ancho del valor anterior al nuevo; la fila que sube o baja se reordena **después** de terminar el ancho; recuento cambia al final | 450 ms (ancho) + 200 ms (reordenación) | Barras y orden saltan al valor final; el anuncio `aria-live` y la marca «tu voto» indican qué cambió | **Imprescindible** |
| 3 | Hover o foco en un mapa (exploración) | Imagen escala a 1.04 dentro de su marco; aparece «Entrar →» junto al nombre; con foco, además, anillo | 200 ms | Sin escala; «Entrar →» y el anillo aparecen al instante | Deseable |
| 4 | Error al guardar | Aparece el mensaje junto al selector (opacidad + 4 px de desplazamiento) | 150 ms | Aparición inmediata | Deseable (el mensaje es obligatorio; su animación no) |
| 5 | Abrir el detalle desde un mapa | La imagen del bloque se transforma en la banda de cabecera (`view-transition-name` compartido) | ~300 ms | Navegación instantánea (también en navegadores sin la API) | **Primera en recortarse** |

Detalles para que el cambio se entienda:

- Las barras se animan con `transform: scaleX()` sobre un ancho fijo cuando sea posible, para no provocar reflujo.
- Los recuentos no hacen cuenta progresiva: cambian de una vez al final, para que sigan siendo legibles.
- El foco no se mueve durante la reordenación.
- No hay animación de entrada de página ni efectos al hacer scroll.

Si el tiempo solo permite pulir dos: **1 y 2**.

---

## 8. Roadmap

Estimación total: **≈ 8 h 45 min** de trabajo, más márgenes. Con dos carriles de agentes en paralelo (§9), H2–H3 y H4 se solapan y el tiempo de reloj baja a ≈ 6 h 30 min. La reserva para H7 **no se toca**.

Leyenda: **[I]** imprescindible · **[R]** recortable (en orden de recorte en §8.9).

### H0 — Preparación (15 min) · sin dependencias
- **Resultado:** repositorio Git con `PLAN.md` como primer commit.
- **Tareas:** `git init`; `.gitignore`, `.gitattributes` (LF); primer commit. (Referencias visuales ya revisadas e instalación de Impeccable ya decidida: §4.)
- **Verificación (pendiente):** `git log` muestra el commit; `git status` limpio.

### H1 — Esqueleto integrado y contrato (1 h 15 min) · depende de H0
- **Resultado:** `docker compose up --build` levanta db + api + web; la página muestra «API: ok · BD: ok» leyendo `/api/health` a través de nginx.
- **Tareas [I]:** workspace pnpm; `apps/api` (Nest) con `/api/health` que hace `SELECT 1`; Prisma con el esquema de §3.3 y primera migración; `apps/web` (Vite + React + TS) con proxy `/api`; Dockerfiles, `docker-compose.yml`, `nginx.conf`, `.env.example`; tipos del contrato de §3.5 en `apps/web/src/api/types.ts`; tokens de diseño (`tokens.css`) y fuentes; instalar Impeccable según §4.1 (solo Claude Code, alcance de proyecto, sin hook, telemetría desactivada) en un commit propio.
- **Verificación (pendiente):** arranque desde cero con Docker; `curl http://localhost:8080/api/health` → 200; las tablas existen en Postgres; `.impeccable/config.json` contiene `"telemetry": false` y `.claude/settings.json` no tiene hooks de Impeccable.
- **Por qué primero:** front, back, base de datos y Docker quedan conectados antes de escribir funcionalidad; el riesgo de integración se paga al principio.

### H2 — Autenticación (1 h 15 min) · depende de H1
- **Resultado:** registrarse, iniciar sesión, ver el email en la cabecera, cerrar sesión; la sesión sobrevive a recargar.
- **Tareas [I]:** `AuthModule` (register, login, logout, me), hash scrypt, cookie, guard de sesión, guard de origen, `ValidationPipe`; página `/acceso` con errores por campo y retorno `?volver=`.
- **Verificación (pendiente), e2e:** registro válido → 201 + `Set-Cookie` HttpOnly; email duplicado → 409; email mal formado o contraseña corta → 400 con `fields`; login incorrecto → 401; `me` sin cookie → 401; escritura con `Origin` ajeno → 403. Manual: flujo completo en navegador.

### H3 — Catálogo y votos en el backend (1 h 30 min) · depende de H1 (y de H2 para el guard)
- **Resultado:** la API completa de §3.5 funciona y sus reglas están demostradas por pruebas.
- **Tareas [I]:** `CatalogModule` (descarga, filtro, recorte, caché, obsoleto-si-falla); `VotesModule` (upsert `ON CONFLICT`, agregación `GROUP BY`, `myVotes`); validación de ids contra catálogo; comprobar peso y proporción de `splash`.
- **Verificación (pendiente), e2e con Postgres real y catálogo simulado:**
  1. **Voto duplicado:** dos `PUT` Sage/Ascent → Sage = 1, total = 1.
  2. **Concurrencia:** 10 `PUT` idénticos con `Promise.all` → 1 fila, ninguna respuesta 500.
  3. **Cambio de elección:** luego `PUT` Omen → Sage = 0 (ausente), Omen = 1.
  4. **Independencia:** el voto de arma en Ascent y los votos en Bind no cambian tras el paso 3.
  5. **Agregación por mapa:** tres usuarios, dos mapas → recuentos y totales correctos por mapa y categoría; `myVotes` distinto por usuario y `null` sin sesión.
  6. **Identificadores inválidos:** mapa inexistente → 404; mapa no competitivo (The Range) → 404; uuid de arma en categoría agente → 422; `optionId` no uuid → 400; categoría desconocida → 400.
  7. **Sin sesión:** `PUT` → 401; `GET results` → 200.
  8. **Fallo externo:** catálogo sin cargar → `GET /catalog` 503 y `PUT` 503; con caché previa y fallo de actualización → sigue 200.
  9. **Persistencia:** reiniciar el contenedor `api` (y aparte `docker compose restart`) → los resultados siguen ahí.

### H4 — Exploración de mapas (1 h) · depende de H1; puede empezar con datos simulados del contrato
- **Resultado:** la portada muestra los 13 mapas reales con su arte; se navega con teclado y se entra al detalle.
- **Tareas [I]:** cliente de API + TanStack Query; cabecera con sesión; rejilla/lista responsive; estados de carga y de error con reintento. **[R]:** animación 3; «Tu voto: …» en cada bloque.
- **Verificación (pendiente):** 1280 px y 375 px sin scroll horizontal; Tab recorre los mapas en orden y Enter entra; con la API detenida aparece el mensaje con Reintentar.

### H5 — Detalle del mapa (2 h) · depende de H2, H3, H4
- **Resultado:** el recorrido completo de §2 funciona en el navegador.
- **Tareas [I]:** cabecera del mapa; bloque «Tu voto»; clasificación con barras; selectores (`radiogroup`); mutación con los seis estados de §5.6; pestañas y resumen fijo en móvil; animaciones 1 y 2. **[R]:** animación 4, «Ver los restantes», animación 5.
- **Verificación (pendiente):** criterio de aceptación a mano (Sage dos veces → 1; cambio a Omen → se mueve; arma intacta; recargar conserva); forzar error (detener `api`) y comprobar mensaje, elección conservada y reintento; visitante ve resultados y es llevado a acceso con retorno al mapa; mapa sin votos muestra el texto vacío.

### H6 — Revisión de calidad y diseño (1 h) · depende de H5
- **Resultado:** lista de hallazgos con su corrección, registrada en `docs/`.
- **Tareas [I]:** revisión en escritorio (1280) y móvil (375); recorrido completo solo con teclado; emulación de `prefers-reduced-motion`; contrastes; capturas de las tres vistas; **revisión manual con Impeccable** en cuanto funcione la pantalla de detalle: `/impeccable critique` y `/impeccable audit` sobre el flujo de **votar y cambiar el voto**, en **escritorio y móvil**; decidir conmigo qué hallazgos se corrigen; aplicar esas correcciones.
- **Registro de la revisión con Impeccable.** Solo hallazgos reales devueltos por la herramienta, sin resumir a favor ni completar con suposiciones; si una pasada no devuelve nada, se anota así. Hoy vacío a propósito:

  **Cómo se hizo (20-11-2026).** El flujo con sesión se capturó con Chrome 157 headless controlado por DevTools Protocol (script fuera del repositorio), porque `impeccable shot` no puede iniciar sesión. `critique` se ejecutó con sus dos evaluaciones en subagentes aislados (A: revisión de diseño con su rúbrica; B: detector sobre el código y sobre la URL a 1280×800 y 390×844). `audit` se ejecutó con mediciones en el navegador (bytes descargados, objetivos táctiles, títulos, `alt`, nombres cortados) y cálculo de contrastes. Informes guardados por Impeccable en `.impeccable/critique/` y `.impeccable/audit/` (locales, no versionados).

  **Resultados:** `critique` 29/40 (Good), 0 P0, 2 P1. Detector: 0 hallazgos (solo ve el estado de visitante). `audit` 14/20 (Good), 0 P0, 1 P1.

  | Comando | Dispositivo | Paso del flujo | Hallazgo | Gravedad | Decisión (corregir / descartar y por qué) | Commit |
  |---|---|---|---|---|---|---|
  | critique | Escritorio | Votar | La rejilla queda bajo el pliegue tras un hueco vacío de 210 px; al votar no se ve el estado ni el resultado | P1 | **Corregido:** hueco «Sin voto» con su texto (sin salto al confirmar) y estado junto a «Elige agente/arma», cabecera fija en escritorio | `1055164` |
  | critique | Ambos | Cambiar voto | Durante el cambio se ve el nombre del agente nuevo con el retrato del anterior | P1 | **Corregido:** la imagen se recrea por opción y se precarga al votar; la ficha usa el rostro (cabeza y hombros) | `1055164`, `39b86e4` |
  | critique | Ambos | Ver resultados | Tu opción desaparece de la clasificación si queda 6.ª o más abajo | P2 | **Corregido:** tu fila se muestra siempre, separada del top 5 | `1055164` |
  | critique | Ambos | Cambiar voto | Durante la animación se anuncia «Omen, 2 votos, tu voto», combinación que no existió | P2 | **Corregido:** la marca «tu voto» cambia junto con los recuentos | `1055164` |
  | critique | Escritorio | Tras votar | «Todavía no has votado en este mapa» en Arma después de votar agente | P2 | **Corregido:** texto por categoría («Aún no has votado arma en Ascent.») | `1055164` |
  | critique | Ambos | Elegir arma | Categoría repetida en cada fila y en la cabecera del grupo | P3 | **Corregido** | `1055164` |
  | critique | Ambos | Error al guardar | El aviso desplaza la rejilla; un segundo clic puede votar otra casilla | P2 | **No se corrige** (decisión del autor tras la crítica): el grupo está bloqueado mientras guarda y el aviso aparece solo tras la respuesta | — |
  | critique | Ambos | Visitante → acceso | Al volver del acceso se pierde la casilla elegida | P2 | **No implementado** (documentado): requiere llevar la elección en `?volver=` | — |
  | critique | Ambos | Elegir agente | 30 agentes sin agrupar por rol | P2 | **No implementado** (documentado) | — |
  | critique | — | Banda del mapa | Coordenadas con letras y «Sites A/B» en inglés | P3 | **Descartado:** son datos de Valorant API tal cual | — |
  | (propio) | Escritorio | Ver resultados | «Ver los 0 restantes» cuando la única fila oculta es la tuya (introducido por la corrección anterior) | P2 | **Corregido** antes del commit | `1055164` |
  | audit | Ambos | Cargar el mapa | 12,4 MB de rostros de agentes (30 PNG de 1024 px para 56–72 px); página de 15 MB | P1 | **Corregido:** `killfeedPortrait` (~28 KB) en rejilla y resumen; la página baja a 4,1 MB (escritorio) y 3,5 MB (móvil) | `39b86e4` |
  | audit | Móvil | Elegir agente | Nombres truncados («Brimst…», «Deadlo…») | P2 | **Corregido:** medido 0 nombres cortados a 375 y 360 px | `39b86e4` |
  | audit | Móvil | Cargar el mapa | La banda descarga el arte de 2,2 MB para 160 px | P2 | **Descartado** (límite conocido): la API no ofrece una variante intermedia y la franja ligera se vería borrosa | — |
  | audit | Ambos | Movimiento reducido | Corte global de transiciones en `base.css` | P3 | **Descartado:** verificado que los estados se comunican por texto | — |
  | audit | — | Theming | Velo con `rgb()` literal igual a `--surface-0` | P3 | **Descartado** | — |

- **Verificación (pendiente):** las cuatro pasadas (critique y audit × escritorio y móvil) hechas y registradas; cada hallazgo tiene una decisión; capturas en `docs/capturas/`; ningún hallazgo grave abierto.

### H7 — Arranque limpio y entrega (1 h 15 min, **reservado**) · depende de todo
- **Resultado:** un tercero clona, sigue el README y completa el recorrido; la entrega está enviada.
- **Tareas [I]:**
  - Clon nuevo en otra carpeta, `docker compose down -v` previo, `cp .env.example .env`, `docker compose up --build`, recorrido completo de §2.
  - `README.md`: descripción, requisitos, arranque en tres comandos, variables de entorno, cómo ejecutar las pruebas, decisiones de alcance y **qué no se implementó**.
  - `docs/ARCHITECTURE.md` (una página): estructura, modelo de datos, la restricción única, autenticación y CSRF, integración externa y fallos.
  - `docs/AI.md`: a partir de §11.
  - Revisar que `.env` no está versionado y que `.env.example` no contiene secretos reales; revisar historial (commits por hito, mensajes claros).
  - Entrega: si el repo es **público**, enviar el enlace; si es **privado**, invitar a `german@lucidbot.co` como colaborador y enviar la confirmación. En ambos casos, antes del plazo.
- **Verificación (pendiente):** lista de §10 completa.

### 8.9 Orden de recorte si falta tiempo

1. Animación 5 (continuidad mapa → detalle).
2. «Tu voto: …» en los bloques de exploración.
3. Animaciones 3 y 4 (se conservan los estados, sin transición).
4. Prueba Playwright y filtro por rol (opcionales de §1.3).
5. Busto del agente en «Tu voto» (se usa el icono).
6. «Ver los restantes» (se muestran todas las opciones con votos).
7. Pestañas en móvil (las dos categorías apiladas).

**No se recorta nunca:** la restricción única y sus pruebas, los estados de error al guardar, el foco por teclado, las animaciones 1 y 2 en su versión mínima, y H7.

---

## 9. Ejecución con agentes

La implementación se hará con agentes de Claude Code. Yo dirijo, decido y valido; los agentes ejecutan tareas acotadas. Este plan es su fuente de verdad.

### 9.1 Roles

| Rol | Quién | Responsabilidad | Puede escribir en |
|---|---|---|---|
| **Orquestador** | Sesión principal de Claude Code, conmigo delante | Reparte tareas, integra, ejecuta las verificaciones, hace los commits | Raíz, `docs/`, Docker |
| **Agente API** | Subagente | H2 (backend) y H3 | `apps/api/**` |
| **Agente Web** | Subagente | H2 (página de acceso), H4, H5 | `apps/web/**` |
| **Agente revisor** | Subagente nuevo, sin el contexto de quien implementó | Revisión de código tras H3 y H5; revisión de seguridad de auth | Solo lectura; devuelve hallazgos |
| **Agente de diseño** | Sesión con Impeccable + frontend-design | H6: ejecuta `critique` y `audit` a mano, me presenta los hallazgos y aplica solo las correcciones que decidamos | `apps/web/**` (solo correcciones acordadas) |

### 9.2 Secuencia y paralelismo

```
H0 → H1 (orquestador, secuencial: fija estructura y contrato)
        ├─ Carril A · Agente API:  H2-backend → H3
        └─ Carril B · Agente Web:  tokens y base → H4 (con datos simulados del contrato) → H2-acceso
     ↓ integración (orquestador): se sustituyen los datos simulados por la API real
H5 (Agente Web, con la API ya real) → revisor → H6 → H7 (orquestador y yo)
```

### 9.3 Reglas de trabajo

1. **Contrato antes de paralelizar.** §3.5 se congela al final de H1. Si un agente necesita cambiarlo, se detiene y lo propone; el orquestador actualiza `PLAN.md` y avisa al otro carril. Ningún agente lo cambia por su cuenta.
2. **Propiedad de directorios.** Cada agente escribe solo en su carpeta. Los archivos de la raíz, Docker y el esquema Prisma solo los toca el orquestador (o el Agente API, en el caso de Prisma, avisando).
3. **Encargos autocontenidos.** Cada encargo incluye: hito, secciones de `PLAN.md` que debe leer, archivos que puede tocar, criterio de «hecho» y la verificación que debe ejecutar y pegar.
4. **«Hecho» exige evidencia.** Un agente no declara terminado un hito sin la salida real de sus pruebas o comandos. El orquestador vuelve a ejecutar la verificación antes de aceptar.
5. **Quien revisa no es quien implementa.** El revisor recibe el código y los requisitos, no las conclusiones del implementador.
6. **Yo apruebo cada hito** antes de pasar al siguiente: leo el diff, pruebo en el navegador y pregunto lo que no entienda. Si no puedo explicar una decisión, no se integra.
7. **Un commit (o pocos) por hito**, con mensaje que describa el resultado, hecho por el orquestador tras verificar. Nada de un commit gigante al final.
8. **Sin dependencias fuera de este plan** sin justificarlo ante el orquestador con una interacción o problema concreto.
9. **Registro de IA en vivo.** Al cerrar cada hito, el orquestador añade una fila a §11: qué hizo el agente, qué se corrigió y cómo se validó.

### 9.4 Riesgos del trabajo con agentes

| Riesgo | Mitigación |
|---|---|
| Front y back divergen del contrato | Tipos del contrato en un único archivo; integración temprana al final de H3/H4, no al final del día |
| El agente da por buenas pruebas que no ejecutó | Regla 4: salida real y segunda ejecución por el orquestador |
| Sobreingeniería (capas, abstracciones, librerías extra) | Regla 8 y estructura cerrada de §3.2; el revisor busca también código sobrante |
| Diseño genérico pese al plan | §5 como brief obligatorio del Agente Web; `critique` y `audit` de Impeccable en H6 |
| Entregar código que no entiendo ni sé explicar | Regla 6; `docs/ARCHITECTURE.md` lo redacto a partir de mis propias explicaciones |

---

## 10. Lista de comprobación de entrega

- [x] Clon limpio + `.env` desde el ejemplo + `docker compose up --build --wait` funciona sin pasos ocultos (también con `build --no-cache`, 20-11-2026)
- [x] Recorrido de §2 completo en ese entorno (Chrome headless, base vacía)
- [x] Pruebas e2e de la API en verde: 27/27 (`pnpm test:api`)
- [x] Persistencia tras reiniciar los contenedores y tras recrear la API
- [x] Revisión en escritorio y móvil, teclado y movimiento reducido
- [x] Revisión con Impeccable registrada (tabla de H6)
- [x] `README.md`, `docs/ARCHITECTURE.md`, `docs/AI.md`, `docs/capturas/`
- [x] `.env.example` sin secretos; `.env` ignorado
- [x] Historial Git legible por hitos
- [x] Sección «No implementado» escrita
- [ ] Enlace enviado (público) o invitación a `german@lucidbot.co` + confirmación (privado), antes del sábado 14:00 (hora de Colombia)

---

## 11. Registro de uso de IA (base de `docs/AI.md`)

| Fase | Herramienta | Tarea | Qué acepté | Qué corregí o descarté | Cómo se validó |
|---|---|---|---|---|---|
| Planificación (esta sesión) | Claude Code (modelo Claude Fable 5.2) con subagentes de lectura web | Leer el enunciado, verificar Valorant API, consultar Impeccable, buscar referencias y redactar este plan | Estructura del plan, modelo de datos, contrato de API, dirección visual | *(pendiente: anotar aquí lo que cambie al revisar el plan)* | Enunciado contrastado punto por punto (§1.1); datos de la API comprobados con peticiones reales (recuentos, `es-ES`, 404); imágenes del catálogo descargadas y vistas |
| Planificación | Skill `frontend-design` (Anthropic) | Guía de dirección estética | Elegir una dirección única y evitar tipografías genéricas | — | Se contrastará en H6 |
| Planificación | Impeccable (solo documentación; no instalada) | Criterios de calidad y lista de errores típicos | Prohibiciones de §5.3 y umbrales | No se usará el modo `live` | Pendiente: ejecución real en H6 |

Limitaciones de la IA encontradas en esta fase, para contarlas con honestidad:

- La herramienta de lectura web no pudo abrir varias referencias visuales (DNS o dominios bloqueados) ni renderizar páginas; las referencias 1, 2 y 4 se observaron solo como marcado. VCT, la BBC y la ficha deportiva las revisé yo en el navegador y decidí qué adaptar de cada una; por eso §4.2 separa lo que observó la IA de lo que revisé yo.
- Un primer resumen automático de la API dejó datos sin confirmar (número de armas, cuerpo del 404, soporte de `es-ES`); se resolvió consultando la API directamente.
- La respuesta de armas pesa ~3,6 MB: una integración ingenua la habría reenviado al navegador. De ahí la regla de recortar en el backend.

| H0–H1 | Claude Code (modelo Claude Opus 5.5), orquestador sin subagentes | Repositorio, esqueleto del monorepo, Docker, esquema y migración, instalación de Impeccable | Estructura de §3.2, Dockerfiles, esquema Prisma | Se fijaron versiones estables anteriores en vez de las últimas mayores; se rechazó la excepción automática de pnpm a su protección de versiones nuevas; se añadió `*.cmd eol=crlf` tras ver que `eol=lf` rompería el lanzador de Impeccable en Windows | `docker compose up --build`: `/api/health` → 200 a través de nginx, rutas de la SPA → 200, tablas creadas por la migración; `pnpm -r build` sin errores; `impeccable telemetry status` y `doctor` |

| H2–H4 | Dos subagentes en paralelo (Agente API y Agente Web) dirigidos por el orquestador | Auth, catálogo, votos y 22 pruebas e2e; router, sesión, acceso y exploración | Diseño del voto (`INSERT … ON CONFLICT`), caché del catálogo, pruebas en base aparte; estructura y estados del frontend; dos desviaciones visuales menores (bloque destacado 21:9, `alt=""` con nombre en texto) | El orquestador detectó al integrar que nginx devolvía 502 (API sin healthcheck y DNS fijado) y lo corrigió; normalizó la categoría de Warden | Reejecución de build y pruebas por el orquestador; `docker compose restart` y recreación de la API con el voto y la sesión conservados |
| H3 (revisión) | Subagente revisor independiente, solo lectura | Revisión de seguridad y reglas de negocio de la API | Sin defectos graves; 5 de gravedad baja | Corregidos: arranque sin `APP_ORIGIN` y catálogo vacío que sustituía al bueno, más 4 pruebas (26 en total). Descartados con motivo: FK por usuario borrado (no hay ruta que borre), esperas con la API externa colgada | La prueba del catálogo vacío falla sin la corrección y pasa con ella |
| H5 | Agente Web | Pantalla de detalle con los seis estados y las animaciones 1 y 2 | Componentes, estados y animación de barras | — (revisado por la crítica) | Recorrido completo en Chrome headless: visitante → acceso → vuelta, voto con teclado, repetido, cambio, error 500 inyectado y Reintentar, recarga, movimiento reducido, 360 px |
| H6 | Impeccable (`critique` con dos subagentes, `audit`) y orquestador | Revisión de diseño y técnica del flujo de votar y cambiar el voto | Ver la tabla de H6 | Ver la tabla de H6; la decisión de qué corregir fue del autor | Mismo recorrido repetido tras cada corrección; bytes y nombres cortados medidos antes y después |

| H7 | Orquestador | README, documentación técnica, registro de IA y prueba de arranque limpio | Redacción de `docs/ARCHITECTURE.md` y `docs/AI.md` (pendiente de mi revisión antes de la entrega) | — | Clon nuevo sin `.env`, `cp .env.example .env`, `docker compose up --build --wait` y `build --no-cache`; recorrido completo en el navegador contra ese clon |

# Valorant Community

Aplicación web para que la comunidad de VALORANT vote, en cada mapa competitivo, el mejor agente y la mejor arma, y consulte cómo se reparten los votos.

Prueba técnica full stack para Lucidbot: monorepo con **NestJS** (API) y **React + Vite** (web), **PostgreSQL**, **Docker Compose** y datos del juego de [Valorant API](https://valorant-api.com/).

- Cualquier visitante explora los mapas y consulta los resultados. Para votar hay que crear una cuenta e iniciar sesión.
- Cada usuario tiene una elección de agente y otra de arma por mapa, y puede cambiarlas por separado. Repetir el voto no suma; cambiarlo mueve el voto de la opción anterior a la nueva.

## Requisitos

- Docker con Docker Compose v2 (Docker Desktop en Windows y macOS).
- Puertos libres en tu máquina: `8080` (web) y `5433` (PostgreSQL, solo en `localhost`). Ambos se pueden cambiar en `.env`.
- Conexión a internet: la API descarga el catálogo de Valorant API y el navegador carga las imágenes desde `media.valorant-api.com`.

Para desarrollar o ejecutar las pruebas fuera de Docker hacen falta además Node.js 22 o superior y pnpm 11.

## Puesta en marcha

```bash
git clone <url-del-repositorio> valorant-community
cd valorant-community
cp .env.example .env
docker compose up --build --wait
```

Abre <http://localhost:8080>.

`--wait` devuelve el control cuando la base de datos, la API y la web están sanas. La API aplica las migraciones al arrancar; no hay pasos manuales.

Para pararlo: `docker compose down`. Para borrar también los datos: `docker compose down -v`.

### Recorrido sugerido

1. En la portada, elige un mapa.
2. Pulsa un agente: como no tienes sesión, te lleva a crear una cuenta y luego te devuelve a ese mapa.
3. Vota un agente y un arma, y mira cómo cambian los resultados.
4. Cambia tu agente: el voto se mueve de la opción anterior a la nueva. Recarga la página: tu elección se conserva.

## Variables de entorno

Todas están en `.env.example`, con valores de ejemplo válidos para ejecutar en local. No hay secretos reales en el repositorio.

| Variable | Uso |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Credenciales y nombre de la base de datos del contenedor `db`. |
| `DB_PORT` | Puerto de PostgreSQL en tu máquina (solo `localhost`). Por defecto `5433`. |
| `DATABASE_URL` | Solo para ejecutar la API o las pruebas fuera de Docker. Dentro de Docker, `docker-compose.yml` construye su propia URL. |
| `JWT_SECRET` | Firma de la cookie de sesión. **Cámbialo** por una cadena larga y aleatoria. La API no arranca sin él. |
| `APP_ORIGIN` | Orígenes desde los que se aceptan escrituras, separados por comas. Si abres la aplicación en otra dirección (por ejemplo `http://127.0.0.1:8080`) o cambias `WEB_PORT`, añádela aquí; si no, el registro y los votos devuelven 403. La API no arranca sin esta variable. |
| `COOKIE_SECURE` | `true` solo si la aplicación se sirve por HTTPS. |
| `WEB_PORT` | Puerto de la web en tu máquina. Por defecto `8080`. |

## Desarrollo y pruebas

```bash
pnpm install
docker compose up -d --wait db     # solo PostgreSQL
pnpm dev:api                       # API en http://localhost:3000
pnpm dev:web                       # web en http://localhost:5173 (proxy de /api a la API)
```

Pruebas e2e de la API (necesitan PostgreSQL en marcha):

```bash
pnpm test:api
```

Usan una base de datos aparte (`valorant_test`), que crean y migran ellas mismas; no tocan los datos de la aplicación. Sustituyen Valorant API por respuestas fijas, así que no dependen de la red. Cubren el registro y el login, la cookie, la protección de escrituras, el voto duplicado y concurrente, el cambio de voto, la agregación por mapa, los identificadores inválidos y la caída de Valorant API.

## Estructura

```
apps/
  api/    NestJS: auth/, catalog/, votes/; prisma/ con el esquema y las migraciones; test/ con las e2e
  web/    React + Vite: features/auth, features/maps, features/map-detail; nginx.conf para Docker
docs/     Arquitectura y uso de IA
PLAN.md   Plan de trabajo, decisiones y registro por hitos
```

La documentación técnica está en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), el uso de IA en [docs/AI.md](docs/AI.md) y las capturas en [docs/capturas/](docs/capturas/).

![Detalle de un mapa tras cambiar el voto](docs/capturas/escritorio-voto-cambiado.png)

## Decisiones de alcance

- **Mapas:** solo los 13 de la rotación competitiva. Valorant API no los marca; se identifican porque son los únicos con `tacticalDescription`.
- **Armas:** 20, sin el arma cuerpo a cuerpo.
- **Votos:** no se puede retirar un voto, solo cambiarlo.

## No implementado

- Revocación de sesiones en el servidor: cerrar sesión borra la cookie, pero un token copiado sigue siendo válido hasta que caduca (7 días).
- Límite de intentos de inicio de sesión.
- Retirar un voto.
- Agrupar los agentes por rol en el selector.
- Conservar el agente que eligió un visitante después de iniciar sesión (vuelve al mapa, pero tiene que elegirlo de nuevo).
- Pruebas automáticas del frontend. La interfaz se recorrió en un navegador real (Chrome headless) en escritorio y móvil, con teclado, con un error del servidor simulado y con movimiento reducido, y se revisó con Impeccable; ver `PLAN.md`, hito H6.

## Límites conocidos

- En móvil, la cabecera de cada mapa descarga su arte a 1920×1080 (unos 2,2 MB): Valorant API no ofrece una versión intermedia con el mismo encuadre.
- Las coordenadas y «Sites A/B» se muestran tal como los entrega Valorant API.

## Nota

Proyecto no oficial, sin fines comerciales, hecho solo para una evaluación técnica. VALORANT y su arte pertenecen a Riot Games; las imágenes se cargan directamente desde Valorant API y no se incluyen en el repositorio, salvo en las capturas de pantalla de `docs/capturas/`.

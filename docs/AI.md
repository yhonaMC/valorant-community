# Uso de IA

La prueba se desarrolló con IA de principio a fin, con un reparto explícito: yo tomé las decisiones de producto, diseño y alcance, y validé cada hito. Los agentes investigaron, propusieron e implementaron tareas acotadas. El registro detallado por hito está en `PLAN.md` §11.

## Herramientas

| Herramienta | Para qué |
|---|---|
| **Claude Code** con Claude Fable 5.2 | Planificación: leer el enunciado, verificar Valorant API con peticiones reales, investigar referencias y redactar `PLAN.md`. |
| **Claude Code** con Claude Opus 5.5 como orquestador | Implementación: esqueleto, Docker, integración, correcciones y documentación. |
| **Subagentes de Claude Code** | Trabajo en paralelo: un agente para la API y otro para la web, cada uno limitado a su carpeta; un revisor independiente de la API; y dos evaluaciones aisladas para la crítica de diseño. |
| **Skill `frontend-design`** (Anthropic) | Dirección estética: obligó a elegir una dirección concreta y a descartar tipografías genéricas. |
| **Impeccable 4.10.0** (Paul Bakaus), solo para Claude Code en este proyecto | Criterios de diseño (`PRODUCT.md`), `critique` y `audit` del flujo de votar y cambiar el voto, en escritorio y móvil. Sin hook automático y con la telemetría desactivada (`.impeccable/config.json`). |
| **Chrome headless** controlado por un script propio (DevTools Protocol) | Recorrer la app real con sesión iniciada, hacer capturas, medir bytes, objetivos táctiles y nombres cortados. El script vive fuera del repositorio. |

## Cómo se incorporó al trabajo

1. **Plan primero.** Antes de escribir código, `PLAN.md` fijó requisitos, decisiones, contrato de API, diseño, hitos y reglas para los agentes.
2. **Contrato antes de paralelizar.** El orquestador montó el esqueleto y congeló el contrato (`apps/web/src/api/types.ts`). Después, dos agentes trabajaron a la vez, uno en `apps/api` y otro en `apps/web`, sin tocar la carpeta del otro.
3. **«Hecho» exige evidencia.** Cada agente entregó la salida real de sus pruebas, y el orquestador las volvió a ejecutar antes de integrar.
4. **Revisión independiente.** Un agente nuevo, sin el contexto de quien implementó, revisó la API. Para la interfaz, Impeccable ejecutó `critique` con dos evaluaciones aisladas (revisión de diseño y detector) y después `audit`.
5. **Commits por hito**, con mensajes que describen el resultado.

## Decisiones que tomé yo

- **Producto:** visitantes leen y solo votan con sesión; un voto de agente y otro de arma por mapa, modificables por separado; repetir no suma y cambiar mueve el voto.
- **Stack:** monorepo pnpm con NestJS, Prisma, PostgreSQL, React y Vite, Docker Compose y cookie HttpOnly.
- **Diseño:** las referencias (VCT para la selección activa, los resultados de la BBC para comparar votos, la ficha deportiva para «Tu voto») y la condición de mantener el diseño de resultados.
- **Impeccable:** instalarlo solo para Claude Code en este proyecto, sin hook y sin telemetría, y ejecutar `critique` y `audit` a mano sobre el flujo de votar.
- **Qué corregir** de cada revisión, y qué dejar documentado como no implementado: agrupar agentes por rol, conservar la elección del visitante tras el login y la banda móvil del mapa.

## Qué acepté, qué corregí y cómo lo validé

**Aceptado:**
- El modelo de datos con la restricción única y el voto con `INSERT … ON CONFLICT`.
- La caché del catálogo.
- Las pruebas e2e en una base de datos aparte.
- La estructura y los estados de la interfaz.

**Corregido o rechazado:**
- **Versiones.** Las herramientas instalaban las últimas mayores (Prisma 7/8, NestJS 12, TypeScript 7). Fijé las estables anteriores, que podía validar en una jornada.
- **Protección de versiones de pnpm.** pnpm añadió por su cuenta una excepción a esa protección para una versión de React Query publicada ese mismo día. La quité y fijé una versión de dos semanas antes.
- **Instalación de Impeccable.** El instalador oficial falló (su dominio no resolvía desde esta máquina). Se instaló copiando la skill desde GitHub, sin su `settings.json`, que contenía los hooks.
- **502 al arrancar.** Al integrar, nginx devolvía 502: la API no tenía *healthcheck* y nginx guardaba su IP. Lo detectó el orquestador probando la persistencia, no los agentes.
- **Revisión de la API.** Apliqué dos correcciones y cuatro pruebas nuevas. Una de ellas se comprobó retirando la corrección: falla sin ella y pasa con ella.
- **Crítica de diseño (29/40).** Corregí la confirmación lejos del clic en escritorio, el retrato desfasado al cambiar de voto, tu fila oculta en la clasificación, la marca «tu voto» que se adelantaba a los recuentos y un texto incorrecto. Una corrección introdujo un fallo nuevo («Ver los 0 restantes»); se vio en la captura y se arregló antes del commit.
- **Audit (14/20).** La página de un mapa descargaba 15 MB, de ellos 12 de rostros de agentes. Pasó a 4,1 MB en escritorio y 3,5 MB en móvil, medido antes y después.

**Validación:**
- 27 pruebas e2e.
- Reejecución de todo lo que entregaban los agentes.
- Persistencia comprobada reiniciando y recreando contenedores.
- Recorrido completo en un navegador real tras cada corrección.
- Arranque desde un clon limpio siguiendo el README.

## Límites de la IA encontrados

- **La IA no pudo ver varias referencias visuales.** Tres no cargaban desde la sesión (VCT, la BBC y la ficha deportiva) y las revisé yo. Las demás solo se pudieron leer como marcado, sin verlas renderizadas.
- **Los agentes no tenían navegador.** Declararon como «no verificado» todo lo visual. Esa verificación la hizo el orquestador con Chrome headless.
- **El detector de Impeccable no puede iniciar sesión.** Su resultado limpio (0 hallazgos) solo cubre el estado de visitante. Los problemas reales los encontraron la revisión de diseño y las mediciones en el navegador.

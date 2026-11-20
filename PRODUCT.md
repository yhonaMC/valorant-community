# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Jugadores de VALORANT** que quieren decir qué agente y qué arma funcionan mejor en cada mapa y ver qué opina la comunidad. Usan la aplicación en escritorio y en móvil.
- **Evaluador técnico de Lucidbot**, que levanta la aplicación con Docker y recorre el flujo completo en pocos minutos para juzgar decisiones de producto e ingeniería.

## Product Purpose

Valorant Community permite votar, para cada mapa competitivo, el mejor agente y la mejor arma, y consultar cómo se distribuyen los votos de la comunidad.

El éxito se mide en dos cosas: que alguien complete el recorrido (cuenta, mapa, voto, resultados, cambio de voto y recarga) en pocos minutos, y que los resultados sean fiables, con un solo voto por usuario, mapa y categoría.

## Positioning

Los resultados se calculan solo con los votos reales guardados por la aplicación, sobre datos reales del juego obtenidos de Valorant API. No es una red social: no hay contenido publicado por usuarios.

## Operating Context

- Prueba técnica de una jornada para Lucidbot; no es un producto comercial ni va a producción.
- Se ejecuta en local con Docker Compose en `http://localhost:8080`.
- Cualquier visitante explora mapas y consulta resultados; votar exige iniciar sesión.

## Capabilities and Constraints

- Registro e inicio de sesión con email y contraseña; sesión en cookie HttpOnly.
- 13 mapas competitivos, 30 agentes jugables y 20 armas (sin cuerpo a cuerpo), obtenidos de Valorant API en español.
- Una elección de agente y otra de arma por usuario y mapa, modificables por separado. Repetir la solicitud cuenta como un solo voto; cambiar la elección mueve el voto.
- No se puede retirar un voto, solo cambiarlo.
- Si Valorant API no responde, la aplicación lo dice y permite reintentar; nunca muestra datos inventados.

## Brand Commitments

- Identidad de VALORANT reconocible: arte de mapas y retratos de agentes del catálogo y paleta oficial del juego.
- Proyecto no oficial: no se usa el logotipo de Riot Games ni se presenta como producto de Riot.
- Referencias fijadas por el autor: VALORANT Champions Tour para destacar la selección activa, los resultados electorales de la BBC para comparar votos (barras horizontales, recuento y porcentaje visibles, total independiente por categoría) y la ficha deportiva para presentar retrato, nombre y rol.
- El brief visual completo está en `PLAN.md` §5.

## Evidence on Hand

- Catálogo de Valorant API (`media.valorant-api.com`) y los votos reales guardados en la base de datos.
- No hay testimonios, estadísticas de uso, jugadores activos ni tendencias: no deben inventarse.

## Product Principles

1. Lo primero de cada pantalla: en qué mapa estoy, por quién voté y qué prefiere la comunidad.
2. Nunca mostrar un resultado que el servidor no haya confirmado.
3. Explorar y consultar sin cuenta; votar con sesión.
4. Ninguna cifra inventada.

## Accessibility & Inclusion

- Todo operable con teclado y con foco visible.
- Respeto de `prefers-reduced-motion`: los mismos estados se comunican con texto e iconos.
- El estado nunca depende solo del color.
- Contraste WCAG AA.

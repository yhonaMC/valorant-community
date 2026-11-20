# Se construye desde la raíz del monorepo: docker compose usa context: .
FROM node:22-alpine
RUN apk add --no-cache openssl && npm install -g pnpm@11.5.1

WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter api

COPY apps/api apps/api
WORKDIR /repo/apps/api
RUN ./node_modules/.bin/prisma generate && pnpm build

ENV NODE_ENV=production PRISMA_HIDE_UPDATE_MESSAGE=1
EXPOSE 3000
# Aplica las migraciones pendientes y arranca la API.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main.js"]

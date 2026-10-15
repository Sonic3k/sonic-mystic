# The Mystic API (NestJS, Node 26) with the knowledge bundle it imports on start.
# Built from the repository root: docker build -f deploy/api.Dockerfile .
FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY engine/package.json engine/
COPY kb/package.json kb/
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci --workspace @mystic/engine --workspace @mystic/api --include-workspace-root --no-audit --no-fund
COPY engine engine
COPY api api
RUN npm run build -w @mystic/engine && npm run build -w @mystic/api

FROM node:26-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY engine/package.json engine/
COPY kb/package.json kb/
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci --omit=dev --workspace @mystic/engine --workspace @mystic/api --include-workspace-root --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/engine/dist engine/dist
COPY --from=build /app/api/dist api/dist
COPY api/drizzle api/drizzle
COPY kb/bundle kb/bundle
WORKDIR /app/api
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]

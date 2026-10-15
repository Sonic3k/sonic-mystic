# The Huyền học web: a static Vite build served by Caddy (any path falls back to index.html).
# Built from the repository root: docker build -f deploy/web.Dockerfile --build-arg VITE_API_URL=https://… .
FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY engine/package.json engine/
COPY kb/package.json kb/
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci --workspace @mystic/engine --workspace @mystic/web --include-workspace-root --no-audit --no-fund
COPY engine engine
COPY web web
# the API's public address, baked into the bundle
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w @mystic/engine && npm run build -w @mystic/web

FROM caddy:2.11-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/web/dist /srv

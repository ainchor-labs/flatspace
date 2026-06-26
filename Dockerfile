# syntax=docker/dockerfile:1

# Flatspace suite — single image that builds the web bundle and runs the Fastify
# server (which serves the built SPA + the API). Pandoc is included for Flatfile
# DOCX export / Flatdrive .docx preview.

############################
# Builder
############################
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Toolchain for native modules (better-sqlite3 compiles on install).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install deps first (cached unless a manifest or the lockfile changes).
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY shared/package.json   shared/package.json
COPY flatfile/package.json flatfile/package.json
COPY flatdeck/package.json flatdeck/package.json
COPY flatdrive/package.json flatdrive/package.json
COPY flatthoughts/package.json flatthoughts/package.json
COPY server/package.json   server/package.json
COPY web/package.json      web/package.json
RUN pnpm install --frozen-lockfile

# Build the web SPA (server serves web/dist in production).
COPY . .
RUN pnpm build

############################
# Runtime
############################
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Pandoc powers DOCX export/preview; tini for clean signal handling.
RUN apt-get update \
  && apt-get install -y --no-install-recommends pandoc tini \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=7532 \
    FLATSPACE_DB_PATH=/data/flatspace.sqlite \
    FLATSPACE_UPLOADS_PATH=/data/uploads

# Bring over the installed deps (incl. compiled better-sqlite3) and built app.
COPY --from=builder /app /app

# Persisted SQLite DB + uploaded blobs (the app creates these dirs on boot).
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 7532
WORKDIR /app/server
ENTRYPOINT ["tini", "--"]
CMD ["pnpm", "start"]

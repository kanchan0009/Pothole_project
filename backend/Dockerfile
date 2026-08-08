# RoadGuard API — Express + Prisma
#
# The Prisma provider is a build-time choice because the generated client embeds
# it. Default sqlite (local docker-compose demo); build with
#   docker build -t roadguard-api --build-arg PRISMA_PROVIDER=postgresql .
# for a Supabase/Postgres deploy.
FROM node:22-slim

WORKDIR /app

# Prisma's query engine needs OpenSSL on Debian slim images.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Workspace manifests so `npm ci -w backend` can resolve the lockfile.
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

# Install the backend workspace. Dev deps are kept on purpose: the entrypoint
# uses the prisma CLI (db push) and tsx (demo seed).
RUN npm ci -w backend

# Prisma schema + TypeScript source.
COPY backend/prisma backend/prisma
COPY backend/tsconfig.json backend/tsconfig.json
COPY backend/src backend/src

ARG PRISMA_PROVIDER=sqlite
RUN sed -i "s/provider = \"sqlite\"/provider = \"$PRISMA_PROVIDER\"/" backend/prisma/schema.prisma \
    && cd backend \
    && npx prisma generate \
    && npx tsc -p tsconfig.json

# Optional boot-time schema apply + demo seed are gated behind env flags
# (AUTO_SCHEMA / SEED_DEMO) — never enabled on a hosted database.
COPY backend/docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 5000
ENV NODE_ENV=production PORT=5000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/src/index.js"]

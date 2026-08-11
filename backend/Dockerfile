# RoadGuard API — Express + Prisma

FROM node:22-slim

WORKDIR /app

# Prisma requires OpenSSL
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifest
COPY package.json ./

# Install dependencies
RUN npm install

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Copy application source
COPY src ./src

# Copy supporting directories
COPY api ./api
COPY scripts ./scripts
COPY data ./data

# TypeScript configuration
COPY tsconfig.json ./

# Build TypeScript
RUN npx tsc -p tsconfig.json

# Entrypoint
COPY docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Render uses this port
EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["node", "dist/src/index.js"]
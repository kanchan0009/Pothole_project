#!/bin/sh
set -e
cd /app

# AUTO_SCHEMA=true (docker-compose demo): apply the schema on boot.
# Leave unset in production — docs/deploy.md applies it once against the hosted
# database so the API never mutates the schema at startup.
if [ "${AUTO_SCHEMA:-false}" = "true" ]; then
  echo "→ Applying schema (AUTO_SCHEMA)"
  npx prisma db push --skip-generate
fi

# SEED_DEMO=true + an empty database → insert the demo admin/citizen/reports.
# Never enable on a shared or production database.
if [ "${SEED_DEMO:-false}" = "true" ]; then
  COUNT=$(node --input-type=module -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); try { const n = await p.report.count(); console.log(String(n)); } catch (e) { console.error(e?.message ?? e); process.exit(1); } finally { await p.$disconnect(); }")
  if [ "$COUNT" = "0" ]; then
    echo "→ Seeding demo data (SEED_DEMO)"
    npx tsx prisma/seed.ts
  else
    echo "→ Database already has $COUNT reports — skipping demo seed."
  fi
fi

exec "$@"

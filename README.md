# Smart Pothole Detection & Reporting System

An enterprise-grade government web application that lets citizens report potholes with **images** and **GPS location**, and lets administrators **verify, prioritize, assign, monitor, and resolve** them through an intelligent dashboard.

Built as a monorepo: **React + TypeScript + Tailwind** frontend, **Express + TypeScript + Prisma** backend, **SQLite** database (Prisma schema is PostgreSQL-compatible for a later Supabase switch).

> Documentation, SRS, diagrams, and API docs live in [`docs/`](./docs).

## Core algorithms

The system is built around four algorithms — see [`docs/algorithms.md`](./docs/algorithms.md) for details:

| Algorithm | Where | What it does |
|---|---|---|
| **CNN** (from scratch) | `backend/src/algorithms/cnn/` | Classifies each photo into NONE/LOW/MEDIUM/HIGH/CRITICAL; severity is authoritative (`Report.severity`), the citizen's form choice is stored as `suggestedSeverity`. |
| **Haversine** | `backend/src/algorithms/geo.ts` | Duplicate detection (a nearby report becomes a confirmation), road-graph snapping, and edge lengths. |
| **Max Heap** | `backend/src/algorithms/heap.ts` + `priority.ts` | Priority queue over open reports keyed by severity + confirmations + age + traffic; `process-next` dispatches the peak. |
| **Dijkstra** | `backend/src/algorithms/dijkstra.ts` + `roadGraph.ts` | Shortest driving route (real OSM roads, weighted by travel time) from the crew to the pothole, drawn on the admin map and recalculated when the crew moves. |

## Offline data caches

`backend/data/*.json` are committed artifacts that make runtime fully offline:

- **`road-graph.json`** — the Kathmandu road network (~173k nodes / 360k edges), fetched from OpenStreetMap's Overpass API over plain HTTP and cached. Regenerate with `npx tsx scripts/fetch-road-network.ts` (from `backend/`).
- **`cnn-weights.json`** — trained CNN weights. Retrain on the bundled synthetic dataset (or a real one) with `npx tsx scripts/train-cnn.ts`.

## Project Layout

```
├── backend/       Express + TypeScript + Prisma REST API
├── frontend/      React + TypeScript + Vite + Tailwind SPA
├── docs/          SRS, requirements, diagrams, API docs, wireframes
└── _legacy/       Archived copy of the previous RoadGuard app
```

## Quick Start

```bash
# 1. Install all workspace dependencies
npm install

# 2. Create the database and apply schema
npm run db:migrate

# 3. Seed sample data (admin, demo user, reports, workers)
npm run db:seed

# 4. Run backend (:5000) + frontend (:5173) together
npm run dev
```

| URL | What |
|---|---|
| http://localhost:5173 | Frontend app |
| http://localhost:5173/admin | Admin login / dashboard |
| http://localhost:5000/api/health | Backend health check |

**Demo accounts**

| Role | Email | Password |
|---|---|---|
| Admin | `admin@roadguard.gov` | `Admin@123` |
| User | `citizen@example.com` | `User@123` |

## Scripts

- `npm run dev` — backend + frontend concurrently
- `npm run build` — production build of the frontend
- `npm test` — backend + frontend test suites
- `npm run db:reset` — wipe, re-migrate, and re-seed the database

## Run with Docker (production-like)

The Dockerfiles mirror the production topology but use SQLite + demo seed, so no
external accounts are needed:

```bash
docker compose up --build
# App at http://localhost:8080 · API at http://localhost:5000/api/health
```

## Deploy

Full walkthrough in [`docs/deploy.md`](./docs/deploy.md): Supabase (Postgres) +
Cloudinary + API on Railway/Render + frontend on Vercel/Render static. Includes
a post-deploy checklist and the `PRISMA_PROVIDER` / `TRUST_PROXY` / `CORS_ORIGIN`
gotchas.

See [`docs/`](./docs) for the full Software Requirement Specification, API documentation, and design documents.

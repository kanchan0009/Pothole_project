# Deployment Guide

Target topology (from [diagrams.md](./diagrams.md)):

```
Browser ──► Vercel (frontend) ──► Railway / Render (API) ──► Supabase (Postgres)
                                      │
                                      └──► Cloudinary (photos)
```

The whole stack also runs locally as a production-like docker-compose demo (SQLite,
no external accounts) — see [Quick demo](#quick-demo-docker-compose) below.

---

## 0. What gets configured where

| Concern | Env var | Notes |
|---|---|---|
| Database URL | `DATABASE_URL` | Supabase Direct connection string (port 5432) |
| JWT signing | `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | `openssl rand -hex 32` |
| Cross-origin calls | `CORS_ORIGIN` | comma-separated; set to the frontend URL |
| Reverse proxy | `TRUST_PROXY` | `1` behind Railway/Render/Vercel/nginx (rate-limit IP) |
| Photo storage | `CLOUDINARY_*` | optional — without them images store to local `/uploads` |
| Schema/seed at boot | `AUTO_SCHEMA` / `SEED_DEMO` | **never** `true` on a hosted DB |

Every variable is documented in [`backend/.env.example`](../backend/.env.example).

---

## 0b. Offline data caches (no outbound calls at runtime)

Routing and CNN detection are **fully offline at runtime**: the API ships two
committed artifacts in `backend/data/` that the image bakes in:

- **`road-graph.json`** — the Kathmandu road network (nodes + edges weighted by
  travel seconds) that Dijkstra routes over. Generated from real OpenStreetMap
  data via the Overpass API (plain **HTTP**, not HTTPS — the demo area's public
  Overpass instance is only reachable that way). Regenerate with
  `npx tsx scripts/fetch-road-network.ts`; the script retries 429/5xx with
  backoff and writes the cache on success. If you deploy the API outside the
  Kathmandu valley, regenerate this file for your bbox or reports there will
  come back `reachable:false` ("off-network").
- **`cnn-weights.json`** — trained CNN weights. Regenerate with
  `npx tsx scripts/train-cnn.ts` (or retrain on a real dataset).

Because both are read from disk, a fresh deploy needs no Overpass, npm or ML
network access — they're only needed on your machine when you want to refresh
the caches.

---

## 1. Database — Supabase (Postgres)

The Prisma schema is provider-agnostic, but the **generated client embeds the
provider**, so switching is two coordinated steps:

1. In `backend/prisma/schema.prisma`, change `provider = "sqlite"` → `provider = "postgresql"`.
2. Build/deploy with `PRISMA_PROVIDER=postgresql` (so the image regenerates the client
   against Postgres — see the Dockerfile).

Supabase specifics:

- Create a project; open **Settings → Database → Connection string → URI**.
- Use the **Direct connection** (port `5432`) — not the pgbouncer/transaction pooler,
  which Prisma migrations and `db push` don't support reliably.
- Append `?schema=public` (Supabase already uses `public`).

Apply the schema once (from your machine or a one-off job — not at app boot):

```bash
cd backend
DATABASE_URL="postgresql://postgres:<password>@<host>:5432/postgres?schema=public" \
  npx prisma db push
```

> Do **not** seed the production database. The demo admin/citizen accounts
> (`admin@roadguard.gov` / `Admin@123`) exist for local demo only.

---

## 2. Photo storage — Cloudinary (optional but recommended)

With all three variables set, photos upload to Cloudinary and the API never keeps
files on disk. Without them, images store to the container's `/uploads` directory —
fine for the docker-compose demo, **not** durable on ephemeral platforms (Railway/Render).

1. Create a [Cloudinary](https://cloudinary.com) account → Dashboard.
2. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   (`CLOUDINARY_FOLDER=roadguard` is the default asset folder).

---

## 3. Deploy the API

### Option A — Railway
```bash
# At the repo root
railway init
railway up
```
Then set env vars (Section 0) and the build arg in the Railway dashboard:
`PRISMA_PROVIDER=postgresql`. Railway detects `backend/Dockerfile` — set
**Root Directory** to the repo root and **Dockerfile Path** to `backend/Dockerfile`.

### Option B — Render (Blueprint)
Push this repo to GitHub, create a new Blueprint from `render.yaml`, then fill in
the `sync: false` env vars (DATABASE_URL, CORS_ORIGIN, Cloudinary) in the dashboard.

### Option C — any Docker host
```bash
docker build -t roadguard-api --build-arg PRISMA_PROVIDER=postgresql .
docker run -d -p 5000:5000 \
  -e DATABASE_URL='postgresql://…' \
  -e JWT_ACCESS_SECRET='…' -e JWT_REFRESH_SECRET='…' \
  -e CORS_ORIGIN='https://your-frontend.example.com' \
  -e TRUST_PROXY=1 \
  -e CLOUDINARY_CLOUD_NAME=… -e CLOUDINARY_API_KEY=… -e CLOUDINARY_API_SECRET=… \
  roadguard-api
```

Verify: `GET https://<api-url>/api/health` → `{ "status": "ok", … }`.

---

## 4. Deploy the frontend

Build with `VITE_API_URL` pointing at the API. With it unset, the app calls the
same-origin `/api` (used by the docker-compose/nginx stack).

### Vercel
- Root Directory: `frontend`
- Framework Preset: **Vite**
- Environment Variable: `VITE_API_URL=https://<api-url>`
- Deploy.

### Render static site
- Build Command: `npm run build -w frontend`
- Publish Directory: `frontend/dist`
- Environment Variable: `VITE_API_URL=https://<api-url>`

### Cross-origin
Set the API's `CORS_ORIGIN` to the deployed frontend URL (comma-separate if more
than one). With nginx (docker-compose) the browser is same-origin, so CORS is unused.

---

## 5. Post-deploy checklist

- [ ] `GET /api/health` returns `ok`
- [ ] Admin login at `/admin` works (create a real admin via the API or DB — the demo seed is local-only)
- [ ] Citizen registers and submits a report with a photo → photo lands in Cloudinary
- [ ] Admin verifies → Verify-AI → assigns a worker → completes with a photo
- [ ] Reports list/dashboard/statistics render; exports download
- [ ] A contact-form message reaches the admin Messages inbox
- [ ] Rate limiting is active (verify `TRUST_PROXY` was set — otherwise every request shares one IP)

---

## Quick demo — docker-compose (SQLite, zero accounts)

Run the exact production artifacts locally without Cloudinary or Postgres:

```bash
docker compose up --build
```

| URL | What |
|---|---|
| http://localhost:8080 | App (nginx → Vite SPA) |
| http://localhost:5000/api/health | API health |

On first boot the entrypoint applies the schema and seeds demo data
(`AUTO_SCHEMA=true`, `SEED_DEMO=true` are compose-only). Login:
`admin@roadguard.gov` / `Admin@123`, or `citizen@example.com` / `User@123`.
Photos persist to the `rg-uploads` volume; the SQLite DB to `rg-data`.

> The Dockerfiles are provided as-is for a demo deployment. They were authored
> in an environment without Docker, so build them once locally
> (`docker compose build`) before relying on them.

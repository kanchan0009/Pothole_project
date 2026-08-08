# System Architecture & Folder Structure

## 1. Architectural Style

- **Monorepo** with npm workspaces (`frontend`, `backend`).
- **Backend:** MVC + **Repository pattern** — `routes` (HTTP) → `controllers` (request handling) → `services` (business logic) → `repositories` (Prisma/data access). Algorithms live in a dedicated `algorithms/` module.
- **Frontend:** Feature-based folder structure, React Query for server state, React Hook Form for forms, React Router v6 for routing, Tailwind for styling.
- **REST API** over HTTPS; JWT access token (short-lived) + rotating refresh token.

## 2. Tech Stack Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language | TypeScript (both apps) | Static typing, catches errors at compile time |
| Frontend build | Vite | Fast dev server, HMR, first-class TS + React |
| Styling | Tailwind CSS | Utility-first, consistent enterprise design system |
| Server state | TanStack React Query | Caching, retries, optimistic updates |
| Forms | React Hook Form + zod | Performant forms with schema validation |
| Animations | Framer Motion | Polished, accessible motion |
| Maps | Leaflet + react-leaflet | Free, no API key, interactive markers |
| Charts | Chart.js + react-chartjs-2 | Full chart suite (bar/pie/line) |
| Receipts | jsPDF (frontend) | Client-side PDF generation |
| Backend framework | Express + TypeScript | Mature, unopinionated, extensible |
| ORM | Prisma | Type-safe queries, migrations, SQLite→Postgres |
| Auth | JWT (access + refresh) + bcrypt | Stateless access, revocable refresh |
| Uploads | Multer + sharp + Cloudinary | Validation + resize + cloud storage (local fallback) |
| Validation | zod | Shared-shape request validation |
| Security | helmet, cors, express-rate-limit | Headers, CORS allowlist, rate limiting |
| Database | SQLite (dev) → PostgreSQL (prod) | Zero-setup dev; Supabase-ready schema |
| Testing | Vitest + Supertest (backend), Vitest + Testing Library (frontend) | Fast, modern, TS-native |

## 3. Folder Structure

```
roadguard-react/                         # repo root (npm workspace)
├── docs/                                # SRS, diagrams, API docs, wireframes
├── backend/                             # Express + TypeScript + Prisma
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── index.ts                     # bootstrap (listen)
│   │   ├── app.ts                       # express app (routes + middleware)
│   │   ├── config/
│   │   │   ├── env.ts                   # validated env (zod)
│   │   │   └── cloudinary.ts
│   │   ├── algorithms/
│   │   │   ├── haversine.ts
│   │   │   ├── duplicateDetection.ts
│   │   │   ├── priority.ts
│   │   │   ├── autoAssign.ts
│   │   │   └── image.ts                 # validate/compress/thumbnail
│   │   ├── middleware/
│   │   │   ├── auth.ts                  # authenticate, requireRole
│   │   │   ├── error.ts                 # centralized error handler
│   │   │   ├── rateLimit.ts
│   │   │   └── upload.ts                # multer config
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── report.routes.ts
│   │   │   ├── admin.routes.ts
│   │   │   ├── notification.routes.ts
│   │   │   └── public.routes.ts
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── report.controller.ts
│   │   │   ├── admin.controller.ts
│   │   │   └── notification.controller.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── report.service.ts
│   │   │   ├── admin.service.ts
│   │   │   ├── notification.service.ts
│   │   │   └── analytics.service.ts
│   │   ├── repositories/
│   │   │   ├── user.repo.ts
│   │   │   ├── report.repo.ts
│   │   │   ├── notification.repo.ts
│   │   │   └── admin.repo.ts
│   │   ├── utils/
│   │   │   ├── ApiError.ts
│   │   │   ├── asyncHandler.ts
│   │   │   ├── pagination.ts
│   │   │   └── csv.ts
│   │   └── types/
│   │       └── express.d.ts
│   ├── uploads/                         # local image fallback
│   ├── tests/
│   │   ├── unit/ (algorithms, services)
│   │   ├── integration/ (repositories)
│   │   └── api/ (supertest endpoint tests)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                      # router + providers
│   │   ├── index.css                    # tailwind directives + theme
│   │   ├── components/
│   │   │   ├── ui/                      # Button, Card, Input, Modal, Toast, Skeleton, Badge...
│   │   │   ├── layout/                  # Navbar, Footer, AdminLayout, UserLayout
│   │   │   ├── map/                     # PotholeMap, MarkerLayer, MapPicker
│   │   │   ├── charts/                  # BarChart, PieChart, LineChart, HeatMap
│   │   │   └── reports/                 # ReportCard, ReportTable, Timeline, DuplicateModal
│   │   ├── features/
│   │   │   ├── auth/                    # login/register/forgot pages + hooks
│   │   │   ├── reports/                 # form, details, tracking
│   │   │   ├── user-dashboard/
│   │   │   ├── admin-dashboard/
│   │   │   └── notifications/
│   │   ├── hooks/                       # useAuth, useCurrentLocation, useReports...
│   │   ├── api/                         # axios client + typed endpoints
│   │   ├── lib/                         # utils, constants, status/severity maps
│   │   ├── types/                       # shared TS types
│   │   └── router/                      # protected route wrappers
│   ├── public/
│   ├── index.html
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── _legacy/                             # archived previous app
├── package.json                         # workspace root scripts
├── .gitignore
└── README.md
```

## 4. Request Flow

```
Browser → React Router → page component
  → React Query hook (api/)
    → Axios → Express route
      → middleware (auth, validation, upload, rate-limit)
        → controller
          → service (business logic + algorithms + notifications)
            → repository
              → Prisma → SQLite/PostgreSQL
```

Errors bubble back through a centralized error middleware that returns a consistent `{ success, error }` envelope with HTTP status codes.

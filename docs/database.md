# Database Design

## 1. Engine & Provider

- **Development:** SQLite via Prisma (`backend/prisma/dev.db`). Zero-setup, embedded, file-based.
- **Production:** PostgreSQL via Supabase. The Prisma schema is written in a provider-agnostic way — switching is a one-line change (`provider = "postgresql"`) plus a `DATABASE_URL` pointing at Supabase.

> All Prisma models use the same types that map cleanly to PostgreSQL (`Int`, `Float`, `Boolean`, `DateTime`, enums) so the migration is transparent.

## 2. Tables

### 2.1 `users`

| Column | Type | Notes |
|---|---|---|
| id | Int | PK, autoincrement |
| name | String | |
| email | String | unique |
| phone | String? | |
| passwordHash | String | bcrypt |
| role | Role enum | `USER` \| `ADMIN` |
| isWorker | Boolean | flagged as an assignable field worker |
| latitude / longitude | Float? | field-worker coords for nearest-worker assignment |
| refreshToken | String? | rotating refresh token |
| isActive | Boolean | admin can deactivate |
| createdAt / updatedAt | DateTime | |

### 2.2 `reports`

| Column | Type | Notes |
|---|---|---|
| id | Int | PK |
| userId | Int | FK → users.id |
| title | String | |
| imageUrl | String | uploaded/cloud URL |
| description | String | |
| roadName | String | |
| municipality | String | |
| ward | String | ward number as string |
| landmark | String? | |
| latitude / longitude | Float | nullable until resolved |
| severity | Severity enum | `LOW/MEDIUM/HIGH/CRITICAL` |
| status | Status enum | `PENDING/VERIFIED/ASSIGNED/IN_PROGRESS/COMPLETED/REJECTED` |
| duplicate | Boolean | flagged by duplicate detection |
| priorityScore | Int | computed by priority algorithm |
| confidenceScore | Float? | AI/heuristic confidence (0..1) |
| boundingBox | String? | JSON `{ x, y, width, height }` normalized 0..1 |
| detectedImageUrl | String? | the photo with the detection box drawn on it |
| aiVerified | Boolean? | admin's Verify-AI verdict (`null` = not reviewed) |
| aiRejectedReason | String? | friendly reason when the AI detection is rejected |
| completionImageUrl | String? | set on COMPLETED |
| rejectionReason | String? | set on REJECTED |
| createdAt / updatedAt | DateTime | |

### 2.3 `locations`

Normalized location data (denormalized convenience fields on `reports` mirror this table).

| Column | Type |
|---|---|
| id | Int PK |
| reportId | Int FK → reports.id |
| latitude / longitude | Float |
| address | String? |
| municipality | String? |
| ward | String? |
| roadName | String? |
| landmark | String? |

### 2.4 `status_history`

| Column | Type | Notes |
|---|---|---|
| id | Int PK | |
| reportId | Int FK | |
| status | Status enum | stage at this entry |
| remarks | String? | admin remarks |
| updatedById | Int? FK | admin who changed it |
| createdAt | DateTime | |

### 2.5 `notifications`

| Column | Type |
|---|---|
| id | Int PK |
| userId | Int FK → users.id |
| title | String |
| message | String |
| isRead | Boolean, default false |
| createdAt | DateTime |

### 2.6 `assignments`

| Column | Type |
|---|---|
| id | Int PK |
| reportId | Int FK |
| userId | Int? FK | the worker who was assigned |
| assignedTo | String | worker name (denormalized) |
| assignedAt | DateTime |

### 2.7 `admin_logs`

| Column | Type |
|---|---|
| id | Int PK |
| adminId | Int FK |
| action | String |
| details | String? |
| createdAt | DateTime |

### 2.8 `contact_messages`

Public contact-form submissions (unauthenticated, rate-limited 5/hour/IP). No IP is stored — the privacy NFR keeps user data scoped to the reporting workflow.

| Column | Type |
|---|---|
| id | Int PK |
| name | String |
| email | String |
| subject | String |
| message | String |
| createdAt | DateTime |

## 3. Enums

```
Role:      USER | ADMIN
Severity:  LOW | MEDIUM | HIGH | CRITICAL
Status:    PENDING | VERIFIED | ASSIGNED | IN_PROGRESS | COMPLETED | REJECTED
```

## 4. Indexes

- `users.email` — unique
- `reports.status`, `reports.severity`, `reports.municipality`, `reports.createdAt`
- `status_history.reportId`
- `notifications.userId`
- `contact_messages.createdAt`
- FTS5 virtual table over reports (`title/description/roadName/municipality`) for full-text search (SQLite); PostgreSQL later uses `pg_trgm`/`tsvector`.

## 5. Seed Data

Created by `backend/prisma/seed.ts`:

| Entity | Count | Notes |
|---|---|---|
| Admin | 1 | `admin@roadguard.gov` / `Admin@123` |
| Demo user | 1 | `citizen@example.com` / `User@123` |
| Workers | 3 | for auto-assignment (named, with lat/lng) |
| Reports | 20 | spread across municipalities/wards/severities/statuses with coordinates + history |
| Notifications | several | sample for the demo user |

## 6. Data Access Pattern

- **Repository layer** (`backend/src/repositories/`) wraps all Prisma queries — controllers never touch Prisma directly (repository pattern).
- All reads are parameterized via Prisma → SQL-injection safe.
- Search uses FTS5 (SQLite) / indexed filters; sorts are capped with pagination.

# REST API Documentation

Base URL: `http://localhost:5000/api` (dev; the Vite dev server proxies `/api`). Bodies are JSON unless noted (multipart for image uploads). All responses use the envelope below.

## Conventions

### Envelope
Every JSON response wraps in `{ success, data }`; errors wrap in `{ success: false, error }`.

```json
{ "success": true, "data": { /* endpoint payload */ } }

{ "success": false, "error": { "message": "A valid email is required", "fields": { "email": "A valid email is required" } } }
```

### Error shape
Errors are `{ message }`, plus `fields` (per-input messages) when a request failed validation. Two errors also carry a `code` for client-side branching:

| Code | Status | Meaning |
|---|---|---|
| `DUPLICATE_REPORT` | 409 | an open report exists within 20 m of the submitted point (`nearbyReport` included) |
| `RATE_LIMITED` | 429 | too many requests to a rate-limited endpoint |

| Status | Meaning |
|---|---|
| 400 | Zod validation failed (`message: "Validation failed"` + `fields`), or an illegal workflow transition |
| 401 | Missing/invalid/expired token |
| 403 | Authenticated but role/permission not allowed (non-admin on an admin route, non-owner on a receipt) |
| 404 | Resource does not exist |
| 409 | Email already registered, or a duplicate report |
| 413 | Uploaded file exceeds the 5 MB limit |
| 500 | Unhandled error (generic message in production) |

### Auth
JWT **access token** in `Authorization: Bearer <token>`, plus a **rotating refresh token** stored server-side (hashed). Marked `(protected)` endpoints require the header; `(admin)` also requires the `ADMIN` role. The token carries `{ id, email, role }`.

### Rate limiting
Public endpoints are rate-limited **per IP** (skipped in tests):

| Endpoint | Limit |
|---|---|
| `POST /auth/login` | 20 / 15 min |
| `POST /admin/login` | 20 / 15 min |
| `POST /auth/register` | 5 / hour |
| `POST /auth/forgot-password` | 5 / hour |
| `POST /auth/reset-password` | 5 / hour |
| `POST /contact` | 5 / hour |

Exceeding a limit returns `429` with `code: "RATE_LIMITED"`.

---

## Auth

### POST `/auth/register`
Create a USER account. Sends the user a welcome notification.
```json
{ "name": "John Doe", "email": "john@example.com", "phone": "+1-555-0100", "password": "StrongPass@1" }
```
`201` → `{ "token", "refreshToken", "user": { "id", "name", "email", "phone", "role": "USER", "isActive", "createdAt" } }`. `409` if the email is taken.

### POST `/auth/login`
```json
{ "email": "john@example.com", "password": "StrongPass@1", "rememberMe": true }
```
`200` → same shape as register. Deactivated accounts get `403`.

### POST `/auth/refresh`
Rotates the session: body `{ "refreshToken" }` → `200` `{ "token", "refreshToken" }`. Reuse of a stale token revokes the whole session.

### POST `/auth/logout`
Revokes a refresh token: body `{ "refreshToken" }`. Always `200`.

### POST `/auth/forgot-password`
Body `{ "email" }`. Sends a reset token (in dev, logged to the server console). Always `200` — never reveals whether the email exists.

### POST `/auth/reset-password`
Body `{ "token", "password": "NewPass@1" }`. `200` on success; the old refresh tokens are revoked.

### GET `/auth/me` *(protected)*
`200` → `{ "user": { "id", "name", "email", "phone", "role", "isActive", "createdAt" } }`.

### PUT `/auth/profile` *(protected)*
Body: `{ "name"?, "phone"?, "currentPassword"?, "newPassword"? }`. Changing the password requires `currentPassword`. `200` → `{ "message", "user" }`.

### DELETE `/auth/account` *(protected)*
Soft-deletes the caller's account: deactivates it and anonymizes name/email/password/refresh token so it can never be signed into again, while keeping the user's reports and audit history intact. `200` → `{ "message" }`. A second call returns `400`.

---

## Reports

### POST `/reports/detect` *(protected, multipart)*
Runs the AI/heuristic pothole detector on a single photo **before** submission (field `image`). `200` →
```json
{ "isPothole": true, "confidence": 0.87, "boundingBox": { "x": 0.4, "y": 0.3, "width": 0.2, "height": 0.3 }, "previewUrl": "/uploads/abc.webp" }
```
A clean road returns `{ "isPothole": false, "boundingBox": null, "previewUrl": null }`. `previewUrl` is an annotated image with the detected box drawn.

### POST `/reports/check-duplicate` *(protected)*
Body `{ "latitude": 27.7172, "longitude": 85.324 }`. `200` → `{ "duplicate": boolean, "nearbyReport"? }`. `duplicate` is `true` when an open report exists within **20 m** (Haversine).

### GET `/reports`
Public list with filters + pagination:

| Param | Values |
|---|---|
| `status` | `PENDING\|VERIFIED\|ASSIGNED\|IN_PROGRESS\|COMPLETED\|REJECTED` |
| `severity` | `LOW\|MEDIUM\|HIGH\|CRITICAL` |
| `municipality`, `ward`, `roadName` | text filter |
| `reporter` | user id or name fragment |
| `from` / `to` | ISO dates |
| `search` | title/description/road free-text |
| `sort` | `newest\|oldest\|priority\|severity\|status` |
| `page` / `limit` | pagination (default 1 / 12) |

`200` → `{ "reports": [ReportListItem], "pagination": { "page", "limit", "total", "totalPages" } }`.
A `ReportListItem` includes `id, userId, title, description, imageUrl, roadName, municipality, ward, landmark, latitude, longitude, severity, status, duplicate, priorityScore, confidenceScore, boundingBox, detectedImageUrl, aiVerified, aiRejectedReason, completionImageUrl, rejectionReason, reporterName, createdAt, updatedAt`.

### POST `/reports` *(protected, multipart)*
Fields: `title`, `description`, `roadName`, `municipality`, `ward`, `landmark?`, `latitude?`, `longitude?`, `severity`, `ignoreDuplicate?` (pass `"true"` to create anyway past the 20 m duplicate warning), `image` (file ≤ 5 MB, jpg/png/webp).

The server re-runs detection on the uploaded image and stores `confidenceScore`, `boundingBox` and an annotated `detectedImageUrl`. A photo with no detectable pothole returns `400`. Priority scoring is computed server-side.

- `201` → `{ "report": ReportListItem }` (`duplicate` flags a confirmed bypass).
- `409` → `{ "error": { "code": "DUPLICATE_REPORT", "nearbyReport": { "id", "title", "distance", "imageUrl", "status", "severity" } } }`.

### GET `/reports/mine` *(protected)*
Same shape as `GET /reports` but forced to the caller — never public.

### GET `/reports/mine/stats` *(protected)*
`200` → `{ "status": { "total", "pending", "verified", "assigned", "inProgress", "completed", "rejected" } }`.

### GET `/reports/:id`
Public detail. `200` → `{ "report": { ...ReportListItem, "location": { "latitude", "longitude" }, "history": [{ "status", "remarks", "createdAt", "updatedBy" }], "assignments": [{ "assignedTo", "assignedAt" }] } }`. `404` for unknown ids.

### GET `/reports/:id/timeline`
Public. `200` → `{ "history": [...] }` ordered oldest-first (`PENDING` first).

### GET `/reports/:id/receipt` *(protected)*
Official A4 PDF receipt for one report — **owner or admin only** (`403` otherwise). Streams `application/pdf` as `Content-Disposition: attachment` (`RG-000042-receipt.pdf`) with the report's title, status/severity, location, before/after photos and status timeline embedded.

### PUT `/reports/:id` *(protected, owner only, multipart)*
Edit the caller's own report fields (same field set as create, minus `ignoreDuplicate`). `200` → `{ "report" }`. Non-owners get `403`.

### DELETE `/reports/:id` *(admin)*
Hard-deletes a report. `200` → `{ "message" }`. Citizens get `403`.

---

## Admin — every route `(admin)`

### POST `/admin/login`
Public. Body `{ "email", "password" }`. `200` → same as `/auth/login`; non-admin accounts get `403`.

### GET `/admin/dashboard`
`200` →
```json
{
  "counts": { "total", "pending", "verified", "assigned", "inProgress", "completed", "rejected" },
  "today": 3, "monthly": 41, "avgResolutionHours": 12.4,
  "recentReports": [ReportListItem],
  "recentActivity": [{ "id", "adminName", "action", "details", "createdAt" }],
  "notifications": { "notifications", "unreadCount", "total" }
}
```

### GET `/admin/statistics`
Query: `period` = `day|week|month|year` (default `month`), optional `from`/`to` ISO dates. `200` →
```json
{
  "period": "month", "total": 41, "status": { /* StatusCounts */ },
  "severity": { "LOW": 2, "MEDIUM": 12, "HIGH": 18, "CRITICAL": 9 },
  "timeSeries": [{ "label": "Aug 6", "count": 4 }],
  "topRoads": [{ "roadName", "count" }],
  "topAreas": [{ "municipality", "ward", "count" }],
  "topUsers": [{ "userId", "name", "count" }],
  "completionRate": 62.5, "avgResolutionHours": 12.4,
  "aiAccuracy": 87, "heatmap": [[latitude, longitude, weight]]
}
```
`aiAccuracy` is `null` until an admin has reviewed at least one AI detection.

### GET `/admin/reports`
Paginated admin list — supports every `GET /reports` filter plus `sort` and an admin-specific reporter filter.

### GET `/admin/reports/:id`
`200` → `{ "report": { ...ReportListItem, "history", "assignments", "user": { "name", "email", "phone" } } }`.

### PUT `/admin/reports/:id/status` *(multipart)*
Workflow transition. Fields: `status`, `remarks?`, optional `image` (required for `COMPLETED` completion photo), and optional `workerId`/`assignedTo` to verify-and-assign in one call.

Legal transitions (`REJECTED` is terminal and reachable from any open state):
```
PENDING → VERIFIED → ASSIGNED → IN_PROGRESS → COMPLETED
   └── REJECTED (from PENDING/VERIFIED/ASSIGNED/IN_PROGRESS)
```
Illegal jumps return `400`. `COMPLETED` requires the completion image and notifies the owner; `REJECTED` requires `remarks` (used as the notification reason). `200` → `{ "report" }`.

### POST `/admin/reports/:id/assign`
Body: `{ "workerId" }` **or** `{ "assignedTo" }` (never both). With neither, the nearest active field worker is auto-assigned. `200` → `{ "report" }` with `assignments` populated. Non-worker ids return `400`.

### POST `/admin/reports/:id/ai-verify`
An admin's verdict on the AI detection. Body `{ "approved": true }` or `{ "approved": false, "reason": "NOT_A_POTHOLY|DUPLICATE|BLURRED_IMAGE|FAKE_REPORT" }` (reason required on rejection). A rejection also closes the report (`REJECTED`) and notifies the reporter. Returns `400` for already-reviewed reports or reports without a detection. `200` → `{ "report" }`.

### GET `/admin/users`
Paginated list with `search`, `role`, `active`, `isWorker` and per-user report counts. `200` → `{ "users": [{ "id", "name", "email", "phone", "role", "isWorker", "isActive", "createdAt", "reportCount" }], "pagination": { "page", "limit", "total", "totalPages" } }`.

### PUT `/admin/users/:id`
Toggle `role`, `isActive`, `isWorker` (at least one required). An admin cannot demote themselves (`400`). `200` → `{ "user" }`.

### GET `/admin/workers`
Active, assignable field workers. `200` → `{ "workers": [{ "id", "name", "phone", "latitude", "longitude" }] }`.

### GET `/admin/export/:format`
`format` = `csv|xlsx|pdf`; optional filters `status`, `severity`, `municipality`, `ward`, `search`, `from`, `to`. Streams a binary attachment with the current report set.

### GET `/admin/logs`
Audit trail of admin actions. `200` → `{ "logs": [{ "id", "action", "entity", "description", "adminName", "createdAt" }] }`. Actions include `STATUS_CHANGE`, `ASSIGN`, `AI_VERIFY`, `USER_UPDATE`.

### GET `/admin/contact-messages`
Inbox for the public contact form. Query: `page`, `limit` (max 50), `search` (name/email/subject free-text). `200` → `{ "messages": [{ "id", "name", "email", "subject", "message", "createdAt" }], "pagination": { "page", "limit", "total", "totalPages" } }`, newest-first.

---

## Notifications — all routes `(protected)`

### GET `/notifications`
`200` → `{ "notifications": [{ "id", "title", "message", "isRead", "createdAt" }], "unreadCount", "total" }`.

### PUT `/notifications/:id/read`
Marks one notification read. `200` → `{ "notifications" }` (the caller's full list). Another user's notification id returns `404`.

### PUT `/notifications/read-all`
Marks everything read. `200` → `{ "notifications", "unreadCount": 0 }`.

---

## Public

### POST `/contact`
Public contact form — unauthenticated, rate-limited (5 / hour / IP). Body:
```json
{ "name": "Jane Citizen", "email": "jane@example.com", "subject": "Pothole near school", "message": "There is a deep pothole right in front of the school gate." }
```
Validation mirrors the frontend form (name 2–80, email, subject 3–120, message 10–2000). `201` → `{ "id", "createdAt" }`. The message is stored in `contact_messages` and every admin receives a "New contact message" notification (`name: subject` summary).

### GET `/health`
`200` → `{ "status": "ok", "service": "Smart Pothole System API", "timestamp", "env" }`.

---

## Enums

**Status** — `PENDING | VERIFIED | ASSIGNED | IN_PROGRESS | COMPLETED | REJECTED`
**Severity** — `LOW | MEDIUM | HIGH | CRITICAL`
**Role** — `USER | ADMIN`
**AI rejection reasons** — `NOT_A_POTHOLY` ("Not a pothole") · `DUPLICATE` ("Duplicate report") · `BLURRED_IMAGE` ("Blurred image") · `FAKE_REPORT` ("Fake report")

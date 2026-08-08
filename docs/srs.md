# Software Requirement Specification (SRS)

## 1. Project Overview

**Smart Pothole Detection and Reporting System** is a web-based government application that enables citizens to report potholes using **images** and **GPS location**, and enables administrators to **verify, manage, prioritize, monitor, and resolve** reported potholes through an intelligent dashboard.

The application presents an enterprise-level, modern government dashboard experience and is fully responsive across desktop, tablet, and mobile.

## 2. Objectives

- Give citizens a fast, location-aware channel to report road hazards.
- Provide a prioritized, data-driven work queue for municipal road departments.
- Reduce duplicate reports through automated duplicate detection.
- Increase transparency through status timelines and public notifications.
- Provide analytics (reports by time, area, severity, and resolution rate) to guide maintenance planning.

## 3. Stakeholders

| Stakeholder | Interest |
|---|---|
| Citizens | Report potholes, track status, receive updates |
| Admins / road department | Verify, assign, resolve reports; manage workers; analytics |
| Municipal planners | Insight into most-damaged roads and complaint hotspots |
| System operators | Operate and maintain the platform |

## 4. Roles & Permissions

| Role | Capabilities |
|---|---|
| **USER** | Register/login, report potholes, track reports, view timeline, receive notifications, edit profile |
| **ADMIN** | All USER capabilities plus: full reports management (verify/reject/assign/update status/delete), worker assignment, statistics, user management, exports, admin dashboard |
| **Public (unauthenticated)** | Browse landing page, view the public reports map, contact form |

## 5. Functional Requirements

### 5.1 Authentication & Authorization
- FR-1: User registration with name, email, phone, and password.
- FR-2: Login for USER and ADMIN roles; JWT access token with rotating refresh token.
- FR-3: Logout invalidates the refresh token (server-side revocation).
- FR-4: "Remember me" keeps a long-lived session; otherwise tokens expire.
- FR-5: Forgot password issues a one-time reset token via email (dev: console/log file).
- FR-6: Password reset with strong-password validation.
- FR-7: Protected routes client-side and server-side; role middleware guards ADMIN routes.
- FR-8: Admin login is exposed only at `/admin`.
- FR-9: User can **delete/deactivate their own account** — a soft delete that deactivates and anonymizes the account while preserving their reports and audit history.

### 5.2 Pothole Reporting
- FR-10: Report form captures image (upload or camera capture), description, road name, municipality, ward number, nearby landmark, severity (LOW/MEDIUM/HIGH/CRITICAL).
- FR-11: Capture current location via browser GPS; fall back to manual selection on the interactive map.
- FR-12: Reverse geocode selected coordinates into an address; allow manual address editing.
- FR-13: Image preview before submit; image can be removed/replaced.
- FR-14: Image validation (extension, resolution, size ≤ 5 MB), compression, and thumbnail generation.
- FR-15: On submit, run **duplicate detection**: unresolved report within 20 m prompts "Possible duplicate detected — Continue / Cancel".
- FR-16: Priority score computed automatically (severity + duplicate count + age + traffic density).
- FR-17: Submitting a report notifies admins and stores a `PENDING` status-history entry.
- FR-18: Pre-submit **AI pothole detection** on the photo — returns confidence (0..1), a normalized bounding box, and an annotated preview image.
- FR-19: The server **re-runs detection on every submission**; a photo with no detectable pothole is rejected (400). Confidence, bounding box, and the annotated image are stored with the report.

### 5.3 Report Tracking
- FR-20: User can view their report history and a per-report status timeline.
- FR-21: Completed reports display **before** and **after** repair images.
- FR-22: Rejected reports display the rejection reason.
- FR-23: User can download a PDF receipt for a report (owner or admin only).
- FR-24: Report details show the **AI confidence score** and the annotated detection image.

### 5.4 Report Workflow (Admin)
- FR-25: Workflow: `PENDING → VERIFIED → ASSIGNED → IN_PROGRESS → COMPLETED`. Admin may **reject** at any stage (with reason).
- FR-26: Admin can upload a **completion image** and add remarks at any status change.
- FR-27: Auto-assignment finds the nearest available worker (Haversine distance) and creates an `Assignments` record.
- FR-28: Admin can search, sort, and filter reports by status, severity, municipality, ward, road name, date, and reporter.
- FR-29: Admin can delete a report (logs the action in `AdminLogs`).
- FR-30: Admin can export reports to PDF, Excel (XLSX), and CSV.
- FR-31: **Verify-AI** — admin reviews each AI detection: confirms it, or rejects it with a reason (not a pothole / duplicate / blurred / fake). A rejection also closes the report and notifies the reporter; the verdict is recorded in the audit log.

### 5.5 Admin Dashboard
- FR-32: Overview cards: total, pending, verified, assigned, in-progress, completed, rejected, today's, monthly, average resolution time.
- FR-33: Charts: bar (reports by municipality/road), pie (severity distribution), line (reports over time), heat map (geographic density).
- FR-34: Recent reports, latest activities, and notifications panels.
- FR-35: User management (view users, change role, deactivate).

### 5.6 Notifications
- FR-36: Notifications on: report submitted, status changed, report assigned, report completed, admin remark added.
- FR-37: Notifications appear in-dashboard with unread counts; mark single or all as read.

### 5.7 Map Module
- FR-38: Interactive Leaflet map displaying all reports as colored markers by status:
  Pending=yellow, Verified=blue, Assigned=purple, In Progress=orange, Completed=green, Rejected=gray.
- FR-39: Marker popup shows image, description, date, reporter, severity, status.

### 5.8 Analytics
- FR-40: Daily, weekly, monthly, and yearly report counts.
- FR-41: Average resolution time, most damaged roads, highest complaint areas, severity distribution, completion rate, heatmap data.
- FR-42: **AI accuracy** statistic — percentage of reviewed detections that the admin confirmed.

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | API p95 response < 500 ms for list endpoints; pagination caps results; image processing async-friendly |
| **Scalability** | Stateless API (JWT), horizontally deployable; SQLite for dev, PostgreSQL-compatible schema for scale |
| **Security** | BCrypt password hashing, JWT access+refresh, Helmet headers, CORS allowlist, rate limiting on auth, zod input validation, Prisma parameterized queries (SQL-injection safe), sanitized outputs, strict file-upload rules |
| **Reliability** | Graceful error handling; centralized error middleware; consistent error envelope |
| **Usability** | Modern government UI; skeleton loading; toast notifications; responsive mobile/tablet/desktop |
| **Accessibility** | Semantic HTML, keyboard-navigable forms, color-contrast-safe palette |
| **Maintainability** | MVC + repository pattern; strongly typed (TypeScript) across frontend and backend; centralized config |
| **Portability** | Runs on Node ≥ 22; DB provider switchable `sqlite → postgresql` in Prisma |
| **Compliance** | Privacy: passwords never stored in plaintext; user data only used for the reporting workflow |

## 7. User Stories

| Story | As a… | I want to… | So that… |
|---|---|---|---|
| US-1 | citizen | register and log in | my reports are tracked under my account |
| US-2 | citizen | report a pothole with photo + GPS | officials can locate and fix it |
| US-3 | citizen | pick my location on a map | I can report even when GPS is unavailable |
| US-4 | citizen | get a duplicate warning | I don't submit a report that already exists |
| US-5 | citizen | track my report's status | I know when it's fixed |
| US-6 | citizen | receive notifications | I learn about status changes without checking |
| US-7 | citizen | download a receipt | I have proof of my report |
| US-8 | admin | see dashboard statistics | I understand the workload at a glance |
| US-9 | admin | verify/assign/resolve reports | the workflow moves forward efficiently |
| US-10 | admin | filter and search reports | I can find specific issues quickly |
| US-11 | admin | export reports | I can share data with stakeholders |
| US-12 | admin | manage users | I can control access |

## 8. Out of Scope (v1)

- Native mobile apps (web is responsive-first).
- Real SMS / push notifications (in-app notifications only).
- Integration with municipal asset-management systems.
- Multi-language support beyond English (architecture allows i18n later).

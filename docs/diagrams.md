# Design Diagrams

All diagrams use [Mermaid](https://mermaid.js.org/) and render in GitHub, VS Code, or mermaid.live.

## 1. Use-Case Diagram

```mermaid
flowchart TD
  Actor Citizen["Citizen"]
  Actor Admin["Admin"]
  Actor Public["Public Visitor"]

  subgraph System["Smart Pothole Detection & Reporting System"]
    A1["Register / Login"]
    A2["Report a pothole (image + GPS)"]
    A3["Track report & timeline"]
    A4["Receive notifications"]
    A5["Download receipt"]
    A6["Edit profile"]
    A7["View public map & statistics"]
    A8["Contact support"]
    B1["Admin login (/admin)"]
    B2["View dashboard analytics"]
    B3["Verify / Reject report"]
    B4["Assign worker"]
    B5["Update status + completion image"]
    B6["Search / Sort / Filter reports"]
    B7["Export PDF / Excel / CSV"]
    B8["Manage users"]
  end

  Citizen --> A1 & A2 & A3 & A4 & A5 & A6
  Public --> A7 & A8
  Admin --> B1 & B2 & B3 & B4 & B5 & B6 & B7 & B8

  B3 --> A3
  B4 --> A3
  B5 --> A4
```

## 2. Activity Diagram — Report Lifecycle

```mermaid
stateDiagram-v2
  [*] --> ReportForm
  ReportForm --> ValidateImage: attach image + location
  ValidateImage --> Valid: extension/size/resolution OK
  ValidateImage --> ReportForm: invalid (error toast)
  Valid --> DuplicateCheck
  DuplicateCheck --> ConfirmDialog: unresolved report within 20 m
  ConfirmDialog --> SubmitReport: continue (marked duplicate)
  ConfirmDialog --> ReportForm: cancel
  DuplicateCheck --> SubmitReport: no duplicate
  SubmitReport --> PENDING
  PENDING --> VERIFIED: admin verifies
  VERIFIED --> ASSIGNED: auto/ manual assign
  ASSIGNED --> IN_PROGRESS: work starts
  IN_PROGRESS --> COMPLETED: completion image
  PENDING --> REJECTED: admin rejects
  VERIFIED --> REJECTED: admin rejects
  ASSIGNED --> REJECTED: admin rejects
  IN_PROGRESS --> REJECTED: admin rejects
  COMPLETED --> [*]
  REJECTED --> [*]
```

## 3. Sequence Diagram — Report Submission

```mermaid
sequenceDiagram
  actor Citizen
  participant FE as React Frontend
  participant API as Express API
  participant ALG as Algorithms
  participant DB as Prisma/SQLite
  participant Admin

  Citizen->>FE: fills report form + picks photo
  FE->>API: POST /api/reports/detect {image}
  API->>ALG: heuristic detection (sharp grid)
  ALG-->>API: {isPothole, confidence, boundingBox}
  API-->>FE: verdict + annotated previewUrl
  alt no pothole detected
    FE-->>Citizen: "No pothole detected" (submit blocked)
  end
  FE->>API: POST /api/reports/check-duplicate {lat,lng}
  API->>ALG: haversineDistance(nearby reports)
  ALG-->>API: nearest within 20 m?
  API-->>FE: {duplicate:true, nearbyReport}
  FE-->>Citizen: "Possible duplicate — continue?"
  Citizen->>FE: confirm (ignoreDuplicate=true)
  FE->>API: POST /api/reports (multipart)
  API->>ALG: re-run detection + validate + compress + upload
  API->>DB: create report + confidence fields + location + statusHistory
  API->>DB: addNotification (admin, "new report")
  API-->>FE: 201 {report, priorityScore}
  FE-->>Citizen: success toast + receipt + redirect to track
  DB-->>Admin: notification appears in dashboard
```

## 4. Sequence Diagram — Admin Status Change

```mermaid
sequenceDiagram
  actor Admin
  participant A as Admin API
  participant S as Status Service
  participant DB as Prisma/SQLite
  participant N as Notification
  participant Citizen

  Admin->>A: PUT /api/admin/reports/:id/status
  A->>S: transition(status, remarks)
  S->>DB: update report status
  S->>DB: insert statusHistory
  alt completed
    S->>DB: save completionImageUrl
    S->>N: notify citizen "completed"
  else assigned
    S->>ALG: nearest available worker
    S->>DB: create assignment
    S->>N: notify citizen "assigned"
  else rejected
    S->>DB: save rejectionReason
    S->>N: notify citizen "rejected (reason)"
  end
  A-->>Admin: 200 {report, history}
  N-->>Citizen: notification in dashboard
```

## 5. Entity-Relationship (ER) Diagram

```mermaid
erDiagram
  USERS ||--o{ REPORTS : "submits"
  USERS ||--o{ NOTIFICATIONS : "receives"
  USERS ||--o{ STATUS_HISTORY : "updates"
  USERS ||--o{ ADMIN_LOGS : "logs"
  REPORTS ||--|| LOCATIONS : "has"
  REPORTS ||--o{ STATUS_HISTORY : "history"
  REPORTS ||--o{ NOTIFICATIONS : "triggers"
  REPORTS ||--o{ ASSIGNMENTS : "assigned"

  USERS {
    int id PK
    string name
    string email UK
    string phone
    string passwordHash
    string role "USER | ADMIN"
    boolean isWorker "field-crew flag"
    float latitude
    float longitude
    string refreshToken
    boolean isActive
    datetime createdAt
    datetime updatedAt
  }
  REPORTS {
    int id PK
    int userId FK
    string title
    string imageUrl
    string description
    string roadName
    string municipality
    string ward
    string landmark
    float latitude
    float longitude
    string severity "LOW|MEDIUM|HIGH|CRITICAL"
    string status "PENDING|VERIFIED|ASSIGNED|IN_PROGRESS|COMPLETED|REJECTED"
    boolean duplicate
    int priorityScore
    float confidenceScore "AI confidence 0..1"
    string boundingBox "JSON {x,y,width,height}"
    string detectedImageUrl "annotated photo"
    boolean aiVerified
    string aiRejectedReason
    string completionImageUrl
    string rejectionReason
    datetime createdAt
    datetime updatedAt
  }
  LOCATIONS {
    int id PK
    int reportId FK
    float latitude
    float longitude
    string address
    string municipality
    string ward
    string roadName
    string landmark
  }
  STATUS_HISTORY {
    int id PK
    int reportId FK
    string status
    string remarks
    int updatedById FK
    datetime createdAt
  }
  NOTIFICATIONS {
    int id PK
    int userId FK
    string title
    string message
    boolean isRead
    datetime createdAt
  }
  ASSIGNMENTS {
    int id PK
    int reportId FK
    int userId FK "assigned worker"
    string assignedTo
    datetime assignedAt
  }
  ADMIN_LOGS {
    int id PK
    int adminId FK
    string action
    string details
    datetime createdAt
  }
```

## 6. Deployment Topology

```mermaid
flowchart LR
  subgraph Client
    B["Browser"]
  end
  subgraph Vercel
    F["React + Vite (frontend)"]
  end
  subgraph Railway / Render
    API["Express + Prisma (backend)"]
  end
  subgraph Supabase
    DB[("PostgreSQL")]
  end
  subgraph Cloudinary
    CDN["Image storage"]
  end
  B --> F
  F -->|HTTPS REST| API
  API --> DB
  API --> CDN
```

# UI Wireframes

Design system: **Modern Government Dashboard** — dark navy primary (`#0B1F3A`), secondary `#153B6B`, accent `#00B4D8`, light background `#F5F7FA`. Rounded glassmorphism cards, soft shadows, Framer Motion animations.

---

## W-1 Landing Page

```
┌──────────────────────────────────────────────────────────────────────┐
│ ◉ RoadGuard        Home About Features Map Contact  [Login] [Register] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                    │
│   Smart Pothole Detection & Reporting System                        │
│   Report road hazards in seconds. Help your city fix them.          │
│                                          [Report a Pothole →]       │
│   ┌────────┐ ┌────────┐ ┌────────┐                                   │
│   │  1.2k  │ │  98%   │ │  450   │   Live stats cards               │
│   │ Reports│ │Fix rate│ │Roads   │                                   │
│   └────────┘ └────────┘ └────────┘                                   │
│   ┌───────────────────────────────────────────┐                      │
│   │            Interactive Map Preview        │  ← Leaflet, colored  │
│   │              (markers by status)          │     markers          │
│   └───────────────────────────────────────────┘                      │
│   Features | How It Works | Testimonials | Contact (sections)        │
├──────────────────────────────────────────────────────────────────────┤
│   Footer: © RoadGuard · Privacy · Terms                               │
└──────────────────────────────────────────────────────────────────────┘
```

## W-2 Auth Pages

```
Login (also /admin for Admin)          Register
┌───────────────────────────┐         ┌───────────────────────────┐
│  Welcome back             │         │  Create your account      │
│  ┌───────────────────┐    │         │  ┌───────────────────┐    │
│  │ email             │    │         │  │ full name         │    │
│  └───────────────────┘    │         │  └───────────────────┘    │
│  ┌───────────────────┐    │         │  ┌───────────────────┐    │
│  │ password  👁        │    │         │  │ email             │    │
│  └───────────────────┘    │         │  └───────────────────┘    │
│  ☑ Remember me  Forgot?   │         │  ┌───────────────────┐    │
│  [ Sign in ]              │         │  │ phone (optional)  │    │
│  ┌───────────────────┐    │         │  └───────────────────┘    │
│  │ oAuth buttons     │    │         │  ┌───────────────────┐    │
│  └───────────────────┘    │         │  │ password          │    │
└───────────────────────────┘         │  │ confirm password  │    │
                                      │  [ Create account ]  │    │
                                      └──────────────────────┘    │
                                      └───────────────────────────┘
```

## W-3 Report Form

```
┌──────────────────────────────────────────────────────────────┐
│ Upload Photo            Location                             │
│ ┌──────────────┐        ┌──────────────────────────────────┐ │
│ │  [drag/drop] │        │         Leaflet Map Picker       │ │
│ │  or camera   │        │   📍 marker (click to set)       │ │
│ └──────────────┘        └──────────────────────────────────┘ │
│ [Use My Location]  Lat: ___  Lng: ___  [Reverse Geocode →]   │
│ Road Name: ______  Municipality: ______  Ward: ___ Landmark: _│
│ Severity: ( Low · Medium · High · Critical )                  │
│ Description: ┌─────────────────────────────────────────┐      │
│              │                                         │      │
│              └─────────────────────────────────────────┘      │
│ ⚠ Possible duplicate detected (within 20 m)  [Cancel][Continue]│
│                                  [ Submit Report ]            │
└──────────────────────────────────────────────────────────────┘
```

## W-4 User Dashboard

```
┌──────────────────────────────────────────────────────────┐
│ ◉ RoadGuard   Dashboard  Report  Map  Notif🔔(3)  👤 John │
├──────────────────────────────────────────────────────────┤
│ My Reports                          [ + New Report ]     │
│ ┌────────────────────────────┐ ┌───────────────────────┐ │
│ │ Pothole on Main St         │ │ Timeline (report #12) │ │
│ │ [In Progress] High · Ward5 │ │ ○ Pending   ● Verified │ │
│ │ 🗓 06 Aug · 📍 Kathmandu   │ │ ● Assigned  ○ ...     │ │
│ │ [Details] [Receipt ↓]      │ │                       │ │
│ └────────────────────────────┘ └───────────────────────┘ │
│  (grid of my reports, each with status badge)             │
└──────────────────────────────────────────────────────────┘
```

## W-5 Admin Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│ ◉ RoadGuard · Admin   Overview Reports Map Users Analytics ⚙  │
├──────────────────────────────────────────────────────────────┤
│ Total  Pending  Verified  Assigned  InProg  Completed  Rej   │
│ [ 40 ]  [ 12 ]   [ 5 ]     [ 4 ]    [ 6 ]    [ 8 ]    [ 5 ]  │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐             │
│ │ Bar: by mun │ │ Pie: sever. │ │ Line: trend │             │
│ └─────────────┘ └─────────────┘ └─────────────┘             │
│ ┌─────────────────────────────────────────────┐  Recent      │
│ │            Heat Map (density)               │  Activity    │
│ └─────────────────────────────────────────────┘  Notifs     │
│ Recent Reports table (search / sort / filter / export)       │
└──────────────────────────────────────────────────────────────┘
```

## W-6 Reports Table (Admin)

```
┌────────────────────────────────────────────────────────────────┐
│ Search: ______  Status:[All ▾] Severity:[All ▾] Mun:[All ▾]    │
│ Sort:[Priority ▾]  Export: [PDF][XLSX][CSV]                    │
│ # │ Title        │ Status     │ Sev  │ Mun    │ Ward │ Pri │  │
│ 12│ Main St poth │ IN_PROGRESS│ HIGH │ Kathm. │ 5    │ 84  │  │
│   │  [Verify][Assign][Update][Reject][Delete]                  │
│ 13│ ...                                                        │
│ ◀ 1 2 3 4 ▶                                                     │
└────────────────────────────────────────────────────────────────┘
```

## W-7 Report Details

```
┌────────────────────────────────────────────────────────────┐
│ Pothole on Main St            [Receipt ↓] [Edit]            │
│ Status: ● In Progress   Severity: High   Priority: 84       │
│ ┌──────────┐ ┌──────────┐   📍 Kathmandu Ward 5, Main St    │
│ │  Before  │ │  After   │   🗓 06 Aug 2026 by John Doe      │
│ └──────────┘ └──────────┘   Description: ...                │
│ Timeline (vertical stepper) + Remarks                       │
└────────────────────────────────────────────────────────────┘
```

## W-8 404

```
┌──────────────────────────────────────────────┐
│              404                              │
│        🛣 The road you took is broken          │
│            [ Back Home ]                      │
└──────────────────────────────────────────────┘
```

## Responsive Breakpoints

| Breakpoint | Layout behavior |
|---|---|
| Desktop ≥1024px | Full sidebar/topbar, multi-column grids |
| Tablet 640–1023px | Collapsed nav, 2-column cards |
| Mobile <640px | Hamburger menu, single-column stack, bottom-sheet forms |

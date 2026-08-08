# The Four Core Algorithms

RoadGuard's pothole workflow is built around four algorithms. This document
explains each one: where it lives, what it computes, how it is used, its cost,
and how it interacts with the others.

```
 citizen uploads photo + GPS
        │
        ▼
 ┌───────────────┐   ┌─────────────────────┐
 │  CNN          │──▶│ severity (authoritative)  ──▶  priority score
 │  detection    │   │ confidence / bbox   │
 └───────────────┘   └─────────────────────┘
        │ GPS
        ▼
 ┌───────────────┐   new report near an existing one?
 │  Haversine    │──▶ yes → duplicate: confirmations++ (recomputed priority)
 │  duplicate    │
 └───────────────┘
        │
        ▼
 ┌───────────────────────────────┐
 │  Max Heap priority queue      │  open reports, scored
 │  (severity + confirmations +  │  severity+confirmations+age+traffic
 │   age + traffic)               │  highest score → dispatched first
 └───────────────────────────────┘
        │ "process next"
        ▼
 ┌───────────────┐   snap crew + pothole to OSM road nodes (Haversine)
 │  Dijkstra     │──▶ shortest DRIVING route (weight = travel seconds)
 │  routing      │   → distance, ETA, map polyline; recalcs when crew moves
 └───────────────┘
        ▼
 assigned + route shown on the admin map
```

---

## 1. Convolutional Neural Network (CNN) — pothole detection & severity

**Files:** `backend/src/algorithms/cnn/` (tensor, ops, model, forward,
backward, detector), `backend/data/cnn-weights.json`, `backend/scripts/train-cnn.ts`

**What it does.** Classifies a road photo into
`[NONE, LOW, MEDIUM, HIGH, CRITICAL]`. A real from-scratch CNN — no ML
framework — with a forward pass, backprop and an Adam optimizer implemented in
plain TypeScript. The weights are trained offline on an auto-generated
synthetic dataset and shipped as JSON, so inference at runtime is a single
forward pass over typed arrays (no network, no dependencies).

**Architecture (32×32 grayscale):**

```
conv1 (32×3×3, SAME) + ReLU → maxpool 2×2 → conv2 (48×3×3, SAME) + ReLU
→ maxpool 2×2 → [per-channel mean ⊕ per-channel top-3 mean] (96)
⊕ input depth-floor (mean of the 3 darkest pixels) (1)
→ dense 96→64 + ReLU → dense 64→5 → softmax
```

The pooling head is deliberately dual-branch: **mean** measures *how much* of
the frame is hole, **max/top-k** captures the *deepest* darkness in the conv
maps. A third **input depth-floor** branch reads the mean of the darkest input
pixels directly. It exists because ReLU + max-pooling structurally erases
darkness: dark pixels produce *low* post-ReLU activations, so every max-pool
surfaces a brighter cell and a small blob never reaches the conv2 peak branch.
The depth floor recovers that signal straight off the source — a broad shallow
shadow is only ~9/255 dark, any pothole is 60+ darker. This is what separates a
small deep pothole (LOW/HIGH ambiguity) from a broad shallow shadow (NONE), and
what makes the severity classes learnable. ~21k parameters.

**Severity mapping.** The CNN's argmax class is authoritative:
`Report.severity` is set from it and `Report.aiSeverity` / `Report.aiClassProbs`
persist the raw prediction. The citizen's form choice is stored separately as
`Report.suggestedSeverity` (a soft prior, not the record of truth). `NONE` (or a
pothole probability below the threshold) ⇒ the report is rejected as not a
pothole. The class probability vector also feeds `verify-AI` in the admin UI
and the top-priority flow.

**Bounding box.** `model.classActivation()` computes a gradient-free class
activation map (FC2→FC1→conv2 path projected onto the GAP half of the pool
head), normalized to a box for the annotated preview.

**Training.** `scripts/train-cnn.ts` synthesizes a dataset whose severity bands
are *non-overlapping* in blob radius and depth (LOW 5–6px/60–75 depth,
MEDIUM 8–10/105–120, HIGH 11–13×2/140–155, CRITICAL 15–17×3/185–215) on a
near-constant road gray, so darkness is an absolute depth signal. Negatives are
clean road, smooth shadows (kept below LOW's depth), thin cracks and painted
lane markings. It trains with Adam (lr 0.01), a Gaussian soft-target loss, and
asserts validation accuracy ≥ 95% before committing the weights. Retrain with:

```
cd backend && npx tsx scripts/train-cnn.ts
```

Swap in a real labeled dataset (64×64 grayscale, labels 0..4) to move from
synthetic to production data. **Cost:** O(C·K²·H·W) per layer forward/backward;
inference is microseconds on CPU.

---

## 2. Haversine Formula — duplicates, nearest teams, graph geometry

**Files:** `backend/src/algorithms/geo.ts`, `duplicate.ts`, used by
`report.repo.findOpenNear`, `routing.ts`, `roadGraph.ts`

**What it does.** Great-circle distance between two lat/lng points (in metres):

```
haversineDistance(a, b)
```

**Three roles in the workflow:**

1. **Duplicate detection.** When a citizen submits a pothole, the report
   repository finds existing open reports within a radius (20–50 m) of the new
   GPS point. If one exists, the new report is folded into it as a
   **confirmation**: `confirmations++` on the target, its `priorityScore`
   recomputed. A pothole reported by many citizens therefore climbs the
   priority queue — the system already "knows" it is real.
2. **Nearest-team straight-line pre-filter.** `nearestTeamByRoad` evaluates
   each crew by its *driving* route, but straight-line distance is reported
   alongside for reference (`straightLineKm`).
3. **Graph geometry.** Every road-graph edge length is a Haversine distance
   (converted to travel-seconds by the road class speed), and
   `roadGraph.nearestNode()` snaps a report's GPS point to the nearest OSM road
   node by Haversine. Dijkstra runs over these metre-exact weights.

**Cost:** O(1) per pair; a duplicate scan is O(reports-in-radius).

---

## 3. Max Heap Priority Queue — "work the worst pothole first"

**Files:** `backend/src/algorithms/heap.ts` (generic `BinaryHeap<T>`),
`backend/src/algorithms/priority.ts` (score), `backend/src/services/priorityQueue.service.ts`

**What it does.** Maintains the open reports (PENDING / VERIFIED / ASSIGNED /
IN_PROGRESS) as a **max-heap keyed by priority score**, so the highest-urgency
pothole is always visible and dispatchable. The same `BinaryHeap` class with
the opposite comparator doubles as Dijkstra's min-heap frontier — one
implementation, two uses.

**Score** (`computePriorityScore(severity, confirmations, ageDays, traffic)`):

```
severity weight   (LOW 10 / MEDIUM 20 / HIGH 30 / CRITICAL 40)
+ 12 × min(confirmations, 4)
+ min(ageDays rounded, 20)
+ min(traffic 0..10, 10)
```

Confirmations are capped at 4 (beyond that it's clearly a real pothole), age
caps at 20 days and traffic at 10 — so severity dominates but citizen
confirmation can flip an adjacent pair (e.g. a 3×-confirmed HIGH = 66 beats a
fresh CRITICAL = 40).

**Dynamic updates.** The heap is rebuilt on demand (O(n) heapify over a small
set), so it always reflects the latest mutations. Every relevant event
recomputes a score before the next snapshot:

- new report → inserted with its CNN severity;
- duplicate confirmation → `confirmations++` and re-score on the target;
- status transition (→ ASSIGNED, IN_PROGRESS, COMPLETED) → the report leaves
  the open set when closed, or re-scores while still open.

**Dispatch.** `POST /api/admin/priority-queue/process-next` pops the peak,
plans the road route to it (Dijkstra), assigns the nearest crew, and moves it
to ASSIGNED — all in one call. **Cost:** push/pop O(log n), heapify O(n),
full ordered view O(n log n).

---

## 4. Dijkstra's Algorithm — shortest road route from crew to pothole

**Files:** `backend/src/algorithms/dijkstra.ts` (shortest path),
`backend/src/algorithms/roadGraph.ts` (OSM graph + snapping),
`backend/src/algorithms/routing.ts` (route planning + team selection),
`backend/src/services/routing.service.ts` (HTTP layer)

**What it does.** Computes the shortest **driving** route from a maintenance
crew's current position to a report's pothole, over a real road network.

**The road graph.** Built once from real OpenStreetMap data:
`scripts/fetch-road-network.ts` queries the Overpass API over plain HTTP for
the Kathmandu valley, keeps car-passable `highway` classes, and caches the
result to `backend/data/road-graph.json` (~173k nodes / 360k edges). At runtime
`loadRoadGraph()` reads the cache (fully offline); a live fetch is the fallback
when the cache is missing. Each undirected edge carries:

- `distanceM` — road length (Haversine between the two nodes);
- `seconds` — travel time = `distanceM / (classSpeed / 3.6)`, using posted
  speeds per road class (motorway 90, primary 55, secondary 45, tertiary 35,
  residential 25, …).

Weights are travel-**seconds**, so Dijkstra minimizes driving time; distance is
summed separately along the path.

**Algorithm.** The frontier is a min-heap keyed by accumulated travel time.
Nodes are expanded once (each settled node's best distance is final), with
predecessor reconstruction and early exit when the target is popped.
**Cost:** O(E · log V).

**Routing (`planRoute`):**

1. Snap crew and pothole to their nearest graph nodes (Haversine).
2. If either is more than 2 km from the network → `reachable:false,
   reason:'off-network'` (handled gracefully in the UI — e.g. a seed report
   outside the valley).
3. Run Dijkstra; unreachable islands → `reason:'no-route'`.
4. Return `{ distanceKm, etaMinutes, path:[lat,lng][] }` — the polyline the
   admin map draws.

**Team selection (`nearestTeamByRoad`).** For each positioned crew, plan the
route to the pothole and pick the one with the **lowest ETA** (driving time) —
not merely the geometrically closest. `routing.service.routeToReport` prefers
the report's *assigned* worker when one exists, so editing a worker's lat/lng
recalculates their route automatically.

---

## How they fit together

- **CNN → priority score.** The CNN's severity is the dominant term of the
  priority score, so "what the network classified" drives "what gets worked
  first".
- **Haversine → heap.** Duplicate confirmations (Haversine) bump a report's
  score, moving it up the max-heap.
- **Heap → Dijkstra.** `process-next` pops the heap peak, then Dijkstra plans
  the crew's route to it; the crew assignment is the route's origin.
- **Haversine → Dijkstra.** Haversine supplies graph edge lengths, snapping,
  and the straight-line reference for the driving-route comparison.
- **Dijkstra → UI.** The returned polyline is rendered on the admin map with
  distance + ETA; it changes live when the crew's position is edited.

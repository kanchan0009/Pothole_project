/**
 * Dijkstra's shortest-path algorithm over the OSM road graph.
 *
 * The frontier is a MIN-heap (the same `BinaryHeap` class that powers the
 * pothole MAX-heap priority queue, just with the opposite comparator), so every
 * node is expanded at most once and the run is O(E·log V). Edge weights are
 * travel time in seconds, so the returned route minimizes driving time; total
 * road distance is summed separately along the path.
 */
import { BinaryHeap } from './heap.js';
import type { RoadGraph } from './roadGraph.js';

export interface RouteResult {
  distanceM: number;
  timeSeconds: number;
  /** Node indices from source to target (inclusive). */
  path: number[];
}

export function shortestPath(graph: RoadGraph, source: number, target: number): RouteResult | null {
  const n = graph.nodes.length;
  if (source < 0 || source >= n || target < 0 || target >= n) return null;
  if (source === target) return { distanceM: 0, timeSeconds: 0, path: [source] };

  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const settled = new Uint8Array(n);

  dist[source] = 0;
  const frontier = new BinaryHeap<{ index: number; d: number }>((a, b) => a.d - b.d);
  frontier.push({ index: source, d: 0 });

  while (!frontier.isEmpty) {
    const current = frontier.pop()!;
    if (settled[current.index]) continue;
    settled[current.index] = 1;
    if (current.index === target) break;

    for (const edge of graph.edges[current.index] ?? []) {
      if (settled[edge.to]) continue;
      const candidate = current.d + edge.seconds;
      if (candidate < dist[edge.to]!) {
        dist[edge.to] = candidate;
        prev[edge.to] = current.index;
        frontier.push({ index: edge.to, d: candidate });
      }
    }
  }

  if (!(dist[target]! < Infinity)) return null; // unreachable

  const path: number[] = [];
  for (let v = target; v !== -1; v = prev[v]!) {
    path.push(v);
    if (v === source) break;
  }
  path.reverse();

  // Sum the road lengths along the optimal path.
  let distanceM = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const next = graph.edges[path[i]!]!.find((e) => e.to === path[i + 1]);
    if (next) distanceM += next.distanceM;
  }

  return { distanceM, timeSeconds: dist[target]!, path };
}

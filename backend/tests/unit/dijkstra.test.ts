import { describe, expect, it } from 'vitest';
import { shortestPath } from '../../src/algorithms/dijkstra.js';
import type { RoadEdge, RoadGraph } from '../../src/algorithms/roadGraph.js';

/** Build a RoadGraph from a list of [from, to, seconds] edges (undirected). */
function makeGraph(n: number, edges: [number, number, number][]): RoadGraph {
  const nodes = Array.from({ length: n }, (_, i) => ({ id: i, lat: i * 0.001, lng: 0 }));
  const adj: RoadEdge[][] = nodes.map(() => []);
  for (const [a, b, seconds] of edges) {
    adj[a]!.push({ to: b, seconds, distanceM: seconds * 100 }); // distanceM arbitrary here
    adj[b]!.push({ to: a, seconds, distanceM: seconds * 100 });
  }
  return {
    bbox: { minLat: 0, minLng: 0, maxLat: 0, maxLng: 0 },
    nodes,
    edges: adj,
    fetchedAt: '',
    stats: { nodeCount: n, edgeCount: edges.length, source: 'test' },
  };
}

describe('shortestPath — hand-built graph with a known shortest route', () => {
  //    n1 --7-- n0 --3-- n3
  //     |                 |
  //     4                 5
  //     |                 |
  //    n2 ----------1-----+
  //  Direct n0→n2 is not an edge; the two candidate routes are
  //  n0→n1→n2 = 11s and n0→n3→n2 = 8s → Dijkstra must pick the latter.
  const graph = makeGraph(4, [
    [0, 1, 7],
    [1, 2, 4],
    [0, 3, 3],
    [3, 2, 5],
  ]);

  it('finds the minimum-time path and reconstructs the node sequence', () => {
    const r = shortestPath(graph, 0, 2);
    expect(r).not.toBeNull();
    expect(r!.timeSeconds).toBe(8);
    expect(r!.path).toEqual([0, 3, 2]);
  });

  it('reports road distance summed along the optimal path', () => {
    const r = shortestPath(graph, 0, 2);
    expect(r!.distanceM).toBe((8 * 100));
  });

  it('path from a node to itself is zero-cost', () => {
    const r = shortestPath(graph, 1, 1);
    expect(r).toEqual({ distanceM: 0, timeSeconds: 0, path: [1] });
  });

  it('returns null for out-of-range node ids', () => {
    expect(shortestPath(graph, -1, 2)).toBeNull();
    expect(shortestPath(graph, 0, 99)).toBeNull();
  });

  it('returns null when the target is unreachable', () => {
    const g = makeGraph(5, [
      [0, 1, 2],
      [1, 2, 3],
    ]); // node 3 and 4 are islands
    expect(shortestPath(g, 0, 3)).toBeNull();
    expect(shortestPath(g, 4, 0)).toBeNull();
  });
});

/** Seeded RNG so the randomized cross-check is deterministic. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Reference Dijkstra with a plain array scan (O(V²)) — a different data structure. */
function referenceShortestTime(graph: RoadGraph, source: number, target: number): number | null {
  const n = graph.nodes.length;
  const dist = new Array<number>(n).fill(Infinity);
  const visited = new Array<boolean>(n).fill(false);
  dist[source] = 0;
  for (let iter = 0; iter < n; iter++) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!visited[i] && dist[i]! < best) {
        best = dist[i]!;
        u = i;
      }
    }
    if (u === -1) break;
    visited[u] = true;
    if (u === target) break;
    for (const e of graph.edges[u]!) {
      if (!visited[e.to] && dist[u]! + e.seconds < dist[e.to]!) {
        dist[e.to] = dist[u]! + e.seconds;
      }
    }
  }
  return Number.isFinite(dist[target]) ? dist[target] : null;
}

describe('shortestPath — randomized cross-check against an O(V²) reference', () => {
  it('matches the reference on 200 random source/target pairs over a random graph', () => {
    const rand = mulberry32(1234);
    const n = 14;
    // Random undirected graph: each pair connects with prob ~0.35, weight 1..15.
    const edges: [number, number, number][] = [];
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        if (rand() < 0.35) edges.push([a, b, 1 + Math.floor(rand() * 15)]);
      }
    }
    const graph = makeGraph(n, edges);

    for (let t = 0; t < 200; t++) {
      const s = Math.floor(rand() * n);
      const g = Math.floor(rand() * n);
      const got = shortestPath(graph, s, g);
      const want = referenceShortestTime(graph, s, g);
      expect(got ? got.timeSeconds : null).toBe(want);
      if (got && want !== null) {
        // The returned path must be a real walk whose edge costs sum to the optimum.
        expect(got.path[0]).toBe(s);
        expect(got.path[got.path.length - 1]).toBe(g);
        let total = 0;
        for (let i = 0; i < got.path.length - 1; i++) {
          const edge = graph.edges[got.path[i]!]!.find((e) => e.to === got.path[i + 1]!);
          expect(edge).toBeDefined();
          total += edge!.seconds;
        }
        expect(total).toBe(want);
      }
    }
  });
});

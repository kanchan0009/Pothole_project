/**
 * The road network Dijkstra routes over — a weighted, undirected graph built
 * from real OpenStreetMap road data.
 *
 * `scripts/fetch-road-network.ts` queries the Overpass API (plain HTTP) for the
 * Kathmandu valley, filters to car-passable `highway` classes, and persists the
 * result to `backend/data/road-graph.json`. At runtime `loadRoadGraph()` reads
 * that cache (fully offline); if the cache is missing it falls back to a live
 * fetch so the first request populates it.
 *
 * Edge weights are TRAVEL TIME in seconds (`distance / road-class speed`), so
 * Dijkstra minimizes driving time; each edge also carries its length in meters
 * so the route can report total distance. Roads are treated as two-way.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { haversineDistance } from './geo.js';

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const CACHE_PATH = path.join(DATA_DIR, 'road-graph.json');

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface RoadNode {
  id: number;
  lat: number;
  lng: number;
}

export interface RoadEdge {
  to: number; // node index
  seconds: number; // travel time
  distanceM: number; // road length
}

export interface RoadGraph {
  bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number };
  nodes: RoadNode[]; // index = node id
  edges: RoadEdge[][]; // adjacency list, parallel to nodes
  fetchedAt: string;
  stats: { nodeCount: number; edgeCount: number; source: string };
}

/** Region covered by the graph — the Kathmandu valley demo area. */
export const VALLEY_BBOX = {
  minLat: 27.63,
  minLng: 85.25,
  maxLat: 27.75,
  maxLng: 85.45,
};

const OVERPASS_URL = 'http://overpass-api.de/api/interpreter';
const FETCH_TIMEOUT_MS = 90_000;
/** The public Overpass instance is heavily loaded — retry 429/5xx with backoff. */
const FETCH_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000];

/**
 * The highway classes actually fetched. The public Overpass instance reliably
 * times out on the full 15-class list over the whole valley, so the fetch
 * focuses on the classes that carry most valley traffic (motorway/trunk barely
 * exist there; link/service roads are skippable for a routing demo). Roads of
 * these classes still route normally if present in a cached graph.
 */
const FETCH_HIGHWAYS = [
  'primary',
  'secondary',
  'tertiary',
  'unclassified',
  'residential',
] as const;

/** Posted speed (km/h) per highway class — used to weight edges by time. */
const HIGHWAY_SPEEDS: Record<string, number> = {
  motorway: 90,
  motorway_link: 60,
  trunk: 70,
  trunk_link: 50,
  primary: 55,
  primary_link: 40,
  secondary: 45,
  secondary_link: 35,
  tertiary: 35,
  tertiary_link: 30,
  unclassified: 25,
  residential: 25,
  living_street: 15,
  service: 15,
  road: 20,
};

const DEFAULT_SPEED = 25;

export function roadSpeed(highway: string | undefined): number {
  return (highway && HIGHWAY_SPEEDS[highway]) || DEFAULT_SPEED;
}

/** The subset of highway classes routed by vehicles. */
const ROUTED_HIGHWAYS = [
  'motorway',
  'motorway_link',
  'trunk',
  'trunk_link',
  'primary',
  'primary_link',
  'secondary',
  'secondary_link',
  'tertiary',
  'tertiary_link',
  'unclassified',
  'residential',
  'living_street',
  'service',
  'road',
] as const;

const ROUTED_HIGHWAY_SET = new Set<string>(ROUTED_HIGHWAYS);

export interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  nodes?: number[];
  /** Overpass emits `lat`/`lon` (not `lng`) for node geometries. */
  geometry?: { lat: number; lon: number }[];
}

/** Turns Overpass `way` elements into a graph. Shared node ids = shared junctions. */
export function buildGraphFromOverpassElements(elements: OverpassElement[]): RoadGraph {
  const indexByOsmId = new Map<number, number>();
  const nodes: RoadNode[] = [];
  const edges: RoadEdge[][] = [];

  const getNode = (id: number, lat: number, lng: number): number => {
    const existing = indexByOsmId.get(id);
    if (existing !== undefined) return existing;
    const index = nodes.length;
    nodes.push({ id, lat, lng });
    edges.push([]);
    indexByOsmId.set(id, index);
    return index;
  };

  let edgeCount = 0;
  for (const way of elements) {
    if (way.type !== 'way') continue;
    if (!way.tags?.highway || !ROUTED_HIGHWAY_SET.has(way.tags.highway)) continue;
    const geometry = way.geometry;
    const nodeIds = way.nodes;
    if (!geometry || !nodeIds || geometry.length < 2 || geometry.length !== nodeIds.length) continue;
    const speed = roadSpeed(way.tags.highway);
    for (let i = 0; i < geometry.length - 1; i++) {
      // Overpass geometry uses `lon`; normalize to `lng` for the graph.
      const a = { lat: geometry[i]!.lat, lng: geometry[i]!.lon };
      const b = { lat: geometry[i + 1]!.lat, lng: geometry[i + 1]!.lon };
      const aIdx = getNode(nodeIds[i]!, a.lat, a.lng);
      const bIdx = getNode(nodeIds[i + 1]!, b.lat, b.lng);
      if (aIdx === bIdx) continue;
      const distanceM = haversineDistance(a.lat, a.lng, b.lat, b.lng);
      if (distanceM < 1) continue;
      const seconds = distanceM / (speed / 3.6);
      edges[aIdx]!.push({ to: bIdx, seconds, distanceM });
      edges[bIdx]!.push({ to: aIdx, seconds, distanceM });
      edgeCount++;
    }
  }

  // Degenerate roads (e.g. a path with zero routed segments) leave orphan nodes —
  // drop nodes with no edges so Dijkstra doesn't dead-end on them.
  const alive: number[] = [];
  const remap = new Map<number, number>();
  for (let i = 0; i < nodes.length; i++) {
    if (edges[i]!.length > 0) {
      remap.set(i, alive.length);
      alive.push(i);
    }
  }
  const prunedNodes = alive.map((i) => nodes[i]!);
  const prunedEdges = alive.map((i) => edges[i]!.map((e) => ({ ...e, to: remap.get(e.to)! })));

  return {
    bbox: { ...VALLEY_BBOX },
    nodes: prunedNodes,
    edges: prunedEdges,
    fetchedAt: new Date().toISOString(),
    stats: {
      nodeCount: prunedNodes.length,
      edgeCount,
      source: 'overpass osm (http://overpass-api.de/api/interpreter)',
    },
  };
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** POSTs an Overpass query and returns the parsed JSON body (retries 429/5xx). */
async function overpass(query: string): Promise<{ elements?: OverpassElement[] }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': 'roadguard-pothole-demo/1.0 (Kathmandu road graph cache)',
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: controller.signal,
      });
      if (!res.ok) {
        lastError = new Error(`Overpass API returned HTTP ${res.status}`);
        const retryable = res.status === 429 || res.status === 406 || res.status >= 500;
        if (retryable && attempt < FETCH_ATTEMPTS - 1) {
          await sleep(RETRY_DELAYS_MS[attempt] ?? 5_000);
          continue;
        }
        throw lastError;
      }
      return (await res.json()) as { elements?: OverpassElement[] };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError' && attempt < FETCH_ATTEMPTS - 1) {
        lastError = err;
        await sleep(RETRY_DELAYS_MS[attempt] ?? 5_000);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error('Overpass fetch failed');
}

/** Fetches the valley's routed road network from OSM (Overpass). */
export async function fetchRoadNetwork(bbox = VALLEY_BBOX): Promise<RoadGraph> {
  const { minLat, minLng, maxLat, maxLng } = bbox;
  const query =
    `[out:json][timeout:${Math.round(FETCH_TIMEOUT_MS / 1000)}];` +
    `way["highway"~"^(${FETCH_HIGHWAYS.join('|')})$"](${minLat},${minLng},${maxLat},${maxLng});` +
    `out body geom;`;
  const data = await overpass(query);
  return buildGraphFromOverpassElements(data.elements ?? []);
}

export async function saveRoadGraph(graph: RoadGraph): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CACHE_PATH, JSON.stringify(graph), 'utf8');
}

let cached: RoadGraph | null = null;

/**
 * Returns the road graph: from the on-disk cache, or — if `allowFetch` and no
 * cache exists — by fetching from Overpass and persisting it. The cache makes
 * routing work offline after the first successful fetch.
 */
export async function loadRoadGraph(opts: { allowFetch?: boolean } = {}): Promise<RoadGraph> {
  if (cached) return cached;
  try {
    const raw = await fs.readFile(CACHE_PATH, 'utf8');
    cached = JSON.parse(raw) as RoadGraph;
    return cached;
  } catch {
    // no cache — fall through to fetch (or error when disabled)
  }
  if (opts.allowFetch === false) {
    throw new Error('Road graph is not cached; run scripts/fetch-road-network.ts or allow a fetch');
  }
  const graph = await fetchRoadNetwork();
  await saveRoadGraph(graph);
  cached = graph;
  return cached;
}

/** Clears the module-level cache (used by tests and after a fresh fetch). */
export function resetRoadGraphCache(): void {
  cached = null;
}

/** Nearest graph node to a coordinate (Haversine) — the Dijkstra snap point. */
export function nearestNode(
  graph: RoadGraph,
  lat: number,
  lng: number
): { index: number; distanceM: number } {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    const n = graph.nodes[i]!;
    const d = haversineDistance(lat, lng, n.lat, n.lng);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { index: best, distanceM: bestD };
}

export const ROAD_GRAPH_CACHE_PATH = CACHE_PATH;

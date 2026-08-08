import { describe, expect, it } from 'vitest';
import { haversineDistance } from '../../src/algorithms/geo.js';
import {
  buildGraphFromOverpassElements,
  nearestNode,
  roadSpeed,
  VALLEY_BBOX,
  type OverpassElement,
} from '../../src/algorithms/roadGraph.js';

describe('roadSpeed', () => {
  it('maps highway classes to posted speeds (km/h)', () => {
    expect(roadSpeed('motorway')).toBe(90);
    expect(roadSpeed('primary')).toBe(55);
    expect(roadSpeed('secondary')).toBe(45);
    expect(roadSpeed('residential')).toBe(25);
    expect(roadSpeed('service')).toBe(15);
  });

  it('falls back to a default speed for unknown classes', () => {
    expect(roadSpeed('pedestrian')).toBe(25);
    expect(roadSpeed(undefined)).toBe(25);
  });
});

/** A two-node Overpass way. */
function way(id: number, highway: string, coords: [number, number][]): OverpassElement {
  return {
    type: 'way',
    id,
    tags: { highway },
    nodes: coords.map((_, i) => id * 100 + i),
    geometry: coords.map(([lat, lon]) => ({ lat, lon })),
  };
}

describe('buildGraphFromOverpassElements', () => {
  it('builds a weighted undirected graph, sharing junction nodes across ways', () => {
    // Both ways reference OSM node 101 at (0,1) — the shared junction.
    const elements = [
      { type: 'way', id: 1, tags: { highway: 'primary' }, nodes: [100, 101], geometry: [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }] },
      { type: 'way', id: 2, tags: { highway: 'residential' }, nodes: [101, 102], geometry: [{ lat: 0, lon: 1 }, { lat: 0, lon: 2 }] },
    ];
    const graph = buildGraphFromOverpassElements(elements);

    expect(graph.nodes).toHaveLength(3); // node (0,1) is shared by both ways
    expect(graph.nodes.map((n) => n.lat)).toEqual([0, 0, 0]);
    expect(graph.nodes.map((n) => n.lng)).toEqual([0, 1, 2]);
    expect(graph.stats.nodeCount).toBe(3);
    expect(graph.stats.edgeCount).toBe(2); // two directed pairs / two segments
    expect(graph.stats.source).toContain('overpass');

    // Node 0 connects to node 1 via the primary speed, node 1 to node 2 via residential.
    const edge01 = graph.edges[0]![0]!;
    const edge12 = graph.edges[2]![0]!;
    const d01 = haversineDistance(0, 0, 0, 1);
    const d12 = haversineDistance(0, 1, 0, 2);
    expect(edge01.to).toBe(1);
    expect(edge01.distanceM).toBeCloseTo(d01, 6);
    expect(edge01.seconds).toBeCloseTo(d01 / (roadSpeed('primary') / 3.6), 6);
    expect(edge12.distanceM).toBeCloseTo(d12, 6);
    expect(edge12.seconds).toBeCloseTo(d12 / (roadSpeed('residential') / 3.6), 6);

    // Undirected: the reverse direction is present too.
    expect(graph.edges[1]!.map((e) => e.to)).toEqual(expect.arrayContaining([0, 2]));
  });

  it('skips non-routed highway classes, degenerate and single-point ways', () => {
    const elements = [
      way(1, 'footway', [
        [0, 3],
        [0, 4],
      ]), // not routed
      {
        type: 'way',
        id: 2,
        tags: { highway: 'residential' },
        nodes: [200, 201],
        geometry: [
          { lat: 1, lon: 1 },
          { lat: 1, lon: 1 },
        ],
      }, // zero-length segment → orphan nodes pruned
      { type: 'way', id: 3, tags: { highway: 'secondary' }, nodes: [300], geometry: [{ lat: 5, lon: 5 }] }, // single point
      { type: 'node', id: 7, lat: 0, lng: 0 },
    ];
    const graph = buildGraphFromOverpassElements(elements);
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
    expect(graph.stats.edgeCount).toBe(0);
  });

  it('anchors the graph bbox on the Kathmandu valley demo area', () => {
    const graph = buildGraphFromOverpassElements([way(1, 'primary', [[0, 0], [0, 1]])]);
    expect(graph.bbox).toEqual(VALLEY_BBOX);
  });
});

describe('nearestNode', () => {
  it('returns the closest graph node (Haversine) with its distance', () => {
    const graph = buildGraphFromOverpassElements([
      way(1, 'primary', [
        [0, 0],
        [0, 1],
        [0, 2],
      ]),
    ]);
    const hit = nearestNode(graph, 0.0001, 1.1);
    expect(hit.index).toBe(1); // the (0,1) node
    expect(hit.distanceM).toBeCloseTo(haversineDistance(0.0001, 1.1, 0, 1), 4);
  });
});

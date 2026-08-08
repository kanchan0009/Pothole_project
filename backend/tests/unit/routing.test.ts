import { describe, expect, it } from 'vitest';
import { OFF_NETWORK_MAX_M, nearestTeamByRoad, planRoute } from '../../src/algorithms/routing.js';
import type { RoadEdge, RoadGraph } from '../../src/algorithms/roadGraph.js';

/**
 * A tiny two-hop road: n0 --(100s/1500m)-- n1 --(100s/1500m)-- n2.
 * nOff is a coordinate far from the network (used for off-network teams).
 */
function makeGraph(): RoadGraph {
  const nodes = [
    { id: 0, lat: 0, lng: 0 },
    { id: 1, lat: 0, lng: 0.001 },
    { id: 2, lat: 0, lng: 0.002 },
  ];
  const edge = (to: number): RoadEdge => ({ to, seconds: 100, distanceM: 1500 });
  const edges: RoadEdge[][] = [
    [edge(1)],
    [edge(0), edge(2)],
    [edge(1)],
  ];
  return {
    bbox: { minLat: 0, minLng: 0, maxLat: 0, maxLng: 0 },
    nodes,
    edges,
    fetchedAt: '',
    stats: { nodeCount: 3, edgeCount: 2, source: 'test' },
  };
}

const graph = makeGraph();
const TARGET = { lat: 0, lng: 0.002 }; // snaps to n2

describe('planRoute', () => {
  it('returns a reachable route: polyline, distance and ETA along the road', () => {
    const route = planRoute(graph, { lat: 0, lng: 0 }, TARGET);
    expect(route.reachable).toBe(true);
    expect(route.path).toEqual([
      [0, 0],
      [0, 0.001],
      [0, 0.002],
    ]);
    expect(route.distanceKm).toBeCloseTo(3, 2); // 3000m / 1000
    expect(route.etaMinutes).toBeCloseTo(200 / 60, 2);
  });

  it('flags endpoints too far from the network as off-network', () => {
    const route = planRoute(graph, { lat: 1, lng: 1 }, TARGET);
    expect(route.reachable).toBe(false);
    expect(route.reason).toBe('off-network');
    expect(route.offNetworkM).toBeGreaterThan(OFF_NETWORK_MAX_M);
  });

  it('snaps slightly-off points to the road and still routes', () => {
    // A point 100m off the road snaps to n1 and routes fine.
    const route = planRoute(graph, { lat: 0, lng: 0.0009 }, { lat: 0, lng: 0.0021 });
    expect(route.reachable).toBe(true);
    expect(route.path!.length).toBeGreaterThanOrEqual(2);
    expect(route.offNetworkM).toBeLessThan(OFF_NETWORK_MAX_M);
  });
});

describe('nearestTeamByRoad', () => {
  it('picks the road-reachable team, rejecting off-network crews', () => {
    const result = nearestTeamByRoad(graph, TARGET, [
      { id: 1, name: 'Far-off crew', lat: 1, lng: 1 }, // off-network → skipped
      { id: 2, name: 'On-road crew', lat: 0, lng: 0 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.team.id).toBe(2);
    expect(result!.teamSource).toBeUndefined(); // not part of TeamRoute
    expect(result!.reachable).toBe(true);
    expect(result!.etaMinutes).toBeCloseTo(200 / 60, 2);
  });

  it('returns null when no crew is positioned or reachable', () => {
    expect(nearestTeamByRoad(graph, TARGET, [])).toBeNull();
    expect(
      nearestTeamByRoad(graph, TARGET, [
        { id: 1, name: 'Island crew', lat: 1, lng: 1 },
        { id: 2, name: 'Other island', lat: 2, lng: 2 },
      ])
    ).toBeNull();
  });
});

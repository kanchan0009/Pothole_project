
import { haversineDistance } from './geo.js';
import { shortestPath } from './dijkstra.js';
import { nearestNode, type GeoPoint, type RoadGraph } from './roadGraph.js';


export const OFF_NETWORK_MAX_M = 2000;

export interface RoutePlan {
  reachable: boolean;
  reason?: 'off-network' | 'no-route' | 'no-coordinates' | 'no-workers';
  distanceKm?: number;
  etaMinutes?: number;
  
  path?: [number, number][];
  
  offNetworkM?: number;
}

export function planRoute(graph: RoadGraph, from: GeoPoint, to: GeoPoint): RoutePlan {
  const src = nearestNode(graph, from.lat, from.lng);
  const dst = nearestNode(graph, to.lat, to.lng);
  const worstOff = Math.max(src.distanceM, dst.distanceM);
  if (worstOff > OFF_NETWORK_MAX_M) {
    return { reachable: false, reason: 'off-network', offNetworkM: worstOff };
  }

  const result = shortestPath(graph, src.index, dst.index);
  if (!result) {
    return { reachable: false, reason: 'no-route' };
  }

  
  const path: [number, number][] = [];
  for (const nodeIndex of result.path) {
    const node = graph.nodes[nodeIndex]!;
    const last = path[path.length - 1];
    if (!last || last[0] !== node.lat || last[1] !== node.lng) {
      path.push([node.lat, node.lng]);
    }
  }

  return {
    reachable: true,
    distanceKm: result.distanceM / 1000,
    etaMinutes: result.timeSeconds / 60,
    path,
    offNetworkM: worstOff,
  };
}

export interface PositionedTeam {
  id: number;
  name: string;
  lat: number;
  lng: number;
}

export interface TeamRoute extends RoutePlan {
  team: PositionedTeam;
  
  straightLineKm: number;
}


export function nearestTeamByRoad(
  graph: RoadGraph,
  to: GeoPoint,
  teams: PositionedTeam[]
): TeamRoute | null {
  let best: TeamRoute | null = null;
  for (const team of teams) {
    const route = planRoute(graph, { lat: team.lat, lng: team.lng }, to);
    if (!route.reachable) continue;
    const candidate: TeamRoute = {
      ...route,
      team,
      straightLineKm: haversineDistance(team.lat, team.lng, to.lat, to.lng) / 1000,
    };
    if (!best || (candidate.etaMinutes ?? Infinity) < (best.etaMinutes ?? Infinity)) {
      best = candidate;
    }
  }
  return best;
}

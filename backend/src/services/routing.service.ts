/**
 * Road routing service — the HTTP-facing layer over the OSM road graph.
 *
 * `routeToReport` plans the driving route from the maintenance crew to a
 * pothole: it prefers the report's *assigned* worker (so the route recalculates
 * automatically when that worker's lat/lng is edited), otherwise it picks the
 * nearest team by driving time (Dijkstra over Haversine-weighted edges).
 */
import { loadRoadGraph, type RoadGraph } from '../algorithms/roadGraph.js';
import { nearestTeamByRoad, planRoute, type PositionedTeam, type RoutePlan } from '../algorithms/routing.js';
import type { GeoPoint } from '../algorithms/roadGraph.js';
import { prisma } from '../config/prisma.js';
import { reportRepo } from '../repositories/report.repo.js';
import { userRepo } from '../repositories/user.repo.js';
import { ApiError } from '../utils/ApiError.js';

export type TeamSource = 'assigned' | 'nearest';

export interface ReportRouteOutput {
  reportId: number;
  /** The road route (reachable flag + path + distance/ETA), or an unreachable plan. */
  route: RoutePlan;
  /** The crew the route is drawn from (null when no positioned team exists). */
  team: PositionedTeam | null;
  teamSource: TeamSource | null;
}

let graphPromise: Promise<RoadGraph> | null = null;

/** Lazy singleton — the graph is read once per process, then reused. */
export function getRoadGraph(): Promise<RoadGraph> {
  graphPromise ??= loadRoadGraph({ allowFetch: true });
  return graphPromise;
}

/** Test hook: force the singleton to re-read the cache / fixture graph. */
export function resetRoadGraphSingleton(): void {
  graphPromise = null;
}

/** Test hook: inject a fixed graph (e.g. a small fixture) so API tests run offline. */
export function injectRoadGraph(graph: RoadGraph): void {
  graphPromise = Promise.resolve(graph);
}

export const routingService = {
  /**
   * Route from the crew to the report. Falls back to the nearest *driving*
   * team when the report has no assignment yet. Off-network reports return
   * `reachable:false` rather than throwing — the UI shows that gracefully.
   */
  async routeToReport(reportId: number): Promise<ReportRouteOutput> {
    const report = await reportRepo.findById(reportId);
    if (!report) {
      throw ApiError.notFound('Report not found');
    }
    if (report.latitude == null || report.longitude == null) {
      return { reportId, route: { reachable: false, reason: 'no-coordinates' }, team: null, teamSource: null };
    }

    const target = { lat: report.latitude, lng: report.longitude };
    const graph = await getRoadGraph();

    // 1. Prefer the assigned worker — editing their coords recalculates the route.
    const assigned = await prisma.assignment.findFirst({
      where: { reportId },
      orderBy: { assignedAt: 'desc' },
    });
    let team: PositionedTeam | null = null;
    let teamSource: TeamSource | null = null;
    if (assigned?.userId) {
      const worker = await userRepo.findById(assigned.userId);
      if (worker?.latitude != null && worker.longitude != null) {
        team = { id: worker.id, name: worker.name, lat: worker.latitude, lng: worker.longitude };
        teamSource = 'assigned';
      }
    }

    // 2. Otherwise the nearest team by *driving* time (Dijkstra), not straight-line.
    let positioned: PositionedTeam[] = [];
    if (!team) {
      const workers = await userRepo.findWorkers();
      positioned = workers
        .filter(
          (w): w is typeof w & { latitude: number; longitude: number } =>
            w.latitude != null && w.longitude != null
        )
        .map((w) => ({ id: w.id, name: w.name, lat: w.latitude, lng: w.longitude }));
      const best = nearestTeamByRoad(graph, target, positioned);
      if (best) {
        team = best.team;
        teamSource = 'nearest';
      }
    }

    // Always run planRoute so an unreachable report is classified as
    // `off-network` / `no-route` (not conflated with "no workers"). When no
    // crew could be resolved we use the first positioned worker as the origin.
    const origin: GeoPoint | null = team
      ? { lat: team.lat, lng: team.lng }
      : positioned[0]
        ? { lat: positioned[0].lat, lng: positioned[0].lng }
        : null;
    const route: RoutePlan = origin
      ? planRoute(graph, origin, target)
      : { reachable: false, reason: 'no-workers' };

    return { reportId, route, team, teamSource };
  },
};


import { loadRoadGraph, type RoadGraph } from '../algorithms/roadGraph.js';
import { nearestTeamByRoad, planRoute, type PositionedTeam, type RoutePlan } from '../algorithms/routing.js';
import type { GeoPoint } from '../algorithms/roadGraph.js';
import { prisma } from '../config/prisma.js';
import { reportRepo } from '../repositories/report.repo.js';
import { userRepo } from '../repositories/user.repo.js';
import { ApiError } from '../utils/ApiError.js';

export type TeamSource = 'assigned' | 'nearest' | 'selected';

export interface ReportRouteOutput {
  reportId: number;
  
  route: RoutePlan;
  
  team: PositionedTeam | null;
  teamSource: TeamSource | null;
}

let graphPromise: Promise<RoadGraph> | null = null;


export function getRoadGraph(): Promise<RoadGraph> {
  graphPromise ??= loadRoadGraph({ allowFetch: true });
  return graphPromise;
}


export function resetRoadGraphSingleton(): void {
  graphPromise = null;
}


export function injectRoadGraph(graph: RoadGraph): void {
  graphPromise = Promise.resolve(graph);
}

export const routingService = {
  
  async routeToReport(reportId: number, options?: { workerId?: number }): Promise<ReportRouteOutput> {
    const report = await reportRepo.findById(reportId);
    if (!report) {
      throw ApiError.notFound('Report not found');
    }
    if (report.latitude == null || report.longitude == null) {
      return { reportId, route: { reachable: false, reason: 'no-coordinates' }, team: null, teamSource: null };
    }

    const target = { lat: report.latitude, lng: report.longitude };
    const graph = await getRoadGraph();

    let team: PositionedTeam | null = null;
    let teamSource: TeamSource | null = null;

    
    if (options?.workerId) {
      const worker = await userRepo.findById(options.workerId);
      if (
        worker?.isWorker &&
        worker.isActive &&
        worker.latitude != null &&
        worker.longitude != null
      ) {
        team = { id: worker.id, name: worker.name, lat: worker.latitude, lng: worker.longitude };
        teamSource = 'selected';
      }
    }

    
    if (!team) {
      const assigned = await prisma.assignment.findFirst({
        where: { reportId },
        orderBy: { assignedAt: 'desc' },
      });
      if (assigned?.userId) {
        const worker = await userRepo.findById(assigned.userId);
        if (worker?.latitude != null && worker.longitude != null) {
          team = { id: worker.id, name: worker.name, lat: worker.latitude, lng: worker.longitude };
          teamSource = 'assigned';
        }
      }
    }

    
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

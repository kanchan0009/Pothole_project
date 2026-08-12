import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { computePriorityScore } from '../../src/algorithms/priority.js';
import type { RoadGraph } from '../../src/algorithms/roadGraph.js';
import { injectRoadGraph } from '../../src/services/routing.service.js';
import type { Severity } from '@prisma/client';
import { cleanDb } from '../helpers/clean-db.js';

let app: Express;
let adminToken = '';
let citizenToken = '';
let citizenId = 0;
let workerId = 0;

const ADMIN = { email: 'admin.algo@roadguard.gov', password: 'Admin@123' };
const CITIZEN = { name: 'Citizen Algo', email: 'citizen.algo@example.com', password: 'StrongPass@1' };

/** Small Kathmandu fixture graph: n0 --60s-- n1 --120s-- n2. */
function fixtureGraph(): RoadGraph {
  const nodes = [
    { id: 1, lat: 27.7031, lng: 85.3184 }, // n0 — the worker's start position
    { id: 2, lat: 27.71, lng: 85.32 }, //     n1 — report coords
    { id: 3, lat: 27.715, lng: 85.325 }, //   n2 — where the worker gets moved
  ];
  return {
    bbox: { minLat: 27.63, minLng: 85.25, maxLat: 27.75, maxLng: 85.45 },
    nodes,
    edges: [
      [{ to: 1, seconds: 60, distanceM: 800 }],
      [
        { to: 0, seconds: 60, distanceM: 800 },
        { to: 2, seconds: 120, distanceM: 1600 },
      ],
      [{ to: 1, seconds: 120, distanceM: 1600 }],
    ],
    fetchedAt: new Date().toISOString(),
    stats: { nodeCount: 3, edgeCount: 2, source: 'test-fixture' },
  };
}

/** Creates a report directly in the DB (skipping detection) for deterministic control. */
async function seedReport(opts: {
  severity: Severity;
  confirmations?: number;
  status?: 'PENDING' | 'VERIFIED' | 'IN_PROGRESS';
  lat?: number;
  lng?: number;
}): Promise<number> {
  const report = await prisma.report.create({
    data: {
      userId: citizenId,
      title: `Algo test ${Math.random().toString(36).slice(2)}`,
      description: 'Algorithm API test report',
      imageUrl: '/uploads/test.jpg',
      roadName: 'Algo Road',
      municipality: 'Kathmandu',
      ward: '1',
      severity: opts.severity,
      status: opts.status ?? 'PENDING',
      latitude: opts.lat ?? null,
      longitude: opts.lng ?? null,
      confirmations: opts.confirmations ?? 0,
      priorityScore: computePriorityScore(opts.severity, opts.confirmations ?? 0, 0, 0),
    },
  });
  return report.id;
}

beforeAll(async () => {
  app = createApp();
  await cleanDb();
  injectRoadGraph(fixtureGraph());

  await prisma.user.create({
    data: {
      name: 'Admin Algo',
      email: ADMIN.email,
      passwordHash: bcrypt.hashSync(ADMIN.password, 10),
      role: 'ADMIN',
    },
  });
  const worker = await prisma.user.create({
    data: {
      name: 'Algo Worker',
      email: 'worker.algo@roadguard.gov',
      passwordHash: bcrypt.hashSync('Worker@123', 10),
      role: 'USER',
      isWorker: true,
      latitude: 27.7031, // n0
      longitude: 85.3184,
    },
  });
  workerId = worker.id;

  const adminLogin = await request(app).post('/api/admin/login').send(ADMIN).expect(200);
  adminToken = adminLogin.body.data.token;
  const reg = await request(app).post('/api/auth/register').send(CITIZEN).expect(201);
  citizenToken = reg.body.data.token;
  citizenId = reg.body.data.user.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Priority queue — max heap', () => {
  it('is empty (peek null) and process-next no-ops before any reports exist', async () => {
    const snap = await request(app)
      .get('/api/admin/priority-queue')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(snap.body.data.size).toBe(0);
    expect(snap.body.data.items).toEqual([]);
    expect(snap.body.data.peek).toBeNull();

    const dispatch = await request(app)
      .post('/api/admin/priority-queue/process-next')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(dispatch.body.data.processed).toBe(false);
    expect(dispatch.body.data.report).toBeNull();
  });

  it('rejects a citizen from the queue (403)', async () => {
    await request(app)
      .get('/api/admin/priority-queue')
      .set('Authorization', `Bearer ${citizenToken}`)
      .expect(403);
  });

  it('orders open reports by priority score with the peak first', async () => {
    const a = await seedReport({ severity: 'LOW' }); // 10
    const b = await seedReport({ severity: 'HIGH', confirmations: 3 }); // 30 + 36 = 66
    const c = await seedReport({ severity: 'CRITICAL' }); // 40

    const res = await request(app)
      .get('/api/admin/priority-queue')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const items = res.body.data.items as { id: number; rank: number; ref: string; priorityScore: number; severity: string }[];
    const top3 = items.slice(0, 3).map((i) => i.id);
    expect(top3).toEqual([b, c, a]);
    expect(items[0]!.rank).toBe(1);
    expect(items[0]!.ref).toMatch(/^RG-\d{6}$/);
    expect(items[0]!.severity).toBe('HIGH');
    expect(res.body.data.peek.id).toBe(b);
  });

  it('dispatches the peak: assigns the nearest crew and returns the road route', async () => {
    // Earlier tests left open reports in the queue — seed a second, lower-score
    // report to prove the *peak* (not just any report) is the one popped.
    await seedReport({ severity: 'MEDIUM', lat: 27.71, lng: 85.32 }); // 20
    const peak = await seedReport({ severity: 'CRITICAL', confirmations: 4, lat: 27.71, lng: 85.32 }); // 40+48=88 → top of the heap

    const res = await request(app)
      .post('/api/admin/priority-queue/process-next')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const data = res.body.data;
    expect(data.processed).toBe(true);
    expect(data.report.id).toBe(peak);
    expect(data.report.status).toBe('ASSIGNED');
    expect(data.report.assignments[0].userId).toBe(workerId);
    // Route from the crew (n0) to the pothole (n1): 60 s → 1.0 min.
    expect(data.route.reachable).toBe(true);
    expect(data.route.etaMinutes).toBeCloseTo(1, 1);
    expect(data.route.path.length).toBeGreaterThanOrEqual(2);
    expect(data.team!.id).toBe(workerId);
    expect(data.teamSource).toBe('nearest');
  });
});

describe('Report route — Dijkstra over the road graph', () => {
  it('routes to the nearest crew when the report is unassigned', async () => {
    const id = await seedReport({ severity: 'MEDIUM', status: 'VERIFIED', lat: 27.71, lng: 85.32 });
    const res = await request(app)
      .get(`/api/admin/reports/${id}/route`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const { route, team, teamSource } = res.body.data;
    expect(route.reachable).toBe(true);
    expect(route.distanceKm).toBeCloseTo(0.8, 1);
    expect(route.etaMinutes).toBeCloseTo(1, 1);
    expect(route.path[0]).toEqual([27.7031, 85.3184]);
    expect(route.path[route.path.length - 1]).toEqual([27.71, 85.32]);
    expect(team.id).toBe(workerId);
    expect(teamSource).toBe('nearest');
  });

  it('prefers the assigned worker and reports the crew source', async () => {
    const id = await seedReport({ severity: 'MEDIUM', status: 'VERIFIED', lat: 27.71, lng: 85.32 });
    await request(app)
      .post(`/api/admin/reports/${id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ workerId })
      .expect(200);
    const res = await request(app)
      .get(`/api/admin/reports/${id}/route`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.data.teamSource).toBe('assigned');
    expect(res.body.data.team.id).toBe(workerId);
    expect(res.body.data.route.reachable).toBe(true);
  });

  it('routes through a manually selected worker before assignment is saved', async () => {
    const farWorker = await prisma.user.create({
      data: {
        name: 'Far Worker',
        email: 'far.worker@roadguard.gov',
        passwordHash: bcrypt.hashSync('Worker@123', 10),
        role: 'USER',
        isWorker: true,
        latitude: 27.715,
        longitude: 85.325,
      },
    });
    const id = await seedReport({ severity: 'MEDIUM', status: 'VERIFIED', lat: 27.71, lng: 85.32 });

    const nearest = await request(app)
      .get(`/api/admin/reports/${id}/route`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(nearest.body.data.team.id).toBe(workerId);
    expect(nearest.body.data.route.etaMinutes).toBeCloseTo(1, 1);

    const selected = await request(app)
      .get(`/api/admin/reports/${id}/route`)
      .query({ workerId: farWorker.id })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(selected.body.data.teamSource).toBe('selected');
    expect(selected.body.data.team.id).toBe(farWorker.id);
    expect(selected.body.data.route.etaMinutes).toBeCloseTo(2, 1);
  });

  it('recalculates the route when the worker moves', async () => {
    const id = await seedReport({ severity: 'MEDIUM', status: 'VERIFIED', lat: 27.71, lng: 85.32 });

    // Worker at n0 → 60 s.
    const before = await request(app)
      .get(`/api/admin/reports/${id}/route`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(before.body.data.route.etaMinutes).toBeCloseTo(1, 1);

    // Move the crew to n2 (27.715, 85.325) → 120 s via n1.
    await request(app)
      .put(`/api/admin/users/${workerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ latitude: 27.715, longitude: 85.325 })
      .expect(200);

    const after = await request(app)
      .get(`/api/admin/reports/${id}/route`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(after.body.data.route.etaMinutes).toBeCloseTo(2, 1);
  });

  it('returns no-coordinates for a report without GPS', async () => {
    const id = await seedReport({ severity: 'MEDIUM', status: 'VERIFIED' });
    const res = await request(app)
      .get(`/api/admin/reports/${id}/route`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.data.route.reachable).toBe(false);
    expect(res.body.data.route.reason).toBe('no-coordinates');
  });

  it('flags a report far from the network as off-network (not no-workers)', async () => {
    const id = await seedReport({ severity: 'MEDIUM', status: 'VERIFIED', lat: 26.9, lng: 85.2 });
    const res = await request(app)
      .get(`/api/admin/reports/${id}/route`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.data.route.reachable).toBe(false);
    expect(res.body.data.route.reason).toBe('off-network');
    expect(res.body.data.route.offNetworkM).toBeGreaterThan(2000);
  });
});

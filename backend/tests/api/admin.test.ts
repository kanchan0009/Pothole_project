import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { cleanDb } from '../helpers/clean-db.js';
import { makeImage, POOL_SEEDS } from '../helpers/images.js';

let app: Express;
let adminToken = '';
let citizenToken = '';
let citizenId = 0;
let workerId = 0;
let image: Buffer;
let imagePool: Buffer[] = [];
let nextImage = 0;

const ADMIN = { email: 'admin.test@roadguard.gov', password: 'Admin@123' };
const CITIZEN = { name: 'Citizen Tester', email: 'citizen.admin@example.com', password: 'StrongPass@1' };
const WORKER = {
  name: 'Test Worker',
  email: 'worker.admin@roadguard.gov',
  password: 'Worker@123',
  latitude: 27.7031,
  longitude: 85.3184,
};

const baseFields = {
  title: 'Deep pothole on Test Avenue',
  description: 'A wide pothole spanning half the lane near the bus stop.',
  roadName: 'Test Avenue',
  municipality: 'Kathmandu',
  ward: '7',
  landmark: 'Near the bus stop',
  severity: 'HIGH',
};

async function createReport(
  lat = 27.71,
  lng = 85.32
): Promise<{ id: number; severity: string }> {
  const img = imagePool[nextImage++ % imagePool.length];
  const res = await request(app)
    .post('/api/reports')
    .set('Authorization', `Bearer ${citizenToken}`)
    .field('title', baseFields.title)
    .field('description', baseFields.description)
    .field('roadName', baseFields.roadName)
    .field('municipality', baseFields.municipality)
    .field('ward', baseFields.ward)
    .field('severity', baseFields.severity)
    .field('latitude', String(lat))
    .field('longitude', String(lng))
    .field('ignoreDuplicate', 'true')
    .attach('image', img, 'pothole.jpg')
    .expect(201);
  const report = res.body.data.report as { id: number; severity: string };
  return { id: report.id, severity: report.severity };
}

beforeAll(async () => {
  app = createApp();
  await cleanDb();

  // Seed an admin, a worker, and a citizen.
  await prisma.user.create({
    data: {
      name: 'Admin Tester',
      email: ADMIN.email,
      passwordHash: bcrypt.hashSync(ADMIN.password, 10),
      role: 'ADMIN',
    },
  });
  const worker = await prisma.user.create({
    data: {
      name: WORKER.name,
      email: WORKER.email,
      passwordHash: bcrypt.hashSync(WORKER.password, 10),
      role: 'USER',
      isWorker: true,
      latitude: WORKER.latitude,
      longitude: WORKER.longitude,
    },
  });
  workerId = worker.id;

  const adminLogin = await request(app).post('/api/admin/login').send(ADMIN).expect(200);
  adminToken = adminLogin.body.data.token;
  const reg = await request(app).post('/api/auth/register').send(CITIZEN).expect(201);
  citizenToken = reg.body.data.token;
  citizenId = reg.body.data.user.id;

  // Distinct pothole photos for every report created in this file.
  imagePool = await Promise.all(POOL_SEEDS.map(makeImage));
  image = imagePool[0]; // reused as the completion photo (not subject to dup checks)
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Admin route protection', () => {
  it('rejects unauthenticated access to admin endpoints (401)', async () => {
    await request(app).get('/api/admin/dashboard').expect(401);
  });

  it('rejects a citizen from admin endpoints (403)', async () => {
    await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${citizenToken}`)
      .expect(403);
  });

  it('allows an admin through', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.data.counts.total).toBe(0);
  });
});

describe('GET /api/admin/dashboard', () => {
  let reportId: number;

  beforeAll(async () => {
    reportId = (await createReport()).id;
  });

  it('returns status counts, today/monthly, and recent activity', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const data = res.body.data;
    expect(data.counts.total).toBe(1);
    expect(data.counts.pending).toBe(1);
    expect(data.today).toBe(1);
    expect(data.monthly).toBeGreaterThanOrEqual(1);
    expect(data.recentReports[0].id).toBe(reportId);
    expect(data.recentActivity).toHaveLength(0); // no admin actions yet
  });
});

describe('Report workflow transitions', () => {
  it('rejects an illegal jump PENDING → COMPLETED (400)', async () => {
    const { id } = await createReport();
    await request(app)
      .put(`/api/admin/reports/${id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('status', 'COMPLETED')
      .expect(400);
  });

  it('rejects without a rejection reason (400)', async () => {
    const { id } = await createReport();
    await request(app)
      .put(`/api/admin/reports/${id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('status', 'REJECTED')
      .expect(400);
  });

  it('walks a report through the full workflow and auto-assigns the nearest worker', async () => {
    const { id } = await createReport();

    // PENDING → VERIFIED
    const verified = await request(app)
      .put(`/api/admin/reports/${id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('status', 'VERIFIED')
      .expect(200);
    expect(verified.body.data.report.status).toBe('VERIFIED');

    // VERIFIED → ASSIGNED (auto-assign nearest worker)
    const assigned = await request(app)
      .put(`/api/admin/reports/${id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('status', 'ASSIGNED')
      .expect(200);
    expect(assigned.body.data.report.status).toBe('ASSIGNED');
    expect(assigned.body.data.report.assignments).toHaveLength(1);
    expect(assigned.body.data.report.assignments[0].assignedTo).toBe(WORKER.name);

    // ASSIGNED → IN_PROGRESS
    const progress = await request(app)
      .put(`/api/admin/reports/${id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('status', 'IN_PROGRESS')
      .expect(200);
    expect(progress.body.data.report.status).toBe('IN_PROGRESS');

    // IN_PROGRESS → COMPLETED (with a completion image)
    const done = await request(app)
      .put(`/api/admin/reports/${id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('status', 'COMPLETED')
      .field('remarks', 'Repaired and re-surfaced.')
      .attach('image', image, 'after.jpg')
      .expect(200);
    expect(done.body.data.report.status).toBe('COMPLETED');
    expect(done.body.data.report.completionImageUrl).toMatch(/^(\/uploads\/|\/\/res\.cloudinary)/);

    // The owner was notified of the completion.
    const notifs = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${citizenToken}`)
      .expect(200);
    const titles = notifs.body.data.notifications.map((n: { title: string }) => n.title);
    expect(titles).toContain('Report completed');
  });

  it('rejects a report with a stored reason', async () => {
    const { id } = await createReport();
    const res = await request(app)
      .put(`/api/admin/reports/${id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('status', 'REJECTED')
      .field('remarks', 'Duplicate of an existing work order.')
      .expect(200);
    expect(res.body.data.report.status).toBe('REJECTED');
    expect(res.body.data.report.rejectionReason).toContain('Duplicate');
  });
});

describe('Assignment endpoint', () => {
  it('assigns a specific worker by id', async () => {
    const { id } = await createReport();
    const res = await request(app)
      .post(`/api/admin/reports/${id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ workerId })
      .expect(200);
    expect(res.body.data.report.status).toBe('ASSIGNED');
    expect(res.body.data.report.assignments[0].userId).toBe(workerId);
  });

  it('rejects a non-worker user id (400)', async () => {
    const { id } = await createReport();
    const { body } = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${adminToken}`).expect(200);
    const citizen = body.data.users.find((u: { email: string }) => u.email === CITIZEN.email);
    await request(app)
      .post(`/api/admin/reports/${id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ workerId: citizen.id })
      .expect(400);
  });
});

describe('User management', () => {
  it('lists users with report counts and search', async () => {
    const res = await request(app)
      .get('/api/admin/users?search=Test')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.data.users.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.users[0]).toHaveProperty('reportCount');
  });

  it('deactivates a citizen', async () => {
    const { body } = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${adminToken}`).expect(200);
    const citizen = body.data.users.find((u: { email: string }) => u.email === CITIZEN.email);
    const res = await request(app)
      .put(`/api/admin/users/${citizen.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(200);
    expect(res.body.data.user.isActive).toBe(false);
  });

  it('blocks an admin from demoting themselves (400)', async () => {
    const { body } = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${adminToken}`).expect(200);
    const self = body.data.users.find((u: { email: string }) => u.email === ADMIN.email);
    await request(app)
      .put(`/api/admin/users/${self.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'USER' })
      .expect(400);
  });
});

describe('Statistics + exports', () => {
  it('returns severity distribution, time series and heatmap', async () => {
    const { severity } = await createReport(27.72, 85.33);
    const res = await request(app)
      .get('/api/admin/statistics?period=day')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const data = res.body.data;
    // The report's severity is set by the CNN from the uploaded photo, so assert
    // on the severity it actually got rather than a hard-coded class.
    expect(data.severity[severity]).toBeGreaterThan(0);
    expect(data.timeSeries.length).toBeGreaterThan(0);
    expect(data.heatmap.length).toBeGreaterThan(0);
    expect(data.heatmap[0]).toHaveLength(3);
    // Most active users — the citizen reporter appears with their report count.
    expect(data.topUsers).toBeDefined();
    expect(data.topUsers[0].count).toBeGreaterThanOrEqual(1);
  });

  it('lists workers', async () => {
    const res = await request(app)
      .get('/api/admin/workers')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.data.workers.map((w: { name: string }) => w.name)).toContain(WORKER.name);
  });

  it('exports CSV with a content-disposition header', async () => {
    const res = await request(app)
      .get('/api/admin/export/csv')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text).toContain('Reference');
  });

  it('exports XLSX and PDF as binary attachments', async () => {
    const xlsx = await request(app)
      .get('/api/admin/export/xlsx')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(xlsx.headers['content-type']).toContain('spreadsheetml');

    const pdf = await request(app)
      .get('/api/admin/export/pdf')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.length).toBeGreaterThan(1000);
  });

  it('records admin actions in the audit log', async () => {
    const res = await request(app)
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const actions = res.body.data.logs.map((l: { action: string }) => l.action);
    expect(actions).toContain('STATUS_CHANGE');
    expect(actions).toContain('ASSIGN');
  });
});

describe('Verify-AI (admin detection review)', () => {
  it('reflects confirmed detections in the AI accuracy statistic', async () => {
    const { id } = await createReport();
    await request(app)
      .post(`/api/admin/reports/${id}/ai-verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approved: true })
      .expect(200);
    const res = await request(app)
      .get('/api/admin/statistics?period=month')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.data.aiAccuracy).toBe(100);
  });

  it('records a confirmation and leaves the report pending', async () => {
    const { id } = await createReport();
    const res = await request(app)
      .post(`/api/admin/reports/${id}/ai-verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approved: true })
      .expect(200);
    const report = res.body.data.report;
    expect(report.aiVerified).toBe(true);
    expect(report.status).toBe('PENDING');
  });

  it('rejects a citizen trying to verify AI (403)', async () => {
    const { id } = await createReport();
    await request(app)
      .post(`/api/admin/reports/${id}/ai-verify`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ approved: true })
      .expect(403);
  });

  it('requires a reason when rejecting the detection (400)', async () => {
    const { id } = await createReport();
    await request(app)
      .post(`/api/admin/reports/${id}/ai-verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approved: false })
      .expect(400);
  });

  it('rejects the detection, closes the report and notifies the reporter', async () => {
    const { id } = await createReport();
    const res = await request(app)
      .post(`/api/admin/reports/${id}/ai-verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approved: false, reason: 'NOT_A_POTHOLY' })
      .expect(200);
    const report = res.body.data.report;
    expect(report.aiVerified).toBe(false);
    expect(report.aiRejectedReason).toBe('Not a pothole');
    expect(report.status).toBe('REJECTED');

    const all = await prisma.notification.findMany({ where: { userId: citizenId } });
    expect(all.map((n) => n.message).join(' ')).toContain('Not a pothole');
  });

  it('prevents reviewing the same detection twice', async () => {
    const { id } = await createReport();
    await request(app)
      .post(`/api/admin/reports/${id}/ai-verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approved: true })
      .expect(200);
    await request(app)
      .post(`/api/admin/reports/${id}/ai-verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approved: true })
      .expect(400);
  });

  it('refuses to review a report with no AI detection', async () => {
    const bare = await prisma.report.create({
      data: {
        userId: citizenId,
        title: 'No detection on this one',
        description: 'Created directly without the detection pipeline.',
        imageUrl: '/uploads/x.jpg',
        roadName: 'Road',
        municipality: 'Kathmandu',
        ward: '1',
        severity: 'MEDIUM',
      },
    });
    await request(app)
      .post(`/api/admin/reports/${bare.id}/ai-verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approved: true })
      .expect(400);
  });
});

describe('REMOVED transition', () => {
  it('rejects PENDING → REMOVED (400)', async () => {
    const { id } = await createReport();
    await request(app)
      .put(`/api/admin/reports/${id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('status', 'REMOVED')
      .expect(400);
  });

  it('archives a COMPLETED report, hides it everywhere, and notifies the owner', async () => {
    const { id } = await createReport();

    // Walk PENDING → VERIFIED → ASSIGNED → IN_PROGRESS → COMPLETED.
    for (const status of ['VERIFIED', 'ASSIGNED', 'IN_PROGRESS']) {
      await request(app)
        .put(`/api/admin/reports/${id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('status', status)
        .expect(200);
    }
    const done = await request(app)
      .put(`/api/admin/reports/${id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('status', 'COMPLETED')
      .field('remarks', 'Repaired and re-surfaced.')
      .attach('image', image, 'after.jpg')
      .expect(200);
    expect(done.body.data.report.status).toBe('COMPLETED');

    // COMPLETED → REMOVED is the legal archival step.
    const removed = await request(app)
      .put(`/api/admin/reports/${id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('status', 'REMOVED')
      .expect(200);
    expect(removed.body.data.report.status).toBe('REMOVED');

    // Gone from the public list and the admin list…
    const pub = await request(app).get('/api/reports?limit=50').expect(200);
    expect(pub.body.data.reports.map((r: { id: number }) => r.id)).not.toContain(id);
    const admin = await request(app)
      .get('/api/admin/reports?limit=50')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(admin.body.data.reports.map((r: { id: number }) => r.id)).not.toContain(id);

    // …but still fetchable by id (archived, not deleted)…
    const detail = await request(app).get(`/api/reports/${id}`).expect(200);
    expect(detail.body.data.report.status).toBe('REMOVED');

    // …and the owner was notified while the history records the REMOVED step.
    const notifs = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${citizenToken}`)
      .expect(200);
    expect(notifs.body.data.notifications.map((n: { title: string }) => n.title)).toContain('Report removed');
    const timeline = await request(app).get(`/api/reports/${id}/timeline`).expect(200);
    expect(timeline.body.data.history.map((h: { status: string }) => h.status)).toContain('REMOVED');
  });
});

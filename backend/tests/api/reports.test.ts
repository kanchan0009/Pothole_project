import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { cleanDb } from '../helpers/clean-db.js';
import { makeImage, makeNoPotholeImage, POOL_SEEDS } from '../helpers/images.js';

let app: Express;
let citizenToken = '';
let adminToken = '';
let image: Buffer;
let imagePool: Buffer[] = [];
let nextImage = 0;

const CITIZEN = { name: 'Report Tester', email: 'tester@example.com', password: 'StrongPass@1' };
const ADMIN = { name: 'Admin Tester', email: 'admin2@test.gov', password: 'Admin@123' };

const baseFields = {
  title: 'Deep pothole on Ashok Road',
  description: 'Large and deep pothole right in the middle of the lane.',
  roadName: 'Ashok Road',
  municipality: 'Kathmandu',
  ward: '10',
  landmark: 'Near the old gate',
  severity: 'MEDIUM',
};

beforeAll(async () => {
  app = createApp();

  // Clean slate (FK-safe order so the files can run in any sequence)
  await cleanDb();

  await prisma.user.create({
    data: {
      name: ADMIN.name,
      email: ADMIN.email,
      passwordHash: bcrypt.hashSync(ADMIN.password, 10),
      role: 'ADMIN',
    },
  });
  const reg = await request(app).post('/api/auth/register').send(CITIZEN).expect(201);
  citizenToken = reg.body.data.token;
  const adminLogin = await request(app).post('/api/admin/login').send(ADMIN).expect(200);
  adminToken = adminLogin.body.data.token;

  // Pre-generated pool of distinct pothole photos: every submission attaches a
  // fresh one so the image-duplicate check (hamming distance ≤ 25) never fires
  // across unrelated reports. `submit` cycles the pool synchronously below.
  imagePool = await Promise.all(POOL_SEEDS.map(makeImage));
  image = imagePool[0];
});

afterAll(async () => {
  await prisma.$disconnect();
});

const submit = (token: string, fields: Record<string, unknown> = baseFields) =>
  request(app)
    .post('/api/reports')
    .set('Authorization', `Bearer ${token}`)
    .field('title', fields.title as string)
    .field('description', fields.description as string)
    .field('roadName', fields.roadName as string)
    .field('municipality', fields.municipality as string)
    .field('ward', fields.ward as string)
    .field('severity', fields.severity as string)
    .field('landmark', (fields.landmark as string | undefined) ?? '')
    .field('latitude', String(fields.latitude ?? ''))
    .field('longitude', String(fields.longitude ?? ''))
    .field('ignoreDuplicate', String(fields.ignoreDuplicate ?? false))
    .attach('image', imagePool[nextImage++ % imagePool.length], 'pothole.jpg');

describe('POST /api/reports', () => {
  it('rejects unauthenticated submissions', async () => {
    await request(app).post('/api/reports').attach('image', image, 'p.jpg').expect(401);
  });

  it('rejects a submission without a photo (400)', async () => {
    await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${citizenToken}`)
      .field('title', baseFields.title)
      .field('description', baseFields.description)
      .field('roadName', baseFields.roadName)
      .field('municipality', baseFields.municipality)
      .field('ward', baseFields.ward)
      .field('severity', baseFields.severity)
      .expect(400);
  });

  it('creates a PENDING report with processed image + priority score', async () => {
    const res = await submit(citizenToken, { ...baseFields, latitude: 27.71, longitude: 85.32 }).expect(201);
    expect(res.body.data.report.status).toBe('PENDING');
    expect(res.body.data.report.duplicate).toBe(false);
    expect(res.body.data.report.priorityScore).toBeGreaterThanOrEqual(20);
    expect(res.body.data.report.imageUrl).toMatch(/^(\/uploads\/|\/\/res\.cloudinary)/);
    expect(res.body.data.report.reporterName).toBe(CITIZEN.name);
  });

  it('detects a duplicate within 20m and returns 409 without creating', async () => {
    // Same-ish coords as the report created above.
    const res = await submit(citizenToken, {
      ...baseFields,
      title: 'Duplicate pothole nearby',
      latitude: 27.71001,
      longitude: 85.32001,
    }).expect(409);
    expect(res.body.error.code).toBe('DUPLICATE_REPORT');
    expect(res.body.error.nearbyReport.id).toBeGreaterThan(0);
    expect(res.body.error.nearbyReport.distance).toBeLessThan(20);

    // Nothing extra was created.
    const { body } = await request(app).get('/api/reports').expect(200);
    expect(body.data.reports.length).toBe(1);
  });

  it('creates anyway when ignoreDuplicate=true, flagging the report', async () => {
    const res = await submit(citizenToken, {
      ...baseFields,
      title: 'Confirmed distinct pothole',
      latitude: 27.71001,
      longitude: 85.32001,
      ignoreDuplicate: true,
    }).expect(201);
    expect(res.body.data.report.duplicate).toBe(true);
  });

  it('rejects a weak title/description with field errors (400)', async () => {
    const res = await submit(citizenToken, {
      ...baseFields,
      title: 'Bad',
      description: 'short',
      latitude: 27.72,
      longitude: 85.33,
    }).expect(400);
    expect(res.body.error.fields.title).toBeDefined();
    expect(res.body.error.fields.description).toBeDefined();
  });
});

describe('POST /api/reports/check-duplicate', () => {
  it('reports a nearby open report', async () => {
    const res = await request(app)
      .post('/api/reports/check-duplicate')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ latitude: 27.710005, longitude: 85.320005 })
      .expect(200);
    expect(res.body.data.duplicate).toBe(true);
  });

  it('reports no duplicate far away', async () => {
    const res = await request(app)
      .post('/api/reports/check-duplicate')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ latitude: 28.2, longitude: 84.9 })
      .expect(200);
    expect(res.body.data.duplicate).toBe(false);
  });
});

describe('GET /api/reports', () => {
  it('lists reports with pagination + reporter names', async () => {
    const res = await request(app).get('/api/reports?page=1&limit=5&municipality=Kathmandu').expect(200);
    expect(res.body.data.reports.length).toBeGreaterThan(0);
    expect(res.body.data.reports[0]).toHaveProperty('reporterName');
    expect(res.body.data.pagination.totalPages).toBeGreaterThanOrEqual(1);
  });

  it('filters by severity and searches', async () => {
    const res = await request(app).get('/api/reports?severity=MEDIUM&search=pothole').expect(200);
    for (const r of res.body.data.reports) {
      expect(r.severity).toBe('MEDIUM');
    }
  });

  it('sorts by priority descending', async () => {
    const res = await request(app).get('/api/reports?sort=priority').expect(200);
    const scores = res.body.data.reports.map((r: { priorityScore: number }) => r.priorityScore);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });
});

async function firstReportId(): Promise<number> {
  const { body } = await request(app).get('/api/reports?sort=oldest').expect(200);
  const first = body.data.reports[0];
  if (!first) throw new Error('No reports in test DB');
  return first.id;
}

describe('Report detail + timeline', () => {
  let reportId: number;

  beforeAll(async () => {
    reportId = await firstReportId();
  });

  it('returns nested location/history/assignments', async () => {
    const res = await request(app).get(`/api/reports/${reportId}`).expect(200);
    expect(res.body.data.report.history.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.report.location.latitude).toBeCloseTo(27.71, 1);
  });

  it('returns a PENDING-first timeline', async () => {
    const res = await request(app).get(`/api/reports/${reportId}/timeline`).expect(200);
    expect(res.body.data.history[0].status).toBe('PENDING');
  });

  it('404s for an unknown report', async () => {
    await request(app).get('/api/reports/999999').expect(404);
  });
});

describe('PUT /api/reports/:id (owner edit)', () => {
  let reportId: number;

  beforeAll(async () => {
    reportId = await firstReportId();
  });

  it('lets the owner update fields', async () => {
    const res = await request(app)
      .put(`/api/reports/${reportId}`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .field('description', 'Updated: pothole has grown wider after the rains.')
      .expect(200);
    expect(res.body.data.report.description).toContain('Updated');
  });

  it('blocks a different user from editing', async () => {
    const other = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Other User', email: 'other@example.com', password: 'StrongPass@1' })
      .expect(201);
    await request(app)
      .put(`/api/reports/${reportId}`)
      .set('Authorization', `Bearer ${other.body.data.token}`)
      .field('description', 'Unauthorized edit.')
      .expect(403);
  });
});

describe('DELETE /api/reports/:id (admin)', () => {
  let reportId: number;

  beforeAll(async () => {
    reportId = await firstReportId();
  });

  it('rejects a citizen', async () => {
    await request(app)
      .delete(`/api/reports/${reportId}`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .expect(403);
  });

  it('allows an admin and removes the report', async () => {
    await request(app)
      .delete(`/api/reports/${reportId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(app).get(`/api/reports/${reportId}`).expect(404);
  });
});

describe('GET /api/reports/mine + /mine/stats', () => {
  let token = '';
  let myId = 0;

  beforeAll(async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Mine Tester', email: 'mine@example.com', password: 'StrongPass@1' })
      .expect(201);
    token = reg.body.data.token;
    myId = reg.body.data.user.id;

    // Two reports at clearly distinct coordinates; ignoreDuplicate keeps the
    // address fallback (same road/ward) from flagging them against each other.
    await submit(token, {
      ...baseFields,
      title: 'My report A',
      latitude: 27.5,
      longitude: 85.1,
      ignoreDuplicate: true,
    });
    await submit(token, {
      ...baseFields,
      title: 'My report B',
      latitude: 27.51,
      longitude: 85.11,
      ignoreDuplicate: true,
    });
  });

  it('requires authentication', async () => {
    await request(app).get('/api/reports/mine/stats').expect(401);
  });

  it('lists only the caller reports', async () => {
    const res = await request(app)
      .get('/api/reports/mine')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.data.reports.length).toBe(2);
    for (const r of res.body.data.reports) expect(r.userId).toBe(myId);
  });

  it('returns per-status counts scoped to the caller', async () => {
    const res = await request(app)
      .get('/api/reports/mine/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.data.status).toEqual({
      total: 2,
      pending: 2,
      verified: 0,
      assigned: 0,
      inProgress: 0,
      completed: 0,
      rejected: 0,
    });
  });
});

describe('POST /api/reports/detect (AI gate)', () => {
  it('requires authentication', async () => {
    await request(app).post('/api/reports/detect').attach('image', image, 'pothole.jpg').expect(401);
  });

  it('detects a pothole and returns confidence + bounding box + annotated preview', async () => {
    const res = await request(app)
      .post('/api/reports/detect')
      .set('Authorization', `Bearer ${citizenToken}`)
      .attach('image', image, 'pothole.jpg')
      .expect(200);
    const data = res.body.data;
    expect(data.isPothole).toBe(true);
    expect(data.confidence).toBeGreaterThanOrEqual(0.5);
    expect(data.confidence).toBeLessThanOrEqual(0.99);
    expect(data.boundingBox).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
      width: expect.any(Number),
      height: expect.any(Number),
    });
    expect(typeof data.previewUrl).toBe('string');
  });

  it('returns no-hit (and no preview) for a pothole-free photo', async () => {
    const clean = await makeNoPotholeImage();
    const res = await request(app)
      .post('/api/reports/detect')
      .set('Authorization', `Bearer ${citizenToken}`)
      .attach('image', clean, 'clean.jpg')
      .expect(200);
    expect(res.body.data.isPothole).toBe(false);
    expect(res.body.data.boundingBox).toBeNull();
    expect(res.body.data.previewUrl).toBeNull();
  });
});

describe('Detection fields on created reports', () => {
  it('persists confidence, bounding box and the annotated image', async () => {
    const res = await submit(citizenToken, {
      ...baseFields,
      title: 'Detection persist check',
      latitude: 27.69,
      longitude: 85.31,
      ignoreDuplicate: true,
    }).expect(201);
    const report = res.body.data.report;
    expect(report.confidenceScore).toBeGreaterThanOrEqual(0.5);
    expect(report.boundingBox).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
      width: expect.any(Number),
      height: expect.any(Number),
    });
    expect(report.detectedImageUrl).toMatch(/^(\/uploads\/|\/\/res\.cloudinary)/);
    expect(report.aiVerified).toBeNull();
  });

  it('rejects a submission whose photo has no pothole (400)', async () => {
    const clean = await makeNoPotholeImage();
    await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${citizenToken}`)
      .field('title', baseFields.title)
      .field('description', baseFields.description)
      .field('roadName', baseFields.roadName)
      .field('municipality', baseFields.municipality)
      .field('ward', baseFields.ward)
      .field('severity', baseFields.severity)
      .field('latitude', '27.685')
      .field('longitude', '85.305')
      .field('ignoreDuplicate', 'true') // reach the AI gate, not the address fallback
      .attach('image', clean, 'clean.jpg')
      .expect(400);
  });

  it('accepts a non-pothole image when skipDetection=true (map capture)', async () => {
    // A map screenshot will never pass the AI gate — the capture flow opts out
    // explicitly, so the same pothole-free image must be accepted here.
    const clean = await makeNoPotholeImage();
    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${citizenToken}`)
      .field('title', 'Map-captured hazard on Ring Road')
      .field('description', 'Capture of the affected road area from the hazard map.')
      .field('roadName', 'Ring Road')
      .field('municipality', 'Kathmandu')
      .field('ward', '12')
      .field('severity', 'LOW')
      .field('latitude', '27.695')
      .field('longitude', '85.31')
      .field('skipDetection', 'true')
      .attach('image', clean, 'capture.png')
      .expect(201);
    const report = res.body.data.report;
    expect(report.status).toBe('PENDING');
    expect(report.confidenceScore).toBeNull();
    expect(report.detectedImageUrl).toBeNull();
    expect(report.boundingBox).toBeNull();
  });
});

describe('GET /api/reports/:id/receipt (PDF)', () => {
  let receiptReportId: number;

  beforeAll(async () => {
    // A report owned by the main citizen token (distinct coords, no duplicate 409).
    const res = await submit(citizenToken, {
      ...baseFields,
      title: 'Receipt-ready pothole',
      latitude: 27.65,
      longitude: 85.28,
      ignoreDuplicate: true,
    }).expect(201);
    receiptReportId = res.body.data.report.id;
  });

  it('requires a token (401)', async () => {
    await request(app).get(`/api/reports/${receiptReportId}/receipt`).expect(401);
  });

  it('rejects another user downloading someone else’s receipt (403)', async () => {
    const other = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Receipt Stranger', email: 'stranger@example.com', password: 'StrongPass@1' })
      .expect(201);
    await request(app)
      .get(`/api/reports/${receiptReportId}/receipt`)
      .set('Authorization', `Bearer ${other.body.data.token}`)
      .expect(403);
  });

  it('streams a PDF attachment to the owner', async () => {
    const res = await request(app)
      .get(`/api/reports/${receiptReportId}/receipt`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.body.length).toBeGreaterThan(1000);
  });

  it('allows an admin to download any report receipt', async () => {
    const res = await request(app)
      .get(`/api/reports/${receiptReportId}/receipt`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.length).toBeGreaterThan(1000);
  });

  it('404s for an unknown report', async () => {
    await request(app)
      .get('/api/reports/999999/receipt')
      .set('Authorization', `Bearer ${citizenToken}`)
      .expect(404);
  });
});

describe('POST /api/reports/:id/remove-user (owner cleanup)', () => {
  let ownerToken = '';
  let completedId = 0;

  beforeAll(async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Remove Tester', email: 'remove-owner@example.com', password: 'StrongPass@1' })
      .expect(201);
    ownerToken = reg.body.data.token;

    const created = await submit(ownerToken, {
      ...baseFields,
      title: 'Removable completed pothole',
      latitude: 27.58,
      longitude: 85.16,
      ignoreDuplicate: true,
    }).expect(201);
    completedId = created.body.data.report.id;

    // Walk the report to COMPLETED via the admin status endpoint.
    for (const status of ['VERIFIED', 'ASSIGNED', 'IN_PROGRESS']) {
      await request(app)
        .put(`/api/admin/reports/${completedId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .field('status', status)
        .expect(200);
    }
    await request(app)
      .put(`/api/admin/reports/${completedId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('status', 'COMPLETED')
      .attach('image', image, 'after.jpg')
      .expect(200);
  });

  it('requires a token (401)', async () => {
    await request(app).post(`/api/reports/${completedId}/remove-user`).expect(401);
  });

  it('hides a COMPLETED report from the owner’s dashboard only', async () => {
    const res = await request(app)
      .post(`/api/reports/${completedId}/remove-user`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body.message).toContain('removed from your dashboard');

    // Gone from the owner’s list and stats…
    const mine = await request(app)
      .get('/api/reports/mine?limit=50')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(mine.body.data.reports.map((r: { id: number }) => r.id)).not.toContain(completedId);
    const stats = await request(app)
      .get('/api/reports/mine/stats')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(stats.body.data.status.completed).toBe(0);

    // …but still visible publicly and to the admin.
    const pub = await request(app).get(`/api/reports/${completedId}`).expect(200);
    expect(pub.body.data.report.status).toBe('COMPLETED');
    const admin = await request(app)
      .get('/api/admin/reports?limit=50')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(admin.body.data.reports.map((r: { id: number }) => r.id)).toContain(completedId);

    // The owner was notified.
    const notifs = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const titles = notifs.body.data.notifications.map((n: { title: string }) => n.title);
    expect(titles).toContain('Report removed');
  });

  it('rejects removing a report that is not COMPLETED (400)', async () => {
    const created = await submit(ownerToken, {
      ...baseFields,
      title: 'Still pending pothole',
      latitude: 27.585,
      longitude: 85.165,
      ignoreDuplicate: true,
    }).expect(201);
    await request(app)
      .post(`/api/reports/${created.body.data.report.id}/remove-user`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);
  });

  it('rejects another user removing someone else’s report (404)', async () => {
    const other = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Remove Stranger', email: 'remove-stranger@example.com', password: 'StrongPass@1' })
      .expect(201);
    await request(app)
      .post(`/api/reports/${completedId}/remove-user`)
      .set('Authorization', `Bearer ${other.body.data.token}`)
      .expect(404);
  });
});

describe('Duplicate attempts record a notification', () => {
  it('stores a notification when a location duplicate is rejected (409)', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dup Tester', email: 'dup-notif@example.com', password: 'StrongPass@1' })
      .expect(201);
    const dupToken = reg.body.data.token;

    // Original report…
    await submit(dupToken, {
      ...baseFields,
      title: 'Original hazard',
      latitude: 27.44,
      longitude: 85.05,
      ignoreDuplicate: true,
    }).expect(201);

    // …then the same location again → 409 before anything is created.
    const res = await submit(dupToken, {
      ...baseFields,
      title: 'Twin hazard',
      latitude: 27.44,
      longitude: 85.05,
    }).expect(409);
    expect(res.body.error.code).toBe('DUPLICATE_REPORT');

    const notifs = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${dupToken}`)
      .expect(200);
    const titles = notifs.body.data.notifications.map((n: { title: string }) => n.title);
    expect(titles).toContain('Duplicate report');
  });

  it('stores a notification when an identical image is rejected (409)', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Image Dup Tester', email: 'img-dup-notif@example.com', password: 'StrongPass@1' })
      .expect(201);
    const imgToken = reg.body.data.token;

    // Reuse the last pool image (least likely already consumed) twice — the
    // second upload at a different location trips the image-duplicate check.
    const buf = imagePool[imagePool.length - 1];
    const fields = {
      title: baseFields.title,
      description: baseFields.description,
      roadName: 'Image Test Road',
      municipality: 'Kathmandu',
      ward: '3',
      severity: 'LOW',
    };
    await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${imgToken}`)
      .field('title', fields.title)
      .field('description', fields.description)
      .field('roadName', fields.roadName)
      .field('municipality', fields.municipality)
      .field('ward', fields.ward)
      .field('severity', fields.severity)
      .field('latitude', '27.3')
      .field('longitude', '85.01')
      .attach('image', buf, 'same.jpg')
      .expect(201);

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${imgToken}`)
      .field('title', fields.title)
      .field('description', fields.description)
      .field('roadName', fields.roadName)
      .field('municipality', fields.municipality)
      .field('ward', fields.ward)
      .field('severity', fields.severity)
      .field('latitude', '27.9')
      .field('longitude', '85.6')
      .attach('image', buf, 'same.jpg')
      .expect(409);
    expect(res.body.error.code).toBe('DUPLICATE_IMAGE');

    const notifs = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${imgToken}`)
      .expect(200);
    const titles = notifs.body.data.notifications.map((n: { title: string }) => n.title);
    expect(titles).toContain('Duplicate report');
  });
});

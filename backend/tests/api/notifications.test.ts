import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { cleanDb } from '../helpers/clean-db.js';
import { makeImage, POOL_SEEDS } from '../helpers/images.js';

let app: Express;
let token = '';
let userId = 0;
let imagePool: Buffer[] = [];
let nextImage = 0;

const CITIZEN = { name: 'Notif User', email: 'notif@example.com', password: 'StrongPass@1' };

const baseFields = {
  title: 'Crack on the main road',
  description: 'A long crack spanning the whole lane width.',
  roadName: 'Ring Road',
  municipality: 'Kathmandu',
  ward: '8',
  severity: 'HIGH',
};

beforeAll(async () => {
  app = createApp();
  await cleanDb();

  const reg = await request(app).post('/api/auth/register').send(CITIZEN).expect(201);
  token = reg.body.data.token;
  userId = reg.body.data.user.id;

  // Distinct pothole photos for every report created in this file.
  imagePool = await Promise.all(POOL_SEEDS.map(makeImage));
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createReport() {
  const img = imagePool[nextImage++ % imagePool.length];
  return request(app)
    .post('/api/reports')
    .set('Authorization', `Bearer ${token}`)
    .field('title', baseFields.title)
    .field('description', baseFields.description)
    .field('roadName', baseFields.roadName)
    .field('municipality', baseFields.municipality)
    .field('ward', baseFields.ward)
    .field('severity', baseFields.severity)
    .field('latitude', '27.73')
    .field('longitude', '85.34')
    .field('ignoreDuplicate', 'true') // same coords across tests — confirmed duplicates
    .attach('image', img, 'crack.jpg')
    .expect(201);
}

describe('GET /api/notifications', () => {
  it('requires a token (401)', async () => {
    await request(app).get('/api/notifications').expect(401);
  });

  it('returns the welcome notification unread on register', async () => {
    const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.data.notifications.length).toBe(1);
    expect(res.body.data.notifications[0].title).toMatch(/welcome/i);
    expect(res.body.data.unreadCount).toBe(1);
  });

  it('adds a submission notification when a report is created', async () => {
    await createReport();
    const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.data.unreadCount).toBe(2);
    const titles = res.body.data.notifications.map((n: { title: string }) => n.title);
    expect(titles).toContain('Report submitted');
  });

  it("does not expose another user's notifications", async () => {
    const other = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Other Notif', email: 'other-notif@example.com', password: 'StrongPass@1' })
      .expect(201);
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${other.body.data.token}`)
      .expect(200);
    // Only the welcome notification for this brand-new user.
    expect(res.body.data.total).toBe(1);
  });
});

describe('PUT /api/notifications', () => {
  it('marks a single notification read', async () => {
    await createReport();
    const list = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`).expect(200);
    const unreadId = list.body.data.notifications.find((n: { isRead: boolean }) => !n.isRead).id;

    const res = await request(app)
      .put(`/api/notifications/${unreadId}/read`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.data.notifications.find((n: { id: number }) => n.id === unreadId).isRead).toBe(true);
  });

  it('rejects marking another user’s notification (404)', async () => {
    const other = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Third Notif', email: 'third-notif@example.com', password: 'StrongPass@1' })
      .expect(201);
    const mine = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`).expect(200);
    const myId = mine.body.data.notifications[0].id;

    await request(app)
      .put(`/api/notifications/${myId}/read`)
      .set('Authorization', `Bearer ${other.body.data.token}`)
      .expect(404);
  });

  it('marks everything read', async () => {
    await createReport();
    const res = await request(app)
      .put('/api/notifications/read-all')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.data.unreadCount).toBe(0);
    expect(res.body.data.notifications.every((n: { isRead: boolean }) => n.isRead)).toBe(true);
  });
});

describe('GET /api/reports/mine', () => {
  it('requires a token (401)', async () => {
    await request(app).get('/api/reports/mine').expect(401);
  });

  it('returns only the caller’s reports', async () => {
    // First citizen has created several reports above; make a second citizen with none.
    const other = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Mine Tester', email: 'mine@example.com', password: 'StrongPass@1' })
      .expect(201);

    const mine = await request(app)
      .get('/api/reports/mine?limit=50')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(mine.body.data.reports.length).toBeGreaterThanOrEqual(3);
    for (const r of mine.body.data.reports) {
      expect(r.userId).toBe(userId);
    }

    const theirs = await request(app)
      .get('/api/reports/mine')
      .set('Authorization', `Bearer ${other.body.data.token}`)
      .expect(200);
    expect(theirs.body.data.reports.length).toBe(0);
  });
});

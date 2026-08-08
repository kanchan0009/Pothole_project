import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { cleanDb } from '../helpers/clean-db.js';

let app: Express;
let adminId = 0;
let adminToken = '';
let citizenToken = '';

const ADMIN = { email: 'admin.contact@roadguard.gov', password: 'Admin@123' };

const validMessage = {
  name: 'Jane Citizen',
  email: 'jane@example.com',
  subject: 'Pothole near school',
  message: 'There is a deep pothole right in front of the school gate.',
};

beforeAll(async () => {
  app = createApp();
  await cleanDb();
  const admin = await prisma.user.create({
    data: {
      name: 'Admin Tester',
      email: ADMIN.email,
      passwordHash: bcrypt.hashSync(ADMIN.password, 10),
      role: 'ADMIN',
    },
  });
  adminId = admin.id;

  const login = await request(app)
    .post('/api/admin/login')
    .send({ email: ADMIN.email, password: ADMIN.password })
    .expect(200);
  adminToken = login.body.data.token as string;
});

describe('POST /api/contact', () => {
  it('stores the message and returns 201', async () => {
    const res = await request(app).post('/api/contact').send(validMessage).expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toEqual(expect.any(Number));

    const row = await prisma.contactMessage.findUnique({ where: { id: res.body.data.id } });
    expect(row).not.toBeNull();
    expect(row?.name).toBe('Jane Citizen');
    expect(row?.message).toBe(validMessage.message);
  });

  it('trims and lowercases the email', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ ...validMessage, email: '  JANE@Example.COM ' })
      .expect(201);
    const row = await prisma.contactMessage.findUnique({ where: { id: res.body.data.id } });
    expect(row?.email).toBe('jane@example.com');
  });

  it('notifies every admin with a short summary', async () => {
    await request(app).post('/api/contact').send(validMessage).expect(201);
    const notif = await prisma.notification.findFirst({
      where: { userId: adminId, title: 'New contact message' },
      orderBy: { createdAt: 'desc' },
    });
    expect(notif).not.toBeNull();
    expect(notif?.message).toBe('Jane Citizen: Pothole near school');
  });

  it('returns 400 with field errors for a too-short message', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ ...validMessage, message: 'Too short' })
      .expect(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Validation failed');
    expect(res.body.error.fields).toHaveProperty('message');
  });

  it('returns 400 with field errors when a required field is missing', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ email: 'jane@example.com', subject: 'Hello', message: 'This message is long enough.' })
      .expect(400);
    expect(res.body.error.fields).toHaveProperty('name');
  });
});

describe('GET /api/admin/contact-messages', () => {
  beforeAll(async () => {
    // Two known messages so search/pagination assertions are deterministic.
    await prisma.contactMessage.createMany({
      data: [
        {
          name: 'Alice Roads',
          email: 'alice@example.com',
          subject: 'Deep crack near metro',
          message: 'A long crack across the full lane right outside the metro station.',
        },
        {
          name: 'Bob Driver',
          email: 'bob@example.com',
          subject: 'Pothole by the market',
          message: 'The pothole right outside the market is swallowing wheels.',
        },
      ],
    });

    // A citizen to prove the route is admin-only.
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Citizen Inbox', email: 'citizen.inbox@example.com', password: 'StrongPass@1' })
      .expect(201);
    citizenToken = reg.body.data.token as string;
  });

  it('requires an admin token (401)', async () => {
    await request(app).get('/api/admin/contact-messages').expect(401);
  });

  it('rejects citizens (403)', async () => {
    await request(app)
      .get('/api/admin/contact-messages')
      .set('Authorization', `Bearer ${citizenToken}`)
      .expect(403);
  });

  it('lists messages newest-first with pagination for an admin', async () => {
    const res = await request(app)
      .get('/api/admin/contact-messages')
      .query({ limit: 2 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.messages).toHaveLength(2);
    expect(res.body.data.messages[0]).toMatchObject({
      name: expect.any(String),
      email: expect.any(String),
      subject: expect.any(String),
      message: expect.any(String),
    });
    expect(res.body.data.pagination.total).toBeGreaterThan(2);
    expect(res.body.data.pagination.page).toBe(1);

    const dates = res.body.data.messages.map((m: { createdAt: string }) => new Date(m.createdAt).getTime());
    expect(dates[0]!).toBeGreaterThanOrEqual(dates[1]!);
  });

  it('filters by search across name/subject/email', async () => {
    const res = await request(app)
      .get('/api/admin/contact-messages')
      .query({ search: 'metro' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.data.pagination.total).toBe(1);
    expect(res.body.data.messages[0].subject).toBe('Deep crack near metro');
  });
});

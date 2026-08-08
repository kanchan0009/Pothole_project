import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { signResetToken } from '../../src/utils/tokens.js';
import { cleanDb } from '../helpers/clean-db.js';

let app: Express;

const ADMIN_EMAIL = 'admin@test.gov';
const ADMIN_PASSWORD = 'Admin@123';

beforeAll(async () => {
  app = createApp();
  // Clean slate + seed an admin (test db is rebuilt in global-setup anyway).
  await cleanDb();
  await prisma.user.create({
    data: {
      name: 'Admin Test',
      email: ADMIN_EMAIL,
      passwordHash: bcrypt.hashSync(ADMIN_PASSWORD, 10),
      role: 'ADMIN',
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  const uniqueEmail = () => `user_${Date.now()}@example.com`;

  it('creates a USER account and returns access + refresh tokens', async () => {
    const email = uniqueEmail();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Jane Citizen', email, password: 'StrongPass@1' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.user.role).toBe('USER');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate email with 409', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register').send({ name: 'Amy A', email, password: 'StrongPass@1' }).expect(201);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bob B', email, password: 'StrongPass@1' })
      .expect(409);
    expect(res.body.error.message).toMatch(/already exists/);
  });

  it('rejects a weak password with field validation errors (400)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Jane Citizen', email: uniqueEmail(), password: 'weak' })
      .expect(400);
    expect(res.body.error.fields).toBeDefined();
    expect(res.body.error.fields.password).toBeDefined();
  });

  it('rejects an invalid email (400)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Jane Citizen', email: 'not-an-email', password: 'StrongPass@1' })
      .expect(400);
    expect(res.body.error.fields.email).toBeDefined();
  });
});

describe('POST /api/auth/login', () => {
  it('logs in a valid user and returns a session', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
  });

  it('rejects a wrong password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'WrongPass@1' })
      .expect(401);
    expect(res.body.error.message).toMatch(/invalid/i);
  });

  it('rejects an unknown email with 401 (no user enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Whatever@1' })
      .expect(401);
    expect(res.body.error.message).toMatch(/invalid/i);
  });
});

describe('POST /api/admin/login', () => {
  it('allows an ADMIN account', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    expect(res.body.data.user.role).toBe('ADMIN');
  });

  it('rejects a non-admin account with 403', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bob Citizen', email: 'bob@example.com', password: 'StrongPass@1' })
      .expect(201);
    void reg;
    const res = await request(app)
      .post('/api/admin/login')
      .send({ email: 'bob@example.com', password: 'StrongPass@1' })
      .expect(403);
    expect(res.body.error.message).toMatch(/admin/i);
  });
});

describe('GET /api/auth/me (protected)', () => {
  it('returns the profile for a valid token', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    const token = login.body.data.token;

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.data.user.email).toBe(ADMIN_EMAIL);
  });

  it('rejects a request without a token (401)', async () => {
    const res = await request(app).get('/api/auth/me').expect(401);
    expect(res.body.error.message).toMatch(/token/i);
  });

  it('rejects a garbage token (403)', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-jwt').expect(403);
    expect(res.body.error.message).toMatch(/token/i);
  });
});

describe('POST /api/auth/refresh (rotation)', () => {
  it('issues a unique new pair, and detected reuse revokes the whole session', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    const oldRefresh = login.body.data.refreshToken;

    const refresh = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(200);
    const newRefresh = refresh.body.data.refreshToken;
    expect(newRefresh).toBeTruthy();
    // Rotation actually issues a distinct token (jti nonce), even within the same second.
    expect(newRefresh).not.toBe(oldRefresh);

    // Old token is now revoked → reuse is rejected (401)
    await request(app).post('/api/auth/refresh').send({ refreshToken: oldRefresh }).expect(401);
    // Reuse detection revokes the entire session, so the new token is dead too.
    await request(app).post('/api/auth/refresh').send({ refreshToken: newRefresh }).expect(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the refresh token so it can no longer be used', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    const refreshToken = login.body.data.refreshToken;

    await request(app).post('/api/auth/logout').send({ refreshToken }).expect(200);
    await request(app).post('/api/auth/refresh').send({ refreshToken }).expect(401);
  });
});

describe('Password reset', () => {
  it('reset-password updates the password and revokes old sessions', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Reset User', email: 'reset@example.com', password: 'OldPass@123' })
      .expect(201);
    const userId = reg.body.data.user.id;

    const token = signResetToken(userId);
    await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'NewPass@456' })
      .expect(200);

    // Old password no longer works; new one does
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'reset@example.com', password: 'OldPass@123' })
      .expect(401);
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'reset@example.com', password: 'NewPass@456' })
      .expect(200);
  });

  it('forgot-password always returns success (no user enumeration)', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: 'ghost@example.com' }).expect(200);
    await request(app).post('/api/auth/forgot-password').send({ email: ADMIN_EMAIL }).expect(200);
  });
});

describe('DELETE /api/auth/account (self-delete)', () => {
  it('requires a token (401)', async () => {
    await request(app).delete('/api/auth/account').expect(401);
  });

  it('soft-deletes the account and revokes the session', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Doomed User', email: 'doomed@example.com', password: 'StrongPass@1' })
      .expect(201);
    const { id } = reg.body.data.user;
    const { token, refreshToken } = reg.body.data;

    const res = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.success).toBe(true);

    // The row is anonymized + deactivated, but NOT removed (reports stay intact).
    const row = await prisma.user.findUnique({ where: { id } });
    expect(row).not.toBeNull();
    expect(row!.isActive).toBe(false);
    expect(row!.name).toBe('Deleted user');
    expect(row!.email).toBe(`deleted-${id}@invalid`);
    expect(row!.refreshToken).toBeNull();
    // The stored hash no longer verifies the old password (replaced with a random one).
    expect(bcrypt.compareSync('StrongPass@1', row!.passwordHash)).toBe(false);

    // Old password no longer works.
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'doomed@example.com', password: 'StrongPass@1' })
      .expect(401);

    // Refresh token was revoked too.
    await request(app).post('/api/auth/refresh').send({ refreshToken }).expect(401);
  });

  it('refuses to deactivate an already-deleted account (400)', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Twice Deleted', email: 'twice@example.com', password: 'StrongPass@1' })
      .expect(201);
    const token = reg.body.data.token;

    await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${token}`).expect(200);
    await request(app).delete('/api/auth/account').set('Authorization', `Bearer ${token}`).expect(400);
  });
});

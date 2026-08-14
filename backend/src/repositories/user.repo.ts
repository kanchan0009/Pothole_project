import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';


export const userRepo = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findById(id: number) {
    return prisma.user.findUnique({ where: { id } });
  },

  create(data: {
    name: string;
    email: string;
    passwordHash?: string | null;
    phone?: string | null;
    role: 'USER' | 'ADMIN';
    isWorker?: boolean;
    latitude?: number | null;
    longitude?: number | null;
    googleId?: string | null;
  }) {
    return prisma.user.create({ data });
  },

  update(id: number, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data });
  },

  
  findWorkers() {
    return prisma.user.findMany({
      where: { isWorker: true, isActive: true },
      select: { id: true, name: true, phone: true, latitude: true, longitude: true },
      orderBy: { name: 'asc' },
    });
  },

  setRefreshToken(id: number, refreshTokenHash: string | null) {
    return prisma.user.update({ where: { id }, data: { refreshToken: refreshTokenHash } });
  },

  
  async list(params: {
    where: { role?: 'USER' | 'ADMIN'; isActive?: boolean; isWorker?: boolean; search?: string };
    page: number;
    limit: number;
  }) {
    const where: Prisma.UserWhereInput = {};
    if (params.where.role) where.role = params.where.role;
    if (params.where.isActive !== undefined) where.isActive = params.where.isActive;
    if (params.where.isWorker !== undefined) where.isWorker = params.where.isWorker;
    if (params.where.search) {
      where.OR = [{ name: { contains: params.where.search } }, { email: { contains: params.where.search } }];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isWorker: true,
          isActive: true,
          latitude: true,
          longitude: true,
          createdAt: true,
          _count: { select: { reports: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);
    return { users, total };
  },
};

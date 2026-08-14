import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export interface ContactMessageInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactMessageListQuery {
  page: number;
  limit: number;
  search?: string;
}


export const contactRepo = {
  async create(input: ContactMessageInput) {
    return prisma.contactMessage.create({ data: input });
  },

  
  async list({ page, limit, search }: ContactMessageListQuery) {
    const where: any = {
      isReplied: false,
      ...(search ? {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { subject: { contains: search } },
        ],
      } : {})
    };

    const [items, total] = await Promise.all([
      prisma.contactMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contactMessage.count({ where }),
    ]);
    return { items, total };
  },
};

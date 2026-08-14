import { Role } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { contactRepo } from '../repositories/contact.repo.js';
import type { ContactMessageInput } from '../repositories/contact.repo.js';

export interface ContactSubmission {
  id: number;
  createdAt: string;
}

export interface ContactMessageListItem {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}

export interface ContactMessageList {
  messages: ContactMessageListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}


export const contactService = {
  async submit(input: ContactMessageInput): Promise<ContactSubmission> {
    const message = await contactRepo.create(input);
    
    await notifyAdmins('New contact message', `${message.name}: ${message.subject}`);
    return { id: message.id, createdAt: message.createdAt.toISOString() };
  },

  
  async listMessages(query: { page: number; limit: number; search?: string }): Promise<ContactMessageList> {
    const { items, total } = await contactRepo.list({
      page: query.page,
      limit: query.limit,
      search: query.search || undefined,
    });
    return {
      messages: items.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        subject: m.subject,
        message: m.message,
        createdAt: m.createdAt.toISOString(),
      })),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
    };
  },

  async replyMessage(id: number, replyText: string): Promise<void> {
    const message = await prisma.contactMessage.findUnique({ where: { id } });
    if (!message) throw new Error('Message not found');

    const user = await prisma.user.findUnique({ where: { email: message.email } });
    if (user) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: 'Reply to your contact message',
          message: `Admin replied: ${replyText}`,
        },
      });
    }
    
    
    await (prisma.contactMessage as any).update({ where: { id }, data: { isReplied: true } });
  },
};

async function notifyAdmins(title: string, message: string): Promise<void> {
  const admins = await prisma.user.findMany({ where: { role: Role.ADMIN }, select: { id: true } });
  if (admins.length === 0) return;
  await prisma.notification.createMany({
    data: admins.map((a) => ({ userId: a.id, title, message })),
  });
}

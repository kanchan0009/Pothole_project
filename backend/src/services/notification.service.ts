import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';

export interface NotificationDTO {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationList {
  notifications: NotificationDTO[];
  unreadCount: number;
  total: number;
}

/** Citizen-facing notification feed (list + read state). */
export const notificationService = {
  async listForUser(userId: number): Promise<NotificationList> {
    const [notifications, unreadCount, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.notification.count({ where: { userId } }),
    ]);

    return {
      notifications: notifications.map(toDTO),
      unreadCount,
      total,
    };
  },

  async markRead(userId: number, id: number): Promise<NotificationList> {
    const n = await prisma.notification.findFirst({ where: { id, userId } });
    if (!n) {
      throw ApiError.notFound('Notification not found');
    }
    await prisma.notification.update({ where: { id }, data: { isRead: true } });
    return this.listForUser(userId);
  },

  async markAllRead(userId: number): Promise<NotificationList> {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return this.listForUser(userId);
  },
};

function toDTO(n: { id: number; title: string; message: string; isRead: boolean; createdAt: Date }): NotificationDTO {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  };
}

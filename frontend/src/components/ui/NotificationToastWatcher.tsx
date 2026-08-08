import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../../api/admin';
import { useToast } from './Toast';

/**
 * Fires a toast whenever a NEW notification lands in the shared feed — e.g. an
 * admin verifies or rejects a citizen's report while the user is on the page.
 *
 * Subscribes to the same ['notifications'] query as NotificationsBell with the
 * same 30s poll, so React Query shares one network call between both components.
 * A watermark ref keeps pre-existing notifications from toasting on first load.
 * Renders nothing.
 */
export function NotificationToastWatcher() {
  const toast = useToast();
  const lastSeenId = useRef<number | null>(null);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const notifications = data?.notifications;
    if (!notifications || notifications.length === 0) return;

    const maxId = Math.max(...notifications.map((n) => n.id));

    // First successful load seeds the watermark so existing notifications
    // never fire a toast — only genuinely new ones.
    if (lastSeenId.current === null) {
      lastSeenId.current = maxId;
      return;
    }

    for (const n of notifications) {
      if (n.id > lastSeenId.current && !n.isRead) {
        toast.info(`${n.title}: ${n.message}`);
      }
    }
    lastSeenId.current = maxId;
  }, [data, toast]);

  return null;
}

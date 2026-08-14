import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../../api/admin';
import { useToast } from './Toast';


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

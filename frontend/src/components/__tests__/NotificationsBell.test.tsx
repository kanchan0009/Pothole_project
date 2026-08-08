import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { notificationsApi } from '../../api/admin';
import { NotificationsBell } from '../ui/NotificationsBell';
import { ToastProvider } from '../ui/Toast';
import type { NotificationList } from '../../types';

vi.mock('../../api/admin', () => ({
  notificationsApi: {
    list: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

const LIST: NotificationList = {
  notifications: [
    {
      id: 1,
      title: 'Report verified',
      message: 'RG-000001 was verified by the municipality.',
      isRead: false,
      createdAt: '2026-08-06T09:00:00',
    },
    {
      id: 2,
      title: 'Report completed',
      message: 'RG-000002 has been repaired.',
      isRead: true,
      createdAt: '2026-08-06T10:00:00',
    },
  ],
  unreadCount: 1,
  total: 2,
};

function renderBell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <NotificationsBell />
      </ToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(notificationsApi.list).mockResolvedValue(LIST);
});

describe('NotificationsBell', () => {
  it('shows the unread count as a badge', async () => {
    renderBell();
    expect(await screen.findByText('1')).toBeInTheDocument();
  });

  it('does not show a badge when everything is read', async () => {
    vi.mocked(notificationsApi.list).mockResolvedValue({ ...LIST, unreadCount: 0 });
    renderBell();
    await vi.waitFor(() => expect(notificationsApi.list).toHaveBeenCalled());
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('lists notifications when opened and marks an unread one as read', async () => {
    renderBell();
    fireEvent.click(await screen.findByLabelText('Notifications'));

    expect(await screen.findByText('Report verified')).toBeInTheDocument();
    expect(screen.getByText('Report completed')).toBeInTheDocument();

    // Clicking the unread row calls markRead for that id.
    fireEvent.click(screen.getByText('Report verified'));
    await vi.waitFor(() => {
      expect(notificationsApi.markRead).toHaveBeenCalledWith(1);
    });
  });

  it('offers "mark all read" when there are unread items', async () => {
    renderBell();
    fireEvent.click(await screen.findByLabelText('Notifications'));

    fireEvent.click(await screen.findByText('Mark all read'));
    await vi.waitFor(() => {
      expect(notificationsApi.markAllRead).toHaveBeenCalledTimes(1);
    });
  });
});

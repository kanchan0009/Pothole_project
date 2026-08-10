import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { FaBell, FaTimes } from "react-icons/fa";
import { PartyPopper } from "lucide-react";
import { notificationsApi } from "../../api/admin";
import { formatTime } from "../../lib/format";
import { useToast } from "./Toast";

/**
 * Bell + dropdown notification feed, shared by the admin and citizen shells.
 * Uses the authenticated /notifications endpoints (mark-read on click, mark-all).
 */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const { data, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: notificationsApi.list,
    // Keep the unread badge fresh in the background without a manual reopen.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const unread = data?.unreadCount ?? 0;
  const visibleNotifications =
    data?.notifications.filter((n) => !n.isRead && !hiddenIds.has(n.id)) ?? [];

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) refetch();
  }

  async function markRead(id: number) {
    try {
      await notificationsApi.markRead(id);
      setHiddenIds((prev) => new Set(prev).add(id));
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update notification",
      );
    }
  }

  async function markAll() {
    try {
      await notificationsApi.markAllRead();
      setHiddenIds(new Set(data?.notifications.map((n) => n.id) ?? []));
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update notifications",
      );
    }
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        aria-label="Notifications"
        className="relative grid h-10 w-10 place-items-center rounded-lg bg-white/70 text-primary-light transition hover:bg-white"
      >
        <FaBell />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-white/60 bg-white shadow-card"
            >
              <div className="flex items-center justify-between border-b border-primary/5 px-4 py-3">
                <p className="text-sm font-extrabold text-primary">
                  Notifications
                </p>
                {unread > 0 && (
                  <button
                    onClick={markAll}
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {visibleNotifications.length === 0 && (
                  <p className="flex items-center justify-center gap-2 px-4 py-8 text-center text-sm text-primary/50">
                    You're all caught up <PartyPopper className="h-4 w-4" />
                  </p>
                )}
                {visibleNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`group flex w-full items-start justify-between border-b border-primary/5 px-4 py-3 transition hover:bg-background ${
                      n.isRead ? "opacity-60" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => !n.isRead && markRead(n.id)}
                      className="text-left"
                      style={{
                        all: "unset",
                        cursor: "pointer",
                        display: "block",
                        width: "100%",
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-bold text-primary">
                          {n.title}
                        </p>
                        <span className="shrink-0 text-[11px] text-primary/40">
                          {formatTime(n.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-primary/60">
                        {n.message}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      className="ml-3 mt-1 rounded-full p-1 text-primary/40 transition hover:bg-primary/10 hover:text-primary"
                      aria-label="Dismiss notification"
                    >
                      <FaTimes className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FaChevronDown, FaChevronLeft, FaChevronRight, FaEnvelopeOpen, FaSearch } from 'react-icons/fa';
import { adminApi } from '../../api/admin';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SkeletonRow } from '../../components/ui/Skeleton';
import { formatDate } from '../../lib/format';
import type { ContactMessage } from '../../types';

const PAGE_SIZE = 10;

export function AdminMessages() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const params = useMemo(
    () => ({ page, limit: PAGE_SIZE, search: debouncedSearch || undefined }),
    [page, debouncedSearch]
  );

  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'contact-messages', params],
    queryFn: () => adminApi.contactMessages(params),
    placeholderData: (prev) => prev,
  });

  const totalPages = data?.pagination.totalPages ?? 1;
  const messages = data?.messages ?? [];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-primary">Contact messages</h1>
        <p className="mt-1 text-sm text-primary/60">
          Messages submitted through the public contact form. Click a row to read the full message.
        </p>
      </div>

      {/* Search */}
      <Card className="mb-5 p-4">
        <div className="relative max-w-md">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-primary/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or subject…"
            className="input-field h-10 pl-9 text-sm"
          />
        </div>
      </Card>

      {/* List */}
      <Card className="overflow-hidden">
        {isFetching && !data ? (
          <div className="px-5 py-4">
            <SkeletonRow lines={PAGE_SIZE} />
          </div>
        ) : (
          <ul className="divide-y divide-primary/5">
            {messages.map((m) => (
              <MessageRow
                key={m.id}
                message={m}
                expanded={expanded === m.id}
                onToggle={() => setExpanded(expanded === m.id ? null : m.id)}
              />
            ))}
          </ul>
        )}

        {data && messages.length === 0 && (
          <p className="py-12 text-center text-sm text-primary/50">No messages match these filters.</p>
        )}

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-primary/5 px-5 py-4">
          <p className="text-xs text-primary/50">
            {data ? `${data.pagination.total} total messages` : 'Loading…'}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <FaChevronLeft /> Prev
            </Button>
            <span className="px-1 text-xs font-semibold text-primary/60">
              Page {page} of {totalPages}
            </span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next <FaChevronRight />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function MessageRow({
  message,
  expanded,
  onToggle,
}: {
  message: ContactMessage;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-primary/[0.02]"
      >
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm transition ${
            expanded ? 'bg-accent text-white' : 'bg-accent/10 text-accent'
          }`}
        >
          <FaEnvelopeOpen />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <p className="truncate text-sm font-bold text-primary">{message.subject}</p>
            <span className="text-[11px] font-medium text-primary/40">{formatDate(message.createdAt)}</span>
          </div>
          <p className="truncate text-xs text-primary/55">
            {message.name} · {message.email}
          </p>
        </div>
        <FaChevronDown
          className={`shrink-0 text-xs text-primary/35 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div className="border-t border-primary/5 bg-primary/[0.02] px-5 py-4">
          <p className="text-sm leading-relaxed text-primary/80">{message.message}</p>
        </div>
      )}
    </li>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FaBolt, FaCrown, FaTruck } from 'react-icons/fa';
import { adminApi } from '../../api/admin';
import { SEVERITY_META, STATUS_META } from '../../lib/constants';
import { reportRef } from '../../lib/receipt';
import type { PriorityQueueItem } from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';

/** How many queue rows to render (the heap itself holds every open report). */
const DISPLAY_LIMIT = 4;

/**
 * The Max Heap priority queue, rendered in priority order. The crown marks the
 * peak — the report the queue would dispatch next. "Dispatch next" pops it,
 * resolves the nearest crew by road (Dijkstra) and moves it to ASSIGNED.
 */
export function PriorityQueuePanel() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isFetching } = useQuery({
    queryKey: ['admin', 'priority-queue'],
    queryFn: adminApi.priorityQueue,
  });

  const dispatch = useMutation({
    mutationFn: adminApi.dispatchNext,
    onSuccess: (result) => {
      invalidate();
      if (result.processed && result.report) {
        toast.success(
          `Dispatched ${reportRef(result.report.id)} → ${result.team?.name ?? 'nearest crew'}`
        );
      } else {
        toast.info('Priority queue is empty — nothing to dispatch');
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Dispatch failed'),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'priority-queue'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'workers'] });
  }

  const items = data?.items ?? [];
  const visible = items.slice(0, DISPLAY_LIMIT);

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-accent">
            <FaBolt />
          </span>
          <div>
            <p className="text-sm font-extrabold text-primary">Priority queue (max heap)</p>
            <p className="text-[11px] text-primary/50">
              {data ? `${data.size} open · next up ${data.peek ? reportRef(data.peek.id) : '—'}` : 'Loading…'}
            </p>
          </div>
        </div>
        <Button size="sm" variant="primary" loading={dispatch.isPending} onClick={() => dispatch.mutate()}>
          <FaTruck /> Dispatch next
        </Button>
      </div>

      {isFetching && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-lg bg-primary/[0.03] py-6 text-center text-sm text-primary/50">
          No open reports in the queue.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {visible.map((item, index) => (
            <QueueRow key={item.id} item={item} isPeak={index === 0 && item.id === data?.peek?.id} />
          ))}
        </ol>
      )}

      {data && data.size > DISPLAY_LIMIT && (
        <p className="mt-3 text-[11px] text-primary/45">
          Showing top {DISPLAY_LIMIT} of {data.size} open reports.
        </p>
      )}
    </Card>
  );
}

function QueueRow({ item, isPeak }: { item: PriorityQueueItem; isPeak: boolean }) {
  const severity = SEVERITY_META[item.severity];
  return (
    <li
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
        isPeak ? 'border-accent/40 bg-accent/5' : 'border-primary/5 bg-white'
      }`}
    >
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-xs font-extrabold ${
          isPeak ? 'bg-accent text-white' : 'bg-primary/5 text-primary/60'
        }`}
      >
        {isPeak ? <FaCrown className="text-sm" /> : item.rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-primary">
          {item.title}
          <span className="ml-2 text-[11px] font-medium text-primary/40">{item.ref}</span>
        </p>
        <p className="text-[11px] text-primary/50">
          {item.municipality} · Ward {item.ward} · {item.ageDays}d old
          {item.confirmations > 0 && (
            <span className="font-semibold text-accent"> · {item.confirmations}× confirmed</span>
          )}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-extrabold" style={{ color: severity.color }}>
          {item.priorityScore}
        </p>
        <Badge tone={STATUS_META[item.status].tone}>{STATUS_META[item.status].label}</Badge>
      </div>
    </li>
  );
}

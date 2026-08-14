import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { FaBan, FaDownload, FaFlag, FaRoad, FaTrash } from 'react-icons/fa';
import { reportsApi } from '../../api/reports';
import { useAuth } from '../../features/auth/auth-context';
import { SEVERITY_META, STATUS_META } from '../../lib/constants';
import { formatCoords, formatDateTime } from '../../lib/format';
import { canUserDeleteReport } from '../../lib/reportActions';
import { reportRef } from '../../lib/receipt';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';

interface ReportDetailDrawerProps {
  reportId: number | null;
  onClose: () => void;
}


export function ReportDetailDrawer({ reportId, onClose }: ReportDetailDrawerProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['user', 'report', reportId],
    queryFn: () => reportsApi.get(reportId!),
    enabled: !!reportId,
  });

  const report = data?.report;
  const isOwner = report?.userId === user?.id;
  const canRemove = report ? canUserDeleteReport(report.status) : false;

  useEffect(() => {
    setConfirmRemove(false);
  }, [reportId]);

  async function handleReceipt() {
    if (!report) return;
    try {
      await reportsApi.receipt(report.id);
      toast.info(`Receipt ${reportRef(report.id)} downloaded`);
    } catch {
      toast.error('Could not generate the receipt. Try again later.');
    }
  }

  
  async function handleRemove() {
    if (!report) return;
    setRemoving(true);
    try {
      await reportsApi.removeForUser(report.id);
      queryClient.invalidateQueries({ queryKey: ['user', 'reports'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'stats'] });
      toast.success('Report deleted permanently.');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the report');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <AnimatePresence>
      {reportId && (
        <>
          <div className="fixed inset-0 z-40 bg-primary/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-background shadow-2xl"
          >
            {}
            <div className="flex items-center justify-between gap-3 border-b border-white/60 bg-white/80 px-5 py-4 backdrop-blur">
              <div>
                <h2 className="text-lg font-extrabold text-primary">{report ? reportRef(report.id) : 'Report'}</h2>
                <p className="text-xs text-primary/50">Report detail &amp; progress</p>
              </div>
              {report && <Badge tone={STATUS_META[report.status].tone}>{STATUS_META[report.status].label}</Badge>}
              {report?.confidenceScore != null && (
                <span className="rounded-md bg-accent/10 px-2 py-1 text-xs font-bold text-accent">
                  AI {Math.round(report.confidenceScore * 100)}%
                </span>
              )}
              <button
                onClick={onClose}
                aria-label="Close"
                className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-primary/60 transition hover:bg-primary/5"
              >
                ✕
              </button>
            </div>

            {}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {isLoading || !report ? (
                <div className="space-y-4">
                  <Skeleton className="h-56 w-full rounded-xl" />
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : (
                <div className="space-y-6">
                  {}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <figure>
                      <img src={report.imageUrl} alt="Reported" className="h-44 w-full rounded-xl object-cover" />
                      <figcaption className="mt-1 text-center text-xs font-semibold text-primary/50">
                        Reported photo
                      </figcaption>
                    </figure>
                    {report.completionImageUrl ? (
                      <figure>
                        <img src={report.completionImageUrl} alt="After repair" className="h-44 w-full rounded-xl object-cover" />
                        <figcaption className="mt-1 text-center text-xs font-semibold text-success">
                          After repair
                        </figcaption>
                      </figure>
                    ) : (
                      <div className="grid h-44 w-full place-items-center rounded-xl border border-dashed border-primary/20 text-center text-xs font-medium text-primary/40">
                        {report.status === 'COMPLETED'
                          ? 'No completion photo was attached.'
                          : 'Completion photo appears here once the road is repaired.'}
                      </div>
                    )}
                  </div>

                  {}
                  {report.duplicate && (
                    <div className="rounded-xl border border-warning/20 bg-warning/5 p-4">
                      <p className="flex items-center gap-2 text-sm font-bold text-warning">
                        <FaFlag /> Flagged as a duplicate
                      </p>
                      <p className="mt-1 text-sm text-primary/70">
                        Another open report exists within 20m of this location. The team is handling it as one job.
                      </p>
                    </div>
                  )}

                  {}
                  {report.status === 'REJECTED' && report.rejectionReason && (
                    <div className="rounded-xl border border-danger/20 bg-danger/5 p-4">
                      <p className="flex items-center gap-2 text-sm font-bold text-danger">
                        <FaBan /> Rejection reason
                      </p>
                      <p className="mt-1 text-sm text-primary/80">{report.rejectionReason}</p>
                    </div>
                  )}

                  {}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Info label="Title" value={report.title} span />
                    <Info label="Road name" value={report.roadName} />
                    <Info label="Municipality" value={report.municipality} />
                    <Info label="Ward" value={report.ward} />
                    <Info label="Landmark" value={report.landmark || '—'} />
                    <Info label="Coordinates" value={formatCoords(report.latitude, report.longitude)} />
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-primary/40">Severity</p>
                      <p className="mt-0.5 text-sm font-bold" style={{ color: SEVERITY_META[report.severity].color }}>
                        {SEVERITY_META[report.severity].label}
                      </p>
                    </div>
                    <Info label="Priority score" value={String(report.priorityScore)} />
                    <Info label="Submitted" value={formatDateTime(report.createdAt)} span />
                    <Info label="Description" value={report.description} span />
                  </div>

                  {}
                  {report.assignments && report.assignments.length > 0 && (
                    <Card className="p-4">
                      <p className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
                        <FaRoad className="text-accent" /> Assigned crew
                      </p>
                      {report.assignments.map((a) => (
                        <p key={a.id} className="text-sm text-primary/70">
                          <span className="font-semibold text-primary">{a.assignedTo}</span> ·{' '}
                          {formatDateTime(a.assignedAt)}
                        </p>
                      ))}
                    </Card>
                  )}

                  {}
                  {report.history && report.history.length > 0 && (
                    <Card className="p-4">
                      <p className="mb-4 text-sm font-bold text-primary">Status timeline</p>
                      <ol className="relative space-y-4 border-l border-primary/10 pl-5">
                        {report.history.map((h) => (
                          <li key={h.id} className="relative">
                            <span
                              className="absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white"
                              style={{ backgroundColor: STATUS_META[h.status].color }}
                            />
                            <p className="text-sm font-bold text-primary">{STATUS_META[h.status].label}</p>
                            {h.remarks && <p className="text-xs text-primary/60">{h.remarks}</p>}
                            <p className="mt-0.5 text-[11px] text-primary/40">
                              {h.updatedBy?.name ?? 'System'} · {formatDateTime(h.createdAt)}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </Card>
                  )}

                  {}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/10 bg-white p-4">
                    <div>
                      <p className="text-sm font-bold text-primary">Official report receipt</p>
                      <p className="text-xs text-primary/50">
                        Download a PDF with photos, status history, and reference {reportRef(report.id)}.
                      </p>
                    </div>
                    <Button size="sm" onClick={handleReceipt}>
                      <FaDownload /> Download receipt
                    </Button>
                  </div>

                  {}
                  {isOwner && (
                    <div className="rounded-xl border border-danger/20 bg-danger/5 p-4">
                      {!confirmRemove ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-danger">Delete this report</p>
                            <p className="text-xs text-primary/50">
                              Permanently removes it from your dashboard, the admin panel, and the database.
                            </p>
                          </div>
                          {canRemove ? (
                            <Button size="sm" variant="danger" onClick={() => setConfirmRemove(true)}>
                              <FaTrash /> Delete report
                            </Button>
                          ) : (
                            <p className="text-xs font-medium text-primary/60">
                              Cannot delete while work is {STATUS_META[report.status].label.toLowerCase()}.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm font-bold text-primary">
                            Permanently delete {reportRef(report.id)}?
                          </p>
                          <p className="text-xs text-primary/60">
                            This cannot be undone. Download the receipt first if you need a copy.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="danger" loading={removing} onClick={handleRemove}>
                              Yes, delete permanently
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Info({ label, value, span = false }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-primary/40">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-primary">{value}</p>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { FaBan, FaRobot, FaTrash } from "react-icons/fa";
import { adminApi } from "../../api/admin";
import type { ReportStatus } from "../../types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { useToast } from "../ui/Toast";
import {
  REJECT_REASONS,
  SEVERITY_META,
  STATUS_META,
} from "../../lib/constants";
import { formatCoords, formatDateTime } from "../../lib/format";
import { reportRef } from "../../lib/receipt";
import { RouteMap } from "./RouteMap";

type ActionMode =
  | "verify"
  | "assign"
  | "start"
  | "complete"
  | "reject"
  | "remove"
  | null;

/** Which workflow actions are offered per status (mirrors the backend state machine). */
const STATUS_ACTIONS: Partial<
  Record<ReportStatus, Exclude<ActionMode, null>[]>
> = {
  PENDING: ["verify", "assign", "reject"],
  VERIFIED: ["assign", "reject"],
  ASSIGNED: ["start", "reject"],
  IN_PROGRESS: ["complete", "reject"],
  // Once repaired, a Completed report can be removed from the active list.
  COMPLETED: ["remove"],
};

const ACTION_LABEL: Record<Exclude<ActionMode, null>, string> = {
  verify: "Verify report",
  assign: "Assign worker",
  start: "Start work",
  complete: "Mark completed",
  reject: "Reject report",
  remove: "Remove report",
};

/** Multipart body for field-only transitions. */
function formOf(obj: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) if (v) f.append(k, v);
  return f;
}

interface ReportDrawerProps {
  reportId: number | null;
  onClose: () => void;
}

export function ReportDrawer({ reportId, onClose }: ReportDrawerProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<ActionMode>(null);
  const [remarks, setRemarks] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [workerId, setWorkerId] = useState<number | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [aiMode, setAiMode] = useState<"confirm" | "reject" | null>(null);
  const [aiReason, setAiReason] = useState("NOT_A_POTHOLY");
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "report", reportId],
    queryFn: () => adminApi.reportDetail(reportId!),
    enabled: !!reportId,
  });
  const { data: workersData } = useQuery({
    queryKey: ["admin", "workers"],
    queryFn: adminApi.workers,
    enabled: !!reportId,
  });

  const report = data?.report;

  // Dijkstra route crew → pothole, computed live so it recalculates when the
  // assigned worker's coordinates change.
  const { data: routeData } = useQuery({
    queryKey: ["admin", "report-route", reportId],
    queryFn: () => adminApi.reportRoute(reportId!),
    enabled: !!reportId && !!report?.latitude && !!report?.longitude,
  });

  // Reset transient form state whenever the drawer opens for a new report.
  useEffect(() => {
    setAction(null);
    setRemarks("");
    setRejectReason("");
    setRejectNotes("");
    setWorkerId("");
    setFile(null);
    setConfirmDelete(false);
    setAiMode(null);
    setAiReason("NOT_A_POTHOLY");
  }, [reportId]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "statistics"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "report", reportId] });
  };

  async function submitAction() {
    if (!report || !action) return;
    setSubmitting(true);
    try {
      if (action === "verify") {
        await adminApi.updateStatus(report.id, formOf({ status: "VERIFIED" }));
      } else if (action === "start") {
        await adminApi.updateStatus(
          report.id,
          formOf({ status: "IN_PROGRESS" }),
        );
      } else if (action === "reject") {
        if (!rejectReason) {
          toast.error("A rejection reason is required");
          return;
        }
        const reason = rejectNotes.trim()
          ? `${rejectReason} — ${rejectNotes.trim()}`
          : rejectReason;
        await adminApi.updateStatus(
          report.id,
          formOf({ status: "REJECTED", remarks: reason }),
        );
      } else if (action === "complete") {
        const form = new FormData();
        form.append("status", "COMPLETED");
        if (remarks) form.append("remarks", remarks);
        if (file) form.append("image", file);
        await adminApi.updateStatus(report.id, form);
      } else if (action === "assign") {
        await adminApi.assign(
          report.id,
          workerId === "" ? {} : { workerId: Number(workerId) },
        );
      } else if (action === "remove") {
        await adminApi.updateStatus(report.id, formOf({ status: "REMOVED" }));
      }
      invalidate();
      setAction(null);
      setRemarks("");
      setRejectReason("");
      setRejectNotes("");
      setWorkerId("");
      setFile(null);
      toast.success(
        action === "remove"
          ? "Report removed from the active list"
          : "Report updated",
      );
      if (action === "remove") onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update report",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!report) return;
    setSubmitting(true);
    try {
      await adminApi.remove(report.id);
      invalidate();
      toast.success("Report deleted");
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete report",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAi(action: "confirm" | "reject") {
    if (!report) return;
    setSubmitting(true);
    try {
      await adminApi.verifyAi(
        report.id,
        action === "confirm"
          ? { approved: true }
          : { approved: false, reason: aiReason },
      );
      invalidate();
      setAiMode(null);
      setAiReason("NOT_A_POTHOLY");
      toast.success(
        action === "confirm"
          ? "Detection confirmed"
          : "Detection rejected — report closed",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not record the AI verdict",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {reportId && (
        <>
          <div
            className="fixed inset-0 z-40 bg-primary/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-background shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-white/60 bg-white/80 px-5 py-4 backdrop-blur">
              <div>
                <h2 className="text-lg font-extrabold text-primary">
                  {report ? reportRef(report.id) : "Report"}
                </h2>
                <p className="text-xs text-primary/50">
                  Admin detail &amp; workflow
                </p>
              </div>
              {report && (
                <Badge tone={STATUS_META[report.status].tone}>
                  {STATUS_META[report.status].label}
                </Badge>
              )}
              <button
                onClick={onClose}
                aria-label="Close"
                className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-primary/60 transition hover:bg-primary/5"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {isLoading || !report ? (
                <div className="space-y-4">
                  <Skeleton className="h-56 w-full rounded-xl" />
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Images */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <figure>
                      <img
                        src={report.imageUrl}
                        alt="Before"
                        className="h-44 w-full rounded-xl object-cover"
                      />
                      <figcaption className="mt-1 text-center text-xs font-semibold text-primary/50">
                        Reported photo
                      </figcaption>
                    </figure>
                    {report.completionImageUrl && (
                      <figure>
                        <img
                          src={report.completionImageUrl}
                          alt="After repair"
                          className="h-44 w-full rounded-xl object-cover"
                        />
                        <figcaption className="mt-1 text-center text-xs font-semibold text-success">
                          After repair
                        </figcaption>
                      </figure>
                    )}
                  </div>

                  {(report.duplicate ||
                    report.status === "COMPLETED" ||
                    report.completionImageUrl) && (
                    <Card className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {report.duplicate && (
                          <Badge tone="danger">Flagged duplicate</Badge>
                        )}
                        {report.status === "COMPLETED" && (
                          <Badge tone="success">Work completed</Badge>
                        )}
                        {report.completionImageUrl && (
                          <Badge tone="info">Completion photo attached</Badge>
                        )}
                      </div>
                      {report.duplicate && (
                        <p className="mt-2 text-sm text-primary/60">
                          This report is flagged as a duplicate of an existing
                          pothole report.
                        </p>
                      )}
                    </Card>
                  )}

                  {/* Rejection reason */}
                  {report.status === "REJECTED" && report.rejectionReason && (
                    <div className="rounded-xl border border-danger/20 bg-danger/5 p-4">
                      <p className="flex items-center gap-2 text-sm font-bold text-danger">
                        <FaBan /> Rejection reason
                      </p>
                      <p className="mt-1 text-sm text-primary/80">
                        {report.rejectionReason}
                      </p>
                    </div>
                  )}

                  {/* AI detection + Verify-AI */}
                  {report.confidenceScore != null && (
                    <Card className="p-4">
                      <p className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
                        <FaRobot className="text-accent" /> AI detection
                      </p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-primary/60">Confidence</span>
                        <span className="font-bold text-primary">
                          {Math.round(report.confidenceScore * 100)}%
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-primary/10">
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{
                            width: `${Math.round(report.confidenceScore * 100)}%`,
                          }}
                        />
                      </div>

                      {report.aiSeverity && (
                        <div className="mt-3 space-y-1.5 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-primary/60">
                              CNN severity
                            </span>
                            <span
                              className="font-extrabold"
                              style={{
                                color: SEVERITY_META[report.aiSeverity].color,
                              }}
                            >
                              {SEVERITY_META[report.aiSeverity].label}
                            </span>
                          </div>
                          {report.suggestedSeverity &&
                            report.suggestedSeverity !== report.aiSeverity && (
                              <div className="flex items-center justify-between">
                                <span className="text-primary/60">
                                  Reported as
                                </span>
                                <span className="font-semibold text-primary/70">
                                  {
                                    SEVERITY_META[report.suggestedSeverity]
                                      .label
                                  }
                                </span>
                              </div>
                            )}
                          {(report.confirmations ?? 0) > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-primary/60">
                                Confirmations
                              </span>
                              <span className="font-bold text-accent">
                                ×{report.confirmations}
                              </span>
                            </div>
                          )}
                          {report.aiClassProbs && (
                            <div className="mt-1 space-y-1">
                              {(
                                [
                                  "NONE",
                                  "LOW",
                                  "MEDIUM",
                                  "HIGH",
                                  "CRITICAL",
                                ] as const
                              ).map((cls, i) => {
                                const p = report.aiClassProbs![i] ?? 0;
                                return (
                                  <div
                                    key={cls}
                                    className="flex items-center gap-2 text-[11px]"
                                  >
                                    <span className="w-16 shrink-0 text-primary/45">
                                      {cls}
                                    </span>
                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/10">
                                      <div
                                        className="h-full rounded-full bg-accent/80"
                                        style={{
                                          width: `${Math.round(p * 100)}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="w-9 shrink-0 text-right font-semibold text-primary/60">
                                      {(p * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {report.detectedImageUrl && (
                        <figure className="relative mt-3 overflow-hidden rounded-xl">
                          <img
                            src={report.detectedImageUrl}
                            alt="AI detection result"
                            className="h-40 w-full object-cover"
                          />
                          <figcaption className="absolute right-2 top-2 rounded bg-primary/80 px-2 py-0.5 text-[10px] font-bold text-white">
                            Detection box
                          </figcaption>
                        </figure>
                      )}

                      {report.aiVerified === true && (
                        <p className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-xs font-semibold text-success">
                          ✓ AI detection confirmed by admin
                        </p>
                      )}
                      {report.aiVerified === false && (
                        <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
                          ✕ AI detection rejected —{" "}
                          {report.aiRejectedReason ?? "not a pothole"}
                        </p>
                      )}

                      {report.aiVerified === null && (
                        <div className="mt-4 space-y-3 border-t border-primary/5 pt-3">
                          <p className="text-xs text-primary/50">
                            Was the AI right about this photo?
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              loading={submitting && aiMode !== "reject"}
                              onClick={() => void handleAi("confirm")}
                            >
                              Confirm detection
                            </Button>
                            <Button
                              size="sm"
                              variant={
                                aiMode === "reject" ? "danger" : "outline"
                              }
                              onClick={() => {
                                setAiMode(
                                  aiMode === "reject" ? null : "reject",
                                );
                                setAiReason("NOT_A_POTHOLY");
                              }}
                            >
                              Reject detection
                            </Button>
                          </div>
                          {aiMode === "reject" && (
                            <div className="space-y-2 border-t border-primary/5 pt-3">
                              <label
                                htmlFor="ai-reason"
                                className="label-field"
                              >
                                Rejection reason
                              </label>
                              <select
                                id="ai-reason"
                                value={aiReason}
                                onChange={(e) => setAiReason(e.target.value)}
                                className="input-field"
                              >
                                <option value="NOT_A_POTHOLY">
                                  Not a pothole
                                </option>
                                <option value="DUPLICATE">
                                  Duplicate report
                                </option>
                                <option value="BLURRED_IMAGE">
                                  Blurred image
                                </option>
                                <option value="FAKE_REPORT">Fake report</option>
                              </select>
                              <Button
                                size="sm"
                                variant="danger"
                                loading={submitting}
                                onClick={() => void handleAi("reject")}
                              >
                                Reject &amp; close report
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  )}

                  {/* Details */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Info label="Title" value={report.title} span />
                    <Info label="Road name" value={report.roadName} />
                    <Info label="Municipality" value={report.municipality} />
                    <Info label="Ward" value={report.ward} />
                    <Info label="Landmark" value={report.landmark || "—"} />
                    <Info
                      label="Coordinates"
                      value={formatCoords(report.latitude, report.longitude)}
                    />
                    <Info label="Severity" value={report.severity} />
                    <Info
                      label="Priority"
                      value={String(report.priorityScore)}
                    />
                    <Info label="Reporter" value={report.reporterName || "—"} />
                    <Info
                      label="Submitted"
                      value={formatDateTime(report.createdAt)}
                      span
                    />
                    <Info label="Description" value={report.description} span />
                  </div>

                  {/* Dijkstra route — crew → pothole (recomputed on every view) */}
                  {report.latitude != null && report.longitude != null && (
                    <div>
                      {!routeData ? (
                        <Skeleton className="h-64 w-full rounded-xl" />
                      ) : (
                        <RouteMap route={routeData} />
                      )}
                    </div>
                  )}

                  {/* Assignment */}
                  {report.assignments && report.assignments.length > 0 && (
                    <Card className="p-4">
                      <p className="mb-2 text-sm font-bold text-primary">
                        Assignment
                      </p>
                      {report.assignments.map((a) => (
                        <p key={a.id} className="text-sm text-primary/70">
                          Assigned to{" "}
                          <span className="font-semibold text-primary">
                            {a.assignedTo}
                          </span>{" "}
                          · {formatDateTime(a.assignedAt)}
                        </p>
                      ))}
                    </Card>
                  )}

                  {/* Timeline */}
                  {report.history && report.history.length > 0 && (
                    <Card className="p-4">
                      <p className="mb-4 text-sm font-bold text-primary">
                        Status timeline
                      </p>
                      <ol className="relative space-y-4 border-l border-primary/10 pl-5">
                        {report.history.map((h) => (
                          <li key={h.id} className="relative">
                            <span
                              className="absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white"
                              style={{
                                backgroundColor: STATUS_META[h.status].color,
                              }}
                            />
                            <p className="text-sm font-bold text-primary">
                              {STATUS_META[h.status].label}
                            </p>
                            {h.remarks && (
                              <p className="text-xs text-primary/60">
                                {h.remarks}
                              </p>
                            )}
                            <p className="mt-0.5 text-[11px] text-primary/40">
                              {h.updatedBy?.name ?? "System"} ·{" "}
                              {formatDateTime(h.createdAt)}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </Card>
                  )}

                  {/* Workflow actions */}
                  {(STATUS_ACTIONS[report.status] ?? []).length > 0 && (
                    <Card className="p-4">
                      <p className="mb-3 text-sm font-bold text-primary">
                        Workflow
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {STATUS_ACTIONS[report.status]!.map((a) => (
                          <Button
                            key={a}
                            size="sm"
                            variant={a === "reject" ? "danger" : "primary"}
                            onClick={() =>
                              setAction((prev) => (prev === a ? null : a))
                            }
                          >
                            {ACTION_LABEL[a]}
                          </Button>
                        ))}
                      </div>

                      {action && (
                        <div className="mt-4 space-y-3 border-t border-primary/5 pt-4">
                          {action === "assign" && (
                            <div className="space-y-2">
                              <label
                                className="label-field"
                                htmlFor="worker-select"
                              >
                                Maintenance worker
                              </label>
                              <select
                                id="worker-select"
                                value={workerId}
                                onChange={(e) =>
                                  setWorkerId(
                                    e.target.value
                                      ? Number(e.target.value)
                                      : "",
                                  )
                                }
                                className="input-field"
                              >
                                <option value="">
                                  Auto-assign nearest worker
                                </option>
                                {(workersData?.workers ?? []).map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {action === "reject" && (
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <label
                                  className="label-field"
                                  htmlFor="reject-reason"
                                >
                                  Rejection reason *
                                </label>
                                <select
                                  id="reject-reason"
                                  value={rejectReason}
                                  onChange={(e) =>
                                    setRejectReason(e.target.value)
                                  }
                                  className="input-field"
                                >
                                  <option value="">Select a reason…</option>
                                  {REJECT_REASONS.map((r) => (
                                    <option key={r} value={r}>
                                      {r}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-2">
                                <label
                                  className="label-field"
                                  htmlFor="reject-notes"
                                >
                                  Additional notes (optional)
                                </label>
                                <textarea
                                  id="reject-notes"
                                  rows={2}
                                  value={rejectNotes}
                                  onChange={(e) =>
                                    setRejectNotes(e.target.value)
                                  }
                                  placeholder="Optional detail for the reporter"
                                  className="input-field resize-none"
                                />
                              </div>
                            </div>
                          )}

                          {action === "complete" && (
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <label
                                  className="label-field"
                                  htmlFor="complete-remarks"
                                >
                                  Remarks
                                </label>
                                <textarea
                                  id="complete-remarks"
                                  rows={2}
                                  value={remarks}
                                  onChange={(e) => setRemarks(e.target.value)}
                                  placeholder="e.g. Crew #2 re-surfaced the lane"
                                  className="input-field resize-none"
                                />
                              </div>
                              <div className="space-y-2">
                                <label
                                  className="label-field"
                                  htmlFor="complete-image"
                                >
                                  Completion photo (after repair)
                                </label>
                                <input
                                  id="complete-image"
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) =>
                                    setFile(e.target.files?.[0] ?? null)
                                  }
                                  className="input-field file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              loading={submitting}
                              onClick={submitAction}
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setAction(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  )}

                  {/* Delete */}
                  <div className="flex items-center justify-between rounded-xl border border-danger/20 bg-white p-4">
                    <div>
                      <p className="text-sm font-bold text-danger">
                        Danger zone
                      </p>
                      <p className="text-xs text-primary/50">
                        Permanently remove this report and its history.
                      </p>
                    </div>
                    {confirmDelete ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="danger"
                          loading={submitting}
                          onClick={handleDelete}
                        >
                          Confirm delete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDelete(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setConfirmDelete(true)}
                      >
                        <FaTrash /> Delete
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Info({
  label,
  value,
  span = false,
}: {
  label: string;
  value: string;
  span?: boolean;
}) {
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-primary/40">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-primary">{value}</p>
    </div>
  );
}

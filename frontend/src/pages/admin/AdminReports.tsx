import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  FaChevronLeft,
  FaChevronRight,
  FaFileCsv,
  FaFileExcel,
  FaFilePdf,
  FaSearch,
} from "react-icons/fa";
import {
  adminApi,
  type AdminExportFormat,
  type AdminReportParams,
} from "../../api/admin";
import { PriorityQueuePanel } from "../../components/admin/PriorityQueuePanel";
import { ReportDrawer } from "../../components/admin/ReportDrawer";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { SkeletonRow } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";
import {
  SEVERITY_META,
  SEVERITY_ORDER,
  STATUS_META,
  STATUS_ORDER,
} from "../../lib/constants";
import { formatDateTime } from "../../lib/format";
import { reportRef } from "../../lib/receipt";
import type { Report, ReportStatus, Severity } from "../../types";

const PAGE_SIZE = 10;

const MUNICIPALITIES = [
  "Kathmandu",
  "Lalitpur",
  "Bhaktapur",
  "Kirtipur",
  "Madhyapur Thimi",
  "Hetauda",
];
const WARDS = Array.from({ length: 17 }, (_, i) => String(i + 1));

const SORTS: { key: NonNullable<AdminReportParams["sort"]>; label: string }[] =
  [
    { key: "newest", label: "Newest first" },
    { key: "oldest", label: "Oldest first" },
    { key: "priority", label: "Highest priority" },
    { key: "severity", label: "Most severe" },
    { key: "status", label: "Status" },
  ];

const EXPORTS: {
  format: AdminExportFormat;
  label: string;
  icon: React.ReactNode;
}[] = [
  { format: "csv", label: "CSV", icon: <FaFileCsv /> },
  { format: "xlsx", label: "Excel", icon: <FaFileExcel /> },
  { format: "pdf", label: "PDF", icon: <FaFilePdf /> },
];

function SeverityChip({ severity }: { severity: Severity }) {
  const meta = SEVERITY_META[severity];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-bold"
      style={{ color: meta.color }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      {meta.label}
    </span>
  );
}

export function AdminReports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('reportId') ? parseInt(searchParams.get('reportId')!, 10) : null;

  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<ReportStatus | "">("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [municipality, setMunicipality] = useState("");
  const [ward, setWard] = useState("");
  const [sort, setSort] = useState<AdminReportParams["sort"]>("newest");
  const [selectedId, setSelectedId] = useState<number | null>(initialId);
  const [exporting, setExporting] = useState<AdminExportFormat | null>(null);

  useEffect(() => {
    const id = searchParams.get('reportId');
    if (id) {
       setSelectedId(parseInt(id, 10));
    }
  }, [searchParams]);

  const handleDrawerClose = () => {
    setSelectedId(null);
    if (searchParams.has('reportId')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('reportId');
      setSearchParams(newParams);
    }
  };

  // Debounce the search box so the table doesn't refetch per keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  // Any filter change starts back at page 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, severity, municipality, ward, sort]);

  const listQueryKey = useMemo(
    () =>
      [
        "admin",
        "reports",
        {
          page,
          limit: PAGE_SIZE,
          status: status || null,
          severity: severity || null,
          municipality: municipality || null,
          ward: ward || null,
          search: debouncedSearch || null,
          sort,
        },
      ] as const,
    [page, status, severity, municipality, ward, debouncedSearch, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: listQueryKey,
    queryFn: ({ queryKey }) => {
      const [, , filters] = queryKey as [
        "admin",
        "reports",
        {
          page: number;
          limit: number;
          status: ReportStatus | null;
          severity: Severity | null;
          municipality: string | null;
          ward: string | null;
          search: string | null;
          sort: NonNullable<AdminReportParams["sort"]>;
        },
      ];
      return adminApi.reports({
        page: filters.page,
        limit: filters.limit,
        status: filters.status ?? undefined,
        severity: filters.severity ?? undefined,
        municipality: filters.municipality || undefined,
        ward: filters.ward || undefined,
        search: filters.search || undefined,
        sort: filters.sort,
      });
    },
  });

  const selectClass = "input-field h-10 min-w-0 cursor-pointer pr-8 text-sm";

  async function handleExport(format: AdminExportFormat) {
    setExporting(format);
    try {
      await adminApi.downloadExport(format, {
        status: status || undefined,
        severity: severity || undefined,
        municipality: municipality || undefined,
        ward: ward || undefined,
        search: debouncedSearch || undefined,
        sort,
      });
      toast.success(`Exported ${format.toUpperCase()} — check your downloads`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  const totalPages = data?.pagination.totalPages ?? 1;
  const reports = data?.reports ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-primary">
            Reports management
          </h1>
          <p className="mt-1 text-sm text-primary/60">
            Review, verify, assign and resolve every citizen report.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {EXPORTS.map((e) => (
            <Button
              key={e.format}
              size="sm"
              variant="outline"
              loading={exporting === e.format}
              onClick={() => handleExport(e.format)}
            >
              {e.icon}
              {e.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative sm:col-span-2">
            <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-primary/35" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, road, reporter…"
              className="input-field h-10 pl-9 text-sm"
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ReportStatus | "")}
            className={selectClass}
          >
            <option value="">All statuses</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>

          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity | "")}
            className={selectClass}
          >
            <option value="">All severities</option>
            {SEVERITY_ORDER.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_META[s].label}
              </option>
            ))}
          </select>

          <select
            value={municipality}
            onChange={(e) => setMunicipality(e.target.value)}
            className={selectClass}
          >
            <option value="">All municipalities</option>
            {MUNICIPALITIES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={ward}
            onChange={(e) => setWard(e.target.value)}
            className={selectClass}
          >
            <option value="">All wards</option>
            {WARDS.map((w) => (
              <option key={w} value={w}>
                Ward {w}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-primary/5 pt-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary/40">
            Sort by
          </span>
          <div className="flex flex-wrap gap-1">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  sort === s.key
                    ? "bg-primary text-white"
                    : "text-primary/60 hover:text-primary"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Max-heap priority queue — highest-priority pothole first */}
      <div className="mb-5">
        <PriorityQueuePanel />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-primary/5 bg-primary/[0.03] text-[11px] font-bold uppercase tracking-wider text-primary/45">
                <th className="px-5 py-3">Report</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Severity</th>
                <th className="px-5 py-3">Priority</th>
                <th className="px-5 py-3">Flags</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Reported</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6}>
                    <div className="px-5 py-4">
                      <SkeletonRow lines={PAGE_SIZE} />
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-primary/60">
                    {error instanceof Error ? error.message : "Could not load reports."}
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <Row
                    key={r.id}
                    report={r}
                    onClick={() => setSelectedId(r.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && !isError && reports.length === 0 && (
          <p className="py-12 text-center text-sm text-primary/50">
            No reports match these filters.
          </p>
        )}

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-primary/5 px-5 py-4">
          <p className="text-xs text-primary/50">
            {data ? (
              <>
                Showing {(data.pagination.page - 1) * data.pagination.limit + 1}
                –
                {Math.min(
                  data.pagination.page * data.pagination.limit,
                  data.pagination.total,
                )}{" "}
                of {data.pagination.total} reports
              </>
            ) : (
              "Loading…"
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <FaChevronLeft /> Prev
            </Button>
            <span className="px-1 text-xs font-semibold text-primary/60">
              Page {page} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <FaChevronRight />
            </Button>
          </div>
        </div>
      </Card>

      <ReportDrawer reportId={selectedId} onClose={handleDrawerClose} />
    </motion.div>
  );
}

function Row({ report, onClick }: { report: Report; onClick: () => void }) {
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b border-primary/5 transition-colors last:border-0 hover:bg-primary/[0.03]"
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <img
            src={report.imageUrl}
            alt=""
            className="h-11 w-11 shrink-0 rounded-lg object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-primary">
              {report.title}
            </p>
            <p className="text-[11px] text-primary/45">
              {reportRef(report.id)}
            </p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3">
        <p className="text-sm font-medium text-primary">{report.roadName}</p>
        <p className="text-[11px] text-primary/45">
          {report.municipality} · Ward {report.ward}
        </p>
      </td>
      <td className="px-5 py-3">
        <SeverityChip severity={report.severity} />
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold text-primary">
            {report.priorityScore}
          </span>
          {report.confidenceScore != null && (
            <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">
              AI {Math.round(report.confidenceScore * 100)}%
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-3">
        <div className="flex flex-wrap gap-1">
          {report.duplicate && <Badge tone="danger">Duplicate</Badge>}
          {report.status === "COMPLETED" && (
            <Badge tone="success">Work completed</Badge>
          )}
          {report.completionImageUrl && (
            <Badge>Completion photo</Badge>
          )}
        </div>
      </td>
      <td className="px-5 py-3">
        <Badge tone={STATUS_META[report.status].tone}>
          {STATUS_META[report.status].label}
        </Badge>
      </td>
      <td className="px-5 py-3 text-xs font-medium text-primary/60">
        {formatDateTime(report.createdAt)}
      </td>
    </tr>
  );
}

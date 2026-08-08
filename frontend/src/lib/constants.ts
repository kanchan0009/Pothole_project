import type { ReportStatus, Severity } from "../types";

/** Display metadata per report status — colors follow the spec. */
export const STATUS_META: Record<
  ReportStatus,
  {
    label: string;
    color: string;
    marker: "yellow" | "blue" | "purple" | "orange" | "green" | "gray";
    tone: "warning" | "info" | "neutral" | "danger" | "success";
  }
> = {
  PENDING: {
    label: "Pending Verification",
    color: "#FFA500",
    marker: "yellow",
    tone: "warning",
  },
  VERIFIED: {
    label: "Verified",
    color: "#2563EB",
    marker: "blue",
    tone: "info",
  },
  ASSIGNED: {
    label: "Assigned",
    color: "#7C3AED",
    marker: "purple",
    tone: "neutral",
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "#F97316",
    marker: "orange",
    tone: "warning",
  },
  COMPLETED: {
    label: "Completed",
    color: "#28A745",
    marker: "green",
    tone: "success",
  },
  REJECTED: {
    label: "Rejected",
    color: "#6B7280",
    marker: "gray",
    tone: "danger",
  },
  REMOVED: {
    label: "Removed",
    color: "#6B7280",
    marker: "gray",
    tone: "neutral",
  },
};

export const SEVERITY_META: Record<Severity, { label: string; color: string }> =
  {
    LOW: { label: "Low", color: "#28A745" },
    MEDIUM: { label: "Medium", color: "#FFA500" },
    HIGH: { label: "High", color: "#DC3545" },
    CRITICAL: { label: "Critical", color: "#9D174D" },
  };

export const SEVERITY_ORDER: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
export const STATUS_ORDER: ReportStatus[] = [
  "PENDING",
  "VERIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
];

/** Severity weights used for priority scoring (mirrors backend). */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  LOW: 10,
  MEDIUM: 20,
  HIGH: 30,
  CRITICAL: 40,
};

/** Maximum distance (meters) that flags a duplicate report. */
export const DUPLICATE_RADIUS_M = 20;

/** Preset rejection reasons offered to the admin when rejecting a report. */
export const REJECT_REASONS = [
  "Duplicate report",
  "Invalid image",
  "Incorrect location",
  "Not a pothole",
  "Low quality image",
  "Other",
] as const;

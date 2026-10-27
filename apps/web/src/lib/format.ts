import {
  EMPLOYMENT_TYPES,
  JOB_CATEGORIES,
  formatNaira,
  type ApplicationStatus,
  type EmploymentType,
  type JobCategory,
  type JobStatus,
  type PayPeriod,
} from "@fwp/shared";

const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" });
const compactNaira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatDate = (iso: string) => dateFormat.format(new Date(iso));

export function timeAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export const isNew = (iso: string) => Date.now() - new Date(iso).getTime() < 48 * 60 * 60 * 1000;

/** "₦90k – ₦130k" — compact range for cards and bars. */
export function payRange(min: number, max: number): string {
  const format = (n: number) => (n >= 10_000 ? compactNaira.format(n) : formatNaira(n));
  return min === max ? format(min) : `${format(min)} – ${format(max)}`;
}

export const PERIOD_LABEL: Record<PayPeriod, string> = {
  day: "per day",
  week: "per week",
  month: "per month",
};

export const categoryLabel = (key: JobCategory) => JOB_CATEGORIES[key];
export const employmentLabel = (key: EmploymentType) => EMPLOYMENT_TYPES[key];

export function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

const AVATAR_COLOURS = ["#1f6b45", "#7a5a12", "#2d5f8a", "#8a3d2d", "#5b4a8a", "#2f7a76", "#8a2d5b"];
export function avatarColour(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_COLOURS[Math.abs(hash) % AVATAR_COLOURS.length]!;
}

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export const APPLICATION_STATUS_UI: Record<ApplicationStatus, { label: string; tone: Tone }> = {
  submitted: { label: "Submitted", tone: "info" },
  shortlisted: { label: "Shortlisted", tone: "success" },
  hired: { label: "Hired", tone: "success" },
  rejected: { label: "Not selected", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export const JOB_STATUS_UI: Record<JobStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "warning" },
  open: { label: "Open", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
  removed: { label: "Removed by moderator", tone: "danger" },
};

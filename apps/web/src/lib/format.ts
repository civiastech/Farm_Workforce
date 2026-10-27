import {
  EMPLOYMENT_TYPES,
  JOB_CATEGORIES,
  type ApplicationStatus,
  type EmploymentType,
  type JobCategory,
  type JobStatus,
} from "@fwp/shared";

const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric" });

export const formatDate = (iso: string) => dateFormat.format(new Date(iso));

export function timeAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(iso);
}

export const categoryLabel = (key: JobCategory) => JOB_CATEGORIES[key];
export const employmentLabel = (key: EmploymentType) => EMPLOYMENT_TYPES[key];

export const CATEGORY_ICONS: Record<JobCategory, string> = {
  general_labour: "🌾",
  crop_production: "🌱",
  irrigation: "💧",
  machinery: "🚜",
  livestock: "🐓",
  aquaculture: "🐟",
  post_harvest: "📦",
  supervision: "📋",
  agronomy: "🔬",
};

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

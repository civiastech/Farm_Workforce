import { formatNaira, type ApplicationStatus, type JobStatus } from "@fwp/shared";

// Text labels live in the i18n dictionaries; this module holds language-neutral helpers.

const compactNaira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  notation: "compact",
  maximumFractionDigits: 1,
});

export const isNew = (iso: string) => Date.now() - new Date(iso).getTime() < 48 * 60 * 60 * 1000;

/** "₦90K – ₦130K" — compact range for cards and bars. */
export function payRange(min: number, max: number): string {
  const format = (n: number) => (n >= 10_000 ? compactNaira.format(n) : formatNaira(n));
  return min === max ? format(min) : `${format(min)} – ${format(max)}`;
}

export function greetingKey(): "greeting.morning" | "greeting.afternoon" | "greeting.evening" {
  const hour = new Date().getHours();
  return hour < 12 ? "greeting.morning" : hour < 17 ? "greeting.afternoon" : "greeting.evening";
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

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export const APPLICATION_STATUS_TONE: Record<ApplicationStatus, Tone> = {
  submitted: "info",
  shortlisted: "success",
  hired: "success",
  rejected: "neutral",
  withdrawn: "neutral",
};

export const JOB_STATUS_TONE: Record<JobStatus, Tone> = {
  draft: "warning",
  open: "success",
  closed: "neutral",
  removed: "danger",
};

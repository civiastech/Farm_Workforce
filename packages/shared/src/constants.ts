export const ROLES = ["worker", "employer", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** Roles a member of the public can sign up as. Admins are created from the CLI. */
export const SIGNUP_ROLES = ["worker", "employer"] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

export const NIGERIAN_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const;
export type NigerianState = (typeof NIGERIAN_STATES)[number];

export const JOB_CATEGORIES = {
  general_labour: "General farm labour",
  crop_production: "Crop production",
  irrigation: "Irrigation",
  machinery: "Machinery & tractors",
  livestock: "Livestock & poultry",
  aquaculture: "Fish farming",
  post_harvest: "Post-harvest & packaging",
  supervision: "Supervision & management",
  agronomy: "Agronomy & extension",
} as const;
export type JobCategory = keyof typeof JOB_CATEGORIES;
export const JOB_CATEGORY_KEYS = Object.keys(JOB_CATEGORIES) as [JobCategory, ...JobCategory[]];

export const EMPLOYMENT_TYPES = {
  full_time: "Full-time",
  part_time: "Part-time",
  seasonal: "Seasonal",
  daily: "Daily / casual",
  contract: "Fixed-term contract",
} as const;
export type EmploymentType = keyof typeof EMPLOYMENT_TYPES;
export const EMPLOYMENT_TYPE_KEYS = Object.keys(EMPLOYMENT_TYPES) as [EmploymentType, ...EmploymentType[]];

export const PAY_PERIODS = {
  day: "day",
  week: "week",
  month: "month",
} as const;
export type PayPeriod = keyof typeof PAY_PERIODS;
export const PAY_PERIOD_KEYS = Object.keys(PAY_PERIODS) as [PayPeriod, ...PayPeriod[]];

export const JOB_STATUSES = ["draft", "open", "closed", "removed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
/** Statuses an employer may set. "removed" is reserved for moderators. */
export const EMPLOYER_JOB_STATUSES = ["draft", "open", "closed"] as const;

export const APPLICATION_STATUSES = ["submitted", "shortlisted", "rejected", "hired", "withdrawn"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
/** Statuses an employer may move an application to. */
export const EMPLOYER_APPLICATION_STATUSES = ["submitted", "shortlisted", "rejected", "hired"] as const;
/** Statuses at which the employer may see the applicant's contact details. */
export const CONTACT_VISIBLE_STATUSES: readonly ApplicationStatus[] = ["shortlisted", "hired"];

/** Interface languages, labelled in their own language. */
export const LANGUAGES = {
  en: "English",
  pcm: "Naijá (Pidgin)",
  ha: "Hausa",
  yo: "Yorùbá",
  ig: "Igbo",
  fr: "Français",
} as const;
export type Language = keyof typeof LANGUAGES;
export const LANGUAGE_KEYS = Object.keys(LANGUAGES) as [Language, ...Language[]];

export const REPORT_REASONS = {
  scam: "Scam or request for money",
  misleading: "Misleading pay or conditions",
  unsafe: "Unsafe or exploitative work",
  discrimination: "Discrimination or harassment",
  other: "Something else",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;
export const REPORT_REASON_KEYS = Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]];

export const REPORT_STATUSES = ["open", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const MAX_PAGE_SIZE = 50;

/** One-time SMS codes: why the code was sent. */
export const VERIFICATION_PURPOSES = ["register", "change_phone", "reset"] as const;
export type VerificationPurpose = (typeof VERIFICATION_PURPOSES)[number];
export const CODE_LENGTH = 6;
/** Minimum wait before another code can be sent to the same number. */
export const CODE_RESEND_SECONDS = 60;

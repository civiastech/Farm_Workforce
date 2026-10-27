import { z } from "zod";
import {
  APPLICATION_STATUSES,
  EMPLOYER_APPLICATION_STATUSES,
  EMPLOYER_JOB_STATUSES,
  EMPLOYMENT_TYPE_KEYS,
  JOB_CATEGORY_KEYS,
  LANGUAGE_KEYS,
  MAX_PAGE_SIZE,
  NIGERIAN_STATES,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PAY_PERIOD_KEYS,
  REPORT_REASON_KEYS,
  REPORT_STATUSES,
  SIGNUP_ROLES,
} from "./constants";

// Plain-language validation messages. Users see these on forms, so they must never read
// like developer output ("expected string to have >=2 characters").
z.config({
  customError: (issue) => {
    switch (issue.code) {
      case "invalid_type":
        return issue.input === undefined || issue.input === ""
          ? "This field is required"
          : "Please check this value";
      case "too_small":
        if (issue.origin === "string") {
          return issue.minimum === 1 ? "This field is required" : `Use at least ${issue.minimum} characters`;
        }
        if (issue.origin === "number") return `Must be at least ${issue.minimum}`;
        return undefined;
      case "too_big":
        if (issue.origin === "string") return `Use at most ${issue.maximum} characters`;
        if (issue.origin === "number") return `Must be at most ${issue.maximum}`;
        if (issue.origin === "array") return `Choose at most ${issue.maximum}`;
        return undefined;
      case "invalid_value":
        return "Choose one of the options";
      default:
        return undefined;
    }
  },
});

/** Turns empty form strings into `undefined` so optional fields behave as expected. */
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

/**
 * Normalises Nigerian mobile numbers to E.164 (+234XXXXXXXXXX).
 * Accepts 080…, 80…, 234…, +234… with spaces or dashes.
 */
export function normaliseNigerianPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  let national: string;
  if (/^234\d{10}$/.test(digits)) national = digits.slice(3);
  else if (/^0\d{10}$/.test(digits)) national = digits.slice(1);
  else if (/^\d{10}$/.test(digits)) national = digits;
  else return null;
  return /^[789]\d{9}$/.test(national) ? `+234${national}` : null;
}

export const phoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const phone = normaliseNigerianPhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Enter a valid Nigerian mobile number, e.g. 0803 123 4567" });
      return z.NEVER;
    }
    return phone;
  });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Enter a valid email address" }).max(254));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters`);

export const stateSchema = z.enum(NIGERIAN_STATES, { message: "Choose a state" });
export const languageSchema = z.enum(LANGUAGE_KEYS);
export const uuidSchema = z.uuid({ message: "Invalid id" });

// ---------- Auth ----------

export const registerSchema = z.object({
  role: z.enum(SIGNUP_ROLES),
  fullName: text(2, 120),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  preferredLanguage: languageSchema.default("en"),
  acceptTerms: z.literal(true, { message: "You must accept the terms and privacy notice" }),
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(PASSWORD_MAX_LENGTH),
});
export type LoginInput = z.input<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newPassword: passwordSchema,
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm").max(PASSWORD_MAX_LENGTH),
});

// ---------- Profiles ----------

export const accountUpdateSchema = z.object({
  fullName: text(2, 120),
  phone: phoneSchema,
  preferredLanguage: languageSchema,
});

export const workerProfileSchema = z.object({
  state: stateSchema,
  town: optionalText(80),
  primaryCategory: z.enum(JOB_CATEGORY_KEYS),
  skills: z.array(text(1, 40)).max(15).default([]),
  yearsExperience: z.coerce.number().int().min(0).max(60),
  bio: optionalText(1000),
  available: z.boolean().default(true),
});
export type WorkerProfileInput = z.input<typeof workerProfileSchema>;

export const employerProfileSchema = z.object({
  organisationName: text(2, 160),
  state: stateSchema,
  town: optionalText(80),
  description: optionalText(1500),
});
export type EmployerProfileInput = z.input<typeof employerProfileSchema>;

// ---------- Jobs ----------

const jobFields = z.object({
  title: text(4, 120),
  description: text(30, 5000),
  category: z.enum(JOB_CATEGORY_KEYS),
  employmentType: z.enum(EMPLOYMENT_TYPE_KEYS),
  state: stateSchema,
  town: text(2, 80),
  payMin: z.coerce.number().int().min(0).max(100_000_000),
  payMax: z.coerce.number().int().min(0).max(100_000_000),
  payPeriod: z.enum(PAY_PERIOD_KEYS),
  positions: z.coerce.number().int().min(1).max(10_000),
  accommodationProvided: z.boolean().default(false),
  mealsProvided: z.boolean().default(false),
  startDate: z.preprocess(emptyToUndefined, z.iso.date().optional()),
  status: z.enum(EMPLOYER_JOB_STATUSES).default("open"),
});

const payRangeIsValid = (job: { payMin?: number; payMax?: number }) =>
  job.payMin === undefined || job.payMax === undefined || job.payMax >= job.payMin;
const payRangeMessage = { message: "Maximum pay must be at least the minimum pay", path: ["payMax"] };

export const jobInputSchema = jobFields.refine(payRangeIsValid, payRangeMessage);
export type JobInput = z.input<typeof jobInputSchema>;

export const jobUpdateSchema = jobFields.partial().refine(payRangeIsValid, payRangeMessage);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(12),
});

export const jobSearchSchema = paginationSchema.extend({
  q: optionalText(100),
  category: z.preprocess(emptyToUndefined, z.enum(JOB_CATEGORY_KEYS).optional()),
  state: z.preprocess(emptyToUndefined, stateSchema.optional()),
  employmentType: z.preprocess(emptyToUndefined, z.enum(EMPLOYMENT_TYPE_KEYS).optional()),
  /** "pay" ranks by monthly-equivalent maximum pay, so daily and monthly jobs compare fairly. */
  sort: z.preprocess(emptyToUndefined, z.enum(["newest", "pay"]).default("newest")),
});
export type JobSearch = z.input<typeof jobSearchSchema>;

// ---------- Applications ----------

export const applicationInputSchema = z.object({
  coverNote: optionalText(2000),
});

export const applicationStatusUpdateSchema = z.object({
  status: z.enum(EMPLOYER_APPLICATION_STATUSES),
});

export const applicationStatusSchema = z.enum(APPLICATION_STATUSES);

// ---------- Trust & safety ----------

export const reportInputSchema = z.object({
  reason: z.enum(REPORT_REASON_KEYS),
  details: optionalText(2000),
});

export const reportResolutionSchema = z.object({
  status: z.enum(REPORT_STATUSES).exclude(["open"]),
  removeJob: z.boolean().default(false),
  note: optionalText(1000),
});

export const reportListSchema = paginationSchema.extend({
  status: z.preprocess(emptyToUndefined, z.enum(REPORT_STATUSES).optional()),
});

export const employerVerificationSchema = z.object({
  verified: z.boolean(),
});

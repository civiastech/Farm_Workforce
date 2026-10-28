import {
  APPLICATION_STATUSES,
  EMPLOYMENT_TYPE_KEYS,
  JOB_CATEGORY_KEYS,
  JOB_STATUSES,
  LANGUAGE_KEYS,
  PAY_PERIOD_KEYS,
  REPORT_REASON_KEYS,
  REPORT_STATUSES,
  ROLES,
  VERIFICATION_PURPOSES,
} from "@fwp/shared";
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ROLES);
export const languageEnum = pgEnum("language", LANGUAGE_KEYS);
export const jobCategoryEnum = pgEnum("job_category", JOB_CATEGORY_KEYS);
export const employmentTypeEnum = pgEnum("employment_type", EMPLOYMENT_TYPE_KEYS);
export const payPeriodEnum = pgEnum("pay_period", PAY_PERIOD_KEYS);
export const jobStatusEnum = pgEnum("job_status", JOB_STATUSES);
export const applicationStatusEnum = pgEnum("application_status", APPLICATION_STATUSES);
export const reportReasonEnum = pgEnum("report_reason", REPORT_REASON_KEYS);
export const reportStatusEnum = pgEnum("report_status", REPORT_STATUSES);
export const verificationPurposeEnum = pgEnum("verification_purpose", VERIFICATION_PURPOSES);
export const notificationChannelEnum = pgEnum("notification_channel", ["sms", "email"]);
export const notificationStatusEnum = pgEnum("notification_status", ["pending", "sent", "failed"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Optional: many workers sign up with a phone number only. */
    email: text("email"),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull(),
    fullName: text("full_name").notNull(),
    /** E.164. Required at sign-up for workers and employers; admins created by the CLI may have none. */
    phone: text("phone"),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    preferredLanguage: languageEnum("preferred_language").notNull().default("en"),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
    uniqueIndex("users_phone_unique").on(t.phone),
    check("users_email_or_phone", sql`${t.email} is not null or ${t.phone} is not null`),
  ],
);

export const workerProfiles = pgTable(
  "worker_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    state: text("state").notNull(),
    town: text("town"),
    primaryCategory: jobCategoryEnum("primary_category").notNull(),
    skills: text("skills")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    yearsExperience: integer("years_experience").notNull().default(0),
    bio: text("bio"),
    available: boolean("available").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("worker_profiles_state_idx").on(t.state)],
);

export const employerProfiles = pgTable("employer_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  organisationName: text("organisation_name").notNull(),
  state: text("state").notNull(),
  town: text("town"),
  description: text("description"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  ...timestamps,
});

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employerId: uuid("employer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: jobCategoryEnum("category").notNull(),
    employmentType: employmentTypeEnum("employment_type").notNull(),
    state: text("state").notNull(),
    town: text("town").notNull(),
    payMin: integer("pay_min").notNull(),
    payMax: integer("pay_max").notNull(),
    payPeriod: payPeriodEnum("pay_period").notNull(),
    positions: integer("positions").notNull().default(1),
    accommodationProvided: boolean("accommodation_provided").notNull().default(false),
    mealsProvided: boolean("meals_provided").notNull().default(false),
    startDate: date("start_date"),
    status: jobStatusEnum("status").notNull().default("open"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** Open jobs close automatically at this time; reopening sets a new one. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("jobs_status_published_idx").on(t.status, t.publishedAt),
    index("jobs_status_expires_idx").on(t.status, t.expiresAt),
    index("jobs_employer_idx").on(t.employerId),
    index("jobs_state_idx").on(t.state),
    index("jobs_category_idx").on(t.category),
  ],
);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    coverNote: text("cover_note"),
    status: applicationStatusEnum("status").notNull().default("submitted"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("applications_job_worker_unique").on(t.jobId, t.workerId),
    index("applications_worker_idx").on(t.workerId),
  ],
);

/** Session tokens are never stored: `id` is the SHA-256 of the cookie value. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
    ip: inet("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("password_reset_tokens_user_idx").on(t.userId)],
);

/** One-time SMS codes. Only a salted hash of the code is stored. */
export const verificationCodes = pgTable(
  "verification_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: text("phone").notNull(),
    purpose: verificationPurposeEnum("purpose").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_codes_phone_idx").on(t.phone, t.purpose, t.createdAt)],
);

/**
 * Outbox for SMS and email notifications. Rows are written alongside the change that
 * caused them and delivered by a background worker with retries.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull(),
    recipient: text("recipient").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    status: notificationStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_due_idx").on(t.status, t.nextAttemptAt)],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
    reason: reportReasonEnum("reason").notNull(),
    details: text("details"),
    status: reportStatusEnum("status").notNull().default("open"),
    resolutionNote: text("resolution_note"),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reports_status_idx").on(t.status, t.createdAt)],
);

/** Append-only record of security-relevant and moderation actions. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    ip: inet("ip"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_actor_idx").on(t.actorId), index("audit_logs_created_idx").on(t.createdAt)],
);

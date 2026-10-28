import type { ApplicationStatus, JobCategory, JobSummary } from "@fwp/shared";
import {
  BadgeCheck,
  Bird,
  Briefcase,
  Check,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Clock,
  Droplets,
  Eye,
  EyeOff,
  Fish,
  FlaskConical,
  House,
  Info,
  MapPin,
  Package,
  Shovel,
  Sprout,
  Tractor,
  TriangleAlert,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { useI18n } from "../i18n";
import { avatarColour, initials, isNew, payRange } from "../lib/format";

// ---------------------------------------------------------------- Brand art

export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21v-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M12 13.5c0-4 2.8-6.8 7-6.8 0 4-2.9 6.8-7 6.8Z" fill="currentColor" />
      <path d="M12 11.2c0-3.5-2.4-6-6-6 0 3.5 2.4 6 6 6Z" fill="currentColor" opacity=".75" />
    </svg>
  );
}

/** Rolling fields with crop rows; fills with currentColor. */
export function FieldsIllustration({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1440 200" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 120 C 240 60, 420 70, 640 110 S 1080 170, 1440 90 L1440 200 L0 200Z"
        fill="currentColor"
        opacity=".35"
      />
      <path
        d="M0 150 C 300 100, 560 120, 820 150 S 1220 180, 1440 140 L1440 200 L0 200Z"
        fill="currentColor"
      />
      <g stroke="currentColor" strokeWidth="2" opacity=".5" fill="none">
        <path d="M120 112 C 300 90, 460 92, 620 118" />
        <path d="M80 126 C 280 100, 470 104, 660 132" />
        <path d="M820 128 C 1000 150, 1180 140, 1360 104" />
        <path d="M780 142 C 980 166, 1180 156, 1400 118" />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------- Icons

const CATEGORY_ICON: Record<JobCategory, LucideIcon> = {
  general_labour: Shovel,
  crop_production: Sprout,
  irrigation: Droplets,
  machinery: Tractor,
  livestock: Bird,
  aquaculture: Fish,
  post_harvest: Package,
  supervision: ClipboardList,
  agronomy: FlaskConical,
};

export function CategoryIcon({ category, size = 20 }: { category: JobCategory; size?: number }) {
  const Icon = CATEGORY_ICON[category];
  return <Icon size={size} strokeWidth={1.9} aria-hidden="true" />;
}

// ---------------------------------------------------------------- Feedback

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export function Badge({ tone, dot, children }: { tone: Tone | "new"; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

const ALERT_ICON = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleAlert };

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success" | "warning" | "error";
  title?: string;
  children?: ReactNode;
}) {
  const Icon = ALERT_ICON[tone];
  return (
    <div className={`alert alert-${tone}`} role={tone === "error" ? "alert" : undefined}>
      <Icon size={18} aria-hidden="true" />
      <div>
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="page-loader" role="status">
      <div className="spinner" aria-hidden="true" />
      <span className="visually-hidden">{label ?? t("common.loading")}…</span>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="tile-icon">
        <Icon size={26} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function QueryError({ error, retry }: { error: Error; retry?: () => void }) {
  const { t, errorMessage } = useI18n();
  return (
    <Alert tone="error" title={t("common.somethingWrong")}>
      {errorMessage(error)}{" "}
      {retry && (
        <button type="button" className="link-button link" onClick={retry}>
          {t("common.tryAgain")}
        </button>
      )}
    </Alert>
  );
}

// ---------------------------------------------------------------- Forms

export interface ControlProps {
  id: string;
  name: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
}

interface FieldProps {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
  /** Shows a live character counter for text inputs. */
  counter?: { max: number; initial?: number };
  children: (props: ControlProps) => ReactNode;
}

/** Label + control + hint + error (+ optional counter), wired up for screen readers. */
export function Field({ label, name, error, hint, optional, className, counter, children }: FieldProps) {
  const { t } = useI18n();
  const id = useId();
  const [length, setLength] = useState(counter?.initial ?? 0);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div
      className={`field ${className ?? ""}`}
      onInput={counter ? (event) => setLength((event.target as HTMLInputElement).value.length) : undefined}
    >
      <label className="field-label" htmlFor={id}>
        <span>
          {label} {optional && <span className="optional">{t("common.optional")}</span>}
        </span>
      </label>
      {children({ id, name, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {(hint || error || counter) && (
        <div className="field-foot">
          <div style={{ display: "grid", gap: 4 }}>
            {error && (
              <span id={errorId} className="field-error">
                <CircleAlert size={14} aria-hidden="true" />
                {error}
              </span>
            )}
            {hint && (
              <span id={hintId} className="field-hint">
                {hint}
              </span>
            )}
          </div>
          {counter && (
            <span className={`counter ${length > counter.max * 0.9 ? "near" : ""}`} aria-hidden="true">
              {length}/{counter.max}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function PasswordInput({
  autoComplete,
  ...props
}: ControlProps & { autoComplete: "current-password" | "new-password" }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <div className="input-affix">
      <input className="input" type={visible ? "text" : "password"} autoComplete={autoComplete} {...props} />
      <button
        type="button"
        className="affix-button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("common.hidePassword") : t("common.showPassword")}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export function Options({
  items,
  placeholder,
}: {
  items: Record<string, string> | readonly string[];
  placeholder?: string;
}) {
  const entries = Array.isArray(items) ? items.map((v) => [v, v] as const) : Object.entries(items);
  return (
    <>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {entries.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- People & progress

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ "--size": `${size}px`, "--avatar-bg": avatarColour(name) } as CSSProperties}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="meter"
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

const TRACKER_STEPS = ["tracker.applied", "tracker.shortlisted", "tracker.hired"] as const;

/** Submitted → Shortlisted → Hired, with the current step highlighted. */
export function StatusTracker({ status }: { status: ApplicationStatus }) {
  const { t } = useI18n();
  const reached = status === "hired" ? 3 : status === "shortlisted" ? 2 : 1;
  const closed = status === "rejected" || status === "withdrawn";
  return (
    <ol className="tracker" aria-label={t("tracker.label")}>
      {TRACKER_STEPS.map((step, index) => {
        const isReached = !closed && index < reached;
        const isCurrent = !closed && index === reached - 1;
        return (
          <li
            key={step}
            className={`${isReached ? "reached" : ""} ${isCurrent ? "current" : ""}`}
            aria-current={isCurrent ? "step" : undefined}
          >
            <span className="node">
              {isReached && <Check size={14} strokeWidth={3} aria-hidden="true" />}
            </span>
            {t(step)}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------- Jobs

type JobCardData = Pick<
  JobSummary,
  | "title"
  | "category"
  | "employmentType"
  | "state"
  | "town"
  | "payMin"
  | "payMax"
  | "payPeriod"
  | "positions"
  | "accommodationProvided"
  | "mealsProvided"
  | "createdAt"
  | "employer"
> & { id?: string };

export function JobCard({ job, footer }: { job: JobCardData; footer?: ReactNode }) {
  const { t, timeAgo } = useI18n();
  const fresh = isNew(job.createdAt);
  return (
    <article className="job-card">
      <div className="tile-icon">
        <CategoryIcon category={job.category} size={22} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="job-head">
          <div style={{ minWidth: 0 }}>
            <h3>
              {job.id ? (
                <Link className="job-link" to={`/jobs/${job.id}`}>
                  {job.title}
                </Link>
              ) : (
                job.title || t("editor.jobTitle")
              )}
            </h3>
            <span className="employer-line">
              {job.employer.organisationName}
              {job.employer.verified && (
                <BadgeCheck className="verified" size={16} aria-label={t("common.verifiedEmployer")} />
              )}
            </span>
          </div>
          {fresh && <Badge tone="new">{t("common.new")}</Badge>}
        </div>

        <div className="job-pay">
          {payRange(job.payMin, job.payMax)} <small>{t(`period.${job.payPeriod}`)}</small>
        </div>

        <div className="job-meta">
          <span>
            <MapPin size={15} aria-hidden="true" />
            {job.town ? `${job.town}, ` : ""}
            {job.state}
          </span>
          <span>
            <Briefcase size={15} aria-hidden="true" />
            {t(`employment.${job.employmentType}`)}
          </span>
          {job.positions > 1 && (
            <span>
              <Users size={15} aria-hidden="true" />
              {t("common.positions", { n: job.positions })}
            </span>
          )}
        </div>

        <div className="job-foot">
          <div className="chips">
            {job.accommodationProvided && (
              <span className="chip chip-brand">
                <House size={13} aria-hidden="true" />
                {t("common.accommodation")}
              </span>
            )}
            {job.mealsProvided && (
              <span className="chip chip-brand">
                <UtensilsCrossed size={13} aria-hidden="true" />
                {t("common.meals")}
              </span>
            )}
            {!job.accommodationProvided && !job.mealsProvided && (
              <span className="subtle" style={{ fontSize: "0.82rem" }}>
                {t("common.noHousingMeals")}
              </span>
            )}
          </div>
          <span className="subtle icon-inline" style={{ fontSize: "0.8rem" }}>
            <Clock size={13} aria-hidden="true" />
            {timeAgo(job.createdAt)}
          </span>
        </div>
        {footer && (
          <div className="job-actions" style={{ marginTop: 14 }}>
            {footer}
          </div>
        )}
      </div>
    </article>
  );
}

export function JobCardSkeleton() {
  return (
    <div className="job-card" aria-hidden="true">
      <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 12 }} />
      <div style={{ display: "grid", gap: 10 }}>
        <div className="skeleton" style={{ height: 18, width: "70%" }} />
        <div className="skeleton" style={{ height: 14, width: "40%" }} />
        <div className="skeleton" style={{ height: 20, width: "45%", marginTop: 6 }} />
        <div className="skeleton" style={{ height: 14, width: "60%" }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Pagination

function pageWindow(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) result.push("…");
    result.push(p);
  });
  return result;
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const { t } = useI18n();
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label={t("common.pagination")}>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        {t("common.previous")}
      </button>
      {pageWindow(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="subtle" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className="page-num"
            aria-current={p === page ? "page" : undefined}
            aria-label={t("common.page", { n: p })}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        {t("common.next")}
      </button>
    </nav>
  );
}

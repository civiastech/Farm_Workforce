import type { JobSummary } from "@fwp/shared";
import { formatPay } from "@fwp/shared";
import { useId, type ReactNode } from "react";
import { Link } from "react-router";
import { CATEGORY_ICONS, categoryLabel, employmentLabel, timeAgo } from "../lib/format";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "warning" | "error";
  children: ReactNode;
}) {
  return (
    <div className={`alert alert-${tone}`} role={tone === "error" ? "alert" : undefined}>
      {children}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status">
      <div className="spinner" aria-hidden="true" />
      <span className="visually-hidden">{label}…</span>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function QueryError({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <Alert tone="error">
      {error.message}{" "}
      {retry && (
        <button type="button" className="link-button" onClick={retry}>
          Try again
        </button>
      )}
    </Alert>
  );
}

interface FieldProps {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  className?: string;
  children: (props: {
    id: string;
    name: string;
    "aria-invalid": boolean;
    "aria-describedby"?: string;
  }) => ReactNode;
}

/** Label + control + hint + error, wired up for screen readers. */
export function Field({ label, name, error, hint, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`field ${className ?? ""}`}>
      <label htmlFor={id}>{label}</label>
      {children({ id, name, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {hint && (
        <span id={hintId} className="field-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="field-error">
          {error}
        </span>
      )}
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

export function JobCard({ job, footer }: { job: JobSummary; footer?: ReactNode }) {
  return (
    <article className="job-card">
      <div className="job-icon" aria-hidden="true">
        {CATEGORY_ICONS[job.category]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3>
          <Link to={`/jobs/${job.id}`}>{job.title}</Link>
        </h3>
        <div className="job-meta">
          <span>
            {job.employer.organisationName}
            {job.employer.verified && (
              <span title="Verified employer" aria-label="Verified employer">
                {" "}
                ✔
              </span>
            )}
          </span>
          <span>
            📍 {job.town}, {job.state}
          </span>
          <span>{timeAgo(job.createdAt)}</span>
        </div>
        <div className="pay">{formatPay(job.payMin, job.payMax, job.payPeriod)}</div>
        <div className="tags">
          <span className="tag">{employmentLabel(job.employmentType)}</span>
          <span className="tag">{categoryLabel(job.category)}</span>
          {job.accommodationProvided && <span className="tag">Accommodation</span>}
          {job.mealsProvided && <span className="tag">Meals</span>}
          {job.positions > 1 && <span className="tag">{job.positions} positions</span>}
        </div>
        {footer && <div style={{ position: "relative", zIndex: 1, marginTop: 12 }}>{footer}</div>}
      </div>
    </article>
  );
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
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="btn btn-outline btn-small"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ← Previous
      </button>
      <span className="subtle">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        className="btn btn-outline btn-small"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next →
      </button>
    </nav>
  );
}

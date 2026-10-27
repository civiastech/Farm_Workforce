import {
  EMPLOYMENT_TYPES,
  JOB_CATEGORIES,
  NIGERIAN_STATES,
  REPORT_REASONS,
  applicationInputSchema,
  formatPay,
  reportInputSchema,
  type JobDetail,
  type JobSummary,
  type Paginated,
} from "@fwp/shared";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import {
  Alert,
  Badge,
  EmptyState,
  Field,
  JobCard,
  Options,
  Pagination,
  QueryError,
  Spinner,
} from "../components/ui";
import { ApiError, api, toQuery } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  APPLICATION_STATUS_UI,
  JOB_STATUS_UI,
  categoryLabel,
  employmentLabel,
  formatDate,
} from "../lib/format";
import { useFormSubmit } from "../lib/forms";
import { useToast } from "../lib/toast";
import { usePageTitle } from "../lib/usePageTitle";

const FILTER_KEYS = ["q", "category", "state", "employmentType"] as const;

export function JobsPage() {
  usePageTitle("Find farm work");
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? "1") || 1;
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? ""]));
  const query = toQuery({ ...filters, page, pageSize: 12 });

  const jobs = useQuery({
    queryKey: ["jobs", query],
    queryFn: () => api.get<Paginated<JobSummary>>(`/jobs${query}`),
    placeholderData: keepPreviousData,
  });

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const value = String(data.get(key) ?? "").trim();
      if (value) next.set(key, value);
    }
    setParams(next);
  }

  const hasFilters = FILTER_KEYS.some((key) => params.get(key));

  return (
    <div className="page">
      <div className="wrap">
        <div className="page-head">
          <p className="kicker">Explore opportunities</p>
          <h1>Find farm work</h1>
          <p className="muted">Every listing shows the pay up front. Applying is always free.</p>
        </div>

        {/* key resets the uncontrolled inputs when the URL changes (e.g. back button). */}
        <form key={params.toString()} className="filterbar" role="search" onSubmit={applyFilters}>
          <div>
            <label className="visually-hidden" htmlFor="q">
              Search jobs
            </label>
            <input
              id="q"
              name="q"
              className="input"
              type="search"
              placeholder="Search job, skill, town or employer…"
              defaultValue={filters.q}
            />
          </div>
          <div>
            <label className="visually-hidden" htmlFor="category">
              Category
            </label>
            <select id="category" name="category" className="select" defaultValue={filters.category}>
              <Options items={JOB_CATEGORIES} placeholder="All categories" />
            </select>
          </div>
          <div>
            <label className="visually-hidden" htmlFor="state">
              State
            </label>
            <select id="state" name="state" className="select" defaultValue={filters.state}>
              <Options items={NIGERIAN_STATES} placeholder="All states" />
            </select>
          </div>
          <div>
            <label className="visually-hidden" htmlFor="employmentType">
              Job type
            </label>
            <select
              id="employmentType"
              name="employmentType"
              className="select"
              defaultValue={filters.employmentType}
            >
              <Options items={EMPLOYMENT_TYPES} placeholder="Any job type" />
            </select>
          </div>
          <button className="btn btn-primary" type="submit">
            Search
          </button>
        </form>

        <div className="spread" style={{ marginBottom: 16 }}>
          <p className="subtle" aria-live="polite" style={{ margin: 0 }}>
            {jobs.data ? `${jobs.data.total} job${jobs.data.total === 1 ? "" : "s"} found` : " "}
          </p>
          {hasFilters && (
            <button type="button" className="link-button" onClick={() => setParams(new URLSearchParams())}>
              Clear filters
            </button>
          )}
        </div>

        {jobs.isLoading ? (
          <div className="job-list">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton" />
            ))}
          </div>
        ) : jobs.error ? (
          <QueryError error={jobs.error} retry={() => jobs.refetch()} />
        ) : jobs.data && jobs.data.items.length === 0 ? (
          <EmptyState title="No jobs match your search">
            <p>Try a different state or category, or clear the filters to see everything.</p>
          </EmptyState>
        ) : (
          <>
            <div className="job-list" style={{ opacity: jobs.isPlaceholderData ? 0.6 : 1 }}>
              {jobs.data?.items.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={jobs.data?.totalPages ?? 1}
              onChange={(next) => {
                const updated = new URLSearchParams(params);
                updated.set("page", String(next));
                setParams(updated);
                window.scrollTo({ top: 0 });
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

export function JobDetailPage() {
  const { id = "" } = useParams();
  const job = useQuery({ queryKey: ["job", id], queryFn: () => api.get<JobDetail>(`/jobs/${id}`) });
  usePageTitle(job.data?.title);

  if (job.isLoading) return <Spinner />;
  if (job.error) {
    return (
      <div className="page wrap">
        {job.error instanceof ApiError && job.error.status === 404 ? (
          <EmptyState title="This job isn't available">
            <p>It may have been filled or removed.</p>
            <Link className="btn btn-primary" to="/jobs">
              Browse other jobs
            </Link>
          </EmptyState>
        ) : (
          <QueryError error={job.error} retry={() => job.refetch()} />
        )}
      </div>
    );
  }
  const data = job.data!;

  return (
    <div className="page">
      <div className="wrap">
        <p>
          <Link to="/jobs">← All jobs</Link>
        </p>
        <div className="detail-layout">
          <article className="card">
            <div className="row" style={{ marginBottom: 8 }}>
              <Badge tone={JOB_STATUS_UI[data.status].tone}>{JOB_STATUS_UI[data.status].label}</Badge>
              {data.employer.verified && <Badge tone="info">✔ Verified employer</Badge>}
            </div>
            <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)" }}>{data.title}</h1>
            <p className="muted">
              {data.employer.organisationName} · {data.town}, {data.state}
            </p>
            <p className="pay" style={{ fontSize: "1.25rem" }}>
              {formatPay(data.payMin, data.payMax, data.payPeriod)}
            </p>
            <dl className="detail-facts" style={{ margin: "20px 0" }}>
              <dt>Job type</dt>
              <dd>{employmentLabel(data.employmentType)}</dd>
              <dt>Category</dt>
              <dd>{categoryLabel(data.category)}</dd>
              <dt>Positions</dt>
              <dd>{data.positions}</dd>
              {data.startDate && (
                <>
                  <dt>Starts</dt>
                  <dd>{formatDate(data.startDate)}</dd>
                </>
              )}
              <dt>Accommodation</dt>
              <dd>{data.accommodationProvided ? "Provided" : "Not provided"}</dd>
              <dt>Meals</dt>
              <dd>{data.mealsProvided ? "Provided" : "Not provided"}</dd>
              <dt>Posted</dt>
              <dd>{formatDate(data.createdAt)}</dd>
            </dl>
            <h2 style={{ fontSize: "1.2rem" }}>About the job</h2>
            <p className="prose">{data.description}</p>
          </article>

          <aside className="sticky-aside stack">
            <ApplyPanel job={data} />
            <Alert tone="warning">
              <strong>Stay safe:</strong> genuine employers never ask you to pay for a job, training or
              uniform. If anyone asks for money, report this job.
            </Alert>
            <ReportJob key={data.id} jobId={data.id} />
          </aside>
        </div>
      </div>
    </div>
  );
}

function ApplyPanel({ job }: { job: JobDetail }) {
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const { onSubmit, fieldErrors, formError, isPending } = useFormSubmit(
    applicationInputSchema,
    (values) => api.post<{ id: string }>(`/jobs/${job.id}/applications`, values),
    {
      onSuccess: () => {
        toast("Application sent. We'll let you know when the employer responds.");
        queryClient.invalidateQueries({ queryKey: ["job", job.id] });
        queryClient.invalidateQueries({ queryKey: ["my-applications"] });
      },
    },
  );

  if (job.isOwner) {
    return (
      <div className="card stack">
        <h2 style={{ fontSize: "1.1rem" }}>Your listing</h2>
        <Link className="btn btn-primary btn-block" to={`/dashboard/jobs/${job.id}/applicants`}>
          View applicants
        </Link>
        <Link className="btn btn-outline btn-block" to={`/dashboard/jobs/${job.id}/edit`}>
          Edit job
        </Link>
      </div>
    );
  }

  if (job.status !== "open") {
    return <Alert>This job is no longer accepting applications.</Alert>;
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname);
    return (
      <div className="card stack">
        <h2 style={{ fontSize: "1.1rem" }}>Interested?</h2>
        <p className="muted">Create a free worker profile to apply. It takes about two minutes.</p>
        <Link className="btn btn-primary btn-block" to={`/register?role=worker&next=${next}`}>
          Create free profile
        </Link>
        <Link className="btn btn-outline btn-block" to={`/login?next=${next}`}>
          I already have an account
        </Link>
      </div>
    );
  }

  if (user.role !== "worker") {
    return <Alert>Only worker accounts can apply for jobs.</Alert>;
  }

  if (job.myApplication && job.myApplication.status !== "withdrawn") {
    const ui = APPLICATION_STATUS_UI[job.myApplication.status];
    return (
      <div className="card stack">
        <h2 style={{ fontSize: "1.1rem" }}>You've applied</h2>
        <p>
          Status: <Badge tone={ui.tone}>{ui.label}</Badge>
        </p>
        <p className="subtle">Applied {formatDate(job.myApplication.createdAt)}</p>
        <Link className="btn btn-outline btn-block" to="/dashboard/applications">
          View my applications
        </Link>
      </div>
    );
  }

  if (!user.hasProfile) {
    return (
      <div className="card stack">
        <h2 style={{ fontSize: "1.1rem" }}>One more step</h2>
        <p className="muted">Complete your worker profile so employers can see your skills.</p>
        <Link className="btn btn-primary btn-block" to="/dashboard/profile">
          Complete profile
        </Link>
      </div>
    );
  }

  return (
    <form className="card form" onSubmit={onSubmit} noValidate>
      <h2 style={{ fontSize: "1.1rem", margin: 0 }}>Apply for this job</h2>
      {formError && <Alert tone="error">{formError}</Alert>}
      <Field
        label="Message to the employer (optional)"
        name="coverNote"
        error={fieldErrors.coverNote}
        hint="Mention relevant experience and when you can start."
      >
        {(props) => <textarea className="textarea" maxLength={2000} {...props} />}
      </Field>
      <button className="btn btn-primary btn-block" type="submit" disabled={isPending}>
        {isPending ? "Sending…" : "Send application"}
      </button>
      <p className="subtle" style={{ margin: 0 }}>
        The employer sees your profile. Your phone number is shared only if they shortlist you.
      </p>
    </form>
  );
}

function ReportJob({ jobId }: { jobId: string }) {
  const { user } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [sent, setSent] = useState(false);
  const toast = useToast();

  const { onSubmit, fieldErrors, formError, isPending } = useFormSubmit(
    reportInputSchema,
    (values) => api.post(`/jobs/${jobId}/reports`, values),
    {
      onSuccess: () => {
        dialogRef.current?.close();
        setSent(true);
        toast("Thank you. Our moderators will review this job.");
      },
    },
  );

  if (sent) return <p className="subtle">You reported this job. Thank you for keeping the platform safe.</p>;
  if (!user) {
    return (
      <p className="subtle">
        <Link to="/login">Sign in</Link> to report a problem with this job.
      </p>
    );
  }

  return (
    <>
      <button type="button" className="link-button" onClick={() => dialogRef.current?.showModal()}>
        Report this job
      </button>
      <dialog ref={dialogRef} aria-labelledby="report-title">
        <form className="form" onSubmit={onSubmit} noValidate>
          <h2 id="report-title" style={{ fontSize: "1.25rem", margin: 0 }}>
            Report this job
          </h2>
          {formError && <Alert tone="error">{formError}</Alert>}
          <Field label="What's wrong?" name="reason" error={fieldErrors.reason}>
            {(props) => (
              <select className="select" {...props} defaultValue="">
                <Options items={REPORT_REASONS} placeholder="Choose a reason" />
              </select>
            )}
          </Field>
          <Field label="Details (optional)" name="details" error={fieldErrors.details}>
            {(props) => <textarea className="textarea" maxLength={2000} {...props} />}
          </Field>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-outline" onClick={() => dialogRef.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="btn btn-danger" disabled={isPending}>
              {isPending ? "Sending…" : "Send report"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

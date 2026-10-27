import {
  EMPLOYMENT_TYPES,
  JOB_CATEGORIES,
  JOB_CATEGORY_KEYS,
  NIGERIAN_STATES,
  REPORT_REASONS,
  applicationInputSchema,
  formatNaira,
  reportInputSchema,
  type JobCategory,
  type JobDetail,
  type JobSummary,
  type Paginated,
} from "@fwp/shared";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  Clock,
  Flag,
  House,
  MapPin,
  SearchX,
  Search,
  Send,
  Share2,
  ShieldAlert,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import {
  Alert,
  Badge,
  CategoryIcon,
  EmptyState,
  Field,
  JobCard,
  JobCardSkeleton,
  Options,
  Pagination,
  QueryError,
  Spinner,
  StatusTracker,
} from "../components/ui";
import { ApiError, api, toQuery } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  APPLICATION_STATUS_UI,
  JOB_STATUS_UI,
  PERIOD_LABEL,
  categoryLabel,
  employmentLabel,
  formatDate,
  payRange,
  timeAgo,
} from "../lib/format";
import { useFormSubmit } from "../lib/forms";
import { useToast } from "../lib/toast";
import { usePageTitle } from "../lib/usePageTitle";

const FILTER_KEYS = ["q", "category", "state", "employmentType", "sort"] as const;

export function JobsPage() {
  usePageTitle("Find farm work");
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? "1") || 1;
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? ""])) as Record<
    (typeof FILTER_KEYS)[number],
    string
  >;
  const query = toQuery({ ...filters, page, pageSize: 12 });

  const jobs = useQuery({
    queryKey: ["jobs", query],
    queryFn: () => api.get<Paginated<JobSummary>>(`/jobs${query}`),
    placeholderData: keepPreviousData,
  });

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    setParams(next);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    update({ q: String(data.get("q") ?? "").trim(), state: String(data.get("state") ?? "") });
  }

  const activeFilters = [
    filters.q && { key: "q", label: `“${filters.q}”` },
    filters.state && { key: "state", label: filters.state },
    filters.category && { key: "category", label: JOB_CATEGORIES[filters.category as JobCategory] },
    filters.employmentType && {
      key: "employmentType",
      label: EMPLOYMENT_TYPES[filters.employmentType as keyof typeof EMPLOYMENT_TYPES],
    },
  ].filter(Boolean) as { key: string; label: string }[];

  const total = jobs.data?.total;

  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <span className="eyebrow">Explore opportunities</span>
          <h1 className="display">Find farm work</h1>
          <p className="muted" style={{ margin: 0 }}>
            Every listing shows the pay up front. Applying is always free.
          </p>

          {/* key resets the uncontrolled inputs when the URL changes (e.g. back button). */}
          <form
            key={`${filters.q}|${filters.state}`}
            className="search-bar"
            role="search"
            onSubmit={submitSearch}
          >
            <label className="input-icon">
              <span className="visually-hidden">Search jobs</span>
              <Search size={18} aria-hidden="true" />
              <input
                name="q"
                className="input"
                type="search"
                placeholder="Job, skill, town or employer"
                defaultValue={filters.q}
              />
            </label>
            <label className="input-icon">
              <span className="visually-hidden">State</span>
              <MapPin size={18} aria-hidden="true" />
              <select name="state" className="select" defaultValue={filters.state}>
                <Options items={NIGERIAN_STATES} placeholder="All states" />
              </select>
            </label>
            <button className="btn btn-primary" type="submit">
              Search
            </button>
          </form>

          <div className="category-scroller" role="group" aria-label="Filter by category">
            <button
              type="button"
              className="category-chip"
              aria-pressed={!filters.category}
              onClick={() => update({ category: null })}
            >
              All jobs
            </button>
            {JOB_CATEGORY_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className="category-chip"
                aria-pressed={filters.category === key}
                onClick={() => update({ category: filters.category === key ? null : key })}
              >
                <CategoryIcon category={key} size={16} />
                {JOB_CATEGORIES[key]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="wrap">
        <div className="results-bar">
          <h2 aria-live="polite">
            {total === undefined ? "Loading jobs…" : `${total} job${total === 1 ? "" : "s"} found`}
          </h2>
          <div className="results-controls">
            <label>
              <span className="visually-hidden">Job type</span>
              <select
                className="select"
                value={filters.employmentType}
                onChange={(e) => update({ employmentType: e.target.value })}
              >
                <Options items={EMPLOYMENT_TYPES} placeholder="Any job type" />
              </select>
            </label>
            <label>
              <span className="visually-hidden">Sort by</span>
              <select
                className="select"
                value={filters.sort || "newest"}
                onChange={(e) => update({ sort: e.target.value === "newest" ? null : e.target.value })}
              >
                <option value="newest">Newest first</option>
                <option value="pay">Highest pay</option>
              </select>
            </label>
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="active-filters">
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className="filter-pill"
                onClick={() => update({ [filter.key]: null })}
                aria-label={`Remove filter ${filter.label}`}
              >
                {filter.label}
                <X size={16} aria-hidden="true" />
              </button>
            ))}
            {activeFilters.length > 1 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setParams(new URLSearchParams())}
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {jobs.isLoading ? (
          <div className="job-list">
            {Array.from({ length: 6 }, (_, i) => (
              <JobCardSkeleton key={i} />
            ))}
          </div>
        ) : jobs.error ? (
          <QueryError error={jobs.error} retry={() => jobs.refetch()} />
        ) : jobs.data && jobs.data.items.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No jobs match your search"
            action={
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setParams(new URLSearchParams())}
              >
                Clear filters
              </button>
            }
          >
            Try a nearby state, a different category, or fewer words.
          </EmptyState>
        ) : (
          <>
            <div
              className="job-list"
              style={{ opacity: jobs.isPlaceholderData ? 0.55 : 1, transition: "opacity .2s" }}
            >
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
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Job detail

export function JobDetailPage() {
  const { id = "" } = useParams();
  const job = useQuery({ queryKey: ["job", id], queryFn: () => api.get<JobDetail>(`/jobs/${id}`) });
  usePageTitle(job.data?.title);
  const toast = useToast();
  const showApplyBar = job.data?.status === "open" && !job.data.isOwner;

  // Reserve room for the fixed mobile apply bar while this page is shown.
  useEffect(() => {
    if (!showApplyBar) return;
    document.body.classList.add("has-apply-bar");
    return () => document.body.classList.remove("has-apply-bar");
  }, [showApplyBar]);

  if (job.isLoading) return <Spinner />;
  if (job.error) {
    return (
      <div className="page wrap">
        {job.error instanceof ApiError && job.error.status === 404 ? (
          <EmptyState
            icon={SearchX}
            title="This job isn't available"
            action={
              <Link className="btn btn-primary" to="/jobs">
                Browse other jobs
              </Link>
            }
          >
            It may have been filled or removed.
          </EmptyState>
        ) : (
          <QueryError error={job.error} retry={() => job.refetch()} />
        )}
      </div>
    );
  }
  const data = job.data!;

  async function share() {
    const url = window.location.href;
    const text = `${data.title} — ${data.employer.organisationName}, ${data.town}`;
    try {
      if (navigator.share) await navigator.share({ title: data.title, text, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied. Share it with someone who'd be a great fit.");
      }
    } catch {
      /* user cancelled the share sheet */
    }
  }

  return (
    <div className="page">
      <div className="wrap">
        <Link className="breadcrumb" to="/jobs">
          <ArrowLeft size={17} /> All jobs
        </Link>
        <div className="detail-layout">
          <div className="stack-lg">
            <article className="panel job-hero">
              <div className="spread" style={{ alignItems: "flex-start" }}>
                <span className="tile-icon lg">
                  <CategoryIcon category={data.category} size={28} />
                </span>
                <div className="row">
                  {data.status !== "open" && (
                    <Badge tone={JOB_STATUS_UI[data.status].tone} dot>
                      {JOB_STATUS_UI[data.status].label}
                    </Badge>
                  )}
                  <button type="button" className="btn btn-outline btn-sm" onClick={share}>
                    <Share2 size={16} /> Share
                  </button>
                </div>
              </div>
              <div>
                <h1 className="display">{data.title}</h1>
                <p className="employer-line" style={{ marginTop: 8, fontSize: "1.02rem" }}>
                  {data.employer.organisationName}
                  {data.employer.verified && (
                    <span className="icon-inline" style={{ color: "var(--brand-ink)", fontWeight: 600 }}>
                      <BadgeCheck size={17} /> Verified employer
                    </span>
                  )}
                </p>
              </div>
              <div className="pay-block">
                {data.payMin === data.payMax
                  ? formatNaira(data.payMin)
                  : `${formatNaira(data.payMin)} – ${formatNaira(data.payMax)}`}
                <small>{PERIOD_LABEL[data.payPeriod]}</small>
              </div>
              <div className="chips">
                <span className="chip">
                  <MapPin size={13} /> {data.town}, {data.state}
                </span>
                <span className="chip">
                  <Briefcase size={13} /> {employmentLabel(data.employmentType)}
                </span>
                <span className="chip">
                  <Clock size={13} /> Posted {timeAgo(data.createdAt)}
                </span>
              </div>
            </article>

            <section className="panel" aria-labelledby="facts-title">
              <h2 id="facts-title" className="panel-title">
                Key facts
              </h2>
              <dl className="facts">
                <Fact icon={<CategoryIcon category={data.category} size={18} />} label="Category">
                  {categoryLabel(data.category)}
                </Fact>
                <Fact icon={<Users size={18} />} label="Positions">
                  {data.positions}
                </Fact>
                <Fact icon={<House size={18} />} label="Accommodation">
                  {data.accommodationProvided ? "Provided" : "Not provided"}
                </Fact>
                <Fact icon={<UtensilsCrossed size={18} />} label="Meals">
                  {data.mealsProvided ? "Provided" : "Not provided"}
                </Fact>
                {data.startDate && (
                  <Fact icon={<CalendarDays size={18} />} label="Start date">
                    {formatDate(data.startDate)}
                  </Fact>
                )}
              </dl>
            </section>

            <section className="panel" aria-labelledby="about-title">
              <h2 id="about-title" className="panel-title">
                About the job
              </h2>
              <p className="prose" style={{ margin: 0 }}>
                {data.description}
              </p>
            </section>
          </div>

          <aside className="sticky-aside stack" id="apply">
            <ApplyPanel job={data} />
            <Alert tone="warning" title="Stay safe">
              Genuine employers never ask you to pay for a job, training or uniform. If anyone asks for money,
              report this job.
            </Alert>
            <ReportJob key={data.id} jobId={data.id} />
          </aside>
        </div>

        <SimilarJobs job={data} />
      </div>

      {showApplyBar && (
        <div className="mobile-apply-bar">
          <div>
            <strong>{payRange(data.payMin, data.payMax)}</strong>
            <span className="subtle">{PERIOD_LABEL[data.payPeriod]}</span>
          </div>
          <a className="btn btn-primary" href="#apply">
            {data.myApplication && data.myApplication.status !== "withdrawn" ? "View status" : "Apply now"}
          </a>
        </div>
      )}
    </div>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fact">
      <span className="tile-icon">{icon}</span>
      <div>
        <dt>{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}

function SimilarJobs({ job }: { job: JobDetail }) {
  const similar = useQuery({
    queryKey: ["jobs", `?category=${job.category}&pageSize=4`],
    queryFn: () => api.get<Paginated<JobSummary>>(`/jobs?category=${job.category}&pageSize=4`),
  });
  const items = (similar.data?.items ?? []).filter((j) => j.id !== job.id).slice(0, 3);
  if (items.length === 0) return null;
  return (
    <section style={{ marginTop: 56 }} aria-labelledby="similar-title">
      <div className="spread" style={{ marginBottom: 18 }}>
        <h2 id="similar-title" className="display" style={{ fontSize: "1.6rem", margin: 0 }}>
          Similar jobs
        </h2>
        <Link className="link" to={`/jobs?category=${job.category}`}>
          See all {categoryLabel(job.category).toLowerCase()} jobs
        </Link>
      </div>
      <div className="job-list">
        {items.map((j) => (
          <JobCard key={j.id} job={j} />
        ))}
      </div>
    </section>
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
        toast("Application sent! We'll email you when the employer responds.");
        queryClient.invalidateQueries({ queryKey: ["job", job.id] });
        queryClient.invalidateQueries({ queryKey: ["my-applications"] });
      },
    },
  );

  if (job.isOwner) {
    return (
      <div className="panel panel-sm stack">
        <h2 className="panel-title" style={{ margin: 0 }}>
          Your listing
        </h2>
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
      <div className="panel panel-sm stack">
        <h2 className="panel-title" style={{ margin: 0 }}>
          Interested in this job?
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          Create a free worker profile to apply. It takes about two minutes.
        </p>
        <Link className="btn btn-primary btn-block" to={`/register?role=worker&next=${next}`}>
          Create free profile
        </Link>
        <Link className="btn btn-outline btn-block" to={`/login?next=${next}`}>
          Sign in to apply
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
      <div className="panel panel-sm stack">
        <div className="spread">
          <h2 className="panel-title" style={{ margin: 0 }}>
            You've applied
          </h2>
          <Badge tone={ui.tone} dot>
            {ui.label}
          </Badge>
        </div>
        <StatusTracker status={job.myApplication.status} />
        <p className="subtle" style={{ margin: 0 }}>
          Applied {formatDate(job.myApplication.createdAt)}
        </p>
        <Link className="btn btn-outline btn-block" to="/dashboard/applications">
          My applications
        </Link>
      </div>
    );
  }

  if (!user.hasProfile) {
    return (
      <div className="panel panel-sm stack">
        <h2 className="panel-title" style={{ margin: 0 }}>
          One more step
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          Complete your worker profile so the employer can see your skills.
        </p>
        <Link
          className="btn btn-primary btn-block"
          to={`/dashboard/profile?next=${encodeURIComponent(location.pathname)}`}
        >
          Complete profile
        </Link>
      </div>
    );
  }

  return (
    <form className="panel panel-sm form" onSubmit={onSubmit} noValidate>
      <h2 className="panel-title" style={{ margin: 0 }}>
        Apply for this job
      </h2>
      {formError && <Alert tone="error">{formError}</Alert>}
      <Field
        label="Message to the employer"
        optional
        name="coverNote"
        error={fieldErrors.coverNote}
        hint="Mention relevant experience and when you can start."
        counter={{ max: 2000 }}
      >
        {(props) => (
          <textarea
            className="textarea"
            maxLength={2000}
            placeholder="I have 3 years' experience with…"
            {...props}
          />
        )}
      </Field>
      <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={isPending}>
        <Send size={18} />
        {isPending ? "Sending…" : "Send application"}
      </button>
      <p className="subtle icon-inline" style={{ margin: 0, alignItems: "flex-start" }}>
        <ShieldAlert size={15} style={{ marginTop: 2 }} />
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
        <Link className="link" to="/login">
          Sign in
        </Link>{" "}
        to report a problem with this job.
      </p>
    );
  }

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => dialogRef.current?.showModal()}>
        <Flag size={16} /> Report this job
      </button>
      <dialog ref={dialogRef} aria-labelledby="report-title">
        <form className="form" onSubmit={onSubmit} noValidate>
          <div>
            <span
              className="tile-icon dialog-icon"
              style={{ background: "var(--danger-bg)", color: "var(--danger-text)" }}
            >
              <Flag size={20} />
            </span>
            <h2 id="report-title" style={{ fontSize: "1.3rem", margin: 0 }}>
              Report this job
            </h2>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              Reports are confidential. The employer won't see who reported them.
            </p>
          </div>
          {formError && <Alert tone="error">{formError}</Alert>}
          <Field label="What's wrong?" name="reason" error={fieldErrors.reason}>
            {(props) => (
              <select className="select" {...props} defaultValue="">
                <Options items={REPORT_REASONS} placeholder="Choose a reason" />
              </select>
            )}
          </Field>
          <Field label="Details" optional name="details" error={fieldErrors.details} counter={{ max: 2000 }}>
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

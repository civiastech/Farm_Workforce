import {
  EMPLOYMENT_TYPE_KEYS,
  JOB_CATEGORY_KEYS,
  NIGERIAN_STATES,
  REPORT_REASON_KEYS,
  applicationInputSchema,
  formatNaira,
  reportInputSchema,
  type EmploymentType,
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
  Search,
  SearchX,
  Send,
  Share2,
  ShieldAlert,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import {
  Alert,
  Badge,
  CategoryIcon,
  EmptyState,
  Field,
  JobCard,
  JobCardSkeleton,
  Pagination,
  QueryError,
  Spinner,
  StatusTracker,
} from "../components/ui";
import { useI18n } from "../i18n";
import { ApiError, api, toQuery } from "../lib/api";
import { useAuth } from "../lib/auth";
import { APPLICATION_STATUS_TONE, JOB_STATUS_TONE, payRange } from "../lib/format";
import { useFormSubmit } from "../lib/forms";
import { useToast } from "../lib/toast";
import { usePageTitle } from "../lib/usePageTitle";

const FILTER_KEYS = ["q", "category", "state", "employmentType", "sort"] as const;

export function JobsPage() {
  const { t, tp } = useI18n();
  usePageTitle(t("jobs.title"));
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
    filters.category && { key: "category", label: t(`category.${filters.category as JobCategory}`) },
    filters.employmentType && {
      key: "employmentType",
      label: t(`employment.${filters.employmentType as EmploymentType}`),
    },
  ].filter(Boolean) as { key: string; label: string }[];

  const total = jobs.data?.total;

  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <span className="eyebrow">{t("jobs.eyebrow")}</span>
          <h1 className="display">{t("jobs.title")}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {t("jobs.lead")}
          </p>

          {/* key resets the uncontrolled inputs when the URL changes (e.g. back button). */}
          <form
            key={`${filters.q}|${filters.state}`}
            className="search-bar"
            role="search"
            onSubmit={submitSearch}
          >
            <label className="input-icon">
              <span className="visually-hidden">{t("jobs.searchLabel")}</span>
              <Search size={18} aria-hidden="true" />
              <input
                name="q"
                className="input"
                type="search"
                placeholder={t("jobs.searchPlaceholder")}
                defaultValue={filters.q}
              />
            </label>
            <label className="input-icon">
              <span className="visually-hidden">{t("common.state")}</span>
              <MapPin size={18} aria-hidden="true" />
              <select name="state" className="select" defaultValue={filters.state}>
                <option value="">{t("common.allStates")}</option>
                {NIGERIAN_STATES.map((state) => (
                  <option key={state}>{state}</option>
                ))}
              </select>
            </label>
            <button className="btn btn-primary" type="submit">
              {t("jobs.search")}
            </button>
          </form>

          <div className="category-scroller" role="group" aria-label={t("jobs.byCategory")}>
            <button
              type="button"
              className="category-chip"
              aria-pressed={!filters.category}
              onClick={() => update({ category: null })}
            >
              {t("jobs.allJobs")}
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
                {t(`category.${key}`)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="wrap">
        <div className="results-bar">
          <h2 aria-live="polite">{total === undefined ? t("jobs.loading") : tp("jobs.found", total)}</h2>
          <div className="results-controls">
            <label>
              <span className="visually-hidden">{t("jobs.jobType")}</span>
              <select
                className="select"
                value={filters.employmentType}
                onChange={(e) => update({ employmentType: e.target.value })}
              >
                <option value="">{t("jobs.anyType")}</option>
                {EMPLOYMENT_TYPE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t(`employment.${key}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="visually-hidden">{t("jobs.sortBy")}</span>
              <select
                className="select"
                value={filters.sort || "newest"}
                onChange={(e) => update({ sort: e.target.value === "newest" ? null : e.target.value })}
              >
                <option value="newest">{t("jobs.newest")}</option>
                <option value="pay">{t("jobs.highestPay")}</option>
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
                aria-label={t("jobs.removeFilter", { label: filter.label })}
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
                {t("jobs.clearAll")}
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
            title={t("jobs.emptyTitle")}
            action={
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setParams(new URLSearchParams())}
              >
                {t("jobs.clearFilters")}
              </button>
            }
          >
            {t("jobs.emptyBody")}
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
  const { t, formatDate, timeAgo } = useI18n();
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
            title={t("job.unavailableTitle")}
            action={
              <Link className="btn btn-primary" to="/jobs">
                {t("job.browseOther")}
              </Link>
            }
          >
            {t("job.unavailableBody")}
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
        toast(t("job.linkCopied"));
      }
    } catch {
      /* user cancelled the share sheet */
    }
  }

  return (
    <div className="page">
      <div className="wrap">
        <Link className="breadcrumb" to="/jobs">
          <ArrowLeft size={17} /> {t("job.allJobs")}
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
                    <Badge tone={JOB_STATUS_TONE[data.status]} dot>
                      {t(`jobStatus.${data.status}`)}
                    </Badge>
                  )}
                  <button type="button" className="btn btn-outline btn-sm" onClick={share}>
                    <Share2 size={16} /> {t("job.share")}
                  </button>
                </div>
              </div>
              <div>
                <h1 className="display">{data.title}</h1>
                <p className="employer-line" style={{ marginTop: 8, fontSize: "1.02rem" }}>
                  {data.employer.organisationName}
                  {data.employer.verified && (
                    <span className="icon-inline" style={{ color: "var(--brand-ink)", fontWeight: 600 }}>
                      <BadgeCheck size={17} /> {t("common.verifiedEmployer")}
                    </span>
                  )}
                </p>
              </div>
              <div className="pay-block">
                {data.payMin === data.payMax
                  ? formatNaira(data.payMin)
                  : `${formatNaira(data.payMin)} – ${formatNaira(data.payMax)}`}
                <small>{t(`period.${data.payPeriod}`)}</small>
              </div>
              <div className="chips">
                <span className="chip">
                  <MapPin size={13} /> {data.town}, {data.state}
                </span>
                <span className="chip">
                  <Briefcase size={13} /> {t(`employment.${data.employmentType}`)}
                </span>
                <span className="chip">
                  <Clock size={13} /> {t("time.posted", { time: timeAgo(data.createdAt) })}
                </span>
              </div>
            </article>

            <section className="panel" aria-labelledby="facts-title">
              <h2 id="facts-title" className="panel-title">
                {t("job.keyFacts")}
              </h2>
              <dl className="facts">
                <Fact icon={<CategoryIcon category={data.category} size={18} />} label={t("job.category")}>
                  {t(`category.${data.category}`)}
                </Fact>
                <Fact icon={<Users size={18} />} label={t("job.positions")}>
                  {data.positions}
                </Fact>
                <Fact icon={<House size={18} />} label={t("common.accommodation")}>
                  {data.accommodationProvided ? t("common.provided") : t("common.notProvided")}
                </Fact>
                <Fact icon={<UtensilsCrossed size={18} />} label={t("common.meals")}>
                  {data.mealsProvided ? t("common.provided") : t("common.notProvided")}
                </Fact>
                {data.startDate && (
                  <Fact icon={<CalendarDays size={18} />} label={t("job.startDate")}>
                    {formatDate(data.startDate)}
                  </Fact>
                )}
              </dl>
            </section>

            <section className="panel" aria-labelledby="about-title">
              <h2 id="about-title" className="panel-title">
                {t("job.about")}
              </h2>
              <p className="prose" style={{ margin: 0 }}>
                {data.description}
              </p>
            </section>
          </div>

          <aside className="sticky-aside stack" id="apply">
            <ApplyPanel job={data} />
            <Alert tone="warning" title={t("job.staySafeTitle")}>
              {t("job.staySafeBody")}
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
            <span className="subtle">{t(`period.${data.payPeriod}`)}</span>
          </div>
          <a className="btn btn-primary" href="#apply">
            {data.myApplication && data.myApplication.status !== "withdrawn"
              ? t("job.viewStatus")
              : t("job.applyNow")}
          </a>
        </div>
      )}
    </div>
  );
}

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
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
  const { t } = useI18n();
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
          {t("job.similar")}
        </h2>
        <Link className="link" to={`/jobs?category=${job.category}`}>
          {t("job.seeMore")}
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
  const { t, formatDate } = useI18n();
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const { onSubmit, fieldErrors, formError, isPending } = useFormSubmit(
    applicationInputSchema,
    (values) => api.post<{ id: string }>(`/jobs/${job.id}/applications`, values),
    {
      onSuccess: () => {
        toast(t("apply.sent"));
        queryClient.invalidateQueries({ queryKey: ["job", job.id] });
        queryClient.invalidateQueries({ queryKey: ["my-applications"] });
      },
    },
  );

  if (job.isOwner) {
    return (
      <div className="panel panel-sm stack">
        <h2 className="panel-title" style={{ margin: 0 }}>
          {t("apply.yourListing")}
        </h2>
        <Link className="btn btn-primary btn-block" to={`/dashboard/jobs/${job.id}/applicants`}>
          {t("apply.viewApplicants")}
        </Link>
        <Link className="btn btn-outline btn-block" to={`/dashboard/jobs/${job.id}/edit`}>
          {t("apply.editJob")}
        </Link>
      </div>
    );
  }

  if (job.status !== "open") {
    return <Alert>{t("apply.closed")}</Alert>;
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname);
    return (
      <div className="panel panel-sm stack">
        <h2 className="panel-title" style={{ margin: 0 }}>
          {t("apply.interested")}
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          {t("apply.createProfileLead")}
        </p>
        <Link className="btn btn-primary btn-block" to={`/register?role=worker&next=${next}`}>
          {t("apply.createProfile")}
        </Link>
        <Link className="btn btn-outline btn-block" to={`/login?next=${next}`}>
          {t("apply.signIn")}
        </Link>
      </div>
    );
  }

  if (user.role !== "worker") {
    return <Alert>{t("apply.workersOnly")}</Alert>;
  }

  if (job.myApplication && job.myApplication.status !== "withdrawn") {
    return (
      <div className="panel panel-sm stack">
        <div className="spread">
          <h2 className="panel-title" style={{ margin: 0 }}>
            {t("apply.applied")}
          </h2>
          <Badge tone={APPLICATION_STATUS_TONE[job.myApplication.status]} dot>
            {t(`appStatus.${job.myApplication.status}`)}
          </Badge>
        </div>
        <StatusTracker status={job.myApplication.status} />
        <p className="subtle" style={{ margin: 0 }}>
          {t("apply.appliedOn", { date: formatDate(job.myApplication.createdAt) })}
        </p>
        <Link className="btn btn-outline btn-block" to="/dashboard/applications">
          {t("apply.myApplications")}
        </Link>
      </div>
    );
  }

  if (!user.hasProfile) {
    return (
      <div className="panel panel-sm stack">
        <h2 className="panel-title" style={{ margin: 0 }}>
          {t("apply.oneMoreStep")}
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          {t("apply.completeProfileLead")}
        </p>
        <Link
          className="btn btn-primary btn-block"
          to={`/dashboard/profile?next=${encodeURIComponent(location.pathname)}`}
        >
          {t("apply.completeProfile")}
        </Link>
      </div>
    );
  }

  return (
    <form className="panel panel-sm form" onSubmit={onSubmit} noValidate>
      <h2 className="panel-title" style={{ margin: 0 }}>
        {t("apply.title")}
      </h2>
      {formError && <Alert tone="error">{formError}</Alert>}
      <Field
        label={t("apply.message")}
        optional
        name="coverNote"
        error={fieldErrors.coverNote}
        hint={t("apply.messageHint")}
        counter={{ max: 2000 }}
      >
        {(props) => (
          <textarea
            className="textarea"
            maxLength={2000}
            placeholder={t("apply.messagePlaceholder")}
            {...props}
          />
        )}
      </Field>
      <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={isPending}>
        <Send size={18} />
        {isPending ? t("common.sending") : t("apply.send")}
      </button>
      <p className="subtle icon-inline" style={{ margin: 0, alignItems: "flex-start" }}>
        <ShieldAlert size={15} style={{ marginTop: 2 }} />
        {t("apply.privacy")}
      </p>
    </form>
  );
}

function ReportJob({ jobId }: { jobId: string }) {
  const { t, tn } = useI18n();
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
        toast(t("report.thanks"));
      },
    },
  );

  if (sent) return <p className="subtle">{t("report.sent")}</p>;
  if (!user) {
    return (
      <p className="subtle">
        {tn("report.signInPrompt", {
          signIn: (
            <Link className="link" to="/login">
              {t("nav.signIn")}
            </Link>
          ),
        })}
      </p>
    );
  }

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => dialogRef.current?.showModal()}>
        <Flag size={16} /> {t("report.button")}
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
              {t("report.button")}
            </h2>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              {t("report.lead")}
            </p>
          </div>
          {formError && <Alert tone="error">{formError}</Alert>}
          <Field label={t("report.reason")} name="reason" error={fieldErrors.reason}>
            {(props) => (
              <select className="select" {...props} defaultValue="">
                <option value="">{t("report.chooseReason")}</option>
                {REPORT_REASON_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t(`reportReason.${key}`)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field
            label={t("report.details")}
            optional
            name="details"
            error={fieldErrors.details}
            counter={{ max: 2000 }}
          >
            {(props) => <textarea className="textarea" maxLength={2000} {...props} />}
          </Field>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-outline" onClick={() => dialogRef.current?.close()}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="btn btn-danger" disabled={isPending}>
              {isPending ? t("common.sending") : t("report.send")}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

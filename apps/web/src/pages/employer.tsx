import {
  EMPLOYMENT_TYPE_KEYS,
  JOB_CATEGORY_KEYS,
  NIGERIAN_STATES,
  PAY_PERIOD_KEYS,
  jobInputSchema,
  type Applicant,
  type ApplicationStatus,
  type EmployerJob,
  type EmploymentType,
  type JobCategory,
  type JobDetail,
  type PayPeriod,
  type ProfileResponse,
} from "@fwp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Briefcase,
  Eye,
  FileText,
  Inbox,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  Alert,
  Avatar,
  Badge,
  CategoryIcon,
  EmptyState,
  Field,
  JobCard,
  Options,
  QueryError,
  Spinner,
} from "../components/ui";
import { useI18n, type MessageKey } from "../i18n";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { APPLICATION_STATUS_TONE, JOB_STATUS_TONE } from "../lib/format";
import { readForm, useFormSubmit } from "../lib/forms";
import { useToast } from "../lib/toast";
import { usePageTitle } from "../lib/usePageTitle";

// ---------------------------------------------------------------- My jobs

export function EmployerJobsPage() {
  const { t, tp, timeAgo } = useI18n();
  usePageTitle(t("nav.myJobs"));
  const jobs = useQuery({
    queryKey: ["employer-jobs"],
    queryFn: () => api.get<{ items: EmployerJob[] }>("/employer/jobs"),
  });

  if (jobs.isLoading) return <Spinner />;
  if (jobs.error) return <QueryError error={jobs.error} retry={() => jobs.refetch()} />;
  const items = jobs.data?.items ?? [];

  return (
    <div>
      <div className="page-head spread">
        <div>
          <h1 className="display">{t("nav.myJobs")}</h1>
          <p className="muted">{t("ejobs.lead")}</p>
        </div>
        <Link className="btn btn-primary" to="/dashboard/jobs/new">
          <Plus size={18} /> {t("dash.postJob")}
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={t("ejobs.emptyTitle")}
          action={
            <Link className="btn btn-primary" to="/dashboard/jobs/new">
              {t("ejobs.postFirst")}
            </Link>
          }
        >
          {t("dash.noJobsBody")}
        </EmptyState>
      ) : (
        <ul className="list">
          {items.map((job) => {
            const counts = job.applicationCounts;
            const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
            return (
              <li key={job.id} className="list-card">
                <div className="spread" style={{ alignItems: "flex-start" }}>
                  <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap", minWidth: 0 }}>
                    <span className="tile-icon">
                      <CategoryIcon category={job.category} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <h3>
                        <Link to={`/jobs/${job.id}`}>{job.title}</Link>
                      </h3>
                      <p className="subtle icon-inline" style={{ margin: 0, flexWrap: "wrap" }}>
                        <MapPin size={14} /> {job.town}, {job.state} · {t(`category.${job.category}`)} ·{" "}
                        {t("time.posted", { time: timeAgo(job.createdAt) })}
                      </p>
                    </div>
                  </div>
                  <Badge tone={JOB_STATUS_TONE[job.status]} dot>
                    {t(`jobStatus.${job.status}`)}
                  </Badge>
                </div>
                <div className="spread">
                  <div className="chips">
                    <span className="chip">
                      <Users size={13} /> {tp("ejobs.applicants", total)}
                    </span>
                    {(counts.submitted ?? 0) > 0 && (
                      <span className="chip chip-gold">
                        {t("dash.newCount", { n: counts.submitted ?? 0 })}
                      </span>
                    )}
                    {(counts.shortlisted ?? 0) > 0 && (
                      <span className="chip chip-brand">
                        {t("ejobs.shortlistedCount", { n: counts.shortlisted ?? 0 })}
                      </span>
                    )}
                    {(counts.hired ?? 0) > 0 && (
                      <span className="chip chip-brand">
                        {t("ejobs.hiredCount", { n: counts.hired ?? 0 })}
                      </span>
                    )}
                  </div>
                  <div className="row">
                    {job.status !== "removed" && (
                      <Link className="btn btn-ghost btn-sm" to={`/dashboard/jobs/${job.id}/edit`}>
                        <Pencil size={15} /> {t("ejobs.edit")}
                      </Link>
                    )}
                    <Link className="btn btn-primary btn-sm" to={`/dashboard/jobs/${job.id}/applicants`}>
                      {t("ejobs.review")}
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Job editor

interface Preview {
  title: string;
  category: JobCategory;
  employmentType: EmploymentType;
  state: string;
  town: string;
  payMin: number;
  payMax: number;
  payPeriod: PayPeriod;
  positions: number;
  accommodationProvided: boolean;
  mealsProvided: boolean;
}

function toPreview(raw: Record<string, unknown>, statePlaceholder: string): Preview {
  const num = (v: unknown) => Math.max(0, Number(v) || 0);
  return {
    title: String(raw.title ?? ""),
    category: (raw.category as JobCategory) || "general_labour",
    employmentType: (raw.employmentType as EmploymentType) || "full_time",
    state: String(raw.state || statePlaceholder),
    town: String(raw.town ?? ""),
    payMin: num(raw.payMin),
    payMax: Math.max(num(raw.payMin), num(raw.payMax)),
    payPeriod: (raw.payPeriod as PayPeriod) || "month",
    positions: Math.max(1, num(raw.positions)),
    accommodationProvided: !!raw.accommodationProvided,
    mealsProvided: !!raw.mealsProvided,
  };
}

export function JobEditorPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const isEdit = !!id;
  usePageTitle(isEdit ? t("editor.editTitle") : t("dash.postJob"));
  const { user } = useAuth();

  const existing = useQuery({
    queryKey: ["job", id],
    queryFn: () => api.get<JobDetail>(`/jobs/${id}`),
    enabled: isEdit,
  });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => api.get<ProfileResponse>("/me/profile") });

  if (user && !user.hasProfile) {
    return (
      <Alert tone="warning" title={t("editor.addOrgTitle")}>
        {t("editor.addOrgBody")} <Link to="/dashboard/profile">{t("dash.completeProfile")}</Link>
      </Alert>
    );
  }
  if ((isEdit && existing.isLoading) || profile.isLoading) return <Spinner />;
  if (isEdit && existing.error) return <QueryError error={existing.error} />;

  // Remount the form once data is loaded so default values apply.
  return (
    <JobEditorForm
      key={existing.data?.id ?? "new"}
      job={existing.data}
      employer={profile.data?.employer ?? null}
    />
  );
}

function JobEditorForm({ job, employer }: { job?: JobDetail; employer: ProfileResponse["employer"] }) {
  const { t } = useI18n();
  const isEdit = !!job;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [createdAt] = useState(() => new Date().toISOString());
  const [preview, setPreview] = useState<Preview>(() =>
    toPreview(
      job ? { ...job } : { payPeriod: "month", positions: 1, state: employer?.state ?? "" },
      t("common.state"),
    ),
  );

  const { onSubmit, fieldErrors, formError, isPending } = useFormSubmit(
    jobInputSchema,
    (values) =>
      isEdit
        ? api.patch<{ id: string }>(`/jobs/${job.id}`, values)
        : api.post<{ id: string }>("/jobs", values),
    {
      onSuccess: ({ id: jobId }) => {
        queryClient.invalidateQueries({ queryKey: ["employer-jobs"] });
        queryClient.invalidateQueries({ queryKey: ["job", jobId] });
        queryClient.invalidateQueries({ queryKey: ["jobs"] });
        queryClient.invalidateQueries({ queryKey: ["stats"] });
        toast(isEdit ? t("editor.updated") : t("editor.posted"));
        navigate("/dashboard/jobs");
      },
    },
  );

  return (
    <div>
      <Link className="breadcrumb" to="/dashboard/jobs">
        <ArrowLeft size={17} /> {t("nav.myJobs")}
      </Link>
      <div className="page-head">
        <h1 className="display">{isEdit ? t("editor.editTitle") : t("dash.postJob")}</h1>
        <p className="muted">{t("editor.lead")}</p>
      </div>

      <div className="editor-layout">
        <form
          className="panel form"
          onSubmit={onSubmit}
          onChange={(e) => setPreview(toPreview(readForm(e.currentTarget), t("common.state")))}
          noValidate
        >
          {formError && <Alert tone="error">{formError}</Alert>}

          <section className="form-section">
            <h2>
              <Briefcase size={18} /> {t("editor.role")}
            </h2>
            <div className="form-grid">
              <Field
                className="full"
                label={t("editor.jobTitle")}
                name="title"
                error={fieldErrors.title}
                hint={t("editor.jobTitleHint")}
                counter={{ max: 120, initial: job?.title.length ?? 0 }}
              >
                {(props) => <input className="input" maxLength={120} defaultValue={job?.title} {...props} />}
              </Field>
              <Field label={t("editor.category")} name="category" error={fieldErrors.category}>
                {(props) => (
                  <select className="select" defaultValue={job?.category ?? ""} {...props}>
                    <option value="">{t("editor.chooseCategory")}</option>
                    {JOB_CATEGORY_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {t(`category.${key}`)}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={t("editor.jobType")} name="employmentType" error={fieldErrors.employmentType}>
                {(props) => (
                  <select className="select" defaultValue={job?.employmentType ?? ""} {...props}>
                    <option value="">{t("editor.chooseType")}</option>
                    {EMPLOYMENT_TYPE_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {t(`employment.${key}`)}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={t("editor.positions")} name="positions" error={fieldErrors.positions}>
                {(props) => (
                  <input
                    className="input"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    defaultValue={job?.positions ?? 1}
                    {...props}
                  />
                )}
              </Field>
              <Field label={t("job.startDate")} optional name="startDate" error={fieldErrors.startDate}>
                {(props) => (
                  <input className="input" type="date" defaultValue={job?.startDate ?? ""} {...props} />
                )}
              </Field>
            </div>
          </section>

          <section className="form-section">
            <h2>
              <MapPin size={18} /> {t("editor.location")}
            </h2>
            <div className="form-grid">
              <Field label={t("common.state")} name="state" error={fieldErrors.state}>
                {(props) => (
                  <select className="select" defaultValue={job?.state ?? employer?.state ?? ""} {...props}>
                    <Options items={NIGERIAN_STATES} placeholder={t("common.chooseState")} />
                  </select>
                )}
              </Field>
              <Field label={t("common.townLga")} name="town" error={fieldErrors.town}>
                {(props) => (
                  <input className="input" defaultValue={job?.town ?? employer?.town ?? ""} {...props} />
                )}
              </Field>
            </div>
          </section>

          <section className="form-section">
            <h2>
              <Wallet size={18} /> {t("editor.payConditions")}
            </h2>
            <div className="form-grid">
              <Field label={t("editor.minPay")} name="payMin" error={fieldErrors.payMin}>
                {(props) => (
                  <div className="input-affix">
                    <span className="affix">₦</span>
                    <input
                      className="input"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      defaultValue={job?.payMin}
                      {...props}
                    />
                  </div>
                )}
              </Field>
              <Field label={t("editor.maxPay")} name="payMax" error={fieldErrors.payMax}>
                {(props) => (
                  <div className="input-affix">
                    <span className="affix">₦</span>
                    <input
                      className="input"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      defaultValue={job?.payMax}
                      {...props}
                    />
                  </div>
                )}
              </Field>
              <Field
                className="full"
                label={t("editor.paidPer")}
                name="payPeriod"
                error={fieldErrors.payPeriod}
              >
                {(props) => (
                  <select className="select" defaultValue={job?.payPeriod ?? "month"} {...props}>
                    {PAY_PERIOD_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {t(`payPeriod.${key}`)}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <label className="switch-row full">
                <div>
                  <strong>{t("editor.accommodation")}</strong>
                  <span>{t("editor.accommodationHint")}</span>
                </div>
                <input
                  type="checkbox"
                  className="switch"
                  name="accommodationProvided"
                  defaultChecked={job?.accommodationProvided}
                />
              </label>
              <label className="switch-row full">
                <div>
                  <strong>{t("editor.meals")}</strong>
                  <span>{t("editor.mealsHint")}</span>
                </div>
                <input
                  type="checkbox"
                  className="switch"
                  name="mealsProvided"
                  defaultChecked={job?.mealsProvided}
                />
              </label>
            </div>
          </section>

          <section className="form-section">
            <h2>
              <FileText size={18} /> {t("editor.description")}
            </h2>
            <Field
              label={t("job.about")}
              name="description"
              error={fieldErrors.description}
              hint={t("editor.aboutHint")}
              counter={{ max: 5000, initial: job?.description.length ?? 0 }}
            >
              {(props) => (
                <textarea
                  className="textarea"
                  rows={9}
                  maxLength={5000}
                  defaultValue={job?.description}
                  {...props}
                />
              )}
            </Field>
          </section>

          <section className="form-section">
            <h2>
              <Eye size={18} /> {t("editor.publishing")}
            </h2>
            <Field
              label={t("editor.status")}
              name="status"
              error={fieldErrors.status}
              hint={t("editor.statusHint")}
            >
              {(props) => (
                <select
                  className="select"
                  defaultValue={job?.status === "removed" ? "closed" : (job?.status ?? "open")}
                  {...props}
                >
                  <option value="open">{t("editor.statusOpen")}</option>
                  <option value="draft">{t("jobStatus.draft")}</option>
                  <option value="closed">{t("jobStatus.closed")}</option>
                </select>
              )}
            </Field>
          </section>

          <div className="row">
            <button className="btn btn-primary btn-lg" type="submit" disabled={isPending}>
              {isPending ? t("common.saving") : isEdit ? t("editor.save") : t("editor.publish")}
            </button>
            <Link className="btn btn-ghost" to="/dashboard/jobs">
              {t("common.cancel")}
            </Link>
          </div>
        </form>

        <aside className="editor-preview" aria-label={t("editor.preview")}>
          <span className="eyebrow">
            <Eye size={15} /> {t("editor.preview")}
          </span>
          <JobCard
            job={{
              ...preview,
              createdAt,
              employer: {
                organisationName: employer?.organisationName ?? t("editor.yourFarm"),
                verified: !!employer?.verified,
              },
            }}
          />
          <Alert tone="warning" title={t("editor.fairTitle")}>
            {t("editor.fairBody")}
          </Alert>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Applicants

const NEXT_ACTIONS: Partial<
  Record<ApplicationStatus, { status: ApplicationStatus; label: MessageKey; primary?: boolean }[]>
> = {
  submitted: [
    { status: "shortlisted", label: "applicants.shortlist", primary: true },
    { status: "rejected", label: "applicants.notSuitable" },
  ],
  shortlisted: [
    { status: "hired", label: "applicants.markHired", primary: true },
    { status: "rejected", label: "applicants.notSuitable" },
  ],
  rejected: [{ status: "submitted", label: "applicants.reconsider" }],
};

type ApplicantTab = "all" | "submitted" | "shortlisted" | "hired" | "rejected";
const TABS: [ApplicantTab, MessageKey][] = [
  ["all", "apps.all"],
  ["submitted", "common.new"],
  ["shortlisted", "appStatus.shortlisted"],
  ["hired", "appStatus.hired"],
  ["rejected", "appStatus.rejected"],
];

export function JobApplicantsPage() {
  const { t, tp, timeAgo, errorMessage } = useI18n();
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<ApplicantTab>("all");
  const job = useQuery({ queryKey: ["job", id], queryFn: () => api.get<JobDetail>(`/jobs/${id}`) });
  const applicants = useQuery({
    queryKey: ["applicants", id],
    queryFn: () => api.get<{ items: Applicant[] }>(`/employer/jobs/${id}/applications`),
  });
  usePageTitle(job.data ? `${t("applicants.title")} · ${job.data.title}` : t("applicants.title"));

  const updateStatus = useMutation({
    mutationFn: ({ applicationId, status }: { applicationId: string; status: ApplicationStatus }) =>
      api.patch(`/applications/${applicationId}/status`, { status }),
    onSuccess: (_data, { status }) => {
      toast(status === "shortlisted" ? t("applicants.shortlistedToast") : t("applicants.updatedToast"));
      queryClient.invalidateQueries({ queryKey: ["applicants", id] });
      queryClient.invalidateQueries({ queryKey: ["employer-jobs"] });
    },
    onError: (error) => toast(errorMessage(error)),
  });

  if (applicants.isLoading || job.isLoading) return <Spinner />;
  if (applicants.error) return <QueryError error={applicants.error} retry={() => applicants.refetch()} />;
  const items = applicants.data?.items ?? [];
  const count = (key: ApplicantTab) =>
    key === "all" ? items.length : items.filter((a) => a.status === key).length;
  const visible = tab === "all" ? items : items.filter((a) => a.status === tab);

  return (
    <div>
      <Link className="breadcrumb" to="/dashboard/jobs">
        <ArrowLeft size={17} /> {t("nav.myJobs")}
      </Link>
      <div className="page-head">
        <h1 className="display">{t("applicants.title")}</h1>
        <p className="muted">
          {job.data?.title} · {tp("applicants.count", items.length)}
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Inbox} title={t("applicants.emptyTitle")}>
          {t("applicants.emptyBody")}
        </EmptyState>
      ) : (
        <>
          <div className="tabs" role="tablist" aria-label={t("applicants.tabs")}>
            {TABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
              >
                {t(label)} <span className="count">{count(key)}</span>
              </button>
            ))}
          </div>
          <Alert>{t("applicants.contactNote")}</Alert>
          <ul className="list" style={{ marginTop: 16 }}>
            {visible.map((applicant) => {
              const w = applicant.worker;
              return (
                <li key={applicant.id} className="list-card">
                  <div className="spread" style={{ alignItems: "flex-start" }}>
                    <div
                      className="row"
                      style={{ flexWrap: "nowrap", alignItems: "flex-start", minWidth: 0 }}
                    >
                      <Avatar name={w.fullName} size={48} />
                      <div style={{ minWidth: 0 }}>
                        <h3>{w.fullName}</h3>
                        <p className="subtle" style={{ margin: 0 }}>
                          {[w.town, w.state].filter(Boolean).join(", ") || t("applicants.noLocation")}
                          {w.primaryCategory && ` · ${t(`category.${w.primaryCategory}`)}`}
                          {w.yearsExperience !== null &&
                            ` · ${t("applicants.years", { n: w.yearsExperience })}`}
                        </p>
                      </div>
                    </div>
                    <Badge tone={APPLICATION_STATUS_TONE[applicant.status]} dot>
                      {t(`appStatus.${applicant.status}`)}
                    </Badge>
                  </div>
                  {w.skills.length > 0 && (
                    <div className="chips">
                      {w.skills.map((skill) => (
                        <span key={skill} className="chip">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                  {w.bio && (
                    <p className="muted" style={{ margin: 0 }}>
                      {w.bio}
                    </p>
                  )}
                  {applicant.coverNote && <blockquote className="quote">{applicant.coverNote}</blockquote>}
                  {w.phone && (
                    <div className="contact-row">
                      <a className="btn btn-outline btn-sm" href={`tel:${w.phone}`}>
                        <Phone size={15} /> {w.phone}
                      </a>
                      {w.email && (
                        <a className="btn btn-outline btn-sm" href={`mailto:${w.email}`}>
                          <Mail size={15} /> {t("applicants.email")}
                        </a>
                      )}
                    </div>
                  )}
                  <div className="spread">
                    <span className="subtle">
                      {t("time.applied", { time: timeAgo(applicant.createdAt) })}
                    </span>
                    <div className="row">
                      {(NEXT_ACTIONS[applicant.status] ?? []).map((action) => (
                        <button
                          key={action.status}
                          type="button"
                          className={`btn btn-sm ${action.primary ? "btn-primary" : "btn-ghost"}`}
                          disabled={updateStatus.isPending}
                          onClick={() =>
                            updateStatus.mutate({ applicationId: applicant.id, status: action.status })
                          }
                        >
                          {t(action.label)}
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {visible.length === 0 && <p className="muted">{t("applicants.noneInGroup")}</p>}
        </>
      )}
    </div>
  );
}

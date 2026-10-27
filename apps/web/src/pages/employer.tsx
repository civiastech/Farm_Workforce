import {
  EMPLOYMENT_TYPES,
  JOB_CATEGORIES,
  NIGERIAN_STATES,
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
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { APPLICATION_STATUS_UI, JOB_STATUS_UI, categoryLabel, timeAgo } from "../lib/format";
import { readForm, useFormSubmit } from "../lib/forms";
import { useToast } from "../lib/toast";
import { usePageTitle } from "../lib/usePageTitle";

// ---------------------------------------------------------------- My jobs

export function EmployerJobsPage() {
  usePageTitle("My jobs");
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
          <h1 className="display">My jobs</h1>
          <p className="muted">Review applicants, edit listings and close jobs once they're filled.</p>
        </div>
        <Link className="btn btn-primary" to="/dashboard/jobs/new">
          <Plus size={18} /> Post a job
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="You haven't posted any jobs yet"
          action={
            <Link className="btn btn-primary" to="/dashboard/jobs/new">
              Post your first job
            </Link>
          }
        >
          Clear pay and a good description attract the best applicants.
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
                        <MapPin size={14} /> {job.town}, {job.state} · {categoryLabel(job.category)} · posted{" "}
                        {timeAgo(job.createdAt)}
                      </p>
                    </div>
                  </div>
                  <Badge tone={JOB_STATUS_UI[job.status].tone} dot>
                    {JOB_STATUS_UI[job.status].label}
                  </Badge>
                </div>
                <div className="spread">
                  <div className="chips">
                    <span className="chip">
                      <Users size={13} /> {total} applicant{total === 1 ? "" : "s"}
                    </span>
                    {(counts.submitted ?? 0) > 0 && (
                      <span className="chip chip-gold">{counts.submitted} new</span>
                    )}
                    {(counts.shortlisted ?? 0) > 0 && (
                      <span className="chip chip-brand">{counts.shortlisted} shortlisted</span>
                    )}
                    {(counts.hired ?? 0) > 0 && <span className="chip chip-brand">{counts.hired} hired</span>}
                  </div>
                  <div className="row">
                    {job.status !== "removed" && (
                      <Link className="btn btn-ghost btn-sm" to={`/dashboard/jobs/${job.id}/edit`}>
                        <Pencil size={15} /> Edit
                      </Link>
                    )}
                    <Link className="btn btn-primary btn-sm" to={`/dashboard/jobs/${job.id}/applicants`}>
                      Review applicants
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

function toPreview(raw: Record<string, unknown>): Preview {
  const num = (v: unknown) => Math.max(0, Number(v) || 0);
  return {
    title: String(raw.title ?? ""),
    category: (raw.category as JobCategory) || "general_labour",
    employmentType: (raw.employmentType as EmploymentType) || "full_time",
    state: String(raw.state || "State"),
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
  const { id } = useParams();
  const isEdit = !!id;
  usePageTitle(isEdit ? "Edit job" : "Post a job");
  const { user } = useAuth();

  const existing = useQuery({
    queryKey: ["job", id],
    queryFn: () => api.get<JobDetail>(`/jobs/${id}`),
    enabled: isEdit,
  });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => api.get<ProfileResponse>("/me/profile") });

  if (user && !user.hasProfile) {
    return (
      <Alert tone="warning" title="Add your organisation first">
        Workers need to know who they'd be working for.{" "}
        <Link to="/dashboard/profile">Complete profile →</Link>
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
  const isEdit = !!job;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [createdAt] = useState(() => new Date().toISOString());
  const [preview, setPreview] = useState<Preview>(() =>
    toPreview(job ? { ...job } : { payPeriod: "month", positions: 1, state: employer?.state ?? "" }),
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
        toast(isEdit ? "Job updated." : "Job posted! Workers can see it now.");
        navigate("/dashboard/jobs");
      },
    },
  );

  return (
    <div>
      <Link className="breadcrumb" to="/dashboard/jobs">
        <ArrowLeft size={17} /> My jobs
      </Link>
      <div className="page-head">
        <h1 className="display">{isEdit ? "Edit job" : "Post a job"}</h1>
        <p className="muted">Jobs with clear pay and conditions get more — and better — applicants.</p>
      </div>

      <div className="editor-layout">
        <form
          className="panel form"
          onSubmit={onSubmit}
          onChange={(e) => setPreview(toPreview(readForm(e.currentTarget)))}
          noValidate
        >
          {formError && <Alert tone="error">{formError}</Alert>}

          <section className="form-section">
            <h2>
              <Briefcase size={18} /> The role
            </h2>
            <div className="form-grid">
              <Field
                className="full"
                label="Job title"
                name="title"
                error={fieldErrors.title}
                hint="Be specific, e.g. “Poultry attendant (layers)”"
                counter={{ max: 120, initial: job?.title.length ?? 0 }}
              >
                {(props) => <input className="input" maxLength={120} defaultValue={job?.title} {...props} />}
              </Field>
              <Field label="Category" name="category" error={fieldErrors.category}>
                {(props) => (
                  <select className="select" defaultValue={job?.category ?? ""} {...props}>
                    <Options items={JOB_CATEGORIES} placeholder="Choose a category" />
                  </select>
                )}
              </Field>
              <Field label="Job type" name="employmentType" error={fieldErrors.employmentType}>
                {(props) => (
                  <select className="select" defaultValue={job?.employmentType ?? ""} {...props}>
                    <Options items={EMPLOYMENT_TYPES} placeholder="Choose a type" />
                  </select>
                )}
              </Field>
              <Field label="Number of positions" name="positions" error={fieldErrors.positions}>
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
              <Field label="Start date" optional name="startDate" error={fieldErrors.startDate}>
                {(props) => (
                  <input className="input" type="date" defaultValue={job?.startDate ?? ""} {...props} />
                )}
              </Field>
            </div>
          </section>

          <section className="form-section">
            <h2>
              <MapPin size={18} /> Location
            </h2>
            <div className="form-grid">
              <Field label="State" name="state" error={fieldErrors.state}>
                {(props) => (
                  <select className="select" defaultValue={job?.state ?? employer?.state ?? ""} {...props}>
                    <Options items={NIGERIAN_STATES} placeholder="Choose a state" />
                  </select>
                )}
              </Field>
              <Field label="Town / LGA" name="town" error={fieldErrors.town}>
                {(props) => (
                  <input className="input" defaultValue={job?.town ?? employer?.town ?? ""} {...props} />
                )}
              </Field>
            </div>
          </section>

          <section className="form-section">
            <h2>
              <Wallet size={18} /> Pay &amp; conditions
            </h2>
            <div className="form-grid">
              <Field label="Minimum pay" name="payMin" error={fieldErrors.payMin}>
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
              <Field label="Maximum pay" name="payMax" error={fieldErrors.payMax}>
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
              <Field className="full" label="Paid per" name="payPeriod" error={fieldErrors.payPeriod}>
                {(props) => (
                  <select className="select" defaultValue={job?.payPeriod ?? "month"} {...props}>
                    <Options items={{ day: "Day", week: "Week", month: "Month" }} />
                  </select>
                )}
              </Field>
              <label className="switch-row full">
                <div>
                  <strong>Accommodation provided</strong>
                  <span>Housing on or near the farm</span>
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
                  <strong>Meals provided</strong>
                  <span>At least one meal a working day</span>
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
              <FileText size={18} /> Description
            </h2>
            <Field
              label="About the job"
              name="description"
              error={fieldErrors.description}
              hint="Duties, working hours, experience needed, and how and when pay is made."
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
              <Eye size={18} /> Publishing
            </h2>
            <Field
              label="Status"
              name="status"
              error={fieldErrors.status}
              hint="Drafts are only visible to you."
            >
              {(props) => (
                <select
                  className="select"
                  defaultValue={job?.status === "removed" ? "closed" : (job?.status ?? "open")}
                  {...props}
                >
                  <Options
                    items={{ open: "Open — accepting applications", draft: "Draft", closed: "Closed" }}
                  />
                </select>
              )}
            </Field>
          </section>

          <div className="row">
            <button className="btn btn-primary btn-lg" type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save changes" : "Publish job"}
            </button>
            <Link className="btn btn-ghost" to="/dashboard/jobs">
              Cancel
            </Link>
          </div>
        </form>

        <aside className="editor-preview" aria-label="Live preview">
          <span className="eyebrow">
            <Eye size={15} /> Live preview
          </span>
          <JobCard
            job={{
              ...preview,
              createdAt,
              employer: {
                organisationName: employer?.organisationName ?? "Your farm",
                verified: !!employer?.verified,
              },
            }}
          />
          <Alert tone="warning" title="Fair hiring">
            Never ask workers to pay a fee to apply or start work. Listings that do are removed and the
            account suspended.
          </Alert>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Applicants

const NEXT_ACTIONS: Partial<
  Record<ApplicationStatus, { status: ApplicationStatus; label: string; primary?: boolean }[]>
> = {
  submitted: [
    { status: "shortlisted", label: "Shortlist", primary: true },
    { status: "rejected", label: "Not suitable" },
  ],
  shortlisted: [
    { status: "hired", label: "Mark as hired", primary: true },
    { status: "rejected", label: "Not suitable" },
  ],
  rejected: [{ status: "submitted", label: "Reconsider" }],
};

type ApplicantTab = "all" | "submitted" | "shortlisted" | "hired" | "rejected";
const TABS: [ApplicantTab, string][] = [
  ["all", "All"],
  ["submitted", "New"],
  ["shortlisted", "Shortlisted"],
  ["hired", "Hired"],
  ["rejected", "Not selected"],
];

export function JobApplicantsPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<ApplicantTab>("all");
  const job = useQuery({ queryKey: ["job", id], queryFn: () => api.get<JobDetail>(`/jobs/${id}`) });
  const applicants = useQuery({
    queryKey: ["applicants", id],
    queryFn: () => api.get<{ items: Applicant[] }>(`/employer/jobs/${id}/applications`),
  });
  usePageTitle(job.data ? `Applicants · ${job.data.title}` : "Applicants");

  const updateStatus = useMutation({
    mutationFn: ({ applicationId, status }: { applicationId: string; status: ApplicationStatus }) =>
      api.patch(`/applications/${applicationId}/status`, { status }),
    onSuccess: (_data, { status }) => {
      toast(
        status === "shortlisted"
          ? "Shortlisted. Their contact details are now visible, and we've emailed them."
          : `Applicant marked as ${APPLICATION_STATUS_UI[status].label.toLowerCase()}. They'll be notified by email.`,
      );
      queryClient.invalidateQueries({ queryKey: ["applicants", id] });
      queryClient.invalidateQueries({ queryKey: ["employer-jobs"] });
    },
    onError: (error) => toast(error.message),
  });

  if (applicants.isLoading || job.isLoading) return <Spinner />;
  if (applicants.error) return <QueryError error={applicants.error} retry={() => applicants.refetch()} />;
  const items = applicants.data?.items ?? [];
  const count = (t: ApplicantTab) =>
    t === "all" ? items.length : items.filter((a) => a.status === t).length;
  const visible = tab === "all" ? items : items.filter((a) => a.status === tab);

  return (
    <div>
      <Link className="breadcrumb" to="/dashboard/jobs">
        <ArrowLeft size={17} /> My jobs
      </Link>
      <div className="page-head">
        <h1 className="display">Applicants</h1>
        <p className="muted">
          {job.data?.title} · {items.length} applicant{items.length === 1 ? "" : "s"}
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Inbox} title="No applicants yet">
          Share your job link with your network to reach more workers.
        </EmptyState>
      ) : (
        <>
          <div className="tabs" role="tablist" aria-label="Filter applicants">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
              >
                {label} <span className="count">{count(key)}</span>
              </button>
            ))}
          </div>
          <Alert>
            Contact details appear once you shortlist someone. This protects workers from spam and scams.
          </Alert>
          <ul className="list" style={{ marginTop: 16 }}>
            {visible.map((applicant) => {
              const ui = APPLICATION_STATUS_UI[applicant.status];
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
                          {[w.town, w.state].filter(Boolean).join(", ") || "Location not given"}
                          {w.primaryCategory && ` · ${categoryLabel(w.primaryCategory)}`}
                          {w.yearsExperience !== null &&
                            ` · ${w.yearsExperience} yr${w.yearsExperience === 1 ? "" : "s"} experience`}
                        </p>
                      </div>
                    </div>
                    <Badge tone={ui.tone} dot>
                      {ui.label}
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
                      <a className="btn btn-outline btn-sm" href={`mailto:${w.email}`}>
                        <Mail size={15} /> Email
                      </a>
                    </div>
                  )}
                  <div className="spread">
                    <span className="subtle">Applied {timeAgo(applicant.createdAt)}</span>
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
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {visible.length === 0 && <p className="muted">No applicants in this group yet.</p>}
        </>
      )}
    </div>
  );
}

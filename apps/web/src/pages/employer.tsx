import {
  EMPLOYMENT_TYPES,
  JOB_CATEGORIES,
  NIGERIAN_STATES,
  jobInputSchema,
  type Applicant,
  type ApplicationStatus,
  type EmployerJob,
  type JobDetail,
} from "@fwp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { Alert, Badge, EmptyState, Field, Options, QueryError, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { APPLICATION_STATUS_UI, JOB_STATUS_UI, categoryLabel, timeAgo } from "../lib/format";
import { useFormSubmit } from "../lib/forms";
import { useToast } from "../lib/toast";
import { usePageTitle } from "../lib/usePageTitle";

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
          <h1>My jobs</h1>
          <p className="muted" style={{ margin: 0 }}>
            Review applicants, edit listings and close jobs once they're filled.
          </p>
        </div>
        <Link className="btn btn-primary" to="/dashboard/jobs/new">
          + Post a job
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState title="You haven't posted any jobs yet">
          <p>Clear pay and a good description attract the best applicants.</p>
          <Link className="btn btn-primary" to="/dashboard/jobs/new">
            Post your first job
          </Link>
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Job</th>
                <th scope="col">Status</th>
                <th scope="col">Applicants</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((job) => {
                const counts = job.applicationCounts;
                const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
                return (
                  <tr key={job.id}>
                    <td>
                      <Link to={`/jobs/${job.id}`}>
                        <strong>{job.title}</strong>
                      </Link>
                      <div className="subtle">
                        {job.town}, {job.state} · {categoryLabel(job.category)} · posted{" "}
                        {timeAgo(job.createdAt)}
                      </div>
                    </td>
                    <td>
                      <Badge tone={JOB_STATUS_UI[job.status].tone}>{JOB_STATUS_UI[job.status].label}</Badge>
                    </td>
                    <td>
                      {total}
                      {counts.submitted ? <span className="subtle"> ({counts.submitted} new)</span> : null}
                    </td>
                    <td>
                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        <Link
                          className="btn btn-primary btn-small"
                          to={`/dashboard/jobs/${job.id}/applicants`}
                        >
                          Applicants
                        </Link>
                        {job.status !== "removed" && (
                          <Link className="btn btn-outline btn-small" to={`/dashboard/jobs/${job.id}/edit`}>
                            Edit
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function JobEditorPage() {
  const { id } = useParams();
  const isEdit = !!id;
  usePageTitle(isEdit ? "Edit job" : "Post a job");
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const existing = useQuery({
    queryKey: ["job", id],
    queryFn: () => api.get<JobDetail>(`/jobs/${id}`),
    enabled: isEdit,
  });

  const { onSubmit, fieldErrors, formError, isPending } = useFormSubmit(
    jobInputSchema,
    (values) =>
      isEdit ? api.patch<{ id: string }>(`/jobs/${id}`, values) : api.post<{ id: string }>("/jobs", values),
    {
      onSuccess: ({ id: jobId }) => {
        queryClient.invalidateQueries({ queryKey: ["employer-jobs"] });
        queryClient.invalidateQueries({ queryKey: ["job", jobId] });
        queryClient.invalidateQueries({ queryKey: ["jobs"] });
        toast(isEdit ? "Job updated." : "Job posted.");
        navigate("/dashboard/jobs");
      },
    },
  );

  if (user && !user.hasProfile) {
    return (
      <Alert tone="warning">
        Add your organisation details before posting a job.{" "}
        <Link to="/dashboard/profile">Complete profile →</Link>
      </Alert>
    );
  }
  if (isEdit && existing.isLoading) return <Spinner />;
  if (isEdit && existing.error) return <QueryError error={existing.error} />;
  const job = existing.data;

  return (
    <div>
      <div className="page-head">
        <h1>{isEdit ? "Edit job" : "Post a job"}</h1>
        <p className="muted">Jobs with clear pay and conditions get more — and better — applicants.</p>
      </div>
      <form className="card form" onSubmit={onSubmit} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <div className="form-grid">
          <Field
            className="full"
            label="Job title"
            name="title"
            error={fieldErrors.title}
            hint="e.g. Poultry attendant, Tractor operator"
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
          <Field label="State" name="state" error={fieldErrors.state}>
            {(props) => (
              <select className="select" defaultValue={job?.state ?? ""} {...props}>
                <Options items={NIGERIAN_STATES} placeholder="Choose a state" />
              </select>
            )}
          </Field>
          <Field label="Town / LGA" name="town" error={fieldErrors.town}>
            {(props) => <input className="input" defaultValue={job?.town} {...props} />}
          </Field>
          <Field label="Minimum pay (₦)" name="payMin" error={fieldErrors.payMin}>
            {(props) => (
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={job?.payMin}
                {...props}
              />
            )}
          </Field>
          <Field label="Maximum pay (₦)" name="payMax" error={fieldErrors.payMax}>
            {(props) => (
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={job?.payMax}
                {...props}
              />
            )}
          </Field>
          <Field label="Paid per" name="payPeriod" error={fieldErrors.payPeriod}>
            {(props) => (
              <select className="select" defaultValue={job?.payPeriod ?? "month"} {...props}>
                <Options items={{ day: "Day", week: "Week", month: "Month" }} />
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
          <Field label="Start date (optional)" name="startDate" error={fieldErrors.startDate}>
            {(props) => (
              <input className="input" type="date" defaultValue={job?.startDate ?? ""} {...props} />
            )}
          </Field>
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
          <Field
            className="full"
            label="Description"
            name="description"
            error={fieldErrors.description}
            hint="Duties, working hours, experience needed, how and when pay is made."
          >
            {(props) => (
              <textarea
                className="textarea"
                rows={8}
                maxLength={5000}
                defaultValue={job?.description}
                {...props}
              />
            )}
          </Field>
          <label className="checkbox">
            <input type="checkbox" name="accommodationProvided" defaultChecked={job?.accommodationProvided} />
            <span>Accommodation provided</span>
          </label>
          <label className="checkbox">
            <input type="checkbox" name="mealsProvided" defaultChecked={job?.mealsProvided} />
            <span>Meals provided</span>
          </label>
        </div>
        <Alert>
          Never ask workers to pay a fee to apply or start work. Listings that do are removed and the account
          suspended.
        </Alert>
        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={isPending}>
            {isPending ? "Saving…" : isEdit ? "Save changes" : "Publish job"}
          </button>
          <Link className="btn btn-outline" to="/dashboard/jobs">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

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

export function JobApplicantsPage() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const toast = useToast();
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
        `Applicant marked as ${APPLICATION_STATUS_UI[status].label.toLowerCase()}. They'll be notified by email.`,
      );
      queryClient.invalidateQueries({ queryKey: ["applicants", id] });
      queryClient.invalidateQueries({ queryKey: ["employer-jobs"] });
    },
    onError: (error) => toast(error.message),
  });

  if (applicants.isLoading || job.isLoading) return <Spinner />;
  if (applicants.error) return <QueryError error={applicants.error} retry={() => applicants.refetch()} />;
  const items = applicants.data?.items ?? [];

  return (
    <div>
      <p>
        <Link to="/dashboard/jobs">← My jobs</Link>
      </p>
      <div className="page-head">
        <h1>Applicants</h1>
        <p className="muted">
          {job.data?.title} · {items.length} applicant{items.length === 1 ? "" : "s"}
        </p>
        <Alert>
          Contact details appear once you shortlist an applicant. This protects workers from spam and scams.
        </Alert>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No applicants yet">
          <p>Share your job link with your network to reach more workers.</p>
        </EmptyState>
      ) : (
        <ul className="list">
          {items.map((applicant) => {
            const ui = APPLICATION_STATUS_UI[applicant.status];
            const w = applicant.worker;
            return (
              <li
                key={applicant.id}
                className="card stack"
                style={{ "--stack": "10px" } as React.CSSProperties}
              >
                <div className="spread">
                  <div>
                    <h2 style={{ fontSize: "1.1rem", marginBottom: 2 }}>{w.fullName}</h2>
                    <p className="subtle" style={{ margin: 0 }}>
                      {[w.town, w.state].filter(Boolean).join(", ") || "Location not given"}
                      {w.primaryCategory && ` · ${categoryLabel(w.primaryCategory)}`}
                      {w.yearsExperience !== null && ` · ${w.yearsExperience} yrs experience`}
                    </p>
                  </div>
                  <Badge tone={ui.tone}>{ui.label}</Badge>
                </div>
                {w.skills.length > 0 && (
                  <div className="tags" style={{ marginTop: 0 }}>
                    {w.skills.map((skill) => (
                      <span key={skill} className="tag">
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
                {applicant.coverNote && (
                  <blockquote className="alert alert-info" style={{ margin: 0 }}>
                    “{applicant.coverNote}”
                  </blockquote>
                )}
                {w.phone && (
                  <p style={{ margin: 0 }}>
                    📞 <a href={`tel:${w.phone}`}>{w.phone}</a> · ✉️{" "}
                    <a href={`mailto:${w.email}`}>{w.email}</a>
                  </p>
                )}
                <div className="spread">
                  <span className="subtle">Applied {timeAgo(applicant.createdAt)}</span>
                  <div className="row">
                    {(NEXT_ACTIONS[applicant.status] ?? []).map((action) => (
                      <button
                        key={action.status}
                        type="button"
                        className={`btn btn-small ${action.primary ? "btn-primary" : "btn-outline"}`}
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
      )}
    </div>
  );
}

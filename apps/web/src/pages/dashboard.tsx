import type { EmployerJob, JobSummary, Paginated, ProfileResponse, WorkerApplication } from "@fwp/shared";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Check,
  FileText,
  Inbox,
  LayoutDashboard,
  Plus,
  Search,
  ShieldCheck,
  Star,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { Alert, Badge, EmptyState, JobCard, Meter, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { APPLICATION_STATUS_UI, JOB_STATUS_UI, greeting, timeAgo } from "../lib/format";
import { usePageTitle } from "../lib/usePageTitle";

export function DashboardLayout() {
  const { user } = useAuth();
  const isEmployer = user?.role === "employer";
  const links: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
    ...(isEmployer
      ? [
          { to: "/dashboard/jobs", label: "My jobs", icon: Briefcase, end: true },
          { to: "/dashboard/jobs/new", label: "Post a job", icon: Plus },
        ]
      : [
          { to: "/dashboard/applications", label: "Applications", icon: FileText },
          { to: "/jobs", label: "Find jobs", icon: Search },
        ]),
    { to: "/dashboard/profile", label: isEmployer ? "Organisation" : "My profile", icon: UserRound },
    { to: "/dashboard/account", label: "Account & privacy", icon: ShieldCheck },
  ];

  return (
    <div className="page">
      <div className="wrap dash-layout">
        <nav className="dash-nav" aria-label="Dashboard">
          <span className="section-label">{isEmployer ? "Employer" : "Worker"}</span>
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  tone?: "gold";
}) {
  return (
    <div className="stat-card">
      <span className={`tile-icon ${tone ?? ""}`}>
        <Icon size={19} />
      </span>
      <strong className="num">{value}</strong>
      <span>{label}</span>
    </div>
  );
}

interface ChecklistItem {
  label: string;
  done: boolean;
}

function ProfileStrength({ items, editLink }: { items: ChecklistItem[]; editLink: string }) {
  const done = items.filter((i) => i.done).length;
  const percent = Math.round((done / items.length) * 100);
  return (
    <section className="panel panel-sm stack" aria-labelledby="strength-title">
      <div className="spread">
        <h2 id="strength-title" className="panel-title" style={{ margin: 0 }}>
          Profile strength
        </h2>
        <strong className="num">{percent}%</strong>
      </div>
      <Meter value={percent} label="Profile strength" />
      {percent === 100 ? (
        <p className="muted" style={{ margin: 0 }}>
          Your profile is complete. Great profiles get noticed first.
        </p>
      ) : (
        <ul className="checklist">
          {items.map((item) => (
            <li key={item.label} className={item.done ? "done" : ""}>
              <span className="check-dot">{item.done && <Check size={13} strokeWidth={3} />}</span>
              {item.label}
            </li>
          ))}
        </ul>
      )}
      {percent < 100 && (
        <Link className="btn btn-outline btn-sm" to={editLink}>
          Improve profile <ArrowRight size={16} />
        </Link>
      )}
    </section>
  );
}

export function DashboardHome() {
  usePageTitle("Dashboard");
  const { user } = useAuth();
  if (!user) return null;
  const firstName = user.fullName.split(" ")[0];

  return (
    <div className="stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1 className="display">
          {greeting()}, {firstName}
        </h1>
        <p className="muted">
          {user.role === "employer"
            ? "Here's what's happening with your jobs."
            : "Here's where your applications stand."}
        </p>
      </div>
      {!user.hasProfile && (
        <Alert tone="warning" title="Finish setting up your account">
          {user.role === "employer"
            ? "Add your organisation details before posting your first job. "
            : "Complete your profile so you can apply for jobs. "}
          <Link to="/dashboard/profile">Complete profile →</Link>
        </Alert>
      )}
      {user.role === "employer" ? <EmployerOverview /> : <WorkerOverview />}
    </div>
  );
}

function WorkerOverview() {
  const applications = useQuery({
    queryKey: ["my-applications"],
    queryFn: () => api.get<{ items: WorkerApplication[] }>("/me/applications"),
  });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => api.get<ProfileResponse>("/me/profile") });
  const worker = profile.data?.worker;
  const recommended = useQuery({
    queryKey: ["jobs", `?category=${worker?.primaryCategory}&pageSize=4`],
    queryFn: () => api.get<Paginated<JobSummary>>(`/jobs?category=${worker!.primaryCategory}&pageSize=4`),
    enabled: !!worker,
  });

  if (applications.isLoading || profile.isLoading) return <Spinner />;
  const items = applications.data?.items ?? [];
  const active = items.filter((a) => a.status === "submitted" || a.status === "shortlisted").length;
  const shortlisted = items.filter((a) => a.status === "shortlisted" || a.status === "hired").length;
  const appliedIds = new Set(items.map((a) => a.job.id));
  const suggestions = (recommended.data?.items ?? []).filter((j) => !appliedIds.has(j.id)).slice(0, 2);

  const checklist: ChecklistItem[] = [
    { label: "Location and main type of work", done: !!worker },
    { label: "At least 3 skills", done: (worker?.skills.length ?? 0) >= 3 },
    { label: "Years of experience", done: (worker?.yearsExperience ?? 0) > 0 },
    { label: "A short bio about you", done: !!worker?.bio },
    { label: "First application sent", done: items.length > 0 },
  ];

  return (
    <>
      <div className="stat-cards">
        <StatCard icon={FileText} value={items.length} label="Applications sent" />
        <StatCard icon={Inbox} value={active} label="In progress" />
        <StatCard icon={Star} value={shortlisted} label="Shortlisted or hired" tone="gold" />
      </div>

      <div className="dash-grid">
        <section className="panel panel-sm" aria-labelledby="recent-title">
          <div className="spread" style={{ marginBottom: 6 }}>
            <h2 id="recent-title" className="panel-title" style={{ margin: 0 }}>
              Recent applications
            </h2>
            {items.length > 0 && (
              <Link className="link" to="/dashboard/applications" style={{ fontSize: "0.9rem" }}>
                View all
              </Link>
            )}
          </div>
          {items.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No applications yet"
              action={
                <Link className="btn btn-primary" to="/jobs">
                  Find jobs
                </Link>
              }
            >
              When you apply for a job, you can follow its progress here.
            </EmptyState>
          ) : (
            <ul className="compact-list">
              {items.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <Link to={`/jobs/${a.job.id}`}>
                    <div className="grow">
                      <strong>{a.job.title}</strong>
                      <span className="subtle">
                        {a.job.organisationName} · {timeAgo(a.createdAt)}
                      </span>
                    </div>
                    <Badge tone={APPLICATION_STATUS_UI[a.status].tone} dot>
                      {APPLICATION_STATUS_UI[a.status].label}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <ProfileStrength items={checklist} editLink="/dashboard/profile" />
      </div>

      {suggestions.length > 0 && (
        <section aria-labelledby="recommended-title">
          <div className="spread" style={{ marginBottom: 14 }}>
            <h2 id="recommended-title" className="display" style={{ fontSize: "1.5rem", margin: 0 }}>
              Recommended for you
            </h2>
            <Link className="link" to={`/jobs?category=${worker?.primaryCategory}`}>
              More like this
            </Link>
          </div>
          <div className="job-list">
            {suggestions.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function EmployerOverview() {
  const jobs = useQuery({
    queryKey: ["employer-jobs"],
    queryFn: () => api.get<{ items: EmployerJob[] }>("/employer/jobs"),
  });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => api.get<ProfileResponse>("/me/profile") });

  if (jobs.isLoading || profile.isLoading) return <Spinner />;
  const items = jobs.data?.items ?? [];
  const employer = profile.data?.employer;
  const open = items.filter((j) => j.status === "open").length;
  const newApplicants = items.reduce((sum, j) => sum + (j.applicationCounts.submitted ?? 0), 0);
  const totalApplicants = items.reduce(
    (sum, j) => sum + Object.values(j.applicationCounts).reduce((a, b) => a + (b ?? 0), 0),
    0,
  );

  const checklist: ChecklistItem[] = [
    { label: "Organisation name and location", done: !!employer },
    { label: "A description of your farm", done: !!employer?.description },
    { label: "First job posted", done: items.length > 0 },
    { label: "Verified by our team", done: !!employer?.verified },
  ];

  return (
    <>
      <div className="stat-cards">
        <StatCard icon={Briefcase} value={open} label="Open jobs" />
        <StatCard icon={Inbox} value={newApplicants} label="New applicants" tone="gold" />
        <StatCard icon={Users} value={totalApplicants} label="Total applicants" />
      </div>

      <div className="dash-grid">
        <section className="panel panel-sm" aria-labelledby="jobs-title">
          <div className="spread" style={{ marginBottom: 6 }}>
            <h2 id="jobs-title" className="panel-title" style={{ margin: 0 }}>
              Your jobs
            </h2>
            <Link className="btn btn-primary btn-sm" to="/dashboard/jobs/new">
              <Plus size={16} /> Post a job
            </Link>
          </div>
          {items.length === 0 ? (
            <EmptyState icon={Briefcase} title="No jobs posted yet">
              Clear pay and a good description attract the best applicants.
            </EmptyState>
          ) : (
            <ul className="compact-list">
              {items.slice(0, 6).map((job) => (
                <li key={job.id}>
                  <Link to={`/dashboard/jobs/${job.id}/applicants`}>
                    <div className="grow">
                      <strong>{job.title}</strong>
                      <span className="subtle">
                        {job.town}, {job.state} · <JobStatusText status={job.status} />
                      </span>
                    </div>
                    {(job.applicationCounts.submitted ?? 0) > 0 && (
                      <Badge tone="new">{job.applicationCounts.submitted} new</Badge>
                    )}
                    <ArrowRight size={17} style={{ color: "var(--text-subtle)" } as CSSProperties} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="stack">
          <ProfileStrength items={checklist} editLink="/dashboard/profile" />
          {employer?.verified && (
            <Alert tone="success" title="Verified employer">
              <span className="icon-inline">
                <BadgeCheck size={16} /> Your jobs show a verified badge.
              </span>
            </Alert>
          )}
        </div>
      </div>
    </>
  );
}

function JobStatusText({ status }: { status: EmployerJob["status"] }) {
  return <>{JOB_STATUS_UI[status].label}</>;
}

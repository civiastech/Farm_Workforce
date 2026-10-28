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
import { Link, NavLink, Outlet } from "react-router";
import { Alert, Badge, EmptyState, JobCard, Meter, Spinner } from "../components/ui";
import { useI18n, type MessageKey } from "../i18n";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { APPLICATION_STATUS_TONE, greetingKey } from "../lib/format";
import { usePageTitle } from "../lib/usePageTitle";

export function DashboardLayout() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isEmployer = user?.role === "employer";
  const links: { to: string; label: MessageKey; icon: LucideIcon; end?: boolean }[] = [
    { to: "/dashboard", label: "dash.overview", icon: LayoutDashboard, end: true },
    ...(isEmployer
      ? [
          { to: "/dashboard/jobs", label: "nav.myJobs" as const, icon: Briefcase, end: true },
          { to: "/dashboard/jobs/new", label: "dash.postJob" as const, icon: Plus },
        ]
      : [
          { to: "/dashboard/applications", label: "dash.applications" as const, icon: FileText },
          { to: "/jobs", label: "dash.findJobs" as const, icon: Search },
        ]),
    { to: "/dashboard/profile", label: isEmployer ? "dash.organisation" : "nav.myProfile", icon: UserRound },
    { to: "/dashboard/account", label: "nav.account", icon: ShieldCheck },
  ];

  return (
    <div className="page">
      <div className="wrap dash-layout">
        <nav className="dash-nav" aria-label={t("nav.dashboard")}>
          <span className="section-label">{isEmployer ? t("dash.employer") : t("dash.worker")}</span>
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon size={18} />
              {t(label)}
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
  label: MessageKey;
  done: boolean;
}

function ProfileStrength({ items, editLink }: { items: ChecklistItem[]; editLink: string }) {
  const { t } = useI18n();
  const done = items.filter((i) => i.done).length;
  const percent = Math.round((done / items.length) * 100);
  return (
    <section className="panel panel-sm stack" aria-labelledby="strength-title">
      <div className="spread">
        <h2 id="strength-title" className="panel-title" style={{ margin: 0 }}>
          {t("dash.strength")}
        </h2>
        <strong className="num">{percent}%</strong>
      </div>
      <Meter value={percent} label={t("dash.strength")} />
      {percent === 100 ? (
        <p className="muted" style={{ margin: 0 }}>
          {t("dash.strengthDone")}
        </p>
      ) : (
        <ul className="checklist">
          {items.map((item) => (
            <li key={item.label} className={item.done ? "done" : ""}>
              <span className="check-dot">{item.done && <Check size={13} strokeWidth={3} />}</span>
              {t(item.label)}
            </li>
          ))}
        </ul>
      )}
      {percent < 100 && (
        <Link className="btn btn-outline btn-sm" to={editLink}>
          {t("dash.improve")} <ArrowRight size={16} />
        </Link>
      )}
    </section>
  );
}

export function DashboardHome() {
  const { t } = useI18n();
  usePageTitle(t("nav.dashboard"));
  const { user } = useAuth();
  if (!user) return null;
  const firstName = user.fullName.split(" ")[0] ?? "";

  return (
    <div className="stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1 className="display">{t("dash.greeting", { greeting: t(greetingKey()), name: firstName })}</h1>
        <p className="muted">{user.role === "employer" ? t("dash.employerLead") : t("dash.workerLead")}</p>
      </div>
      {!user.hasProfile && (
        <Alert tone="warning" title={t("dash.setupTitle")}>
          {user.role === "employer" ? t("dash.setupEmployer") : t("dash.setupWorker")}{" "}
          <Link to="/dashboard/profile">{t("dash.completeProfile")}</Link>
        </Alert>
      )}
      {user.role === "employer" ? <EmployerOverview /> : <WorkerOverview />}
    </div>
  );
}

function WorkerOverview() {
  const { t, timeAgo } = useI18n();
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
    { label: "dash.checkLocation", done: !!worker },
    { label: "dash.checkSkills", done: (worker?.skills.length ?? 0) >= 3 },
    { label: "dash.checkExperience", done: (worker?.yearsExperience ?? 0) > 0 },
    { label: "dash.checkBio", done: !!worker?.bio },
    { label: "dash.checkFirstApp", done: items.length > 0 },
  ];

  return (
    <>
      <div className="stat-cards">
        <StatCard icon={FileText} value={items.length} label={t("dash.statSent")} />
        <StatCard icon={Inbox} value={active} label={t("dash.statProgress")} />
        <StatCard icon={Star} value={shortlisted} label={t("dash.statShortlisted")} tone="gold" />
      </div>

      <div className="dash-grid">
        <section className="panel panel-sm" aria-labelledby="recent-title">
          <div className="spread" style={{ marginBottom: 6 }}>
            <h2 id="recent-title" className="panel-title" style={{ margin: 0 }}>
              {t("dash.recent")}
            </h2>
            {items.length > 0 && (
              <Link className="link" to="/dashboard/applications" style={{ fontSize: "0.9rem" }}>
                {t("common.viewAll")}
              </Link>
            )}
          </div>
          {items.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t("dash.noAppsTitle")}
              action={
                <Link className="btn btn-primary" to="/jobs">
                  {t("dash.findJobs")}
                </Link>
              }
            >
              {t("dash.noAppsBody")}
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
                    <Badge tone={APPLICATION_STATUS_TONE[a.status]} dot>
                      {t(`appStatus.${a.status}`)}
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
              {t("dash.recommended")}
            </h2>
            <Link className="link" to={`/jobs?category=${worker?.primaryCategory}`}>
              {t("dash.moreLikeThis")}
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
  const { t } = useI18n();
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
    { label: "dash.checkOrg", done: !!employer },
    { label: "dash.checkDescription", done: !!employer?.description },
    { label: "dash.checkFirstJob", done: items.length > 0 },
    { label: "dash.checkVerified", done: !!employer?.verified },
  ];

  return (
    <>
      <div className="stat-cards">
        <StatCard icon={Briefcase} value={open} label={t("dash.statOpen")} />
        <StatCard icon={Inbox} value={newApplicants} label={t("dash.statNew")} tone="gold" />
        <StatCard icon={Users} value={totalApplicants} label={t("dash.statTotal")} />
      </div>

      <div className="dash-grid">
        <section className="panel panel-sm" aria-labelledby="jobs-title">
          <div className="spread" style={{ marginBottom: 6 }}>
            <h2 id="jobs-title" className="panel-title" style={{ margin: 0 }}>
              {t("dash.yourJobs")}
            </h2>
            <Link className="btn btn-primary btn-sm" to="/dashboard/jobs/new">
              <Plus size={16} /> {t("dash.postJob")}
            </Link>
          </div>
          {items.length === 0 ? (
            <EmptyState icon={Briefcase} title={t("dash.noJobsTitle")}>
              {t("dash.noJobsBody")}
            </EmptyState>
          ) : (
            <ul className="compact-list">
              {items.slice(0, 6).map((job) => (
                <li key={job.id}>
                  <Link to={`/dashboard/jobs/${job.id}/applicants`}>
                    <div className="grow">
                      <strong>{job.title}</strong>
                      <span className="subtle">
                        {job.town}, {job.state} · {t(`jobStatus.${job.status}`)}
                      </span>
                    </div>
                    {(job.applicationCounts.submitted ?? 0) > 0 && (
                      <Badge tone="new">
                        {t("dash.newCount", { n: job.applicationCounts.submitted ?? 0 })}
                      </Badge>
                    )}
                    <ArrowRight size={17} style={{ color: "var(--text-subtle)" }} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="stack">
          <ProfileStrength items={checklist} editLink="/dashboard/profile" />
          {employer?.verified && (
            <Alert tone="success" title={t("common.verifiedEmployer")}>
              <span className="icon-inline">
                <BadgeCheck size={16} /> {t("dash.verifiedBody")}
              </span>
            </Alert>
          )}
        </div>
      </div>
    </>
  );
}

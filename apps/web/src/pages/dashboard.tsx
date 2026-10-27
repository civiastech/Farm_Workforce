import type { EmployerJob, WorkerApplication } from "@fwp/shared";
import { useQuery } from "@tanstack/react-query";
import { Link, NavLink, Outlet } from "react-router";
import { Alert, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usePageTitle } from "../lib/usePageTitle";

export function DashboardLayout() {
  const { user } = useAuth();
  const isEmployer = user?.role === "employer";
  return (
    <div className="page">
      <div className="wrap dash-layout">
        <nav className="dash-nav" aria-label="Dashboard">
          <NavLink to="/dashboard" end>
            Overview
          </NavLink>
          {isEmployer ? (
            <>
              <NavLink to="/dashboard/jobs" end>
                My jobs
              </NavLink>
              <NavLink to="/dashboard/jobs/new">Post a job</NavLink>
            </>
          ) : (
            <NavLink to="/dashboard/applications">My applications</NavLink>
          )}
          <NavLink to="/dashboard/profile">{isEmployer ? "Organisation" : "My profile"}</NavLink>
          <NavLink to="/dashboard/account">Account &amp; privacy</NavLink>
        </nav>
        <div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export function DashboardHome() {
  usePageTitle("Dashboard");
  const { user } = useAuth();
  if (!user) return null;
  const firstName = user.fullName.split(" ")[0];

  return (
    <div className="stack" style={{ "--stack": "24px" } as React.CSSProperties}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1>Welcome, {firstName}</h1>
        <p className="muted">
          {user.role === "employer"
            ? "Manage your jobs and applicants."
            : "Track your applications and find new work."}
        </p>
      </div>
      {!user.hasProfile && (
        <Alert tone="warning">
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
  if (applications.isLoading) return <Spinner />;
  const items = applications.data?.items ?? [];
  const active = items.filter((a) => a.status === "submitted" || a.status === "shortlisted").length;
  const shortlisted = items.filter((a) => a.status === "shortlisted" || a.status === "hired").length;

  return (
    <>
      <div className="stat-grid">
        <div className="stat">
          <strong>{items.length}</strong>
          <span>Applications</span>
        </div>
        <div className="stat">
          <strong>{active}</strong>
          <span>In progress</span>
        </div>
        <div className="stat">
          <strong>{shortlisted}</strong>
          <span>Shortlisted or hired</span>
        </div>
      </div>
      <div className="row">
        <Link className="btn btn-primary" to="/jobs">
          Find jobs
        </Link>
        <Link className="btn btn-outline" to="/dashboard/applications">
          View applications
        </Link>
      </div>
    </>
  );
}

function EmployerOverview() {
  const jobs = useQuery({
    queryKey: ["employer-jobs"],
    queryFn: () => api.get<{ items: EmployerJob[] }>("/employer/jobs"),
  });
  if (jobs.isLoading) return <Spinner />;
  const items = jobs.data?.items ?? [];
  const open = items.filter((j) => j.status === "open").length;
  const newApplicants = items.reduce((sum, j) => sum + (j.applicationCounts.submitted ?? 0), 0);

  return (
    <>
      <div className="stat-grid">
        <div className="stat">
          <strong>{open}</strong>
          <span>Open jobs</span>
        </div>
        <div className="stat">
          <strong>{newApplicants}</strong>
          <span>New applicants</span>
        </div>
        <div className="stat">
          <strong>{items.length}</strong>
          <span>Total jobs</span>
        </div>
      </div>
      <div className="row">
        <Link className="btn btn-primary" to="/dashboard/jobs/new">
          Post a job
        </Link>
        <Link className="btn btn-outline" to="/dashboard/jobs">
          Manage jobs
        </Link>
      </div>
    </>
  );
}

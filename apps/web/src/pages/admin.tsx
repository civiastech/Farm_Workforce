import { formatPhone } from "@fwp/shared";
import {
  REPORT_REASONS,
  type AdminEmployer,
  type AdminReport,
  type Paginated,
  type ReportStatus,
} from "@fwp/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Building2, Flag, ShieldCheck, ShieldOff, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { Avatar, Badge, EmptyState, Pagination, QueryError, Spinner } from "../components/ui";
import { api, toQuery } from "../lib/api";
import { useI18n } from "../i18n";
import { JOB_STATUS_TONE } from "../lib/format";
import { useToast } from "../lib/toast";
import { usePageTitle } from "../lib/usePageTitle";

export function AdminLayout() {
  return (
    <div className="page">
      <div className="wrap dash-layout">
        <nav className="dash-nav" aria-label="Moderation">
          <span className="section-label">Moderation</span>
          <NavLink to="/admin/reports">
            <Flag size={18} /> Reports
          </NavLink>
          <NavLink to="/admin/employers">
            <Building2 size={18} /> Employers
          </NavLink>
          <NavLink to="/admin/account">
            <UserRound size={18} /> Account
          </NavLink>
        </nav>
        <div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

const REPORT_STATUS_TONE: Record<ReportStatus, "warning" | "success" | "neutral"> = {
  open: "warning",
  resolved: "success",
  dismissed: "neutral",
};

const REPORT_TABS: [ReportStatus | "", string][] = [
  ["open", "Open"],
  ["resolved", "Resolved"],
  ["dismissed", "Dismissed"],
  ["", "All"],
];

export function AdminReportsPage() {
  const { t, formatDate, timeAgo } = useI18n();
  usePageTitle("Reports");
  const [status, setStatus] = useState<ReportStatus | "">("open");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const toast = useToast();
  const query = toQuery({ status, page, pageSize: 20 });

  const reports = useQuery({
    queryKey: ["admin-reports", query],
    queryFn: () => api.get<Paginated<AdminReport>>(`/admin/reports${query}`),
    placeholderData: keepPreviousData,
  });

  const resolve = useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: "resolved" | "dismissed"; removeJob: boolean }) =>
      api.patch(`/admin/reports/${id}`, body),
    onSuccess: (_d, vars) => {
      toast(vars.removeJob ? "Job removed and report resolved." : `Report ${vars.status}.`);
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (error) => toast(error.message),
  });

  return (
    <div>
      <div className="page-head">
        <h1 className="display">Reports</h1>
        <p className="muted">Reports from users about jobs. Every action is recorded in the audit log.</p>
      </div>
      <div className="tabs" role="tablist" aria-label="Filter reports">
        {REPORT_TABS.map(([key, label]) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={status === key}
            onClick={() => {
              setStatus(key);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {reports.isLoading ? (
        <Spinner />
      ) : reports.error ? (
        <QueryError error={reports.error} retry={() => reports.refetch()} />
      ) : reports.data?.items.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Nothing to review">
          No reports with this status. Nice work.
        </EmptyState>
      ) : (
        <>
          <ul className="list">
            {reports.data?.items.map((report) => (
              <li key={report.id} className="list-card">
                <div className="spread">
                  <div className="row">
                    <span
                      className="tile-icon"
                      style={{ background: "var(--danger-bg)", color: "var(--danger-text)" }}
                    >
                      <Flag size={18} />
                    </span>
                    <div>
                      <h3>{REPORT_REASONS[report.reason]}</h3>
                      <span className="subtle">
                        {timeAgo(report.createdAt)} · by {report.reporter?.fullName ?? "a deleted user"}
                      </span>
                    </div>
                  </div>
                  <Badge tone={REPORT_STATUS_TONE[report.status]} dot>
                    {report.status}
                  </Badge>
                </div>
                {report.job ? (
                  <p className="row" style={{ margin: 0 }}>
                    <Link className="link" to={`/jobs/${report.job.id}`}>
                      {report.job.title}
                    </Link>
                    <span className="subtle">{report.job.organisationName}</span>
                    <Badge tone={JOB_STATUS_TONE[report.job.status]}>
                      {t(`jobStatus.${report.job.status}`)}
                    </Badge>
                  </p>
                ) : (
                  <p className="subtle" style={{ margin: 0 }}>
                    The job has since been deleted.
                  </p>
                )}
                {report.details && <blockquote className="quote">{report.details}</blockquote>}
                {report.resolvedAt && (
                  <p className="subtle" style={{ margin: 0 }}>
                    Closed {formatDate(report.resolvedAt)}
                  </p>
                )}
                {report.status === "open" && (
                  <div className="row">
                    {report.job && report.job.status !== "removed" && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={resolve.isPending}
                        onClick={() => resolve.mutate({ id: report.id, status: "resolved", removeJob: true })}
                      >
                        Remove job
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate({ id: report.id, status: "resolved", removeJob: false })}
                    >
                      Mark resolved
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate({ id: report.id, status: "dismissed", removeJob: false })}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={page} totalPages={reports.data?.totalPages ?? 1} onChange={setPage} />
        </>
      )}
    </div>
  );
}

export function AdminEmployersPage() {
  const { formatDate } = useI18n();
  usePageTitle("Employers");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const toast = useToast();
  const employers = useQuery({
    queryKey: ["admin-employers", page],
    queryFn: () => api.get<Paginated<AdminEmployer>>(`/admin/employers${toQuery({ page, pageSize: 25 })}`),
    placeholderData: keepPreviousData,
  });

  const verify = useMutation({
    mutationFn: ({ userId, verified }: { userId: string; verified: boolean }) =>
      api.patch(`/admin/employers/${userId}/verification`, { verified }),
    onSuccess: (_d, vars) => {
      toast(vars.verified ? "Employer verified." : "Verification removed.");
      queryClient.invalidateQueries({ queryKey: ["admin-employers"] });
    },
    onError: (error) => toast(error.message),
  });

  if (employers.isLoading) return <Spinner />;
  if (employers.error) return <QueryError error={employers.error} retry={() => employers.refetch()} />;

  return (
    <div>
      <div className="page-head">
        <h1 className="display">Employers</h1>
        <p className="muted">
          Verify an employer only after checking their identity and business (e.g. CAC registration, a call or
          visit). Unverified employers are listed first.
        </p>
      </div>
      <ul className="list">
        {employers.data?.items.map((e) => (
          <li key={e.userId} className="list-card">
            <div className="spread">
              <div className="row" style={{ flexWrap: "nowrap", minWidth: 0 }}>
                <Avatar name={e.organisationName} size={44} />
                <div style={{ minWidth: 0 }}>
                  <h3 className="icon-inline">
                    {e.organisationName}
                    {e.verified && <BadgeCheck size={17} className="verified" aria-label="Verified" />}
                  </h3>
                  <span className="subtle">
                    {e.fullName} · {e.email ?? (e.phone && formatPhone(e.phone))} · {e.state}
                  </span>
                </div>
              </div>
              <div className="row">
                <span className="chip">
                  {e.openJobs} open job{e.openJobs === 1 ? "" : "s"}
                </span>
                <span className="subtle">Joined {formatDate(e.createdAt)}</span>
                <button
                  type="button"
                  className={`btn btn-sm ${e.verified ? "btn-ghost" : "btn-primary"}`}
                  disabled={verify.isPending}
                  onClick={() => verify.mutate({ userId: e.userId, verified: !e.verified })}
                >
                  {e.verified ? <ShieldOff size={15} /> : <BadgeCheck size={15} />}
                  {e.verified ? "Remove verification" : "Verify"}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Pagination page={page} totalPages={employers.data?.totalPages ?? 1} onChange={setPage} />
    </div>
  );
}

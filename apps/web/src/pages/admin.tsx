import {
  REPORT_REASONS,
  type AdminEmployer,
  type AdminReport,
  type Paginated,
  type ReportStatus,
} from "@fwp/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { Badge, EmptyState, Pagination, QueryError, Spinner } from "../components/ui";
import { api, toQuery } from "../lib/api";
import { JOB_STATUS_UI, formatDate } from "../lib/format";
import { useToast } from "../lib/toast";
import { usePageTitle } from "../lib/usePageTitle";

export function AdminLayout() {
  return (
    <div className="page">
      <div className="wrap dash-layout">
        <nav className="dash-nav" aria-label="Moderation">
          <NavLink to="/admin/reports">Reports</NavLink>
          <NavLink to="/admin/employers">Employers</NavLink>
          <NavLink to="/admin/account">Account</NavLink>
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

export function AdminReportsPage() {
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
      <div className="page-head spread">
        <div>
          <h1>Reports</h1>
          <p className="muted" style={{ margin: 0 }}>
            Reports from users about jobs. Every action is recorded in the audit log.
          </p>
        </div>
        <div>
          <label className="visually-hidden" htmlFor="report-status">
            Filter by status
          </label>
          <select
            id="report-status"
            className="select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ReportStatus | "");
              setPage(1);
            }}
          >
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
            <option value="">All</option>
          </select>
        </div>
      </div>
      {reports.isLoading ? (
        <Spinner />
      ) : reports.error ? (
        <QueryError error={reports.error} retry={() => reports.refetch()} />
      ) : reports.data?.items.length === 0 ? (
        <EmptyState title="Nothing to review">
          <p>No reports with this status.</p>
        </EmptyState>
      ) : (
        <>
          <ul className="list">
            {reports.data?.items.map((report) => (
              <li key={report.id} className="card stack" style={{ "--stack": "10px" } as React.CSSProperties}>
                <div className="spread">
                  <strong>{REPORT_REASONS[report.reason]}</strong>
                  <Badge tone={REPORT_STATUS_TONE[report.status]}>{report.status}</Badge>
                </div>
                {report.job ? (
                  <p style={{ margin: 0 }}>
                    Job: <Link to={`/jobs/${report.job.id}`}>{report.job.title}</Link> by{" "}
                    {report.job.organisationName}{" "}
                    <Badge tone={JOB_STATUS_UI[report.job.status].tone}>
                      {JOB_STATUS_UI[report.job.status].label}
                    </Badge>
                  </p>
                ) : (
                  <p className="subtle">Job has been deleted.</p>
                )}
                {report.details && (
                  <p className="alert alert-info" style={{ margin: 0 }}>
                    {report.details}
                  </p>
                )}
                <p className="subtle" style={{ margin: 0 }}>
                  Reported {formatDate(report.createdAt)} by {report.reporter?.fullName ?? "a deleted user"}
                  {report.resolvedAt && ` · closed ${formatDate(report.resolvedAt)}`}
                </p>
                {report.status === "open" && (
                  <div className="row">
                    {report.job && report.job.status !== "removed" && (
                      <button
                        type="button"
                        className="btn btn-danger btn-small"
                        disabled={resolve.isPending}
                        onClick={() => resolve.mutate({ id: report.id, status: "resolved", removeJob: true })}
                      >
                        Remove job
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline btn-small"
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate({ id: report.id, status: "resolved", removeJob: false })}
                    >
                      Mark resolved
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
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
        <h1>Employers</h1>
        <p className="muted">
          Verify an employer only after checking their identity and business (e.g. CAC registration, a call or
          visit).
        </p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Organisation</th>
              <th scope="col">Contact</th>
              <th scope="col">Open jobs</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {employers.data?.items.map((e) => (
              <tr key={e.userId}>
                <td>
                  <strong>{e.organisationName}</strong>
                  <div className="subtle">
                    {e.state} · joined {formatDate(e.createdAt)}
                  </div>
                </td>
                <td>
                  {e.fullName}
                  <div className="subtle">{e.email}</div>
                </td>
                <td>{e.openJobs}</td>
                <td>
                  <div className="row">
                    <Badge tone={e.verified ? "success" : "warning"}>
                      {e.verified ? "Verified" : "Unverified"}
                    </Badge>
                    <button
                      type="button"
                      className="btn btn-outline btn-small"
                      disabled={verify.isPending}
                      onClick={() => verify.mutate({ userId: e.userId, verified: !e.verified })}
                    >
                      {e.verified ? "Unverify" : "Verify"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={employers.data?.totalPages ?? 1} onChange={setPage} />
    </div>
  );
}

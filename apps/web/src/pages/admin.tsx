import {
  REPORT_REASONS,
  formatPhone,
  type AdminEmployer,
  type AdminNotification,
  type AdminOverview,
  type AdminReport,
  type AdminUser,
  type Paginated,
  type ReportStatus,
  type Role,
} from "@fwp/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  BadgeCheck,
  Briefcase,
  Building2,
  FileText,
  Flag,
  Gauge,
  HandHeart,
  Mail,
  MessageSquareWarning,
  MessageSquareText,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldOff,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet } from "react-router";
import {
  Alert,
  Avatar,
  Badge,
  EmptyState,
  Pagination,
  QueryError,
  Spinner,
  StatCard,
} from "../components/ui";
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
          <NavLink to="/admin/overview">
            <Gauge size={18} /> Overview
          </NavLink>
          <NavLink to="/admin/reports">
            <Flag size={18} /> Reports
          </NavLink>
          <NavLink to="/admin/employers">
            <Building2 size={18} /> Employers
          </NavLink>
          <NavLink to="/admin/users">
            <Users size={18} /> Users
          </NavLink>
          <NavLink to="/admin/messages">
            <MessageSquareText size={18} /> Messages
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
                    {report.status[0]!.toUpperCase() + report.status.slice(1)}
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

// ---------------------------------------------------------------- Overview

export function AdminOverviewPage() {
  usePageTitle("Overview");
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => api.get<AdminOverview>("/admin/overview"),
  });
  if (overview.error) return <QueryError error={overview.error} retry={() => overview.refetch()} />;
  if (!overview.data) return <Spinner />;
  const o = overview.data;

  return (
    <div className="stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1 className="display">Overview</h1>
        <p className="muted">What needs attention, and how the platform is doing.</p>
      </div>
      {(o.openReports > 0 || o.failedMessages > 0 || o.unverifiedEmployers > 0) && (
        <div className="stack">
          {o.openReports > 0 && (
            <Alert tone="warning" title={`${o.openReports} open report${o.openReports === 1 ? "" : "s"}`}>
              Jobs reported by users are waiting for review. <Link to="/admin/reports">Review reports</Link>
            </Alert>
          )}
          {o.failedMessages > 0 && (
            <Alert
              tone="error"
              title={`${o.failedMessages} message${o.failedMessages === 1 ? "" : "s"} could not be delivered`}
            >
              Some SMS or emails failed after every retry.{" "}
              <Link to="/admin/messages">See failed messages</Link>
            </Alert>
          )}
          {o.unverifiedEmployers > 0 && (
            <Alert
              tone="info"
              title={`${o.unverifiedEmployers} employer${o.unverifiedEmployers === 1 ? "" : "s"} not verified yet`}
            >
              <Link to="/admin/employers">Check employers</Link>
            </Alert>
          )}
        </div>
      )}
      <div className="stat-cards">
        <StatCard icon={Users} value={o.workers} label="Workers with a profile" />
        <StatCard icon={Building2} value={o.employers} label="Employers with a profile" />
        <StatCard icon={UserPlus} value={o.signupsLast7Days} label="Sign-ups, last 7 days" tone="gold" />
        <StatCard icon={Briefcase} value={o.openJobs} label="Open jobs" />
        <StatCard icon={FileText} value={o.applicationsLast7Days} label="Applications, last 7 days" />
        <StatCard icon={HandHeart} value={o.hiresLast30Days} label="Hires, last 30 days" tone="gold" />
      </div>
      {o.pendingMessages > 0 && (
        <p className="subtle" style={{ margin: 0 }}>
          {o.pendingMessages} message{o.pendingMessages === 1 ? " is" : "s are"} being retried after a failed
          attempt.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Users

const ROLE_FILTERS: [Role | "", string][] = [
  ["", "Everyone"],
  ["worker", "Workers"],
  ["employer", "Employers"],
  ["admin", "Moderators"],
];

export function AdminUsersPage() {
  const { formatDate, timeAgo } = useI18n();
  usePageTitle("Users");
  const queryClient = useQueryClient();
  const toast = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminUser | null>(null);
  const query = toQuery({ q: search, role, page, pageSize: 25 });

  const users = useQuery({
    queryKey: ["admin-users", query],
    queryFn: () => api.get<Paginated<AdminUser>>(`/admin/users${query}`),
    placeholderData: keepPreviousData,
  });

  const suspension = useMutation({
    mutationFn: ({ id, ...body }: { id: string; suspended: boolean; reason?: string }) =>
      api.patch<{ closedJobs: number }>(`/admin/users/${id}/suspension`, body),
    onSuccess: (result, vars) => {
      dialogRef.current?.close();
      toast(
        vars.suspended
          ? `Account suspended${result.closedJobs ? ` and ${result.closedJobs} open job${result.closedJobs === 1 ? "" : "s"} closed` : ""}.`
          : "Account restored. They can sign in again.",
      );
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (error) => toast(error.message),
  });

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(String(new FormData(event.currentTarget).get("q") ?? "").trim());
    setPage(1);
  }

  function confirmSuspend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target) return;
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    suspension.mutate({ id: target.id, suspended: true, reason: reason || undefined });
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="display">Users</h1>
        <p className="muted">
          Find any account by name, email or phone number. Suspending signs the person out everywhere, blocks
          sign-in, and takes an employer&apos;s open jobs out of search.
        </p>
      </div>
      <form className="row admin-search" role="search" onSubmit={onSearch}>
        <input
          className="input"
          name="q"
          type="search"
          defaultValue={search}
          placeholder="Name, email or 0803 123 4567"
          aria-label="Search users"
        />
        <button className="btn btn-primary" type="submit">
          <Search size={17} /> Search
        </button>
      </form>
      <div className="tabs" role="tablist" aria-label="Filter by role">
        {ROLE_FILTERS.map(([key, label]) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={role === key}
            onClick={() => {
              setRole(key);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {users.isLoading ? (
        <Spinner />
      ) : users.error ? (
        <QueryError error={users.error} retry={() => users.refetch()} />
      ) : users.data?.items.length === 0 ? (
        <EmptyState icon={Search} title="No matching users">
          Try part of a name, a full email address, or a phone number.
        </EmptyState>
      ) : (
        <>
          <ul className="list">
            {users.data?.items.map((u) => (
              <li key={u.id} className="list-card">
                <div className="spread">
                  <div className="row" style={{ flexWrap: "nowrap", minWidth: 0 }}>
                    <Avatar name={u.fullName} size={44} />
                    <div style={{ minWidth: 0 }}>
                      <h3 className="icon-inline">
                        {u.fullName}
                        <Badge
                          tone={u.role === "employer" ? "info" : u.role === "admin" ? "warning" : "neutral"}
                        >
                          {u.role}
                        </Badge>
                        {u.suspended && (
                          <Badge tone="danger" dot>
                            suspended
                          </Badge>
                        )}
                      </h3>
                      <span className="subtle" style={{ display: "block", overflowWrap: "anywhere" }}>
                        {[
                          u.phone && `${formatPhone(u.phone)}${u.phoneVerified ? "" : " (not verified)"}`,
                          u.email,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                  </div>
                  <div className="row">
                    <span className="subtle">
                      Joined {formatDate(u.createdAt)}
                      {u.lastLoginAt ? ` · last seen ${timeAgo(u.lastLoginAt)}` : ""}
                    </span>
                    {u.role !== "admin" &&
                      (u.suspended ? (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={suspension.isPending}
                          onClick={() => suspension.mutate({ id: u.id, suspended: false })}
                        >
                          <RotateCcw size={15} /> Restore
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setTarget(u);
                            dialogRef.current?.showModal();
                          }}
                        >
                          <Ban size={15} /> Suspend
                        </button>
                      ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} totalPages={users.data?.totalPages ?? 1} onChange={setPage} />
        </>
      )}

      <dialog ref={dialogRef} aria-labelledby="suspend-title">
        <form className="form" onSubmit={confirmSuspend}>
          <div>
            <span
              className="tile-icon dialog-icon"
              style={{ background: "var(--danger-bg)", color: "var(--danger-text)" }}
            >
              <Ban size={20} />
            </span>
            <h2 id="suspend-title" style={{ fontSize: "1.3rem", margin: 0 }}>
              Suspend {target?.fullName}?
            </h2>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              They&apos;ll be signed out and can&apos;t sign in until you restore the account.
              {target?.role === "employer" && " Their open jobs will be closed."}
            </p>
          </div>
          <div className="field">
            <label htmlFor="suspend-reason">Reason (kept in the audit log)</label>
            <textarea
              id="suspend-reason"
              className="textarea"
              name="reason"
              rows={3}
              maxLength={500}
              placeholder="e.g. Asked applicants to pay a registration fee"
            />
          </div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-outline" onClick={() => dialogRef.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="btn btn-danger" disabled={suspension.isPending}>
              Suspend account
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

// ---------------------------------------------------------------- Messages

const MESSAGE_TABS: ["failed" | "pending" | "sent", string][] = [
  ["failed", "Failed"],
  ["pending", "Retrying"],
  ["sent", "Sent"],
];

export function AdminMessagesPage() {
  const { timeAgo } = useI18n();
  usePageTitle("Messages");
  const queryClient = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<"failed" | "pending" | "sent">("failed");
  const [page, setPage] = useState(1);
  const query = toQuery({ status, page, pageSize: 25 });

  const messages = useQuery({
    queryKey: ["admin-messages", query],
    queryFn: () => api.get<Paginated<AdminNotification>>(`/admin/notifications${query}`),
    placeholderData: keepPreviousData,
  });
  const retry = useMutation({
    mutationFn: (id: string) => api.post(`/admin/notifications/${id}/retry`),
    onSuccess: () => {
      toast("Queued again. It will be sent within a few seconds.");
      queryClient.invalidateQueries({ queryKey: ["admin-messages"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (error) => toast(error.message),
  });

  return (
    <div>
      <div className="page-head">
        <h1 className="display">Messages</h1>
        <p className="muted">
          SMS and emails about applications and jobs. Each is retried for about two hours before it counts as
          failed. A failed SMS often means the number is switched off or wrong.
        </p>
      </div>
      <div className="tabs" role="tablist" aria-label="Filter messages">
        {MESSAGE_TABS.map(([key, label]) => (
          <button
            key={key}
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
      {messages.isLoading ? (
        <Spinner />
      ) : messages.error ? (
        <QueryError error={messages.error} retry={() => messages.refetch()} />
      ) : messages.data?.items.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={status === "sent" ? "No messages sent yet" : "Nothing here"}>
          {status === "failed" ? "Every message has been delivered." : "No messages in this list."}
        </EmptyState>
      ) : (
        <>
          <ul className="list">
            {messages.data?.items.map((m) => (
              <li key={m.id} className="list-card">
                <div className="spread">
                  <div className="row" style={{ flexWrap: "nowrap", minWidth: 0 }}>
                    <span className="tile-icon">
                      {m.channel === "sms" ? <MessageSquareText size={18} /> : <Mail size={18} />}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <h3>
                        {m.user?.fullName ?? "Deleted user"}{" "}
                        <span className="subtle" style={{ fontWeight: 500 }}>
                          {m.channel === "sms" ? formatPhone(m.recipient) : m.recipient}
                        </span>
                      </h3>
                      <span className="subtle">
                        {m.channel.toUpperCase()} · {timeAgo(m.createdAt)} · {m.attempts} attempt
                        {m.attempts === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  {m.status !== "sent" && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={retry.isPending}
                      onClick={() => retry.mutate(m.id)}
                    >
                      <RotateCcw size={15} /> Retry now
                    </button>
                  )}
                </div>
                <blockquote className="quote">{m.subject ? `${m.subject}: ${m.body}` : m.body}</blockquote>
                {m.lastError && (
                  <p className="field-error icon-inline" style={{ margin: 0 }}>
                    <MessageSquareWarning size={15} /> {m.lastError}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={page} totalPages={messages.data?.totalPages ?? 1} onChange={setPage} />
        </>
      )}
    </div>
  );
}

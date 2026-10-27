import type { ApplicationStatus, WorkerApplication } from "@fwp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, MapPin, PartyPopper } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Badge, EmptyState, QueryError, Spinner, StatusTracker } from "../components/ui";
import { api } from "../lib/api";
import { APPLICATION_STATUS_UI, PERIOD_LABEL, payRange, timeAgo } from "../lib/format";
import { useToast } from "../lib/toast";
import { usePageTitle } from "../lib/usePageTitle";

type Tab = "active" | "all" | ApplicationStatus;
const ACTIVE: ApplicationStatus[] = ["submitted", "shortlisted"];

export function MyApplicationsPage() {
  usePageTitle("My applications");
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("all");
  const applications = useQuery({
    queryKey: ["my-applications"],
    queryFn: () => api.get<{ items: WorkerApplication[] }>("/me/applications"),
  });
  const withdraw = useMutation({
    mutationFn: (id: string) => api.post(`/applications/${id}/withdraw`),
    onSuccess: () => {
      toast("Application withdrawn. You can apply again any time while the job is open.");
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
    },
    onError: (error) => toast(error.message),
  });

  if (applications.isLoading) return <Spinner />;
  if (applications.error)
    return <QueryError error={applications.error} retry={() => applications.refetch()} />;
  const items = applications.data?.items ?? [];

  const counts = {
    all: items.length,
    active: items.filter((a) => ACTIVE.includes(a.status)).length,
    hired: items.filter((a) => a.status === "hired").length,
  };
  const visible = items.filter((a) =>
    tab === "all" ? true : tab === "active" ? ACTIVE.includes(a.status) : a.status === tab,
  );

  return (
    <div>
      <div className="page-head">
        <h1 className="display">My applications</h1>
        <p className="muted">We'll email you whenever an employer updates your application.</p>
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
        <>
          <div className="tabs" role="tablist" aria-label="Filter applications">
            {(
              [
                ["all", "All", counts.all],
                ["active", "In progress", counts.active],
                ["hired", "Hired", counts.hired],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
              >
                {label} <span className="count">{count}</span>
              </button>
            ))}
          </div>
          <ul className="list">
            {visible.map((application) => {
              const ui = APPLICATION_STATUS_UI[application.status];
              const canWithdraw = ACTIVE.includes(application.status);
              return (
                <li key={application.id} className="list-card">
                  <div className="spread" style={{ alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <h3>
                        <Link to={`/jobs/${application.job.id}`}>{application.job.title}</Link>
                      </h3>
                      <p className="subtle icon-inline" style={{ margin: 0, flexWrap: "wrap" }}>
                        {application.job.organisationName} · <MapPin size={14} /> {application.job.town},{" "}
                        {application.job.state}
                      </p>
                    </div>
                    <Badge tone={ui.tone} dot>
                      {ui.label}
                    </Badge>
                  </div>
                  <div className="spread">
                    <strong className="num">
                      {payRange(application.job.payMin, application.job.payMax)}{" "}
                      <span className="subtle" style={{ fontWeight: 500 }}>
                        {PERIOD_LABEL[application.job.payPeriod]}
                      </span>
                    </strong>
                    <span className="subtle">Applied {timeAgo(application.createdAt)}</span>
                  </div>
                  {application.status !== "withdrawn" && application.status !== "rejected" && (
                    <StatusTracker status={application.status} />
                  )}
                  {application.status === "shortlisted" && (
                    <p className="alert alert-success" style={{ margin: 0 }}>
                      <PartyPopper size={18} />
                      You've been shortlisted — the employer can now see your phone number and may call you.
                    </p>
                  )}
                  {canWithdraw && (
                    <div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={withdraw.isPending}
                        onClick={() => withdraw.mutate(application.id)}
                      >
                        Withdraw application
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {visible.length === 0 && (
            <p className="muted">
              No applications in this view.{" "}
              <button type="button" className="link-button link" onClick={() => setTab("all")}>
                Show all
              </button>
            </p>
          )}
        </>
      )}
    </div>
  );
}

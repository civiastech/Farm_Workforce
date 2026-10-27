import { formatPay, type WorkerApplication } from "@fwp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { Badge, EmptyState, QueryError, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { APPLICATION_STATUS_UI, timeAgo } from "../lib/format";
import { useToast } from "../lib/toast";
import { usePageTitle } from "../lib/usePageTitle";

export function MyApplicationsPage() {
  usePageTitle("My applications");
  const queryClient = useQueryClient();
  const toast = useToast();
  const applications = useQuery({
    queryKey: ["my-applications"],
    queryFn: () => api.get<{ items: WorkerApplication[] }>("/me/applications"),
  });
  const withdraw = useMutation({
    mutationFn: (id: string) => api.post(`/applications/${id}/withdraw`),
    onSuccess: () => {
      toast("Application withdrawn.");
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
    },
    onError: (error) => toast(error.message),
  });

  if (applications.isLoading) return <Spinner />;
  if (applications.error)
    return <QueryError error={applications.error} retry={() => applications.refetch()} />;
  const items = applications.data?.items ?? [];

  return (
    <div>
      <div className="page-head">
        <h1>My applications</h1>
        <p className="muted">We'll email you when an employer updates your application.</p>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No applications yet">
          <p>When you apply for a job, you can follow its progress here.</p>
          <Link className="btn btn-primary" to="/jobs">
            Find jobs
          </Link>
        </EmptyState>
      ) : (
        <ul className="list">
          {items.map((application) => {
            const ui = APPLICATION_STATUS_UI[application.status];
            const canWithdraw = application.status === "submitted" || application.status === "shortlisted";
            return (
              <li key={application.id} className="card">
                <div className="spread">
                  <div>
                    <h2 style={{ fontSize: "1.05rem", marginBottom: 4 }}>
                      <Link to={`/jobs/${application.job.id}`}>{application.job.title}</Link>
                    </h2>
                    <p className="subtle" style={{ margin: 0 }}>
                      {application.job.organisationName} · {application.job.town}, {application.job.state} ·{" "}
                      {formatPay(application.job.payMin, application.job.payMax, application.job.payPeriod)}
                    </p>
                  </div>
                  <Badge tone={ui.tone}>{ui.label}</Badge>
                </div>
                <div className="spread" style={{ marginTop: 12 }}>
                  <span className="subtle">Applied {timeAgo(application.createdAt)}</span>
                  {canWithdraw && (
                    <button
                      type="button"
                      className="btn btn-outline btn-small"
                      disabled={withdraw.isPending}
                      onClick={() => withdraw.mutate(application.id)}
                    >
                      Withdraw
                    </button>
                  )}
                </div>
                {application.status === "shortlisted" && (
                  <p className="subtle" style={{ marginTop: 8, marginBottom: 0 }}>
                    🎉 You've been shortlisted — the employer can now see your phone number and may call you.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

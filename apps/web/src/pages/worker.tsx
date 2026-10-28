import type { ApplicationStatus, WorkerApplication } from "@fwp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, MapPin, PartyPopper } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Badge, EmptyState, QueryError, Spinner, StatusTracker } from "../components/ui";
import { useI18n, type MessageKey } from "../i18n";
import { api } from "../lib/api";
import { APPLICATION_STATUS_TONE, payRange } from "../lib/format";
import { useToast } from "../lib/toast";
import { usePageTitle } from "../lib/usePageTitle";

type Tab = "all" | "active" | "hired";
const ACTIVE: ApplicationStatus[] = ["submitted", "shortlisted"];

export function MyApplicationsPage() {
  const { t, timeAgo, errorMessage } = useI18n();
  usePageTitle(t("apps.title"));
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
      toast(t("apps.withdrawn"));
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
    },
    onError: (error) => toast(errorMessage(error)),
  });

  if (applications.isLoading) return <Spinner />;
  if (applications.error)
    return <QueryError error={applications.error} retry={() => applications.refetch()} />;
  const items = applications.data?.items ?? [];

  const tabs: [Tab, MessageKey, number][] = [
    ["all", "apps.all", items.length],
    ["active", "apps.inProgress", items.filter((a) => ACTIVE.includes(a.status)).length],
    ["hired", "apps.hired", items.filter((a) => a.status === "hired").length],
  ];
  const visible = items.filter((a) =>
    tab === "all" ? true : tab === "active" ? ACTIVE.includes(a.status) : a.status === "hired",
  );

  return (
    <div>
      <div className="page-head">
        <h1 className="display">{t("apps.title")}</h1>
        <p className="muted">{t("apps.lead")}</p>
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
        <>
          <div className="tabs" role="tablist" aria-label={t("apps.tabs")}>
            {tabs.map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
              >
                {t(label)} <span className="count">{count}</span>
              </button>
            ))}
          </div>
          <ul className="list">
            {visible.map((application) => {
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
                    <Badge tone={APPLICATION_STATUS_TONE[application.status]} dot>
                      {t(`appStatus.${application.status}`)}
                    </Badge>
                  </div>
                  <div className="spread">
                    <strong className="num">
                      {payRange(application.job.payMin, application.job.payMax)}{" "}
                      <span className="subtle" style={{ fontWeight: 500 }}>
                        {t(`period.${application.job.payPeriod}`)}
                      </span>
                    </strong>
                    <span className="subtle">
                      {t("time.applied", { time: timeAgo(application.createdAt) })}
                    </span>
                  </div>
                  {application.status !== "withdrawn" && application.status !== "rejected" && (
                    <StatusTracker status={application.status} />
                  )}
                  {application.status === "shortlisted" && (
                    <p className="alert alert-success" style={{ margin: 0 }}>
                      <PartyPopper size={18} />
                      {t("apps.shortlistedNote")}
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
                        {t("apps.withdraw")}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {visible.length === 0 && (
            <p className="muted">
              {t("apps.noneInView")}{" "}
              <button type="button" className="link-button link" onClick={() => setTab("all")}>
                {t("apps.showAll")}
              </button>
            </p>
          )}
        </>
      )}
    </div>
  );
}

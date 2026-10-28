import {
  JOB_CATEGORY_KEYS,
  NIGERIAN_STATES,
  type JobSummary,
  type Paginated,
  type PlatformStats,
} from "@fwp/shared";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Check,
  HandCoins,
  Lock,
  MapPin,
  Search,
  ShieldCheck,
  Smartphone,
  Sprout,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { CategoryIcon, FieldsIllustration, JobCard, JobCardSkeleton, Options } from "../components/ui";
import { useI18n, type MessageKey } from "../i18n";
import { api, toQuery } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usePageTitle } from "../lib/usePageTitle";

const numberFormat = new Intl.NumberFormat("en-NG");

const HOME_PRINCIPLES: { icon: LucideIcon; key: "free" | "pay" | "privacy" | "verified" }[] = [
  { icon: HandCoins, key: "free" },
  { icon: Wallet, key: "pay" },
  { icon: Lock, key: "privacy" },
  { icon: BadgeCheck, key: "verified" },
];

export function HowSteps({ side }: { side: "w" | "e" }) {
  const { t } = useI18n();
  return (
    <ol className="steps">
      {[1, 2, 3].map((n) => (
        <li key={n}>
          <div>
            <strong>{t(`how.${side}${n}t` as MessageKey)}</strong>
            <p>{t(`how.${side}${n}b` as MessageKey)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function HomePage() {
  usePageTitle(undefined);
  const { t, tn } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => api.get<PlatformStats>("/stats") });
  const latest = useQuery({
    queryKey: ["jobs", "?pageSize=6"],
    queryFn: () => api.get<Paginated<JobSummary>>("/jobs?pageSize=6"),
  });
  const jobs = latest.data?.items ?? [];
  const stat = (value: number | undefined) => (value === undefined ? "–" : numberFormat.format(value));
  const hireLink = user?.role === "employer" ? "/dashboard/jobs/new" : "/register?role=employer";

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    navigate(
      `/jobs${toQuery({ q: String(data.get("q") ?? "").trim(), state: String(data.get("state") ?? "") })}`,
    );
  }

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="hero-pill">
              <span className="dot">
                <Sprout size={14} />
              </span>
              {t("home.pill")}
            </span>
            <h1 className="display">{tn("home.title", { em: <em>{t("home.titleEm")}</em> })}</h1>
            <p className="hero-lead">{t("home.lead")}</p>

            <form className="hero-search" role="search" onSubmit={search}>
              <label className="input-icon">
                <span className="visually-hidden">{t("home.searchPlaceholder")}</span>
                <Search size={18} aria-hidden="true" />
                <input className="input" name="q" type="search" placeholder={t("home.searchPlaceholder")} />
              </label>
              <label className="input-icon divider">
                <span className="visually-hidden">{t("common.state")}</span>
                <MapPin size={18} aria-hidden="true" />
                <select className="select" name="state" defaultValue="">
                  <Options items={NIGERIAN_STATES} placeholder={t("common.allStates")} />
                </select>
              </label>
              <button className="btn btn-primary btn-lg" type="submit">
                {t("home.findJobs")}
              </button>
            </form>

            <ul className="hero-trust">
              {(["home.trust1", "home.trust2", "home.trust3"] as const).map((key) => (
                <li key={key}>
                  <Check size={16} strokeWidth={3} /> {t(key)}
                </li>
              ))}
            </ul>
            <p style={{ marginTop: 24, marginBottom: 0 }}>
              <Link className="btn btn-on-deep" to={hireLink}>
                {t("home.imHiring")} <ArrowRight size={17} />
              </Link>
            </p>
          </div>

          <div className="hero-visual" aria-hidden="true">
            {jobs.slice(0, 2).map((job) => (
              <JobCard key={job.id} job={{ ...job, id: undefined }} />
            ))}
            {latest.isLoading && (
              <>
                <JobCardSkeleton />
                <JobCardSkeleton />
              </>
            )}
            <div className="float-stat top">
              <span className="tile" style={{ background: "var(--brand-tint)", color: "var(--brand-ink)" }}>
                <Lock size={18} />
              </span>
              <div style={{ lineHeight: 1.35 }}>
                <b>{t("home.bubbleTitle")}</b>
                <br />
                <span className="subtle">{t("home.bubbleText")}</span>
              </div>
            </div>
          </div>
        </div>
        <FieldsIllustration className="hero-fields" />
      </section>

      <div className="wrap">
        <div className="stats-band">
          <div>
            <strong>{stat(stats.data?.openJobs)}</strong>
            <span>{t("home.statOpenJobs")}</span>
          </div>
          <div>
            <strong>{stat(stats.data?.employers)}</strong>
            <span>{t("home.statEmployers")}</span>
          </div>
          <div>
            <strong>{stat(stats.data?.workers)}</strong>
            <span>{t("home.statWorkers")}</span>
          </div>
          <div>
            <strong>₦0</strong>
            <span>{t("home.statFree")}</span>
          </div>
        </div>
      </div>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">{t("home.catEyebrow")}</span>
              <h2 className="display">{t("home.catTitle")}</h2>
              <p className="muted">{t("home.catLead")}</p>
            </div>
            <Link className="btn btn-outline" to="/jobs">
              {t("home.allJobs")} <ArrowRight size={17} />
            </Link>
          </div>
          <div className="category-grid">
            {JOB_CATEGORY_KEYS.map((key) => (
              <Link key={key} className="category-tile" to={`/jobs?category=${key}`}>
                <span className="tile-icon">
                  <CategoryIcon category={key} />
                </span>
                {t(`category.${key}`)}
                <ArrowRight className="arrow" size={17} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">{t("home.howEyebrow")}</span>
              <h2 className="display">{t("home.howTitle")}</h2>
            </div>
          </div>
          <div className="how-grid">
            <article className="how-card">
              <span className="tile-icon lg">
                <Users size={26} />
              </span>
              <h3 className="display">{t("how.forWorkers")}</h3>
              <HowSteps side="w" />
              <Link className="btn btn-primary" to="/register?role=worker" style={{ marginTop: 28 }}>
                {t("how.createProfile")}
              </Link>
            </article>
            <article className="how-card">
              <span className="tile-icon lg gold">
                <Briefcase size={26} />
              </span>
              <h3 className="display">{t("how.forEmployers")}</h3>
              <HowSteps side="e" />
              <Link className="btn btn-outline" to={hireLink} style={{ marginTop: 28 }}>
                {t("how.postJob")}
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">{t("home.latestEyebrow")}</span>
              <h2 className="display">{t("home.latestTitle")}</h2>
            </div>
            <Link className="btn btn-outline" to="/jobs">
              {t("home.browseAll")} <ArrowRight size={17} />
            </Link>
          </div>
          <div className="job-list">
            {latest.isLoading
              ? Array.from({ length: 4 }, (_, i) => <JobCardSkeleton key={i} />)
              : jobs.slice(0, 4).map((job) => <JobCard key={job.id} job={job} />)}
          </div>
          {!latest.isLoading && jobs.length === 0 && <p className="muted">{t("home.noJobs")}</p>}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="principles">
            <span className="eyebrow">{t("home.promiseEyebrow")}</span>
            <h2 className="display" style={{ fontSize: "clamp(1.9rem, 4vw, 2.8rem)", marginTop: 10 }}>
              {t("home.promiseTitle")}
            </h2>
            <div className="principle-grid">
              {HOME_PRINCIPLES.map(({ icon: Icon, key }) => (
                <div key={key}>
                  <span className="tile-icon">
                    <Icon size={22} />
                  </span>
                  <h3>{t(`principle.${key}.title`)}</h3>
                  <p>{t(`principle.${key}.body`)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="cta-band">
            <div>
              <h2 className="display">{t("home.ctaTitle")}</h2>
              <p>{t("home.ctaBody")}</p>
            </div>
            <div className="row">
              <Link className="btn btn-primary btn-lg" to={hireLink}>
                {t("how.postJob")} <ArrowRight size={18} />
              </Link>
              <Link className="btn btn-ghost" to="/trust" style={{ color: "inherit" }}>
                <ShieldCheck size={18} /> {t("home.ourStandards")}
              </Link>
            </div>
          </div>
          <p className="subtle icon-inline" style={{ marginTop: 18 }}>
            <Smartphone size={15} /> {t("home.noApp")}
          </p>
        </div>
      </section>
    </>
  );
}

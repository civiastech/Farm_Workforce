import {
  JOB_CATEGORIES,
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
} from "lucide-react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { CategoryIcon, FieldsIllustration, JobCard, JobCardSkeleton, Options } from "../components/ui";
import { api, toQuery } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usePageTitle } from "../lib/usePageTitle";

const numberFormat = new Intl.NumberFormat("en-NG");

export function HomePage() {
  usePageTitle(undefined);
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
              Nigeria's agricultural workforce network
            </span>
            <h1 className="display">
              Good farms need <em>great people.</em>
            </h1>
            <p className="hero-lead">
              Find real farm jobs with clear pay, or hire skilled, reliable workers. One trustworthy platform
              for the people who grow Nigeria.
            </p>

            <form className="hero-search" role="search" onSubmit={search}>
              <label className="input-icon">
                <span className="visually-hidden">Job, skill or employer</span>
                <Search size={18} aria-hidden="true" />
                <input className="input" name="q" type="search" placeholder="Job, skill or employer" />
              </label>
              <label className="input-icon divider">
                <span className="visually-hidden">State</span>
                <MapPin size={18} aria-hidden="true" />
                <select className="select" name="state" defaultValue="">
                  <Options items={NIGERIAN_STATES} placeholder="All states" />
                </select>
              </label>
              <button className="btn btn-primary btn-lg" type="submit">
                Find jobs
              </button>
            </form>

            <ul className="hero-trust">
              <li>
                <Check size={16} strokeWidth={3} /> Always free for workers
              </li>
              <li>
                <Check size={16} strokeWidth={3} /> Pay shown on every job
              </li>
              <li>
                <Check size={16} strokeWidth={3} /> Your number stays private
              </li>
            </ul>
            <p style={{ marginTop: 24, marginBottom: 0 }}>
              <Link className="btn btn-on-deep" to={hireLink}>
                I'm hiring workers <ArrowRight size={17} />
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
                <b>Shortlisted!</b>
                <br />
                <span className="subtle">Now your number is shared</span>
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
            <span>Open jobs</span>
          </div>
          <div>
            <strong>{stat(stats.data?.employers)}</strong>
            <span>Farms &amp; employers</span>
          </div>
          <div>
            <strong>{stat(stats.data?.workers)}</strong>
            <span>Worker profiles</span>
          </div>
          <div>
            <strong>₦0</strong>
            <span>Cost to apply, ever</span>
          </div>
        </div>
      </div>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Browse by category</span>
              <h2 className="display">Work for every skill.</h2>
              <p className="muted">From first-season planting to running the whole farm.</p>
            </div>
            <Link className="btn btn-outline" to="/jobs">
              All jobs <ArrowRight size={17} />
            </Link>
          </div>
          <div className="category-grid">
            {JOB_CATEGORY_KEYS.map((key) => (
              <Link key={key} className="category-tile" to={`/jobs?category=${key}`}>
                <span className="tile-icon">
                  <CategoryIcon category={key} />
                </span>
                {JOB_CATEGORIES[key]}
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
              <span className="eyebrow">How it works</span>
              <h2 className="display">Simple for both sides.</h2>
            </div>
          </div>
          <div className="how-grid">
            <article className="how-card">
              <span className="tile-icon lg">
                <Users size={26} />
              </span>
              <h3 className="display">For workers</h3>
              <ol className="steps">
                <li>
                  <div>
                    <strong>Create a free profile</strong>
                    <p>Your skills, experience and where you can work. It takes two minutes.</p>
                  </div>
                </li>
                <li>
                  <div>
                    <strong>Apply in one tap</strong>
                    <p>Every job shows the pay, location, housing and meals up front.</p>
                  </div>
                </li>
                <li>
                  <div>
                    <strong>Get shortlisted</strong>
                    <p>Only then does the employer see your number — and we email you every update.</p>
                  </div>
                </li>
              </ol>
              <Link className="btn btn-primary" to="/register?role=worker" style={{ marginTop: 28 }}>
                Create free profile
              </Link>
            </article>
            <article className="how-card">
              <span className="tile-icon lg gold">
                <Briefcase size={26} />
              </span>
              <h3 className="display">For employers</h3>
              <ol className="steps">
                <li>
                  <div>
                    <strong>Post a job in minutes</strong>
                    <p>Describe the role, pay and conditions. See a live preview as you type.</p>
                  </div>
                </li>
                <li>
                  <div>
                    <strong>Review real applicants</strong>
                    <p>Compare skills, experience and location side by side.</p>
                  </div>
                </li>
                <li>
                  <div>
                    <strong>Shortlist and hire</strong>
                    <p>Shortlisting unlocks contact details so you can call your best candidates.</p>
                  </div>
                </li>
              </ol>
              <Link className="btn btn-outline" to={hireLink} style={{ marginTop: 28 }}>
                Post a job
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow">Latest opportunities</span>
              <h2 className="display">Fresh jobs this week.</h2>
            </div>
            <Link className="btn btn-outline" to="/jobs">
              Browse all jobs <ArrowRight size={17} />
            </Link>
          </div>
          <div className="job-list">
            {latest.isLoading
              ? Array.from({ length: 4 }, (_, i) => <JobCardSkeleton key={i} />)
              : jobs.slice(0, 4).map((job) => <JobCard key={job.id} job={job} />)}
          </div>
          {!latest.isLoading && jobs.length === 0 && (
            <p className="muted">New jobs are on their way. Create a profile to be ready when they arrive.</p>
          )}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="principles">
            <span className="eyebrow">Our promise</span>
            <h2 className="display" style={{ fontSize: "clamp(1.9rem, 4vw, 2.8rem)", marginTop: 10 }}>
              Built on trust, not guesswork.
            </h2>
            <div className="principle-grid">
              <div>
                <span className="tile-icon">
                  <HandCoins size={22} />
                </span>
                <h3>Free for workers</h3>
                <p>No fees to register, apply or start work. Anyone who asks is breaking our rules.</p>
              </div>
              <div>
                <span className="tile-icon">
                  <Wallet size={22} />
                </span>
                <h3>Pay is always shown</h3>
                <p>Every job states its pay range and how often it's paid. No "negotiable".</p>
              </div>
              <div>
                <span className="tile-icon">
                  <Lock size={22} />
                </span>
                <h3>Privacy by default</h3>
                <p>Your phone number is shared only when an employer shortlists you.</p>
              </div>
              <div>
                <span className="tile-icon">
                  <BadgeCheck size={22} />
                </span>
                <h3>Verified employers</h3>
                <p>Our team checks employers and reviews every report from the community.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="cta-band">
            <div>
              <h2 className="display">Hiring for the season?</h2>
              <p>
                Post your first job free and start receiving applications from skilled farm workers near you
                today.
              </p>
            </div>
            <div className="row">
              <Link className="btn btn-primary btn-lg" to={hireLink}>
                Post a job <ArrowRight size={18} />
              </Link>
              <Link className="btn btn-ghost" to="/trust" style={{ color: "inherit" }}>
                <ShieldCheck size={18} /> Our standards
              </Link>
            </div>
          </div>
          <p className="subtle icon-inline" style={{ marginTop: 18 }}>
            <Smartphone size={15} /> Works on any phone browser — no app to install.
          </p>
        </div>
      </section>
    </>
  );
}

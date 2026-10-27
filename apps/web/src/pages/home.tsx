import type { JobSummary, Paginated, PlatformStats } from "@fwp/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { JobCard } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usePageTitle } from "../lib/usePageTitle";

const numberFormat = new Intl.NumberFormat("en-NG");

export function HomePage() {
  usePageTitle(undefined);
  const { user } = useAuth();
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => api.get<PlatformStats>("/stats") });
  const latest = useQuery({
    queryKey: ["jobs", { pageSize: 4 }],
    queryFn: () => api.get<Paginated<JobSummary>>("/jobs?pageSize=4"),
  });

  const stat = (value: number | undefined) => (value === undefined ? "—" : numberFormat.format(value));

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">Nigeria's agricultural workforce network</p>
            <h1>
              Good farms need
              <br />
              great people.
            </h1>
            <p className="hero-lead">
              Find real farm jobs with clear pay. Hire skilled, reliable workers. One simple, trustworthy
              platform for the people who grow Nigeria.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-accent" to="/jobs">
                Find a farm job →
              </Link>
              <Link
                className="btn btn-outline"
                to={user?.role === "employer" ? "/dashboard/jobs/new" : "/register?role=employer"}
              >
                I'm hiring workers
              </Link>
            </div>
            <ul className="trustline">
              <li>Always free for workers</li>
              <li>Pay shown on every job</li>
              <li>Your number stays private until you're shortlisted</li>
            </ul>
          </div>

          <div className="hero-panel" aria-label="Platform at a glance">
            <div className="spread" style={{ marginBottom: 16 }}>
              <strong>Live on the platform</strong>
              <span className="badge badge-success">● Live</span>
            </div>
            <div className="stat-grid">
              <div className="stat">
                <strong>{stat(stats.data?.openJobs)}</strong>
                <span>Open jobs</span>
              </div>
              <div className="stat">
                <strong>{stat(stats.data?.employers)}</strong>
                <span>Employers</span>
              </div>
              <div className="stat">
                <strong>{stat(stats.data?.workers)}</strong>
                <span>Worker profiles</span>
              </div>
            </div>
            <ol className="steps" style={{ marginTop: 22 }}>
              <li>
                <div>
                  <strong>Create a free profile</strong>
                  <div className="subtle">Your skills, experience and where you can work.</div>
                </div>
              </li>
              <li>
                <div>
                  <strong>Apply in one tap</strong>
                  <div className="subtle">Every job shows the pay, location and conditions up front.</div>
                </div>
              </li>
              <li>
                <div>
                  <strong>Get shortlisted</strong>
                  <div className="subtle">Only then does the employer see your phone number.</div>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="kicker">One platform. Two sides. Better outcomes.</p>
              <h2>Less time searching. More time growing.</h2>
              <p className="muted">
                Built around how agricultural work actually happens — seasonal demand, practical skills, local
                communities and the need for trust.
              </p>
            </div>
          </div>
          <div className="cards">
            <article className="card">
              <div className="card-icon" aria-hidden="true">
                🔎
              </div>
              <h3>Find the right people</h3>
              <p className="muted">
                Post a job in minutes. Review applicants' skills, experience and location, then shortlist the
                best fit.
              </p>
            </article>
            <article className="card">
              <div className="card-icon" aria-hidden="true">
                🛡️
              </div>
              <h3>Trust, built in</h3>
              <p className="muted">
                Verified employers, transparent pay, one-tap reporting and human moderation keep scams off the
                platform.
              </p>
            </article>
            <article className="card">
              <div className="card-icon" aria-hidden="true">
                📱
              </div>
              <h3>Made for phones</h3>
              <p className="muted">
                Fast on low-cost Android phones and slow networks. No app to install — it works in any
                browser.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="kicker">Latest opportunities</p>
              <h2>Find work that fits.</h2>
            </div>
            <Link className="btn btn-primary" to="/jobs">
              Browse all jobs
            </Link>
          </div>
          {latest.isLoading ? (
            <div className="job-list">
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ) : latest.data?.items.length ? (
            <div className="job-list">
              {latest.data.items.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <p className="muted">New jobs are on their way. Create a profile to be ready when they arrive.</p>
          )}
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="cta">
            <div>
              <h2>Built on trust, not guesswork.</h2>
              <p>
                Worker privacy, clear pay, fair conditions and a way to report problems are core features —
                not premium extras.
              </p>
            </div>
            <Link className="btn btn-primary" to="/trust">
              Our trust principles
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

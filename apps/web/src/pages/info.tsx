import type { ReactNode } from "react";
import { Link } from "react-router";
import { Alert } from "../components/ui";
import { usePageTitle } from "../lib/usePageTitle";

function InfoPage({ title, kicker, children }: { title: string; kicker?: string; children: ReactNode }) {
  usePageTitle(title);
  return (
    <div className="page">
      <div className="wrap" style={{ maxWidth: 820 }}>
        <div className="page-head">
          {kicker && <p className="kicker">{kicker}</p>}
          <h1>{title}</h1>
        </div>
        <div className="stack">{children}</div>
      </div>
    </div>
  );
}

const LegalDraftNotice = () => (
  <Alert tone="warning">
    <strong>Draft for legal review.</strong> This text describes how the platform is built to work. It must be
    reviewed by a qualified Nigerian lawyer (including against the Nigeria Data Protection Act 2023) before
    public launch.
  </Alert>
);

export function HowItWorksPage() {
  return (
    <InfoPage title="How it works" kicker="Simple for both sides">
      <section className="card">
        <h2>For workers</h2>
        <ol className="steps">
          <li>
            <div>
              <strong>Create a free account and profile.</strong> Tell employers your skills, experience and
              where you can work.
            </div>
          </li>
          <li>
            <div>
              <strong>Browse and apply.</strong> Every job shows the pay, location, and whether accommodation
              or meals are provided.
            </div>
          </li>
          <li>
            <div>
              <strong>Get shortlisted.</strong> Employers see your phone number only once they shortlist you.
              You'll get an email whenever your application changes.
            </div>
          </li>
        </ol>
      </section>
      <section className="card">
        <h2>For employers</h2>
        <ol className="steps">
          <li>
            <div>
              <strong>Register and add your farm details.</strong> Our team verifies employers so workers can
              trust your listings.
            </div>
          </li>
          <li>
            <div>
              <strong>Post a job in minutes.</strong> Clear pay and conditions attract better applicants.
            </div>
          </li>
          <li>
            <div>
              <strong>Review, shortlist and hire.</strong> Compare applicants' skills and experience, then
              contact your shortlist directly.
            </div>
          </li>
        </ol>
      </section>
      <div className="row">
        <Link className="btn btn-primary" to="/register?role=worker">
          I'm looking for work
        </Link>
        <Link className="btn btn-outline" to="/register?role=employer">
          I'm hiring
        </Link>
      </div>
    </InfoPage>
  );
}

export function TrustPage() {
  return (
    <InfoPage title="Trust & safety" kicker="Our principles">
      <p className="muted">Trust is the product. These commitments are built into how the platform works.</p>
      <div className="cards">
        <article className="card">
          <h3>Free for workers, always</h3>
          <p className="muted">
            Workers never pay to register or apply. Any employer asking for a fee, deposit, uniform payment or
            "training cost" is breaking our rules — report them.
          </p>
        </article>
        <article className="card">
          <h3>Your number stays private</h3>
          <p className="muted">
            Employers see your phone and email only after they shortlist you. You can download or delete your
            data at any time.
          </p>
        </article>
        <article className="card">
          <h3>Pay is always shown</h3>
          <p className="muted">
            Every job must state its pay range and how often it is paid. No "pay negotiable" listings.
          </p>
        </article>
        <article className="card">
          <h3>Human moderation</h3>
          <p className="muted">
            Reports are reviewed by our team. Scam and exploitative listings are removed, and verified badges
            are only given after checks.
          </p>
        </article>
      </div>
      <Alert tone="warning">
        <strong>We will never ask for your NIN, BVN, bank PIN or OTP.</strong> If anyone claiming to be from
        Farm Workforce asks for these, it is a scam.
      </Alert>
    </InfoPage>
  );
}

export function PrivacyPage() {
  return (
    <InfoPage title="Privacy notice">
      <LegalDraftNotice />
      <h2>What we collect</h2>
      <p>
        Account details (name, email, mobile number, preferred language); profile details you choose to add
        (state, town, skills, experience, a short bio; or your organisation's details); jobs you post and
        applications you make; and basic security information (sign-in times, IP address and browser, used to
        protect your account).
      </p>
      <h2>Why we use it</h2>
      <p>
        To run the service you asked for: showing jobs, sending applications to employers, and notifying you
        about changes. To keep the platform safe: preventing fraud, investigating reports and keeping an audit
        trail of moderation actions.
      </p>
      <h2>Who can see it</h2>
      <p>
        Employers see an applicant's name, location, skills, experience, bio and message. Phone number and
        email are shared only when the employer shortlists or hires that applicant. We do not sell personal
        data.
      </p>
      <h2>How long we keep it</h2>
      <p>
        For as long as your account is open. When you delete your account we delete your profile, applications
        and jobs immediately. Security logs are kept for a limited period to protect the platform.
      </p>
      <h2>Your rights</h2>
      <p>
        You can see and correct your data in your dashboard, download a copy (Account &amp; privacy → Download
        my data), and delete your account at any time. You may also contact us or the Nigeria Data Protection
        Commission.
      </p>
    </InfoPage>
  );
}

export function TermsPage() {
  return (
    <InfoPage title="Terms of use">
      <LegalDraftNotice />
      <h2>Using the platform</h2>
      <p>
        You must give accurate information, keep your password private, and use the platform only to find or
        offer genuine agricultural work.
      </p>
      <h2>Rules for employers</h2>
      <ul>
        <li>Never charge workers any fee to apply, be hired or start work.</li>
        <li>State real pay and conditions, and honour them.</li>
        <li>Use applicants' contact details only to discuss the job they applied for.</li>
        <li>Comply with Nigerian labour law, including minimum wage and safety requirements.</li>
      </ul>
      <h2>Rules for everyone</h2>
      <p>No harassment, discrimination, misleading content or attempts to misuse other people's data.</p>
      <h2>Moderation</h2>
      <p>
        We may remove content and suspend accounts that break these rules. Farm Workforce connects workers and
        employers; it is not a party to the employment relationship.
      </p>
    </InfoPage>
  );
}

export function NotFoundPage() {
  usePageTitle("Page not found");
  return (
    <div className="page wrap" style={{ textAlign: "center" }}>
      <h1>Page not found</h1>
      <p className="muted">The page you're looking for doesn't exist or has moved.</p>
      <div className="row" style={{ justifyContent: "center" }}>
        <Link className="btn btn-primary" to="/">
          Go home
        </Link>
        <Link className="btn btn-outline" to="/jobs">
          Browse jobs
        </Link>
      </div>
    </div>
  );
}

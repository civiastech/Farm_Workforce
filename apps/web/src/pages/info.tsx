import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Flag,
  HandCoins,
  Lock,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Alert } from "../components/ui";
import { usePageTitle } from "../lib/usePageTitle";

function InfoHero({ eyebrow, title, lead }: { eyebrow: string; title: ReactNode; lead?: string }) {
  return (
    <section className="info-hero">
      <div className="wrap">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="display">{title}</h1>
        {lead && <p>{lead}</p>}
      </div>
    </section>
  );
}

const LegalDraftNotice = () => (
  <Alert tone="warning" title="Draft for legal review">
    This text describes how the platform is built to work. It must be reviewed by a qualified Nigerian lawyer
    (including against the Nigeria Data Protection Act 2023) before public launch.
  </Alert>
);

export function HowItWorksPage() {
  usePageTitle("How it works");
  return (
    <>
      <InfoHero
        eyebrow="How it works"
        title={
          <>
            Simple for <em>both sides.</em>
          </>
        }
        lead="Whether you're looking for your next season of work or hiring a whole team, it takes minutes to get started."
      />
      <section className="section">
        <div className="wrap how-grid">
          <article className="how-card">
            <span className="tile-icon lg">
              <Users size={26} />
            </span>
            <h2 className="display" style={{ fontSize: "1.6rem", margin: "14px 0 22px" }}>
              For workers
            </h2>
            <ol className="steps">
              <li>
                <div>
                  <strong>Create a free account and profile</strong>
                  <p>Tell employers your skills, experience and where you can work.</p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Browse and apply</strong>
                  <p>Every job shows the pay, location, and whether housing or meals are provided.</p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Track your progress</strong>
                  <p>See when you're shortlisted or hired, and get an email at every step.</p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Get the call</strong>
                  <p>Employers see your phone number only once they shortlist you.</p>
                </div>
              </li>
            </ol>
            <Link className="btn btn-primary" to="/register?role=worker" style={{ marginTop: 28 }}>
              I'm looking for work <ArrowRight size={17} />
            </Link>
          </article>
          <article className="how-card">
            <span className="tile-icon lg gold">
              <Briefcase size={26} />
            </span>
            <h2 className="display" style={{ fontSize: "1.6rem", margin: "14px 0 22px" }}>
              For employers
            </h2>
            <ol className="steps">
              <li>
                <div>
                  <strong>Register and describe your farm</strong>
                  <p>Our team verifies employers so workers can trust your listings.</p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Post a job in minutes</strong>
                  <p>A live preview shows exactly what workers will see.</p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Review applicants</strong>
                  <p>Compare skills, experience and location, and read each applicant's message.</p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Shortlist and hire</strong>
                  <p>Shortlisting unlocks contact details so you can call your best candidates.</p>
                </div>
              </li>
            </ol>
            <Link className="btn btn-outline" to="/register?role=employer" style={{ marginTop: 28 }}>
              I'm hiring <ArrowRight size={17} />
            </Link>
          </article>
        </div>
      </section>
    </>
  );
}

const PRINCIPLES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: HandCoins,
    title: "Free for workers, always",
    body: "Workers never pay to register or apply. Any employer asking for a fee, deposit, uniform payment or “training cost” is breaking our rules — report them.",
  },
  {
    icon: Lock,
    title: "Your number stays private",
    body: "Employers see your phone and email only after they shortlist you. You can download or delete your data at any time.",
  },
  {
    icon: Wallet,
    title: "Pay is always shown",
    body: "Every job must state its pay range and how often it is paid. No “pay negotiable” listings.",
  },
  {
    icon: BadgeCheck,
    title: "Verified employers",
    body: "The verified badge is only given after our team checks the business behind the listing.",
  },
  {
    icon: Flag,
    title: "Report anything, instantly",
    body: "Every job has a report button. Reports are confidential and reviewed by real people.",
  },
  {
    icon: Users,
    title: "Fair treatment",
    body: "No discrimination or harassment. Employers must follow Nigerian labour law, including minimum wage and safety rules.",
  },
];

export function TrustPage() {
  usePageTitle("Trust & safety");
  return (
    <>
      <InfoHero
        eyebrow="Trust & safety"
        title={
          <>
            Trust is <em>the product.</em>
          </>
        }
        lead="These commitments are built into how the platform works — not bolted on."
      />
      <section className="section">
        <div className="wrap stack-lg">
          <div
            className="category-grid"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))" }}
          >
            {PRINCIPLES.map(({ icon: Icon, title, body }) => (
              <article key={title} className="panel">
                <span className="tile-icon">
                  <Icon size={22} />
                </span>
                <h2 style={{ fontSize: "1.1rem", margin: "16px 0 8px" }}>{title}</h2>
                <p className="muted" style={{ margin: 0 }}>
                  {body}
                </p>
              </article>
            ))}
          </div>
          <Alert tone="warning" title="We will never ask for your NIN, BVN, bank PIN or OTP.">
            If anyone claiming to be from Farm Workforce asks for these, it is a scam. Do not share them.
          </Alert>
        </div>
      </section>
    </>
  );
}

export function PrivacyPage() {
  usePageTitle("Privacy notice");
  return (
    <>
      <InfoHero eyebrow="Legal" title="Privacy notice" />
      <section className="section-tight">
        <div className="wrap article">
          <LegalDraftNotice />
          <h2 className="display">What we collect</h2>
          <p>
            Account details (name, email, mobile number, preferred language); profile details you choose to
            add (state, town, skills, experience, a short bio; or your organisation's details); jobs you post
            and applications you make; and basic security information (sign-in times, IP address and browser,
            used to protect your account).
          </p>
          <h2 className="display">Why we use it</h2>
          <p>
            To run the service you asked for: showing jobs, sending applications to employers, and notifying
            you about changes. To keep the platform safe: preventing fraud, investigating reports and keeping
            an audit trail of moderation actions.
          </p>
          <h2 className="display">Who can see it</h2>
          <p>
            Employers see an applicant's name, location, skills, experience, bio and message. Phone number and
            email are shared only when the employer shortlists or hires that applicant. We do not sell
            personal data.
          </p>
          <h2 className="display">How long we keep it</h2>
          <p>
            For as long as your account is open. When you delete your account we delete your profile,
            applications and jobs immediately. Security logs are kept for a limited period to protect the
            platform.
          </p>
          <h2 className="display">Your rights</h2>
          <p>
            You can see and correct your data in your dashboard, download a copy (Account &amp; privacy →
            Download my data), and delete your account at any time. You may also contact us or the Nigeria
            Data Protection Commission.
          </p>
        </div>
      </section>
    </>
  );
}

export function TermsPage() {
  usePageTitle("Terms of use");
  return (
    <>
      <InfoHero eyebrow="Legal" title="Terms of use" />
      <section className="section-tight">
        <div className="wrap article">
          <LegalDraftNotice />
          <h2 className="display">Using the platform</h2>
          <p>
            You must give accurate information, keep your password private, and use the platform only to find
            or offer genuine agricultural work.
          </p>
          <h2 className="display">Rules for employers</h2>
          <ul>
            <li>Never charge workers any fee to apply, be hired or start work.</li>
            <li>State real pay and conditions, and honour them.</li>
            <li>Use applicants' contact details only to discuss the job they applied for.</li>
            <li>Comply with Nigerian labour law, including minimum wage and safety requirements.</li>
          </ul>
          <h2 className="display">Rules for everyone</h2>
          <p>No harassment, discrimination, misleading content or attempts to misuse other people's data.</p>
          <h2 className="display">Moderation</h2>
          <p>
            We may remove content and suspend accounts that break these rules. Farm Workforce connects workers
            and employers; it is not a party to the employment relationship.
          </p>
        </div>
      </section>
    </>
  );
}

export function NotFoundPage() {
  usePageTitle("Page not found");
  return (
    <div className="wrap not-found">
      <div className="code">404</div>
      <h1 className="display" style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)" }}>
        This field is empty.
      </h1>
      <p className="muted">The page you're looking for doesn't exist or has moved.</p>
      <div className="row" style={{ justifyContent: "center", marginTop: 24 }}>
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

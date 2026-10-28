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
import { useI18n } from "../i18n";
import { usePageTitle } from "../lib/usePageTitle";
import { HowSteps } from "./home";

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

/** Legal text is kept in English until a lawyer has approved translations. */
function LegalNotices() {
  const { t, lang } = useI18n();
  return (
    <div className="stack">
      {lang !== "en" && <Alert>{t("legal.englishOnly")}</Alert>}
      <Alert tone="warning" title="Draft for legal review">
        This text describes how the platform is built to work. It must be reviewed by a qualified Nigerian
        lawyer (including against the Nigeria Data Protection Act 2023) before public launch.
      </Alert>
    </div>
  );
}

export function HowItWorksPage() {
  const { t, tn } = useI18n();
  usePageTitle(t("nav.howItWorks"));
  return (
    <>
      <InfoHero
        eyebrow={t("nav.howItWorks")}
        title={tn("how.title", { em: <em>{t("how.titleEm")}</em> })}
        lead={t("how.lead")}
      />
      <section className="section">
        <div className="wrap how-grid">
          <article className="how-card">
            <span className="tile-icon lg">
              <Users size={26} />
            </span>
            <h2 className="display" style={{ fontSize: "1.6rem", margin: "14px 0 22px" }}>
              {t("how.forWorkers")}
            </h2>
            <HowSteps side="w" />
            <Link className="btn btn-primary" to="/register?role=worker" style={{ marginTop: 28 }}>
              {t("how.imLooking")} <ArrowRight size={17} />
            </Link>
          </article>
          <article className="how-card">
            <span className="tile-icon lg gold">
              <Briefcase size={26} />
            </span>
            <h2 className="display" style={{ fontSize: "1.6rem", margin: "14px 0 22px" }}>
              {t("how.forEmployers")}
            </h2>
            <HowSteps side="e" />
            <Link className="btn btn-outline" to="/register?role=employer" style={{ marginTop: 28 }}>
              {t("how.imHiring")} <ArrowRight size={17} />
            </Link>
          </article>
        </div>
      </section>
    </>
  );
}

const PRINCIPLES: { icon: LucideIcon; key: "free" | "privacy" | "pay" | "verified" | "report" | "fair" }[] = [
  { icon: HandCoins, key: "free" },
  { icon: Lock, key: "privacy" },
  { icon: Wallet, key: "pay" },
  { icon: BadgeCheck, key: "verified" },
  { icon: Flag, key: "report" },
  { icon: Users, key: "fair" },
];

export function TrustPage() {
  const { t, tn } = useI18n();
  usePageTitle(t("nav.trust"));
  return (
    <>
      <InfoHero
        eyebrow={t("nav.trust")}
        title={tn("trust.title", { em: <em>{t("trust.titleEm")}</em> })}
        lead={t("trust.lead")}
      />
      <section className="section">
        <div className="wrap stack-lg">
          <div
            className="category-grid"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))" }}
          >
            {PRINCIPLES.map(({ icon: Icon, key }) => (
              <article key={key} className="panel">
                <span className="tile-icon">
                  <Icon size={22} />
                </span>
                <h2 style={{ fontSize: "1.1rem", margin: "16px 0 8px" }}>{t(`principle.${key}.title`)}</h2>
                <p className="muted" style={{ margin: 0 }}>
                  {t(`principle.${key}.body`)}
                </p>
              </article>
            ))}
          </div>
          <Alert tone="warning" title={t("trust.neverTitle")}>
            {t("trust.neverBody")}
          </Alert>
        </div>
      </section>
    </>
  );
}

export function PrivacyPage() {
  const { t } = useI18n();
  usePageTitle(t("footer.privacy"));
  return (
    <>
      <InfoHero eyebrow={t("legal.eyebrow")} title={t("footer.privacy")} />
      <section className="section-tight">
        <div className="wrap article" lang="en">
          <LegalNotices />
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
  const { t } = useI18n();
  usePageTitle(t("footer.terms"));
  return (
    <>
      <InfoHero eyebrow={t("legal.eyebrow")} title={t("footer.terms")} />
      <section className="section-tight">
        <div className="wrap article" lang="en">
          <LegalNotices />
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
  const { t } = useI18n();
  usePageTitle(t("notFound.title"));
  return (
    <div className="wrap not-found">
      <div className="code">404</div>
      <h1 className="display" style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)" }}>
        {t("notFound.title")}
      </h1>
      <p className="muted">{t("notFound.body")}</p>
      <div className="row" style={{ justifyContent: "center", marginTop: 24 }}>
        <Link className="btn btn-primary" to="/">
          {t("common.goHome")}
        </Link>
        <Link className="btn btn-outline" to="/jobs">
          {t("common.browseJobs")}
        </Link>
      </div>
    </div>
  );
}

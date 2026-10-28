import {
  LANGUAGES,
  PASSWORD_MIN_LENGTH,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type CurrentUser,
} from "@fwp/shared";
import { ArrowLeft, Briefcase, HandCoins, Lock, MailCheck, Sprout, Users, Wallet } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Alert, Field, FieldsIllustration, Options, PasswordInput } from "../components/ui";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useFormSubmit } from "../lib/forms";
import { useToast } from "../lib/toast";
import { usePageTitle } from "../lib/usePageTitle";

/** Only follow same-site relative redirects, never `//evil.com` or absolute URLs. */
function safeNext(next: string | null, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

function landingFor(user: CurrentUser) {
  if (user.role === "admin") return "/admin";
  return user.hasProfile ? "/dashboard" : "/dashboard/profile";
}

function AuthShell({ children }: { children: ReactNode }) {
  const { t, tn } = useI18n();
  const benefits = [
    { icon: HandCoins, title: t("auth.b1t"), body: t("auth.b1b") },
    { icon: Wallet, title: t("auth.b2t"), body: t("auth.b2b") },
    { icon: Lock, title: t("auth.b3t"), body: t("auth.b3b") },
  ];
  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div>
          <span className="eyebrow" style={{ color: "var(--lime)" }}>
            <Sprout size={16} /> Farm Workforce
          </span>
          <h2 className="display" style={{ marginTop: 18 }}>
            {tn("auth.asideTitle", { em: <em>{t("auth.asideEm")}</em> })}
          </h2>
        </div>
        <ul>
          {benefits.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <span className="tile-icon">
                <Icon size={20} />
              </span>
              <div>
                <strong>{title}</strong>
                {body}
              </div>
            </li>
          ))}
        </ul>
        <FieldsIllustration className="fields" />
      </aside>
      <div className="auth-main">
        <div className="auth-card">{children}</div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { t } = useI18n();
  usePageTitle(t("nav.signIn"));
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");

  const { onSubmit, fieldErrors, formError, isPending } = useFormSubmit(
    loginSchema,
    (values) => api.post<{ user: CurrentUser }>("/auth/login", values),
    {
      onSuccess: ({ user }) => {
        setUser(user);
        navigate(safeNext(next, landingFor(user)), { replace: true });
      },
    },
  );

  return (
    <AuthShell>
      <h1 className="display">{t("login.title")}</h1>
      <p className="lead">{t("login.lead")}</p>
      <form className="form" onSubmit={onSubmit} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field label={t("common.email")} name="email" error={fieldErrors.email}>
          {(props) => (
            <input
              className="input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...props}
            />
          )}
        </Field>
        <Field
          label={t("common.password")}
          name="password"
          error={fieldErrors.password}
          hint={
            <Link className="link" to="/forgot-password">
              {t("login.forgot")}
            </Link>
          }
        >
          {(props) => <PasswordInput autoComplete="current-password" {...props} />}
        </Field>
        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={isPending}>
          {isPending ? t("login.submitting") : t("nav.signIn")}
        </button>
      </form>
      <p className="auth-switch">
        {t("login.new")}{" "}
        <Link className="link" to={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}>
          {t("login.create")}
        </Link>
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { t, tn, lang } = useI18n();
  usePageTitle(t("register.title"));
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get("role") === "employer" ? "employer" : "worker");

  const { onSubmit, fieldErrors, formError, isPending } = useFormSubmit(
    registerSchema,
    (values) => api.post<{ user: CurrentUser }>("/auth/register", values),
    {
      // The +234 prefix is shown separately; send the full number.
      transform: (raw) => ({
        ...raw,
        phone: raw.phone ? `+234${String(raw.phone).replace(/^\+?234|^0/, "")}` : "",
      }),
      onSuccess: ({ user }) => {
        setUser(user);
        // New accounts complete their profile first, then continue where they were going.
        const next = safeNext(params.get("next"), "");
        navigate(`/dashboard/profile?welcome=1${next ? `&next=${encodeURIComponent(next)}` : ""}`, {
          replace: true,
        });
      },
    },
  );

  return (
    <AuthShell>
      <h1 className="display">{t("register.title")}</h1>
      <p className="lead">{t("register.lead")}</p>
      <form className="form" onSubmit={onSubmit} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <fieldset className="choice-group">
          <legend className="visually-hidden">{t("register.iam")}</legend>
          <label className="choice">
            <input
              type="radio"
              name="role"
              value="worker"
              checked={role === "worker"}
              onChange={() => setRole("worker")}
            />
            <span className="tile-icon">
              <Users size={19} />
            </span>
            <strong>{t("register.worker")}</strong>
            <span>{t("register.workerSub")}</span>
          </label>
          <label className="choice">
            <input
              type="radio"
              name="role"
              value="employer"
              checked={role === "employer"}
              onChange={() => setRole("employer")}
            />
            <span className="tile-icon gold">
              <Briefcase size={19} />
            </span>
            <strong>{t("register.employer")}</strong>
            <span>{t("register.employerSub")}</span>
          </label>
        </fieldset>
        <Field label={t("common.fullName")} name="fullName" error={fieldErrors.fullName}>
          {(props) => (
            <input
              className="input"
              autoComplete="name"
              placeholder={t("register.namePlaceholder")}
              {...props}
            />
          )}
        </Field>
        <Field label={t("common.email")} name="email" error={fieldErrors.email}>
          {(props) => (
            <input
              className="input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...props}
            />
          )}
        </Field>
        <Field
          label={t("common.phone")}
          name="phone"
          error={fieldErrors.phone}
          hint={role === "worker" ? t("register.phoneHint") : undefined}
        >
          {(props) => (
            <div className="input-affix">
              <span className="affix" aria-hidden="true">
                +234
              </span>
              <input
                className="input"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="803 123 4567"
                {...props}
              />
            </div>
          )}
        </Field>
        <Field
          label={t("common.password")}
          name="password"
          error={fieldErrors.password}
          hint={t("register.passwordHint", { n: PASSWORD_MIN_LENGTH })}
        >
          {(props) => <PasswordInput autoComplete="new-password" {...props} />}
        </Field>
        <Field label={t("common.language")} name="preferredLanguage" error={fieldErrors.preferredLanguage}>
          {(props) => (
            <select className="select" defaultValue={lang} {...props}>
              <Options items={LANGUAGES} />
            </select>
          )}
        </Field>
        <div>
          <label className="checkbox">
            <input type="checkbox" name="acceptTerms" aria-invalid={!!fieldErrors.acceptTerms} />
            <span>
              {tn("register.terms", {
                terms: (
                  <Link className="link" to="/terms" target="_blank">
                    {t("register.termsLink")}
                  </Link>
                ),
                privacy: (
                  <Link className="link" to="/privacy" target="_blank">
                    {t("register.privacyLink")}
                  </Link>
                ),
              })}
            </span>
          </label>
          {fieldErrors.acceptTerms && (
            <span className="field-error" style={{ marginTop: 6 }}>
              {fieldErrors.acceptTerms}
            </span>
          )}
        </div>
        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={isPending}>
          {isPending ? t("register.submitting") : t("register.submit")}
        </button>
      </form>
      <p className="auth-switch">
        {t("register.already")}{" "}
        <Link className="link" to="/login">
          {t("nav.signIn")}
        </Link>
      </p>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const { t } = useI18n();
  usePageTitle(t("forgot.title"));
  const { onSubmit, fieldErrors, formError, isPending, mutation } = useFormSubmit(
    forgotPasswordSchema,
    (values) => api.post("/auth/password/forgot", values),
  );

  return (
    <AuthShell>
      <Link className="breadcrumb" to="/login">
        <ArrowLeft size={17} /> {t("forgot.back")}
      </Link>
      {mutation.isSuccess ? (
        <div className="stack">
          <span className="tile-icon lg">
            <MailCheck size={26} />
          </span>
          <h1 className="display">{t("forgot.checkTitle")}</h1>
          <p className="lead" style={{ margin: 0 }}>
            {t("forgot.checkBody")}
          </p>
        </div>
      ) : (
        <>
          <h1 className="display">{t("forgot.title")}</h1>
          <p className="lead">{t("forgot.lead")}</p>
          <form className="form" onSubmit={onSubmit} noValidate>
            {formError && <Alert tone="error">{formError}</Alert>}
            <Field label={t("common.email")} name="email" error={fieldErrors.email}>
              {(props) => <input className="input" type="email" autoComplete="email" {...props} />}
            </Field>
            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={isPending}>
              {isPending ? t("common.sending") : t("forgot.submit")}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const { t } = useI18n();
  usePageTitle(t("reset.title"));
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const token = params.get("token") ?? "";

  const { onSubmit, fieldErrors, formError, isPending } = useFormSubmit(
    resetPasswordSchema,
    (values) => api.post("/auth/password/reset", values),
    {
      transform: (raw) => ({ ...raw, token }),
      onSuccess: () => {
        toast(t("reset.done"));
        navigate("/login", { replace: true });
      },
    },
  );

  return (
    <AuthShell>
      <h1 className="display">{t("reset.title")}</h1>
      {!token ? (
        <Alert tone="error" title={t("reset.incomplete")}>
          <Link to="/forgot-password">{t("reset.requestNew")}</Link>
        </Alert>
      ) : (
        <>
          <p className="lead">{t("reset.lead")}</p>
          <form className="form" onSubmit={onSubmit} noValidate>
            {(formError || fieldErrors.token) && (
              <Alert tone="error">{formError ?? t("errors.invalid_reset_link")}</Alert>
            )}
            <Field
              label={t("reset.newPassword")}
              name="password"
              error={fieldErrors.password}
              hint={t("reset.hint", { n: PASSWORD_MIN_LENGTH })}
            >
              {(props) => <PasswordInput autoComplete="new-password" {...props} />}
            </Field>
            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={isPending}>
              {isPending ? t("common.saving") : t("reset.submit")}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}

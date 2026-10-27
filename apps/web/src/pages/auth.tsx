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
  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div>
          <span className="eyebrow" style={{ color: "var(--lime)" }}>
            <Sprout size={16} /> Farm Workforce
          </span>
          <h2 className="display" style={{ marginTop: 18 }}>
            The trusted way to find <em>farm work</em> in Nigeria.
          </h2>
        </div>
        <ul>
          <li>
            <span className="tile-icon">
              <HandCoins size={20} />
            </span>
            <div>
              <strong>Free for workers, always</strong>
              No fees to register, apply or start work.
            </div>
          </li>
          <li>
            <span className="tile-icon">
              <Wallet size={20} />
            </span>
            <div>
              <strong>Pay on every listing</strong>
              Know what a job pays before you apply.
            </div>
          </li>
          <li>
            <span className="tile-icon">
              <Lock size={20} />
            </span>
            <div>
              <strong>Your number stays private</strong>
              Shared only when an employer shortlists you.
            </div>
          </li>
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
  usePageTitle("Sign in");
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
      <h1 className="display">Welcome back</h1>
      <p className="lead">Sign in to manage your profile, jobs and applications.</p>
      <form className="form" onSubmit={onSubmit} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field label="Email address" name="email" error={fieldErrors.email}>
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
          label="Password"
          name="password"
          error={fieldErrors.password}
          hint={
            <Link className="link" to="/forgot-password">
              Forgot your password?
            </Link>
          }
        >
          {(props) => <PasswordInput autoComplete="current-password" {...props} />}
        </Field>
        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={isPending}>
          {isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="auth-switch">
        New to Farm Workforce?{" "}
        <Link className="link" to={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}>
          Create a free account
        </Link>
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
  usePageTitle("Create your account");
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
      <h1 className="display">Create your free account</h1>
      <p className="lead">Join farms and workers across Nigeria.</p>
      <form className="form" onSubmit={onSubmit} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <fieldset className="choice-group">
          <legend className="visually-hidden">I am…</legend>
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
            <strong>Looking for work</strong>
            <span>Find jobs and apply free</span>
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
            <strong>Hiring workers</strong>
            <span>Post jobs and shortlist</span>
          </label>
        </fieldset>
        <Field label="Full name" name="fullName" error={fieldErrors.fullName}>
          {(props) => (
            <input className="input" autoComplete="name" placeholder="e.g. Ade Okafor" {...props} />
          )}
        </Field>
        <Field label="Email address" name="email" error={fieldErrors.email}>
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
          label="Mobile number"
          name="phone"
          error={fieldErrors.phone}
          hint={role === "worker" ? "Shared with an employer only after they shortlist you." : undefined}
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
          label="Password"
          name="password"
          error={fieldErrors.password}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters. A short phrase is easy to remember.`}
        >
          {(props) => <PasswordInput autoComplete="new-password" {...props} />}
        </Field>
        <Field label="Preferred language" name="preferredLanguage" error={fieldErrors.preferredLanguage}>
          {(props) => (
            <select className="select" defaultValue="en" {...props}>
              <Options items={LANGUAGES} />
            </select>
          )}
        </Field>
        <div>
          <label className="checkbox">
            <input type="checkbox" name="acceptTerms" aria-invalid={!!fieldErrors.acceptTerms} />
            <span>
              I agree to the{" "}
              <Link className="link" to="/terms" target="_blank">
                terms of use
              </Link>{" "}
              and have read the{" "}
              <Link className="link" to="/privacy" target="_blank">
                privacy notice
              </Link>
              .
            </span>
          </label>
          {fieldErrors.acceptTerms && (
            <span className="field-error" style={{ marginTop: 6 }}>
              {fieldErrors.acceptTerms}
            </span>
          )}
        </div>
        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={isPending}>
          {isPending ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="auth-switch">
        Already registered?{" "}
        <Link className="link" to="/login">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  usePageTitle("Reset your password");
  const { onSubmit, fieldErrors, formError, isPending, mutation } = useFormSubmit(
    forgotPasswordSchema,
    (values) => api.post("/auth/password/forgot", values),
  );

  return (
    <AuthShell>
      <Link className="breadcrumb" to="/login">
        <ArrowLeft size={17} /> Back to sign in
      </Link>
      {mutation.isSuccess ? (
        <div className="stack">
          <span className="tile-icon lg">
            <MailCheck size={26} />
          </span>
          <h1 className="display">Check your email</h1>
          <p className="lead" style={{ margin: 0 }}>
            If an account exists for that address, we've sent a link to reset your password. It expires in 1
            hour — check your spam folder if it doesn't arrive.
          </p>
        </div>
      ) : (
        <>
          <h1 className="display">Reset your password</h1>
          <p className="lead">Enter your email and we'll send you a link to choose a new password.</p>
          <form className="form" onSubmit={onSubmit} noValidate>
            {formError && <Alert tone="error">{formError}</Alert>}
            <Field label="Email address" name="email" error={fieldErrors.email}>
              {(props) => <input className="input" type="email" autoComplete="email" {...props} />}
            </Field>
            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={isPending}>
              {isPending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  usePageTitle("Choose a new password");
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
        toast("Password updated. Please sign in.");
        navigate("/login", { replace: true });
      },
    },
  );

  return (
    <AuthShell>
      <h1 className="display">Choose a new password</h1>
      {!token ? (
        <Alert tone="error" title="This link is incomplete">
          <Link to="/forgot-password">Request a new reset link</Link>.
        </Alert>
      ) : (
        <>
          <p className="lead">You'll be signed out on all other devices.</p>
          <form className="form" onSubmit={onSubmit} noValidate>
            {(formError || fieldErrors.token) && (
              <Alert tone="error">{formError ?? "This reset link is invalid."}</Alert>
            )}
            <Field
              label="New password"
              name="password"
              error={fieldErrors.password}
              hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
            >
              {(props) => <PasswordInput autoComplete="new-password" {...props} />}
            </Field>
            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save new password"}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}

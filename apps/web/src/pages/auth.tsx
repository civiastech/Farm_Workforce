import {
  LANGUAGES,
  PASSWORD_MIN_LENGTH,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type CurrentUser,
} from "@fwp/shared";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Alert, Field, Options } from "../components/ui";
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

export function LoginPage() {
  usePageTitle("Sign in");
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const { onSubmit, fieldErrors, formError, isPending } = useFormSubmit(
    loginSchema,
    (values) => api.post<{ user: CurrentUser }>("/auth/login", values),
    {
      onSuccess: ({ user }) => {
        setUser(user);
        navigate(safeNext(params.get("next"), landingFor(user)), { replace: true });
      },
    },
  );

  return (
    <div className="wrap">
      <div className="auth-page card">
        <h1>Welcome back</h1>
        <p className="muted">Sign in to manage your profile, jobs and applications.</p>
        <form className="form" onSubmit={onSubmit} noValidate>
          {formError && <Alert tone="error">{formError}</Alert>}
          <Field label="Email address" name="email" error={fieldErrors.email}>
            {(props) => <input className="input" type="email" autoComplete="email" required {...props} />}
          </Field>
          <Field label="Password" name="password" error={fieldErrors.password}>
            {(props) => (
              <input className="input" type="password" autoComplete="current-password" required {...props} />
            )}
          </Field>
          <button className="btn btn-primary btn-block" type="submit" disabled={isPending}>
            {isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="spread" style={{ marginTop: 20 }}>
          <Link to="/forgot-password">Forgot password?</Link>
          <span className="subtle">
            New here?{" "}
            <Link
              to={`/register${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`}
            >
              Create an account
            </Link>
          </span>
        </div>
      </div>
    </div>
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
    <div className="wrap">
      <div className="auth-page card">
        <h1>Create your free account</h1>
        <p className="muted">Join farms and workers across Nigeria.</p>
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
              <strong>Hiring workers</strong>
              <span>Post jobs and shortlist</span>
            </label>
          </fieldset>
          <Field label="Full name" name="fullName" error={fieldErrors.fullName}>
            {(props) => <input className="input" autoComplete="name" required {...props} />}
          </Field>
          <Field label="Email address" name="email" error={fieldErrors.email}>
            {(props) => <input className="input" type="email" autoComplete="email" required {...props} />}
          </Field>
          <Field
            label="Mobile number"
            name="phone"
            error={fieldErrors.phone}
            hint={role === "worker" ? "Shared with an employer only after they shortlist you." : undefined}
          >
            {(props) => (
              <input
                className="input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0803 123 4567"
                required
                {...props}
              />
            )}
          </Field>
          <Field
            label="Password"
            name="password"
            error={fieldErrors.password}
            hint={`At least ${PASSWORD_MIN_LENGTH} characters. A short phrase is easy to remember.`}
          >
            {(props) => (
              <input className="input" type="password" autoComplete="new-password" required {...props} />
            )}
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
                <Link to="/terms" target="_blank">
                  terms of use
                </Link>{" "}
                and have read the{" "}
                <Link to="/privacy" target="_blank">
                  privacy notice
                </Link>
                .
              </span>
            </label>
            {fieldErrors.acceptTerms && <span className="field-error">{fieldErrors.acceptTerms}</span>}
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={isPending}>
            {isPending ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="subtle" style={{ marginTop: 20 }}>
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  usePageTitle("Reset your password");
  const { onSubmit, fieldErrors, formError, isPending, mutation } = useFormSubmit(
    forgotPasswordSchema,
    (values) => api.post("/auth/password/forgot", values),
  );

  return (
    <div className="wrap">
      <div className="auth-page card">
        <h1>Reset your password</h1>
        {mutation.isSuccess ? (
          <Alert tone="success">
            If an account exists for that email, we've sent a reset link. It expires in 1 hour. Check your
            spam folder if it doesn't arrive.
          </Alert>
        ) : (
          <form className="form" onSubmit={onSubmit} noValidate>
            <p className="muted">Enter your email and we'll send you a link to choose a new password.</p>
            {formError && <Alert tone="error">{formError}</Alert>}
            <Field label="Email address" name="email" error={fieldErrors.email}>
              {(props) => <input className="input" type="email" autoComplete="email" required {...props} />}
            </Field>
            <button className="btn btn-primary btn-block" type="submit" disabled={isPending}>
              {isPending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <p style={{ marginTop: 20 }}>
          <Link to="/login">← Back to sign in</Link>
        </p>
      </div>
    </div>
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
    <div className="wrap">
      <div className="auth-page card">
        <h1>Choose a new password</h1>
        {!token ? (
          <Alert tone="error">
            This link is incomplete. <Link to="/forgot-password">Request a new reset link</Link>.
          </Alert>
        ) : (
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
              {(props) => (
                <input className="input" type="password" autoComplete="new-password" required {...props} />
              )}
            </Field>
            <button className="btn btn-primary btn-block" type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

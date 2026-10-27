import {
  LANGUAGES,
  PASSWORD_MIN_LENGTH,
  accountUpdateSchema,
  changePasswordSchema,
  deleteAccountSchema,
  type ProfileResponse,
} from "@fwp/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Alert, Field, Options } from "../components/ui";
import { api } from "../lib/api";
import { meQueryKey, useAuth } from "../lib/auth";
import { useFormSubmit } from "../lib/forms";
import { useToast } from "../lib/toast";
import { usePageTitle } from "../lib/usePageTitle";

export function AccountPage() {
  usePageTitle("Account & privacy");
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="stack" style={{ "--stack": "24px" } as React.CSSProperties}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1>Account &amp; privacy</h1>
        <p className="muted">Signed in as {user.email}</p>
      </div>
      <AccountDetails />
      <ChangePassword />
      {user.role !== "admin" && <YourData />}
    </div>
  );
}

function AccountDetails() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { onSubmit, fieldErrors, formError, isPending } = useFormSubmit(
    accountUpdateSchema,
    (values) => api.put<ProfileResponse>("/me/account", values),
    {
      onSuccess: (data) => {
        queryClient.setQueryData(meQueryKey, { user: data.user });
        queryClient.setQueryData(["profile"], data);
        toast("Account details saved.");
      },
    },
  );
  if (!user) return null;

  return (
    <form className="card form" onSubmit={onSubmit} noValidate>
      <h2 style={{ fontSize: "1.2rem", margin: 0 }}>Your details</h2>
      {formError && <Alert tone="error">{formError}</Alert>}
      <div className="form-grid">
        <Field label="Full name" name="fullName" error={fieldErrors.fullName}>
          {(props) => <input className="input" autoComplete="name" defaultValue={user.fullName} {...props} />}
        </Field>
        <Field label="Mobile number" name="phone" error={fieldErrors.phone}>
          {(props) => (
            <input className="input" type="tel" autoComplete="tel" defaultValue={user.phone} {...props} />
          )}
        </Field>
        <Field label="Preferred language" name="preferredLanguage" error={fieldErrors.preferredLanguage}>
          {(props) => (
            <select className="select" defaultValue={user.preferredLanguage} {...props}>
              <Options items={LANGUAGES} />
            </select>
          )}
        </Field>
      </div>
      <div>
        <button className="btn btn-primary" type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save details"}
        </button>
      </div>
    </form>
  );
}

function ChangePassword() {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const { onSubmit, fieldErrors, formError, isPending } = useFormSubmit(
    changePasswordSchema,
    (values) => api.post("/auth/password/change", values),
    {
      onSuccess: () => {
        formRef.current?.reset();
        toast("Password changed. Other devices have been signed out.");
      },
    },
  );

  return (
    <form ref={formRef} className="card form" onSubmit={onSubmit} noValidate>
      <h2 style={{ fontSize: "1.2rem", margin: 0 }}>Change password</h2>
      {formError && <Alert tone="error">{formError}</Alert>}
      <div className="form-grid">
        <Field label="Current password" name="currentPassword" error={fieldErrors.currentPassword}>
          {(props) => <input className="input" type="password" autoComplete="current-password" {...props} />}
        </Field>
        <Field
          label="New password"
          name="newPassword"
          error={fieldErrors.newPassword}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        >
          {(props) => <input className="input" type="password" autoComplete="new-password" {...props} />}
        </Field>
      </div>
      <div>
        <button className="btn btn-primary" type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Change password"}
        </button>
      </div>
    </form>
  );
}

function YourData() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [exporting, setExporting] = useState(false);

  const { onSubmit, fieldErrors, formError, isPending } = useFormSubmit(
    deleteAccountSchema,
    (values) => api.delete("/me", values),
    {
      onSuccess: () => {
        dialogRef.current?.close();
        queryClient.clear();
        queryClient.setQueryData(meQueryKey, { user: null });
        toast("Your account and data have been deleted.");
        navigate("/", { replace: true });
      },
    },
  );

  async function downloadData() {
    setExporting(true);
    try {
      const data = await api.get<unknown>("/me/export");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "farm-workforce-data.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="card stack danger-zone" aria-labelledby="your-data">
      <h2 id="your-data" style={{ fontSize: "1.2rem" }}>
        Your data
      </h2>
      <p className="muted">
        You can download a copy of everything we hold about you, or permanently delete your account. Deleting
        removes your profile, applications and any jobs you posted. This cannot be undone.
      </p>
      <div className="row">
        <button type="button" className="btn btn-outline" onClick={downloadData} disabled={exporting}>
          {exporting ? "Preparing…" : "Download my data"}
        </button>
        <button type="button" className="btn btn-danger" onClick={() => dialogRef.current?.showModal()}>
          Delete my account
        </button>
      </div>
      <dialog ref={dialogRef} aria-labelledby="delete-title">
        <form className="form" onSubmit={onSubmit} noValidate>
          <h2 id="delete-title" style={{ fontSize: "1.25rem", margin: 0 }}>
            Delete your account?
          </h2>
          <p className="muted" style={{ margin: 0 }}>
            This permanently deletes your account and data. Enter your password to confirm.
          </p>
          {formError && <Alert tone="error">{formError}</Alert>}
          <Field label="Password" name="password" error={fieldErrors.password}>
            {(props) => (
              <input className="input" type="password" autoComplete="current-password" {...props} />
            )}
          </Field>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-outline" onClick={() => dialogRef.current?.close()}>
              Keep my account
            </button>
            <button type="submit" className="btn btn-danger" disabled={isPending}>
              {isPending ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}

import {
  LANGUAGES,
  PASSWORD_MIN_LENGTH,
  accountUpdateSchema,
  changePasswordSchema,
  deleteAccountSchema,
  type ProfileResponse,
} from "@fwp/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Download, KeyRound, Trash2, UserRound } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Alert, Field, Options, PasswordInput } from "../components/ui";
import { api } from "../lib/api";
import { meQueryKey, useAuth } from "../lib/auth";
import { formatDate } from "../lib/format";
import { useFormSubmit } from "../lib/forms";
import { useToast } from "../lib/toast";
import { usePageTitle } from "../lib/usePageTitle";

export function AccountPage() {
  usePageTitle("Account & privacy");
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1 className="display">Account &amp; privacy</h1>
        <p className="muted">
          Signed in as {user.email} · member since {formatDate(user.createdAt)}
        </p>
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
    <form className="panel form" onSubmit={onSubmit} noValidate>
      <section className="form-section">
        <h2>
          <UserRound size={18} /> Your details
        </h2>
        {formError && <Alert tone="error">{formError}</Alert>}
        <div className="form-grid">
          <Field label="Full name" name="fullName" error={fieldErrors.fullName}>
            {(props) => (
              <input className="input" autoComplete="name" defaultValue={user.fullName} {...props} />
            )}
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
      </section>
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
    <form ref={formRef} className="panel form" onSubmit={onSubmit} noValidate>
      <section className="form-section">
        <h2>
          <KeyRound size={18} /> Change password
        </h2>
        <p className="subtle" style={{ margin: 0 }}>
          Changing your password signs you out on every other device.
        </p>
        {formError && <Alert tone="error">{formError}</Alert>}
        <div className="form-grid">
          <Field label="Current password" name="currentPassword" error={fieldErrors.currentPassword}>
            {(props) => <PasswordInput autoComplete="current-password" {...props} />}
          </Field>
          <Field
            label="New password"
            name="newPassword"
            error={fieldErrors.newPassword}
            hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          >
            {(props) => <PasswordInput autoComplete="new-password" {...props} />}
          </Field>
        </div>
      </section>
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
    <section className="panel stack danger-zone" aria-labelledby="your-data">
      <h2 id="your-data" className="panel-title" style={{ margin: 0 }}>
        Your data
      </h2>
      <div className="spread">
        <div style={{ maxWidth: "34em" }}>
          <strong>Download a copy</strong>
          <p className="subtle" style={{ margin: 0 }}>
            Everything we hold about you — account, profile, applications and jobs — as a JSON file.
          </p>
        </div>
        <button type="button" className="btn btn-outline" onClick={downloadData} disabled={exporting}>
          <Download size={17} />
          {exporting ? "Preparing…" : "Download my data"}
        </button>
      </div>
      <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "4px 0" }} />
      <div className="spread">
        <div style={{ maxWidth: "34em" }}>
          <strong>Delete account</strong>
          <p className="subtle" style={{ margin: 0 }}>
            Permanently removes your profile, applications and any jobs you posted. This cannot be undone.
          </p>
        </div>
        <button type="button" className="btn btn-danger" onClick={() => dialogRef.current?.showModal()}>
          <Trash2 size={17} /> Delete account
        </button>
      </div>

      <dialog ref={dialogRef} aria-labelledby="delete-title">
        <form className="form" onSubmit={onSubmit} noValidate>
          <div>
            <span
              className="tile-icon dialog-icon"
              style={{ background: "var(--danger-bg)", color: "var(--danger-text)" }}
            >
              <Trash2 size={20} />
            </span>
            <h2 id="delete-title" style={{ fontSize: "1.3rem", margin: 0 }}>
              Delete your account?
            </h2>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              This permanently deletes your account and data. Enter your password to confirm.
            </p>
          </div>
          {formError && <Alert tone="error">{formError}</Alert>}
          <Field label="Password" name="password" error={fieldErrors.password}>
            {(props) => <PasswordInput autoComplete="current-password" {...props} />}
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

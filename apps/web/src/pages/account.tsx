import {
  LANGUAGES,
  PASSWORD_MIN_LENGTH,
  accountUpdateSchema,
  changePasswordSchema,
  changePhoneSchema,
  deleteAccountSchema,
  formatPhone,
  newPhoneSchema,
  type ProfileResponse,
} from "@fwp/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Download, KeyRound, Smartphone, Trash2, UserRound } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { CodeField, type CodeSent } from "../components/CodeField";
import { Alert, Field, Options, PasswordInput } from "../components/ui";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import { meQueryKey, useAuth } from "../lib/auth";
import { useFormSubmit } from "../lib/forms";
import { useToast } from "../lib/toast";
import { usePageTitle } from "../lib/usePageTitle";

export function AccountPage() {
  const { t, formatDate } = useI18n();
  usePageTitle(t("nav.account"));
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h1 className="display">{t("nav.account")}</h1>
        <p className="muted">
          {t("account.signedInAs", {
            email: user.email ?? formatPhone(user.phone ?? ""),
            date: formatDate(user.createdAt),
          })}
        </p>
      </div>
      <AccountDetails />
      <MobileNumber />
      <ChangePassword />
      {user.role !== "admin" && <YourData />}
    </div>
  );
}

function AccountDetails() {
  const { t, setLang } = useI18n();
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
        // The saved preferred language becomes the interface language too.
        setLang(data.user.preferredLanguage);
        toast(t("account.saved"));
      },
    },
  );
  if (!user) return null;

  return (
    <form className="panel form" onSubmit={onSubmit} noValidate>
      <section className="form-section">
        <h2>
          <UserRound size={18} /> {t("account.details")}
        </h2>
        {formError && <Alert tone="error">{formError}</Alert>}
        <div className="form-grid">
          <Field label={t("common.fullName")} name="fullName" error={fieldErrors.fullName}>
            {(props) => (
              <input className="input" autoComplete="name" defaultValue={user.fullName} {...props} />
            )}
          </Field>
          <Field
            label={t("common.email")}
            name="email"
            optional
            error={fieldErrors.email}
            hint={t("account.emailHint")}
          >
            {(props) => (
              <input
                className="input"
                type="email"
                autoComplete="email"
                defaultValue={user.email ?? ""}
                {...props}
              />
            )}
          </Field>
          <Field label={t("common.language")} name="preferredLanguage" error={fieldErrors.preferredLanguage}>
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
          {isPending ? t("common.saving") : t("account.saveDetails")}
        </button>
      </div>
    </form>
  );
}

/** Changing number is two steps: send a code to the new number, then confirm it. */
function MobileNumber() {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<{ phone: string; sent: CodeSent } | null>(null);

  const requestCode = (phone: string) =>
    api.post<CodeSent>("/auth/phone/code", { phone, purpose: "change_phone" });

  const start = useFormSubmit(newPhoneSchema, (values) => requestCode(values.phone), {
    onSuccess: (sent, values) => setPending({ phone: values.phone, sent }),
  });
  const confirm = useFormSubmit(
    changePhoneSchema,
    (values) => api.put<ProfileResponse>("/me/phone", values),
    {
      transform: (raw) => ({ ...raw, phone: pending?.phone }),
      onSuccess: (data) => {
        queryClient.setQueryData(meQueryKey, { user: data.user });
        queryClient.setQueryData(["profile"], data);
        setPending(null);
        setEditing(false);
        toast(t("account.phoneChanged"));
      },
    },
  );
  if (!user) return null;

  const cancel = () => {
    setPending(null);
    setEditing(false);
  };

  return (
    <section className="panel form" aria-labelledby="mobile-number">
      <div className="form-section">
        <h2 id="mobile-number">
          <Smartphone size={18} /> {t("account.phoneTitle")}
        </h2>
        <p className="subtle" style={{ margin: 0 }}>
          {t("account.phoneLead")}
        </p>
        {!editing && (
          <div className="spread">
            <strong className="num">{user.phone ? formatPhone(user.phone) : t("account.noPhone")}</strong>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>
              {user.phone ? t("account.changePhone") : t("account.addPhone")}
            </button>
          </div>
        )}
        {editing && !pending && (
          <form className="form" onSubmit={start.onSubmit} noValidate>
            {start.formError && <Alert tone="error">{start.formError}</Alert>}
            <Field label={t("account.newPhone")} name="phone" error={start.fieldErrors.phone}>
              {(props) => (
                <input
                  className="input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0803 123 4567"
                  {...props}
                />
              )}
            </Field>
            <div className="row">
              <button className="btn btn-primary" type="submit" disabled={start.isPending}>
                {start.isPending ? t("register.sendingCode") : t("register.continue")}
              </button>
              <button type="button" className="btn btn-ghost" onClick={cancel}>
                {t("common.cancel")}
              </button>
            </div>
          </form>
        )}
        {pending && (
          <form className="form" onSubmit={confirm.onSubmit} noValidate>
            {(confirm.formError || confirm.fieldErrors.phone) && (
              <Alert tone="error">{confirm.formError ?? confirm.fieldErrors.phone}</Alert>
            )}
            <CodeField
              phone={pending.phone}
              sent={pending.sent}
              onResend={() => requestCode(pending.phone)}
              error={confirm.fieldErrors.code}
            />
            <div className="row">
              <button className="btn btn-primary" type="submit" disabled={confirm.isPending}>
                {confirm.isPending ? t("common.saving") : t("account.savePhone")}
              </button>
              <button type="button" className="btn btn-ghost" onClick={cancel}>
                {t("common.cancel")}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function ChangePassword() {
  const { t } = useI18n();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const { onSubmit, fieldErrors, formError, isPending } = useFormSubmit(
    changePasswordSchema,
    (values) => api.post("/auth/password/change", values),
    {
      onSuccess: () => {
        formRef.current?.reset();
        toast(t("account.changed"));
      },
    },
  );

  return (
    <form ref={formRef} className="panel form" onSubmit={onSubmit} noValidate>
      <section className="form-section">
        <h2>
          <KeyRound size={18} /> {t("account.password")}
        </h2>
        <p className="subtle" style={{ margin: 0 }}>
          {t("account.passwordLead")}
        </p>
        {formError && <Alert tone="error">{formError}</Alert>}
        <div className="form-grid">
          <Field label={t("account.current")} name="currentPassword" error={fieldErrors.currentPassword}>
            {(props) => <PasswordInput autoComplete="current-password" {...props} />}
          </Field>
          <Field
            label={t("reset.newPassword")}
            name="newPassword"
            error={fieldErrors.newPassword}
            hint={t("reset.hint", { n: PASSWORD_MIN_LENGTH })}
          >
            {(props) => <PasswordInput autoComplete="new-password" {...props} />}
          </Field>
        </div>
      </section>
      <div>
        <button className="btn btn-primary" type="submit" disabled={isPending}>
          {isPending ? t("common.saving") : t("account.password")}
        </button>
      </div>
    </form>
  );
}

function YourData() {
  const { t, errorMessage } = useI18n();
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
        toast(t("account.deleted"));
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
      toast(errorMessage(error));
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="panel stack danger-zone" aria-labelledby="your-data">
      <h2 id="your-data" className="panel-title" style={{ margin: 0 }}>
        {t("account.yourData")}
      </h2>
      <div className="spread">
        <div style={{ maxWidth: "34em" }}>
          <strong>{t("account.download")}</strong>
          <p className="subtle" style={{ margin: 0 }}>
            {t("account.downloadBody")}
          </p>
        </div>
        <button type="button" className="btn btn-outline" onClick={downloadData} disabled={exporting}>
          <Download size={17} />
          {exporting ? t("account.preparing") : t("account.downloadButton")}
        </button>
      </div>
      <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "4px 0" }} />
      <div className="spread">
        <div style={{ maxWidth: "34em" }}>
          <strong>{t("account.delete")}</strong>
          <p className="subtle" style={{ margin: 0 }}>
            {t("account.deleteBody")}
          </p>
        </div>
        <button type="button" className="btn btn-danger" onClick={() => dialogRef.current?.showModal()}>
          <Trash2 size={17} /> {t("account.delete")}
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
              {t("account.deleteTitle")}
            </h2>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              {t("account.deleteConfirm")}
            </p>
          </div>
          {formError && <Alert tone="error">{formError}</Alert>}
          <Field label={t("common.password")} name="password" error={fieldErrors.password}>
            {(props) => <PasswordInput autoComplete="current-password" {...props} />}
          </Field>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-outline" onClick={() => dialogRef.current?.close()}>
              {t("account.keep")}
            </button>
            <button type="submit" className="btn btn-danger" disabled={isPending}>
              {isPending ? t("account.deleting") : t("account.deletePermanently")}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}

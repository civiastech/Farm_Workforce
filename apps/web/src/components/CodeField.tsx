import { CODE_LENGTH, formatPhone } from "@fwp/shared";
import { MessageSquareText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { useToast } from "../lib/toast";
import { Alert, Field } from "./ui";

/** What the API returns when it sends a code. `devCode` only appears with the local "log" SMS transport. */
export interface CodeSent {
  resendInSeconds: number;
  devCode?: string;
}

interface OtpCredential extends Credential {
  code: string;
}

/**
 * The 6-digit SMS code input. On Android Chrome the code fills itself in (WebOTP);
 * iOS offers it above the keyboard via autocomplete="one-time-code".
 */
export function CodeField({
  phone,
  sent,
  onResend,
  error,
}: {
  phone: string;
  sent: CodeSent;
  onResend: () => Promise<CodeSent>;
  error?: string;
}) {
  const { t, errorMessage } = useI18n();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(sent);
  const [waitUntil, setWaitUntil] = useState(() => Date.now() + sent.resendInSeconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  const [resending, setResending] = useState(false);
  const secondsLeft = Math.max(0, Math.ceil((waitUntil - now) / 1000));

  useEffect(() => {
    if (secondsLeft === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  useEffect(() => {
    inputRef.current?.focus();
    if (!("OTPCredential" in window)) return;
    const abort = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: abort.signal } as CredentialRequestOptions)
      .then((credential) => {
        const code = (credential as OtpCredential | null)?.code;
        if (code && inputRef.current) inputRef.current.value = code;
      })
      .catch(() => {
        // Dismissed, unsupported or aborted: the user types the code instead.
      });
    return () => abort.abort();
  }, [current]);

  async function resend() {
    setResending(true);
    try {
      const next = await onResend();
      setCurrent(next);
      setWaitUntil(Date.now() + next.resendInSeconds * 1000);
      setNow(Date.now());
      toast(t("code.resent"));
    } catch (resendError) {
      toast(errorMessage(resendError));
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="stack">
      <p className="code-sent">
        <MessageSquareText size={18} aria-hidden="true" />
        <span>{t("code.sentTo", { phone: formatPhone(phone) })}</span>
      </p>
      {current.devCode && <Alert tone="warning">{t("code.devNotice", { code: current.devCode })}</Alert>}
      <Field label={t("code.label")} name="code" error={error}>
        {(props) => (
          <input
            ref={inputRef}
            className="input code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={CODE_LENGTH}
            placeholder="••••••"
            {...props}
          />
        )}
      </Field>
      <div>
        <button
          type="button"
          className="link-button link"
          onClick={resend}
          disabled={secondsLeft > 0 || resending}
        >
          {secondsLeft > 0 ? t("code.resendIn", { n: secondsLeft }) : t("code.resend")}
        </button>
      </div>
    </div>
  );
}

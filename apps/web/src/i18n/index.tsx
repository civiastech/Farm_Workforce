import { LANGUAGE_KEYS, setValidationMessages, type Language, type ValidationMessages } from "@fwp/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { en, type MessageKey, type Messages } from "./en";

export type { MessageKey, Messages };
type Vars = Record<string, string | number>;

// English ships in the main bundle; other languages load on demand.
const loaders: Record<Exclude<Language, "en">, () => Promise<{ default: Messages }>> = {
  pcm: () => import("./pcm"),
  ha: () => import("./ha"),
  yo: () => import("./yo"),
  ig: () => import("./ig"),
  fr: () => import("./fr"),
};

/** BCP-47 tags for <html lang> and date formatting. */
const LOCALE: Record<Language, string> = {
  en: "en-NG",
  pcm: "pcm-NG",
  ha: "ha-NG",
  yo: "yo-NG",
  ig: "ig-NG",
  fr: "fr",
};

const STORAGE_KEY = "fwp-lang";

function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGE_KEYS as readonly string[]).includes(value);
}

function readStoredChoice(): Language | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

function detectBrowserLanguage(): Language {
  for (const tag of navigator.languages ?? []) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLanguage(base)) return base;
  }
  return "en";
}

function interpolate(message: string, vars?: Vars): string {
  if (!vars) return message;
  return message.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export interface I18n {
  lang: Language;
  locale: string;
  /** Translated text, with `{name}` placeholders filled from vars. */
  t: (key: MessageKey, vars?: Vars) => string;
  /** Picks `${base}.one` or `${base}.other` for n, and fills in `{n}`. */
  tp: (base: PluralBase, n: number) => string;
  /** Like t, but placeholders may be React elements (links, emphasis). */
  tn: (key: MessageKey, nodes: Record<string, ReactNode>) => ReactNode;
  setLang: (lang: Language) => void;
  formatDate: (iso: string) => string;
  timeAgo: (iso: string) => string;
  /** A user-facing message for an API or network error, in the active language. */
  errorMessage: (error: unknown) => string;
}

type PluralBase = MessageKey extends infer K ? (K extends `${infer B}.one` ? B : never) : never;

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth();
  const [choice, setChoice] = useState<Language | null>(readStoredChoice);
  const [dictionaries, setDictionaries] = useState<Partial<Record<Language, Messages>>>({ en });

  // An explicit choice on this device wins; then the account's preference; then the browser's.
  const lang: Language = choice ?? user?.preferredLanguage ?? detectBrowserLanguage();
  const messages = dictionaries[lang] ?? en;

  useEffect(() => {
    if (lang === "en" || dictionaries[lang]) return;
    let cancelled = false;
    loaders[lang]().then((module) => {
      if (!cancelled) setDictionaries((current) => ({ ...current, [lang]: module.default }));
    });
    return () => {
      cancelled = true;
    };
  }, [lang, dictionaries]);

  const t = useCallback(
    (key: MessageKey, vars?: Vars) => interpolate(messages[key] ?? en[key], vars),
    [messages],
  );

  useEffect(() => {
    document.documentElement.lang = LOCALE[lang];
    const validation: ValidationMessages = {
      required: t("validation.required"),
      invalid: t("validation.invalid"),
      minChars: t("validation.minChars"),
      maxChars: t("validation.maxChars"),
      minNumber: t("validation.minNumber"),
      maxNumber: t("validation.maxNumber"),
      maxItems: t("validation.maxItems"),
      chooseOption: t("validation.chooseOption"),
      chooseState: t("validation.chooseState"),
      email: t("validation.email"),
      phone: t("validation.phone"),
      identifier: t("validation.identifier"),
      code: t("validation.code"),
      enterPassword: t("validation.enterPassword"),
      acceptTerms: t("validation.acceptTerms"),
      payRange: t("validation.payRange"),
    };
    setValidationMessages(validation);
  }, [lang, t]);

  const setLang = useCallback(
    (next: Language) => {
      setChoice(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* the choice just won't persist on this device */
      }
      // Keep the account preference in sync so it follows the user to other devices.
      if (user && user.preferredLanguage !== next) {
        api
          .put<{ user: typeof user }>("/me/account", {
            fullName: user.fullName,
            phone: user.phone,
            preferredLanguage: next,
          })
          .then((response) => setUser(response.user))
          .catch(() => {
            /* non-critical: the device choice still applies */
          });
      }
    },
    [user, setUser],
  );

  const value = useMemo<I18n>(() => {
    const locale = LOCALE[lang];
    const dateFormat = new Intl.DateTimeFormat([locale, "en-NG"], {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return {
      lang,
      locale,
      t,
      tp: (base, n) => t(`${base}.${n === 1 ? "one" : "other"}` as MessageKey, { n }),
      tn: (key, nodes) => {
        const parts = (messages[key] ?? en[key]).split(/\{(\w+)\}/);
        return parts.map((part, index) =>
          index % 2 === 1 ? <span key={index}>{nodes[part] ?? `{${part}}`}</span> : part,
        );
      },
      setLang,
      formatDate: (iso) => dateFormat.format(new Date(iso)),
      timeAgo: (iso) => {
        const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
        if (seconds < 60) return t("time.justNow");
        const minutes = Math.round(seconds / 60);
        if (minutes < 60) return t("time.minutes", { n: minutes });
        const hours = Math.round(minutes / 60);
        if (hours < 24) return t("time.hours", { n: hours });
        const days = Math.round(hours / 24);
        if (days < 30) return t("time.days", { n: days });
        return dateFormat.format(new Date(iso));
      },
      errorMessage: (error) => {
        if (error instanceof ApiError) {
          const key = `errors.${error.code}` as MessageKey;
          return key in en ? t(key) : error.message;
        }
        return error instanceof Error ? error.message : t("errors.internal_error");
      },
    };
  }, [lang, t, messages, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within I18nProvider");
  return context;
}

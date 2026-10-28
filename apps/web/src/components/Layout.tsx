import { LANGUAGES, LANGUAGE_KEYS, type Language } from "@fwp/shared";
import {
  Briefcase,
  Check,
  CircleHelp,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Search,
  Shield,
  ShieldCheck,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigate,
  useNavigation,
} from "react-router";
import { useI18n, type MessageKey } from "../i18n";
import { useAuth } from "../lib/auth";
import { useTheme, type ThemePreference } from "../lib/theme";
import { useToast } from "../lib/toast";
import { Avatar, LogoMark } from "./ui";

const NAV: { to: string; label: MessageKey; icon: typeof Search }[] = [
  { to: "/jobs", label: "nav.findWork", icon: Search },
  { to: "/how-it-works", label: "nav.howItWorks", icon: CircleHelp },
  { to: "/trust", label: "nav.trust", icon: ShieldCheck },
];

const THEME_CYCLE: Record<ThemePreference, { next: ThemePreference; icon: typeof Sun }> = {
  system: { next: "light", icon: Monitor },
  light: { next: "dark", icon: Sun },
  dark: { next: "system", icon: Moon },
};

/** Short codes shown on the header button. */
const LANGUAGE_CODE: Record<Language, string> = {
  en: "EN",
  pcm: "PCM",
  ha: "HA",
  yo: "YO",
  ig: "IG",
  fr: "FR",
};

function ThemeToggle({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const { icon: Icon, next } = THEME_CYCLE[theme];
  const label = t(`theme.${theme}`);
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-icon ${className}`}
      onClick={() => setTheme(next)}
      aria-label={`${label}. ${t("theme.change")}`}
      title={label}
    >
      <Icon size={19} />
    </button>
  );
}

function LanguageMenu() {
  const { t, lang } = useI18n();
  const menuRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm lang-button"
        popoverTarget="language-menu"
        aria-haspopup="menu"
        aria-label={`${t("lang.choose")}: ${LANGUAGES[lang]}`}
      >
        <Globe size={18} />
        <span aria-hidden="true">{LANGUAGE_CODE[lang]}</span>
      </button>
      <div id="language-menu" ref={menuRef} popover="auto" className="menu menu-narrow" role="menu">
        <div className="menu-header">
          <strong>{t("lang.choose")}</strong>
        </div>
        <LanguageOptions onPick={() => menuRef.current?.hidePopover()} />
      </div>
    </>
  );
}

function LanguageOptions({ onPick }: { onPick?: () => void }) {
  const { lang, setLang } = useI18n();
  return (
    <>
      {LANGUAGE_KEYS.map((code) => (
        <button
          key={code}
          type="button"
          role="menuitemradio"
          aria-checked={lang === code}
          lang={code === "pcm" ? "pcm" : code}
          onClick={() => {
            setLang(code);
            onPick?.();
          }}
        >
          <span style={{ flex: 1 }}>{LANGUAGES[code]}</span>
          {lang === code && <Check size={16} />}
        </button>
      ))}
    </>
  );
}

function useSignOut() {
  const { t } = useI18n();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  return async () => {
    await logout();
    toast(t("nav.signedOut"));
    navigate("/");
  };
}

function UserMenu() {
  const { t } = useI18n();
  const { user } = useAuth();
  const signOut = useSignOut();
  const menuRef = useRef<HTMLDivElement>(null);
  if (!user) return null;
  const close = () => menuRef.current?.hidePopover();
  const home = user.role === "admin" ? "/admin" : "/dashboard";

  return (
    <>
      <button type="button" className="user-button" popoverTarget="user-menu" aria-haspopup="menu">
        <Avatar name={user.fullName} size={30} />
        <span className="name">{user.fullName.split(" ")[0]}</span>
      </button>
      <div id="user-menu" ref={menuRef} popover="auto" className="menu" role="menu">
        <div className="menu-header">
          <strong>{user.fullName}</strong>
          <span className="subtle">{user.email}</span>
        </div>
        <Link to={home} onClick={close} role="menuitem">
          {user.role === "admin" ? <Shield size={17} /> : <LayoutDashboard size={17} />}
          {user.role === "admin" ? t("nav.moderation") : t("nav.dashboard")}
        </Link>
        {user.role !== "admin" && (
          <Link to="/dashboard/profile" onClick={close} role="menuitem">
            <UserRound size={17} />
            {user.role === "employer" ? t("nav.orgProfile") : t("nav.myProfile")}
          </Link>
        )}
        {user.role === "employer" && (
          <Link to="/dashboard/jobs" onClick={close} role="menuitem">
            <Briefcase size={17} />
            {t("nav.myJobs")}
          </Link>
        )}
        <Link to={`${home}/account`} onClick={close} role="menuitem">
          <ShieldCheck size={17} />
          {t("nav.account")}
        </Link>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            close();
            void signOut();
          }}
        >
          <LogOut size={17} />
          {t("nav.signOut")}
        </button>
      </div>
    </>
  );
}

function Header() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const signOut = useSignOut();
  // The mobile menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  return (
    <header className="site-header">
      <div className="wrap nav">
        <Link className="brand" to="/" aria-label={t("nav.home")}>
          <span className="brand-mark">
            <LogoMark />
          </span>
          Farm Workforce
        </Link>
        <nav aria-label={t("nav.main")}>
          <ul className="nav-links">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to}>{t(item.label)}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="nav-actions">
          <LanguageMenu />
          <ThemeToggle className="hide-sm" />
          {user ? (
            <span className="desktop-only">
              <UserMenu />
            </span>
          ) : (
            <>
              <Link className="btn btn-ghost btn-sm desktop-only" to="/login">
                {t("nav.signIn")}
              </Link>
              <Link className="btn btn-primary btn-sm desktop-only" to="/register">
                {t("nav.joinFree")}
              </Link>
            </>
          )}
          <button
            type="button"
            className="btn btn-outline btn-icon menu-toggle"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
            onClick={() => setOpenOn(open ? null : pathname)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <div id="mobile-menu" className="mobile-panel" hidden={!open}>
        <div className="wrap">
          {user && (
            <div className="row" style={{ padding: "8px 6px 14px" }}>
              <Avatar name={user.fullName} size={40} />
              <div>
                <strong>{user.fullName}</strong>
                <div className="subtle">{user.email}</div>
              </div>
            </div>
          )}
          <nav aria-label={t("nav.main")}>
            <ul>
              {user && (
                <li>
                  <Link className="nav-item" to={user.role === "admin" ? "/admin" : "/dashboard"}>
                    <LayoutDashboard size={19} />
                    {user.role === "admin" ? t("nav.moderation") : t("nav.dashboard")}
                  </Link>
                </li>
              )}
              {NAV.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <Link className="nav-item" to={to}>
                    <Icon size={19} />
                    {t(label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mobile-prefs">
            <div className="mobile-langs" role="group" aria-label={t("lang.choose")}>
              <Globe size={18} aria-hidden="true" />
              <LanguageLinks className="lang-chip" />
            </div>
            <ThemeToggle />
          </div>
          <div className="mobile-actions">
            {user ? (
              <button
                type="button"
                className="btn btn-outline"
                style={{ gridColumn: "1 / -1" }}
                onClick={signOut}
              >
                <LogOut size={18} />
                {t("nav.signOut")}
              </button>
            ) : (
              <>
                <Link className="btn btn-outline" to="/login">
                  {t("nav.signIn")}
                </Link>
                <Link className="btn btn-primary" to="/register">
                  {t("nav.joinFree")}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <Link className="brand" to="/" style={{ marginBottom: 14 }}>
              <span className="brand-mark">
                <LogoMark />
              </span>
              Farm Workforce
            </Link>
            <p style={{ maxWidth: "30em", marginTop: 14 }}>{t("footer.tagline")}</p>
            <div className="footer-languages" role="group" aria-label={t("lang.choose")}>
              <Globe size={16} aria-hidden="true" />
              <LanguageLinks />
            </div>
          </div>
          <div>
            <h2>{t("footer.workers")}</h2>
            <ul>
              <li>
                <Link to="/jobs">{t("common.browseJobs")}</Link>
              </li>
              <li>
                <Link to="/register?role=worker">{t("footer.createProfile")}</Link>
              </li>
              <li>
                <Link to="/how-it-works">{t("nav.howItWorks")}</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>{t("footer.employers")}</h2>
            <ul>
              <li>
                <Link to="/register?role=employer">{t("footer.postJob")}</Link>
              </li>
              <li>
                <Link to="/how-it-works">{t("footer.hiringGuide")}</Link>
              </li>
              <li>
                <Link to="/trust">{t("footer.standards")}</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>{t("footer.trust")}</h2>
            <ul>
              <li>
                <Link to="/trust">{t("nav.trust")}</Link>
              </li>
              <li>
                <Link to="/privacy">{t("footer.privacy")}</Link>
              </li>
              <li>
                <Link to="/terms">{t("footer.terms")}</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Farm Workforce</span>
          <span>{t("footer.never")}</span>
        </div>
      </div>
    </footer>
  );
}

/** Compact language list for the footer: every language is one tap away on every page. */
function LanguageLinks({ className = "footer-lang" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <>
      {LANGUAGE_KEYS.map((code) => (
        <button
          key={code}
          type="button"
          className={className}
          aria-pressed={lang === code}
          lang={code}
          onClick={() => setLang(code)}
        >
          {LANGUAGES[code]}
        </button>
      ))}
    </>
  );
}

export function Layout() {
  const { t } = useI18n();
  const navigation = useNavigation();
  return (
    <>
      {navigation.state === "loading" && <div className="top-progress" aria-hidden="true" />}
      <a className="skip-link" href="#main">
        {t("common.skipToContent")}
      </a>
      <Header />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </>
  );
}

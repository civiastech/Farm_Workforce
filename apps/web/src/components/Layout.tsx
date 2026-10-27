import {
  Briefcase,
  CircleHelp,
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
import { useAuth } from "../lib/auth";
import { useTheme, type ThemePreference } from "../lib/theme";
import { useToast } from "../lib/toast";
import { Avatar, LogoMark } from "./ui";

const NAV = [
  { to: "/jobs", label: "Find work", icon: Search },
  { to: "/how-it-works", label: "How it works", icon: CircleHelp },
  { to: "/trust", label: "Trust & safety", icon: ShieldCheck },
];

const THEME_CYCLE: Record<ThemePreference, { next: ThemePreference; icon: typeof Sun; label: string }> = {
  system: { next: "light", icon: Monitor, label: "Theme: system" },
  light: { next: "dark", icon: Sun, label: "Theme: light" },
  dark: { next: "system", icon: Moon, label: "Theme: dark" },
};

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { icon: Icon, label, next } = THEME_CYCLE[theme];
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      onClick={() => setTheme(next)}
      aria-label={`${label}. Switch to ${next}.`}
      title={label}
    >
      <Icon size={19} />
    </button>
  );
}

function useSignOut() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  return async () => {
    await logout();
    toast("You have signed out.");
    navigate("/");
  };
}

function UserMenu() {
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
          {user.role === "admin" ? "Moderation" : "Dashboard"}
        </Link>
        {user.role !== "admin" && (
          <Link to="/dashboard/profile" onClick={close} role="menuitem">
            <UserRound size={17} />
            {user.role === "employer" ? "Organisation profile" : "My profile"}
          </Link>
        )}
        {user.role === "employer" && (
          <Link to="/dashboard/jobs" onClick={close} role="menuitem">
            <Briefcase size={17} />
            My jobs
          </Link>
        )}
        <Link to={`${home}/account`} onClick={close} role="menuitem">
          <ShieldCheck size={17} />
          Account &amp; privacy
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
          Sign out
        </button>
      </div>
    </>
  );
}

function Header() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const signOut = useSignOut();
  // The mobile menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  return (
    <header className="site-header">
      <div className="wrap nav">
        <Link className="brand" to="/" aria-label="Farm Workforce home">
          <span className="brand-mark">
            <LogoMark />
          </span>
          Farm Workforce
        </Link>
        <nav aria-label="Main">
          <ul className="nav-links">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to}>{item.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
          {user ? (
            <span className="desktop-only">
              <UserMenu />
            </span>
          ) : (
            <>
              <Link className="btn btn-ghost btn-sm desktop-only" to="/login">
                Sign in
              </Link>
              <Link className="btn btn-primary btn-sm desktop-only" to="/register">
                Join free
              </Link>
            </>
          )}
          <button
            type="button"
            className="btn btn-outline btn-icon menu-toggle"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
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
          <nav aria-label="Mobile">
            <ul>
              {user && (
                <li>
                  <Link className="nav-item" to={user.role === "admin" ? "/admin" : "/dashboard"}>
                    <LayoutDashboard size={19} />
                    {user.role === "admin" ? "Moderation" : "Dashboard"}
                  </Link>
                </li>
              )}
              {NAV.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <Link className="nav-item" to={to}>
                    <Icon size={19} />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mobile-actions">
            {user ? (
              <button
                type="button"
                className="btn btn-outline"
                style={{ gridColumn: "1 / -1" }}
                onClick={signOut}
              >
                <LogOut size={18} />
                Sign out
              </button>
            ) : (
              <>
                <Link className="btn btn-outline" to="/login">
                  Sign in
                </Link>
                <Link className="btn btn-primary" to="/register">
                  Join free
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
            <p style={{ maxWidth: "30em", marginTop: 14 }}>
              Connecting agricultural talent to opportunity across Nigeria. Free for workers — always.
            </p>
          </div>
          <div>
            <h2>Workers</h2>
            <ul>
              <li>
                <Link to="/jobs">Browse jobs</Link>
              </li>
              <li>
                <Link to="/register?role=worker">Create a profile</Link>
              </li>
              <li>
                <Link to="/how-it-works">How it works</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>Employers</h2>
            <ul>
              <li>
                <Link to="/register?role=employer">Post a job</Link>
              </li>
              <li>
                <Link to="/how-it-works">Hiring guide</Link>
              </li>
              <li>
                <Link to="/trust">Employer standards</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>Trust</h2>
            <ul>
              <li>
                <Link to="/trust">Trust &amp; safety</Link>
              </li>
              <li>
                <Link to="/privacy">Privacy notice</Link>
              </li>
              <li>
                <Link to="/terms">Terms of use</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Farm Workforce</span>
          <span>We never ask for your NIN, BVN, bank PIN or any fee to apply.</span>
        </div>
      </div>
    </footer>
  );
}

export function Layout() {
  const navigation = useNavigation();
  return (
    <>
      {navigation.state === "loading" && <div className="top-progress" aria-hidden="true" />}
      <a className="skip-link" href="#main">
        Skip to content
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

import { useState } from "react";
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from "react-router";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";

function NavItems() {
  return (
    <ul className="nav-links">
      <li>
        <NavLink to="/jobs">Find work</NavLink>
      </li>
      <li>
        <NavLink to="/how-it-works">How it works</NavLink>
      </li>
      <li>
        <NavLink to="/trust">Trust &amp; safety</NavLink>
      </li>
    </ul>
  );
}

function AccountActions() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  if (!user) {
    return (
      <div className="nav-actions">
        <Link className="btn btn-outline btn-small" to="/login">
          Sign in
        </Link>
        <Link className="btn btn-accent btn-small" to="/register">
          Join free
        </Link>
      </div>
    );
  }
  return (
    <div className="nav-actions">
      <Link className="btn btn-accent btn-small" to={user.role === "admin" ? "/admin" : "/dashboard"}>
        {user.role === "admin" ? "Moderation" : "My dashboard"}
      </Link>
      <button
        type="button"
        className="btn btn-outline btn-small"
        onClick={async () => {
          await logout();
          toast("You have signed out.");
          navigate("/");
        }}
      >
        Sign out
      </button>
    </div>
  );
}

function Header() {
  const { pathname } = useLocation();
  // The menu belongs to the page it was opened on, so navigating closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (update: (open: boolean) => boolean) => setOpenOn(update(open) ? pathname : null);

  return (
    <header className="site-header">
      <div className="wrap nav">
        <Link className="brand" to="/" aria-label="Farm Workforce home">
          <span className="brand-mark" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 64 64" fill="currentColor">
              <path d="M32 54V26" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              <path d="M32 34c0-8 6-14 14-14 0 8-6 14-14 14zM32 30c0-7-5-12-12-12 0 7 5 12 12 12z" />
            </svg>
          </span>
          <span>Farm Workforce</span>
        </Link>
        <nav aria-label="Main">
          <NavItems />
        </nav>
        <AccountActions />
        <button
          type="button"
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="visually-hidden">{open ? "Close menu" : "Open menu"}</span>
          <span aria-hidden="true">{open ? "✕" : "☰"}</span>
        </button>
      </div>
      <div id="mobile-menu" className="mobile-menu wrap" hidden={!open}>
        <nav aria-label="Mobile">
          <NavItems />
        </nav>
        <AccountActions />
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
            <p className="brand" style={{ marginBottom: 8 }}>
              Farm Workforce
            </p>
            <p style={{ maxWidth: "32em" }}>
              Connecting agricultural talent to opportunity across Nigeria. Free for workers — always.
            </p>
          </div>
          <div>
            <h2>Platform</h2>
            <ul>
              <li>
                <Link to="/jobs">Browse jobs</Link>
              </li>
              <li>
                <Link to="/register?role=employer">Post a job</Link>
              </li>
              <li>
                <Link to="/how-it-works">How it works</Link>
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
        <p className="footer-fine">
          © {new Date().getFullYear()} Farm Workforce. We never charge workers to apply, and we never ask for
          your NIN, BVN or bank PIN. Report any employer who does.
        </p>
      </div>
    </footer>
  );
}

export function Layout() {
  return (
    <>
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

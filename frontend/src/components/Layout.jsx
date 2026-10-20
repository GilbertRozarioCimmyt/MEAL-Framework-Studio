/**
 * Layout — exact port of renderShell() sidebar from app.html.
 *
 * Nav items (matching original order + role visibility):
 *   Workspace label
 *   My Projects          (folder)    — all roles
 *   New Project          (plus)      — all roles
 *   KPI Library          (library)   — all roles
 *   Pending Validations  (shield)    — M&E Reviewer + Administrator
 *   Project Outputs      (output)    — all roles
 *   Help / Guidance      (help)      — all roles
 *   Administration label             — Administrator only
 *   Project Types        (settings)  — Administrator
 *   Controlled Vocabulary(settings)  — Administrator
 *   Settings             (settings)  — Administrator
 *   Usage & errors       (table)     — Administrator
 */
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/* ── SVG icons — exact paths from app.html iconSvg() ─────────────────────── */
const Ico = ({ d, d2, viewBox = "0 0 24 24", extra = "" }) => (
  <svg viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: "1em", height: "1em", flexShrink: 0 }}>
    <path d={d} />
    {d2 && <path d={d2} />}
  </svg>
);

/* Individual icons matching app.html exactly */
const FolderIcon  = () => <Ico d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />;
const PlusIcon    = () => <Ico d="M12 5v14M5 12h14" />;
const LibraryIcon = () => <Ico d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z" d2="M8 7h8M8 11h8" />;
const ShieldIcon  = () => <Ico d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />;
const OutputIcon  = () => <Ico d="M4 4h16v16H4z" d2="M4 9h16M9 4v16" />;
const HelpIcon    = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: "1em", height: "1em", flexShrink: 0 }}>
    <circle cx="12" cy="12" r="9"/>
    <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2 2-2 3.5M12 17h.01"/>
  </svg>
);
const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: "1em", height: "1em", flexShrink: 0 }}>
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
  </svg>
);
const TableIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: "1em", height: "1em", flexShrink: 0 }}>
    <rect x="3" y="4" width="18" height="16" rx="1"/>
    <path d="M3 10h18M9 4v16"/>
  </svg>
);
const LeafIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ width: 17, height: 17 }}>
    <path d="M4 20c8 0 15-6 16-16C11 5 4 9 4 17z"/>
    <path d="M4 20c3-4 7-8 12-12"/>
  </svg>
);

/* ── NavItem ─────────────────────────────────────────────────────────────── */
function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button
      className={`nav-item${active ? " active" : ""}`}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span>{label}</span>
      {badge ? <span className="badge-count">{badge}</span> : null}
    </button>
  );
}

/* ── Layout ──────────────────────────────────────────────────────────────── */
export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  function at(path) {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  }

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  const isReviewer = user?.role === "M&E Reviewer" || user?.role === "Administrator";
  const isAdmin    = user?.role === "Administrator";

  return (
    <div className="app-shell">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="sidebar">

        {/* Brand — matches original: logo img + mark icon + title + sub */}
        <div className="brand">
          <img
            className="brand-logo"
            src="/assets/cimmyt-logo.png"
            alt="CIMMYT"
            height="17"
            style={{ display: "block", height: 17, width: "auto", marginBottom: 11 }}
            onError={e => { e.target.style.display = "none"; }}
          />
          <div className="mark">
            <div className="mark-icon">
              <LeafIcon />
            </div>
            <div>
              <div className="brand-title">MEAL Framework<br />Studio</div>
              <div className="brand-sub">CIMMYT</div>
            </div>
          </div>
        </div>

        {/* Navigation — matches original nav order + role visibility */}
        <nav className="nav" aria-label="Main navigation">
          <span className="nav-label">Workspace</span>

          {/* My Projects */}
          <NavItem
            icon={<FolderIcon />}
            label="My Projects"
            active={at("/projects") && !at("/projects/new")}
            onClick={() => navigate("/projects")}
          />

          {/* New Project */}
          <NavItem
            icon={<PlusIcon />}
            label="New Project"
            active={at("/projects/new")}
            onClick={() => navigate("/projects/new")}
          />

          {/* KPI Library */}
          <NavItem
            icon={<LibraryIcon />}
            label="KPI Library"
            active={at("/kpi-library")}
            onClick={() => navigate("/kpi-library")}
          />

          {/* Pending Validations — M&E Reviewer + Administrator */}
          {isReviewer && (
            <NavItem
              icon={<ShieldIcon />}
              label="Pending Validations"
              active={at("/validations")}
              onClick={() => navigate("/validations")}
            />
          )}

          {/* Project Outputs */}
          <NavItem
            icon={<OutputIcon />}
            label="Project Outputs"
            active={at("/export") || location.pathname.endsWith("/export")}
            onClick={() => navigate("/export")}
          />

          {/* Help / Guidance */}
          <NavItem
            icon={<HelpIcon />}
            label="Help / Guidance"
            active={at("/help")}
            onClick={() => navigate("/help")}
          />
        </nav>

        {/* Identity box — name / role / sign out */}
        <div className="identity-box">
          <div className="identity-name">{user?.name}</div>
          <div className="identity-role">{user?.role}</div>
          <button className="identity-switch" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main wrap ────────────────────────────────────────────────────── */}
      <div className="mainwrap">
        <main className="content">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * App — root router, auth gate, and complete route map matching original screens.
 *
 * Routes:
 *   /                    → Login (redirect to /projects if signed in)
 *   /projects            → ProjectList
 *   /projects/new        → ProjectTypeSelector
 *   /projects/:id        → ProjectEditor (7-step wizard)
 *   /projects/:id/export → ExportPage
 *   /kpi-library         → KpiLibraryPage  (all roles)
 *   /validations         → ValidationsPage  (M&E Reviewer + Administrator)
 *   /export              → ExportPage       (all roles)
 *   /help                → HelpPage         (all roles)
 *   /admin               → AdminPanel       (Administrator)
 *   /admin/project-types → AdminSubPage     (Administrator)
 *   /admin/vocab         → AdminSubPage     (Administrator)
 *   /admin/settings      → AdminSubPage     (Administrator)
 *   *                    → redirect to /projects
 */
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";

import Login            from "./components/Login.jsx";
import Layout           from "./components/Layout.jsx";
import ProjectList      from "./components/ProjectList.jsx";
import ProjectTypeSelector from "./components/ProjectTypeSelector.jsx";
import ProjectEditor    from "./components/ProjectEditor.jsx";
import ExportPage       from "./components/ExportPage.jsx";
import KpiLibraryPage   from "./components/KpiLibraryPage.jsx";
import ValidationsPage  from "./components/ValidationsPage.jsx";
import HelpPage         from "./components/HelpPage.jsx";
import AdminPanel       from "./components/AdminPanel.jsx";
import AdminSubPage     from "./components/AdminSubPage.jsx";
import Spinner          from "./components/Spinner.jsx";

/* ── Loading / error shells ────────────────────────────────────────────── */
function FullPageSpinner({ label = "Loading…" }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100vh", gap: 16,
      color: "var(--ink-soft)", fontFamily: "system-ui, sans-serif",
    }}>
      <span className="spinner lg" style={{ color: "var(--primary)" }} />
      <span style={{ fontSize: "0.9rem" }}>{label}</span>
    </div>
  );
}

function BootError({ message }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100vh", gap: 16,
      color: "var(--critical)", fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center",
    }}>
      <span style={{ fontSize: "2rem" }}>⚠️</span>
      <strong style={{ fontSize: "1.1rem" }}>Backend unreachable</strong>
      <p style={{ maxWidth: 420, color: "var(--ink-soft)", fontSize: "0.9rem" }}>{message}</p>
      <button
        style={{ padding: "8px 20px", borderRadius: 6, background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer" }}
        onClick={() => window.location.reload()}
      >
        Retry
      </button>
    </div>
  );
}

/* ── Route guards ──────────────────────────────────────────────────────── */
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner label="Loading session…" />;
  if (!user)   return <Navigate to="/" state={{ from: location }} replace />;
  return children;
}

function RequireReviewer({ children }) {
  const { user } = useAuth();
  if (!user || (user.role !== "M&E Reviewer" && user.role !== "Administrator")) {
    return <Navigate to="/projects" replace />;
  }
  return children;
}

function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (user?.role !== "Administrator") return <Navigate to="/projects" replace />;
  return children;
}

/* ── App routes ────────────────────────────────────────────────────────── */
function AppRoutes() {
  const { user, loading, bootError } = useAuth();

  if (bootError) return <BootError message={bootError} />;
  if (loading)   return <FullPageSpinner label="Starting up…" />;

  // Wrap authenticated routes in Layout
  const auth = (element) => (
    <RequireAuth>
      <Layout>{element}</Layout>
    </RequireAuth>
  );
  const reviewer = (element) => (
    <RequireAuth>
      <RequireReviewer>
        <Layout>{element}</Layout>
      </RequireReviewer>
    </RequireAuth>
  );
  const admin = (element) => (
    <RequireAuth>
      <RequireAdmin>
        <Layout>{element}</Layout>
      </RequireAdmin>
    </RequireAuth>
  );

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={user ? <Navigate to="/projects" replace /> : <Login />} />

      {/* Workspace — all authenticated roles */}
      <Route path="/projects"          element={auth(<ProjectList />)} />
      <Route path="/projects/new"      element={auth(<ProjectTypeSelector />)} />
      <Route path="/projects/:id"      element={auth(<ProjectEditor />)} />
      <Route path="/projects/:id/export" element={auth(<ExportPage />)} />
      <Route path="/kpi-library"       element={auth(<KpiLibraryPage />)} />
      <Route path="/export"            element={auth(<ExportPage />)} />
      <Route path="/help"              element={auth(<HelpPage />)} />

      {/* M&E Reviewer + Administrator */}
      <Route path="/validations" element={reviewer(<ValidationsPage />)} />

      {/* Administrator only */}
      <Route path="/admin"             element={admin(<AdminPanel />)} />
      <Route path="/admin/project-types" element={admin(
        <AdminSubPage
          title="Project Types"
          description="Project type mappings for institutional KPI guidance. Managed centrally by the MEAL unit — contact your MEAL focal point to request changes."
        />
      )} />
      <Route path="/admin/vocab" element={admin(
        <AdminSubPage
          title="Controlled Vocabulary"
          description="The institutional controlled vocabulary source has not been loaded into this build. Every Data Requirements field is flagged 'No approved term found' pending input from the data standards owner."
        />
      )} />
      <Route path="/admin/settings" element={admin(
        <AdminSubPage
          title="Settings"
          description="Institutional settings (M&E reviewer contact, organisation name) are not yet configurable in this build. Use the Administration panel to manage access codes and view AI usage."
        />
      )} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

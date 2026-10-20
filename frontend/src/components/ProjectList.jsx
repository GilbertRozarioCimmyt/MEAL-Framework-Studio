import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listCollection, deleteDoc } from "../api/documents.js";
import Spinner from "./Spinner.jsx";

const STATUS_LABELS = {
  draft: "Draft", needs_review: "Needs review",
  approved: "Approved", complete: "Complete", not_started: "Not started",
};
const STATUS_CSS = {
  draft: "status-draft", needs_review: "status-needsreview",
  approved: "status-approved", complete: "status-complete", not_started: "status-notstarted",
};

// Overall status: based on the "review" step for the project card badge
function overallStatus(proj) {
  const s = proj.stepStatus?.review;
  if (s === "complete") return "complete";
  const completedCount = Object.values(proj.stepStatus ?? {}).filter(v => v === "approved" || v === "complete").length;
  if (completedCount >= 6) return "needs_review";
  if (completedCount >= 1) return "draft";
  return "not_started";
}

export default function ProjectList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  useEffect(() => {
    listCollection("projects")
      .then(({ docs }) => setProjects(docs.map(d => d.data).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))))
      .catch(() => setError("Could not load projects. Refresh to try again."))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(proj) {
    if (!confirm(`Delete project "${proj.title || proj.name}"? This cannot be undone.`)) return;
    try {
      await deleteDoc("projects", proj.id);
      setProjects(prev => prev.filter(p => p.id !== proj.id));
    } catch {
      setError("Could not delete the project.");
    }
  }

  if (loading) return (
    <div className="empty">
      <span className="spinner lg" />
      <p className="small muted" style={{ marginTop: 12 }}>Loading projects…</p>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">My Projects</h1>
        <button className="btn btn-primary" onClick={() => navigate("/projects/new")}>
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 13, height: 13 }}>
            <line x1="7" y1="2" x2="7" y2="12"/><line x1="2" y1="7" x2="12" y2="7"/>
          </svg>
          New project
        </button>
      </div>

      {error && (
        <div className="alert alert-critical" style={{ marginBottom: 14 }}>{error}</div>
      )}

      {projects.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-title">No projects yet</div>
            <p className="small" style={{ marginTop: 6 }}>Start a new project to design its MEAL framework — from proposal to a validated KPI set and data requirements.</p>
            <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => navigate("/projects/new")}>
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 13, height: 13 }}>
                <line x1="7" y1="2" x2="7" y2="12"/><line x1="2" y1="7" x2="12" y2="7"/>
              </svg>
              New project
            </button>
          </div>
        </div>
      ) : (
        <ul className="project-list">
          {projects.map(proj => {
            const status = overallStatus(proj);
            return (
              <li key={proj.id} className="project-card">
                <button
                  className="project-card-main"
                  onClick={() => navigate(`/projects/${proj.id}`)}
                >
                  <span className="project-card-name">{proj.title || proj.name || "Untitled project"}</span>
                  <span className="project-card-meta row" style={{ gap: 6, alignItems: "center" }}>
                    <span className={`status-pill ${STATUS_CSS[status] || "status-notstarted"}`}>
                      {STATUS_LABELS[status] || "Not started"}
                    </span>
                    {proj.projectTypeId && (
                      <span className="small muted">· {proj.projectTypeId.replace(/-/g, " ")}</span>
                    )}
                    <span className="small muted">· {proj.updatedAt ? new Date(proj.updatedAt).toLocaleDateString() : ""}</span>
                  </span>
                </button>
                <div className="project-card-actions">
                  <button
                    className="btn btn-ghost btn-sm btn-danger"
                    onClick={() => handleDelete(proj)}
                    title="Delete project"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

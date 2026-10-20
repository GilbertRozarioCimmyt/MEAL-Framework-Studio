/**
 * ProjectTypeSelector — matches renderNewProjectType() from app.html.
 *
 * Shown at /projects/new (before the project document is created).
 * Clicking a type card creates the project skeleton and navigates
 * straight to the upload step, exactly as the original does.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setDoc } from "../api/documents.js";
import { useAuth } from "../context/AuthContext.jsx";
import Spinner from "./Spinner.jsx";

function newProjectSkeleton(typeId, typeName, ownerName) {
  const id = "proj_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  return {
    id,
    title: `New ${typeName} project`,
    projectTypeId: typeId,
    ownerName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stepStatus: {
      type: "approved",   // type is chosen here — already done
      upload: "not_started",
      rf: "not_started",
      toc: "not_started",
      kpi: "not_started",
      dr: "not_started",
      review: "not_started",
    },
    proposal: { text: "", filename: null, analyzedAt: null },
    aiExtraction: null,
    metadata: {},
    resultsFramework: { results: [], approved: false, version: 0 },
    theoryOfChange: { pathways: [], narrativeIntro: "", approved: false, version: 0 },
    selectedKPIs: [],
    dataRequirements: { rows: {}, generatedAt: null, approved: false },
    auditLog: [{ ts: new Date().toISOString(), actor: ownerName, action: "Project created", detail: `Type: ${typeId}` }],
  };
}

// Arrow icon
const ArrowIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
    <polyline points="5 2 10 7 5 12"/>
  </svg>
);

export default function ProjectTypeSelector() {
  const navigate = useNavigate();
  const { user }  = useAuth();
  const [types,    setTypes]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [creating, setCreating] = useState(null); // id of type being created
  const [error,    setError]    = useState("");

  useEffect(() => {
    fetch("/data/project-types.json")
      .then(r => r.json())
      .then(data => setTypes(data))
      .catch(() => setError("Could not load project types."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSelect(pt) {
    setCreating(pt.id);
    setError("");
    try {
      const proj = newProjectSkeleton(pt.id, pt.userLabel, user?.name ?? "Unknown");
      await setDoc("projects", proj.id, proj);
      // Navigate straight to the upload step (type is already set)
      navigate(`/projects/${proj.id}?step=upload`);
    } catch (err) {
      setError("Could not create project: " + (err.message || "Unknown error"));
      setCreating(null);
    }
  }

  return (
    <>
      {/* Back link */}
      <button className="back-link" onClick={() => navigate("/projects")} style={{ marginBottom: 8 }}>
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 12, height: 12 }}>
          <polyline points="9 2 4 7 9 12"/>
        </svg>
        All projects
      </button>

      <div className="card" style={{ maxWidth: 820 }}>
        <div className="section-head">
          <h2>What type of project are you designing?</h2>
        </div>

        <p className="hint" style={{ marginBottom: 16 }}>
          This determines how CIMMYT's institutional KPIs and methodology guidance apply to the
          project. An administrator can adjust these mappings later.
        </p>

        {error && (
          <div className="alert alert-critical" style={{ marginBottom: 14 }}>{error}</div>
        )}

        {loading ? (
          <div className="empty"><span className="spinner lg" /></div>
        ) : (
          <div className="stack">
            {types.map(pt => (
              <div
                key={pt.id}
                className="card clickable"
                style={{ padding: "14px 16px", cursor: creating ? "default" : "pointer", opacity: creating && creating !== pt.id ? 0.5 : 1 }}
                onClick={() => !creating && handleSelect(pt)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === "Enter" && !creating && handleSelect(pt)}
                aria-disabled={!!creating}
              >
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{pt.userLabel}</div>
                    <div className="small muted" style={{ marginTop: 2 }}>
                      CIMMYT MEAL matrix:{" "}
                      <code className="idchip" style={{ fontSize: 11 }}>{pt.canonicalName}</code>{" "}
                      {pt.footnote}
                    </div>
                    <div className="small soft" style={{ marginTop: 5 }}>{pt.focus}</div>
                    {pt.note && (
                      <div className="small muted" style={{ marginTop: 4, fontStyle: "italic" }}>{pt.note}</div>
                    )}
                  </div>
                  <div style={{ alignSelf: "center", color: "var(--ink-faint)", paddingLeft: 12 }}>
                    {creating === pt.id ? <Spinner /> : <ArrowIcon />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="hint" style={{ marginTop: 14 }}>
          Systems Delivery and Hub Model are related but distinct: Systems Delivery is a focused
          delivery intervention or service model; Hub Model is the most integrated systems-level
          intervention, potentially spanning multiple services, actors, geographies and delivery
          pathways.
        </div>
      </div>
    </>
  );
}

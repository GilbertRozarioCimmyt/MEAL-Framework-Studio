/**
 * ValidationsPage — matches renderValidations() from app.html.
 * Shows the M&E review queue for new-KPI suggestions.
 * Accessible to M&E Reviewer + Administrator roles only.
 */
import { useEffect, useState } from "react";
import { listCollection } from "../api/documents.js";
import Spinner from "./Spinner.jsx";

export default function ValidationsPage() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState("open"); // open | all | Approved | Rejected

  useEffect(() => {
    // Load KPI suggestions from the document store
    listCollection("kpi_suggestions")
      .then(({ docs }) => setSuggestions(docs.map(d => d.data)))
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, []);

  const STATUS_MAP = {
    "Pending review": "tag-inferred",
    "More information requested": "tag-inferred",
    "Approved": "tag-validated",
    "Rejected": "tag-missing",
    "Approved with modifications": "tag-validated",
  };

  const FILTERS = ["open", "all", "Approved", "Rejected", "Approved with modifications"];

  const filtered = filter === "all"
    ? suggestions
    : filter === "open"
      ? suggestions.filter(s => ["Pending review", "More information requested"].includes(s.status))
      : suggestions.filter(s => s.status === filter);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pending Validations</h1>
        <span className="topbar-meta">M&amp;E review queue for new-KPI suggestions</span>
      </div>

      {/* Filter chips */}
      <div className="chip-row" style={{ marginBottom: 14 }}>
        {FILTERS.map(f => (
          <button
            key={f}
            className={`filter-chip ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "open" ? "Open" : f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty"><span className="spinner lg" /></div>
      ) : filtered.length ? (
        <div className="stack">
          {filtered.map(s => (
            <div key={s.id} className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className={`tag ${STATUS_MAP[s.status] || "tag-optional"}`}>{s.status}</span>
                    <b style={{ fontSize: 13.5 }}>{s.name}</b>
                  </div>
                  <div className="small muted" style={{ marginTop: 3 }}>
                    Project: {s.projectId} · Proposed by {s.proposer} · {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : ""}
                  </div>
                </div>
              </div>
              <dl className="kv" style={{ marginTop: 10 }}>
                <dt>Measures</dt>          <dd>{s.measures}</dd>
                <dt>Linked result</dt>     <dd>{s.linkedResultText || s.linkedResult || "—"}</dd>
                <dt>Why insufficient</dt>  <dd>{s.why}</dd>
                {s.method && <><dt>Proposed method</dt><dd>{s.method}</dd></>}
              </dl>
              {(s.comments || []).length > 0 && (
                <div className="stack" style={{ marginTop: 8 }}>
                  {s.comments.map((c, i) => (
                    <div key={i} className="small" style={{ borderLeft: "2px solid var(--line-strong)", paddingLeft: 8 }}>
                      <b>{c.by}</b> · {c.at ? new Date(c.at).toLocaleDateString() : ""}<br />{c.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="empty">
            <div className="empty-title">Nothing here</div>
            <div className="small" style={{ marginTop: 6 }}>
              {filter === "open"
                ? "No pending validations — all KPI suggestions have been reviewed."
                : "No suggestions found for this filter."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

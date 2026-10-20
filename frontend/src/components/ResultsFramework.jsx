/**
 * ResultsFramework — exact port of renderStepRF() + all helpers from app.html.
 *
 * Three views:  Diagram | Table | List
 * Actions:      Load AI draft, Add result, AI suggest/draft/quality,
 *               inline edit, delete, approve RF, accept/reject suggestions
 */
import { useState, useEffect, useRef } from "react";
import { askAIJson } from "../api/ai.js";
import Spinner from "./Spinner.jsx";

/* ── Constants ─────────────────────────────────────────────────────────── */
const RESULT_LEVELS = ["Impact", "Outcome", "Intermediate Outcome", "Output", "Activity"];

const RF_QUALITY_ISSUE_TYPES = {
  wrong_level:       "Wrong results level",
  vague_statement:   "Vague or unmeasurable statement",
  duplicate:         "Duplicate or near-duplicate",
  missing_link:      "Missing parent link",
  activity_as_output:"Activity filed as Output",
  outcome_as_output: "Outcome filed as Output",
};

function rfLevelSlug(level) {
  return String(level).toLowerCase().replace(/\s+/g, "-");
}

function uid() {
  return "res_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}

function truncate(s, n) {
  s = String(s || "");
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/* ── Tree helpers (mirrors rfBuildTree / rfComputeNumbers in app.html) ──── */
function rfBuildTree(results) {
  const idSet = new Set(results.map(r => r.id));
  const childrenOf = {};
  results.forEach(r => {
    if (r.parentId && idSet.has(r.parentId)) {
      (childrenOf[r.parentId] = childrenOf[r.parentId] || []).push(r);
    }
  });
  const levelIndex = l => RESULT_LEVELS.indexOf(l);
  const roots = results.filter(r => !r.parentId || !idSet.has(r.parentId));
  roots.sort((a, b) => levelIndex(a.level) - levelIndex(b.level));
  Object.values(childrenOf).forEach(list => list.sort((a, b) => levelIndex(a.level) - levelIndex(b.level)));
  return { roots, childrenOf };
}

function rfComputeNumbers(results) {
  const { roots, childrenOf } = rfBuildTree(results);
  const numbers = {};
  (function walk(list, prefix) {
    list.forEach((r, i) => {
      const n = prefix ? `${prefix}.${i + 1}` : String(i + 1);
      numbers[r.id] = n;
      walk(childrenOf[r.id] || [], n);
    });
  })(roots, "");
  return numbers;
}

/* ── Origin tag (matches originTag() in app.html) ──────────────────────── */
function OriginTag({ origin }) {
  if (origin === "extracted")  return <span className="tag tag-extracted">Extracted</span>;
  if (origin === "inferred")   return <span className="tag tag-inferred">AI suggested</span>;
  if (origin === "ai-drafted") return <span className="tag tag-drafted">AI drafted — not in proposal</span>;
  return <span className="tag tag-useredited">User edited</span>;
}

/* ── Icons ──────────────────────────────────────────────────────────────── */
const PlusIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 13, height: 13 }}>
    <line x1="7" y1="2" x2="7" y2="12"/><line x1="2" y1="7" x2="12" y2="7"/>
  </svg>
);
const SparkleIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ width: 13, height: 13 }}>
    <path d="M7 1v2M7 11v2M1 7h2M11 7h2M3.2 3.2l1.4 1.4M9.4 9.4l1.4 1.4M3.2 10.8l1.4-1.4M9.4 4.6l1.4-1.4"/>
    <circle cx="7" cy="7" r="2"/>
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 11, height: 11 }}>
    <polyline points="2 6 5 9 10 3"/>
  </svg>
);
const EditIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ width: 13, height: 13 }}>
    <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z"/>
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ width: 13, height: 13 }}>
    <polyline points="2 4 12 4"/><path d="M5 4V3h4v1"/><rect x="3" y="4" width="8" height="9" rx="1"/>
    <line x1="6" y1="7" x2="6" y2="10"/><line x1="8" y1="7" x2="8" y2="10"/>
  </svg>
);
const XIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 10, height: 10 }}>
    <line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/>
  </svg>
);
const ChevIcon = () => (
  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 10, height: 10 }}>
    <polyline points="3 2 7 5 3 8"/>
  </svg>
);
const DiagramIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ width: 13, height: 13 }}>
    <rect x="5" y="1" width="4" height="3" rx="0.5"/><rect x="1" y="10" width="4" height="3" rx="0.5"/>
    <rect x="9" y="10" width="4" height="3" rx="0.5"/><line x1="7" y1="4" x2="7" y2="6.5"/>
    <line x1="7" y1="6.5" x2="3" y2="6.5"/><line x1="7" y1="6.5" x2="11" y2="6.5"/>
    <line x1="3" y1="6.5" x2="3" y2="10"/><line x1="11" y1="6.5" x2="11" y2="10"/>
  </svg>
);
const TableIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ width: 13, height: 13 }}>
    <rect x="1" y="1" width="12" height="12" rx="1"/><line x1="1" y1="5" x2="13" y2="5"/>
    <line x1="1" y1="9" x2="13" y2="9"/><line x1="5" y1="5" x2="5" y2="13"/>
  </svg>
);
const ListIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ width: 13, height: 13 }}>
    <line x1="4" y1="3" x2="13" y2="3"/><line x1="4" y1="7" x2="13" y2="7"/>
    <line x1="4" y1="11" x2="13" y2="11"/>
    <circle cx="1.5" cy="3" r="1" fill="currentColor" stroke="none"/>
    <circle cx="1.5" cy="7" r="1" fill="currentColor" stroke="none"/>
    <circle cx="1.5" cy="11" r="1" fill="currentColor" stroke="none"/>
  </svg>
);

/* ── Inline result editor (shared by diagram + list) ───────────────────── */
function ResultEditor({ result, results, onSave, onCancel }) {
  const [statement, setStatement] = useState(result.statement);
  const [level,     setLevel]     = useState(result.level);
  const [parentId,  setParentId]  = useState(result.parentId || "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <textarea
        rows={3}
        value={statement}
        onChange={e => setStatement(e.target.value)}
        autoFocus
        style={{ fontSize: 12.5 }}
      />
      <div className="row" style={{ gap: 6 }}>
        <select value={level} onChange={e => setLevel(e.target.value)}
          style={{ width: "auto", fontFamily: "ui-monospace,'SF Mono',Consolas,monospace" }}>
          {RESULT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={parentId} onChange={e => setParentId(e.target.value)} style={{ flex: 1 }}>
          <option value="">No parent link</option>
          {results.filter(r => r.id !== result.id).map(r => (
            <option key={r.id} value={r.id}>{r.level}: {truncate(r.statement, 50)}</option>
          ))}
        </select>
      </div>
      <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
        <button className="btn btn-sm btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-sm btn-primary" onClick={() =>
          onSave({ ...result, statement, level, parentId: parentId || null, origin: "user-edited" })
        }>
          Save
        </button>
      </div>
    </div>
  );
}

/* ── Diagram box (matches renderRFDiagramBox) ───────────────────────────── */
function DiagramBox({ result, results, numbers, editingId, onEdit, onSave, onCancel, onDelete }) {
  const isEditing = editingId === result.id;
  const slug = rfLevelSlug(result.level);
  const num = numbers[result.id];
  const parentIsLive = result.parentId && results.some(x => x.id === result.parentId);

  const levelTag = (
    <span className={`rf-level-tag lvl-${slug}`}>
      {num ? `${num} · ` : ""}{result.level}
    </span>
  );

  if (isEditing) {
    return (
      <div className="rf-diagram-box editing" id={`rfbox-${result.id}`}>
        <div className="rf-diagram-box-head">{levelTag}</div>
        <ResultEditor
          result={result}
          results={results}
          onSave={onSave}
          onCancel={onCancel}
        />
      </div>
    );
  }

  return (
    <div
      className="rf-diagram-box"
      id={`rfbox-${result.id}`}
      data-parent-id={result.parentId || undefined}
      onClick={() => onEdit(result.id)}
      title={result.statement}
    >
      <button
        className="icon-btn rf-diagram-del"
        onClick={e => { e.stopPropagation(); onDelete(result.id); }}
        title="Delete"
      >
        <XIcon />
      </button>
      <div className="rf-diagram-box-head">{levelTag}</div>
      <div className="rf-diagram-box-text">
        {truncate(result.statement, result.level === "Activity" ? 80 : 130)}
      </div>
      <div className="rf-diagram-box-meta">
        <OriginTag origin={result.origin} />
        {!parentIsLive && result.level !== "Impact" && (
          <span className="tag tag-missing">No parent link</span>
        )}
      </div>
    </div>
  );
}

/* ── Tree node (matches renderRFTreeNode) ──────────────────────────────── */
function TreeNode({ result, results, childrenOf, numbers, editingId, nodeOverrides, onToggle, onEdit, onSave, onCancel, onDelete }) {
  const kids = childrenOf[result.id] || [];
  const hasKids = kids.length > 0;

  let expanded;
  if (nodeOverrides.has(result.id)) {
    expanded = nodeOverrides.get(result.id);
  } else {
    expanded = result.level === "Impact" || result.level === "Outcome";
  }

  return (
    <div className={`rf-tree-node lvl-${rfLevelSlug(result.level)}`}>
      <DiagramBox
        result={result}
        results={results}
        numbers={numbers}
        editingId={editingId}
        onEdit={onEdit}
        onSave={onSave}
        onCancel={onCancel}
        onDelete={onDelete}
      />

      {hasKids && (
        <button
          className={`rf-tree-toggle ${expanded ? "expanded" : ""}`}
          onClick={() => onToggle(result.id, !expanded)}
        >
          <ChevIcon /> {kids.length} {rfChildLabel(kids)} {expanded ? "" : "linked below"}
        </button>
      )}

      {expanded && hasKids && (
        <div className="rf-tree-node-children">
          {kids.map(kid => (
            <TreeNode
              key={kid.id}
              result={kid}
              results={results}
              childrenOf={childrenOf}
              numbers={numbers}
              editingId={editingId}
              nodeOverrides={nodeOverrides}
              onToggle={onToggle}
              onEdit={onEdit}
              onSave={onSave}
              onCancel={onCancel}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function rfChildLabel(kids) {
  const level = kids[0]?.level;
  if (!level) return "linked below";
  const singular = level === "Activity" ? "activity" : level.toLowerCase();
  if (kids.length === 1) return singular;
  return level === "Activity" ? "activities" : level.toLowerCase() + "s";
}

/* ── SVG connector lines (mirrors drawRFDiagramConnectors) ─────────────── */
function drawConnectors(diagramRef) {
  const root = diagramRef.current;
  if (!root) return;
  const svg = root.querySelector(".rf-diagram-svg");
  if (!svg) return;

  const rootRect = root.getBoundingClientRect();
  svg.setAttribute("width",   Math.max(1, rootRect.width));
  svg.setAttribute("height",  Math.max(1, rootRect.height));
  svg.setAttribute("viewBox", `0 0 ${Math.max(1, rootRect.width)} ${Math.max(1, rootRect.height)}`);

  let html = "";
  root.querySelectorAll(".rf-diagram-box[data-parent-id]").forEach(box => {
    const pid = box.dataset.parentId;
    const parentBox = document.getElementById("rfbox-" + pid);
    if (!parentBox) return;

    const bRect = box.getBoundingClientRect();
    const pRect = parentBox.getBoundingClientRect();

    const x1   = bRect.left  + bRect.width  / 2 - rootRect.left;
    const y1   = bRect.top   - rootRect.top;
    const x2   = pRect.left  + pRect.width  / 2 - rootRect.left;
    const y2   = pRect.bottom - rootRect.top;
    const midY = (y1 + y2) / 2;

    html += `<path d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" fill="none" style="stroke:var(--line-strong); stroke-width:1.75;" />`;
    html += `<circle cx="${x2}" cy="${y2}" r="2.5" style="fill:var(--line-strong);"/>`;
  });
  svg.innerHTML = html;
}

/* ── Main ResultsFramework component ────────────────────────────────────── */
export default function ResultsFramework({ project, onChange }) {
  const rf = project.resultsFramework ?? { results: [], approved: false, version: 0 };
  const results = rf.results ?? [];

  /* ── Local state ─────────────────────────────────────────────────────── */
  const [view,           setView]           = useState("diagram"); // diagram | table | list
  const [editingId,      setEditingId]      = useState(null);
  const [nodeOverrides,  setNodeOverrides]  = useState(new Map());
  const [qualityIssues,  setQualityIssues]  = useState([]);
  const [pendingSuggest, setPendingSuggest] = useState(null);
  const [showMeta,       setShowMeta]       = useState(true);
  const [loading,        setLoading]        = useState({
    suggest: false, draftMissing: false, quality: false, loadDraft: false,
  });
  const [aiError, setAiError] = useState("");

  const diagramRef = useRef(null);

  /* ── SVG connectors after every render ──────────────────────────────── */
  useEffect(() => {
    if (view === "diagram") {
      requestAnimationFrame(() => drawConnectors(diagramRef));
    }
  });

  /* ── Window resize → redraw connectors ──────────────────────────────── */
  useEffect(() => {
    const handler = () => {
      if (view === "diagram") drawConnectors(diagramRef);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [view]);

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function saveRF(newResults, extra = {}) {
    const updated = {
      ...project,
      resultsFramework: { ...rf, results: newResults, ...extra },
    };
    onChange(updated);
  }

  function saveResult(r) {
    const exists = results.find(x => x.id === r.id);
    if (exists) {
      saveRF(results.map(x => x.id === r.id ? r : x));
    } else {
      saveRF([...results, r]);
    }
    setEditingId(null);
  }

  function deleteResult(id) {
    saveRF(results.filter(r => r.id !== id));
    if (editingId === id) setEditingId(null);
  }

  function addResult() {
    const r = { id: uid(), level: "Output", statement: "", origin: "user-edited", parentId: null };
    saveRF([...results, r]);
    setEditingId(r.id);
  }

  /* ── Computed ────────────────────────────────────────────────────────── */
  const { roots, childrenOf } = rfBuildTree(results);
  const numbers  = rfComputeNumbers(results);

  const grouped = {};
  RESULT_LEVELS.forEach(l => { grouped[l] = []; });
  results.forEach(r => { (grouped[r.level] = grouped[r.level] || []).push(r); });
  const missingLevels = RESULT_LEVELS.filter(l => grouped[l].length === 0);

  /* ── AI: load extracted draft ────────────────────────────────────────── */
  function handleLoadDraft() {
    if (!project.aiExtraction?.results) return;
    const incoming = project.aiExtraction.results.map(r => ({
      id: uid(),
      level: r.level ?? "Output",
      statement: r.statement ?? "",
      origin: r.origin ?? "inferred",
      parentId: null,
      existingIndicators: r.existingIndicators ?? "",
      sourceRef: r.sourceRef ?? "",
    }));
    // Skip duplicates (by statement similarity — exact match)
    const existingTexts = new Set(results.map(r => r.statement.trim().toLowerCase()));
    const toAdd = incoming.filter(r => !existingTexts.has(r.statement.trim().toLowerCase()));
    saveRF([...results, ...toAdd]);
  }

  /* ── AI: suggest one missing link ───────────────────────────────────── */
  async function handleSuggestMissing() {
    if (!results.length) return;
    setLoading(l => ({ ...l, suggest: true }));
    setAiError("");
    try {
      const rfSummary = results.map(r => `[${r.level}] ${r.statement}`).join("\n");
      const result = await askAIJson(
        `Review this CIMMYT project Results Framework and identify a single important result that is clearly missing or implied but not stated.\n\nRF:\n${rfSummary}\n\nReturn JSON: {"level":"Impact"|"Outcome"|"Intermediate Outcome"|"Output","statement":"...","rationale":"why this result is missing"}`,
        { modelTier: "default", feature: "rf_suggest_missing_result" }
      );
      setPendingSuggest({
        id: uid(),
        level: result.level ?? "Output",
        statement: result.statement ?? "",
        rationale: result.rationale ?? "",
        origin: "inferred",
        parentId: null,
      });
    } catch (err) {
      setAiError(err.userMessage || err.message);
    } finally {
      setLoading(l => ({ ...l, suggest: false }));
    }
  }

  /* ── AI: draft missing levels ────────────────────────────────────────── */
  async function handleDraftMissingLevels() {
    if (!results.length || !missingLevels.length) return;
    setLoading(l => ({ ...l, draftMissing: true }));
    setAiError("");
    try {
      const rfSummary = results.map(r => `[${r.level}] ${r.statement}`).join("\n");
      const drafted = await askAIJson(
        `This CIMMYT project Results Framework is missing these levels: ${missingLevels.join(", ")}.\n\nFor each missing level, draft 2-4 plausible results based on what IS present in the framework.\n\nExisting RF:\n${rfSummary}\n\nReturn JSON array: [{"level":"...","statement":"..."}]\nOnly include results for the missing levels: ${missingLevels.join(", ")}.`,
        { modelTier: "default", feature: "rf_draft_missing_levels" }
      );
      const toAdd = (Array.isArray(drafted) ? drafted : []).map(r => ({
        id: uid(),
        level: r.level ?? "Output",
        statement: r.statement ?? "",
        origin: "ai-drafted",
        parentId: null,
      }));
      saveRF([...results, ...toAdd]);
    } catch (err) {
      setAiError(err.userMessage || err.message);
    } finally {
      setLoading(l => ({ ...l, draftMissing: false }));
    }
  }

  /* ── AI: quality check ───────────────────────────────────────────────── */
  async function handleQualityCheck() {
    if (!results.length) return;
    setLoading(l => ({ ...l, quality: true }));
    setAiError("");
    try {
      const rfSummary = results.map(r => `[id:${r.id}] [${r.level}] ${r.statement}`).join("\n");
      const result = await askAIJson(
        `Review this CIMMYT Results Framework and identify structural issues.\n\nRF:\n${rfSummary}\n\nFor each issue return:\n{"issueType":"wrong_level"|"vague_statement"|"duplicate"|"missing_link"|"activity_as_output"|"outcome_as_output","resultId":"...","currentStatement":"...","issueDetected":"...","suggestedRevision":"...","suggestedLevel":"..."}\n\nIssueType must be one of the listed values. Return JSON: {"issues":[...]} — empty array if no issues.`,
        { modelTier: "default", feature: "rf_quality_check" }
      );
      const issues = (result.issues ?? []).map((iss, i) => ({ ...iss, _id: `qi_${i}_${Date.now()}` }));
      setQualityIssues(issues);
    } catch (err) {
      setAiError(err.userMessage || err.message);
    } finally {
      setLoading(l => ({ ...l, quality: false }));
    }
  }

  /* ── Quality issue actions ───────────────────────────────────────────── */
  function acceptQualityIssue(iss) {
    const r = results.find(x => x.id === iss.resultId);
    if (!r) { rejectQualityIssue(iss._id); return; }
    const updated = { ...r, origin: "user-edited" };
    if (iss.suggestedRevision) updated.statement = iss.suggestedRevision;
    if (iss.suggestedLevel)    updated.level     = iss.suggestedLevel;
    saveRF(results.map(x => x.id === r.id ? updated : x));
    setQualityIssues(prev => prev.filter(i => i._id !== iss._id));
  }

  function rejectQualityIssue(id) {
    setQualityIssues(prev => prev.filter(i => i._id !== id));
  }

  /* ── Pending suggestion ──────────────────────────────────────────────── */
  function acceptSuggestion() {
    if (!pendingSuggest) return;
    saveRF([...results, pendingSuggest]);
    setPendingSuggest(null);
  }

  /* ── Node expand/collapse ────────────────────────────────────────────── */
  function toggleNode(id, expanded) {
    setNodeOverrides(prev => new Map(prev).set(id, expanded));
  }

  function expandAll() {
    const overrides = new Map();
    results.forEach(r => { if ((childrenOf[r.id] || []).length > 0) overrides.set(r.id, true); });
    setNodeOverrides(overrides);
  }

  function collapseToOverview() {
    const overrides = new Map();
    results.forEach(r => {
      const hasKids = (childrenOf[r.id] || []).length > 0;
      if (hasKids) overrides.set(r.id, r.level === "Impact" || r.level === "Outcome");
    });
    setNodeOverrides(overrides);
  }

  /* ── Approve / unapprove ─────────────────────────────────────────────── */
  function approveRF() {
    const updated = {
      ...project,
      resultsFramework: { ...rf, approved: true, approvedAt: new Date().toISOString(), version: (rf.version || 0) + 1 },
      stepStatus: { ...project.stepStatus, rf: "approved" },
    };
    onChange(updated);
  }

  function unapproveRF() {
    onChange({ ...project, resultsFramework: { ...rf, approved: false }, stepStatus: { ...project.stepStatus, rf: "draft" } });
  }

  /* ── RENDER ─────────────────────────────────────────────────────────── */

  // ── Metadata block ──────────────────────────────────────────────────────
  const metaBlock = (() => {
    if (!project.aiExtraction?.metadata) return null;
    const m = project.aiExtraction.metadata;
    const keys = Object.keys(m).filter(k => m[k]?.value);
    if (!keys.length) return null;
    return (
      <div className="card" style={{ background: "var(--surface-2)", marginBottom: 14 }}>
        <div className="row" style={{ justifyContent: "space-between", cursor: "pointer" }}
          onClick={() => setShowMeta(v => !v)}>
          <b style={{ fontSize: 12.5 }}>Extracted project metadata</b>
          <span className="small muted">{showMeta ? "Hide" : "Show"}</span>
        </div>
        {showMeta && (
          <dl className="kv" style={{ marginTop: 10 }}>
            {keys.map(k => (
              <>
                <dt key={k + "_dt"} style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".03em", color: "var(--ink-faint)", fontWeight: 600 }}>
                  {k.replace(/_/g, " ")}
                </dt>
                <dd key={k + "_dd"} style={{ marginBottom: 8 }}>
                  {m[k].value}{" "}
                  {m[k].status === "INFERRED"
                    ? <span className="tag tag-inferred">AI inferred</span>
                    : <span className="tag tag-extracted">Extracted</span>}
                  {m[k].evidence && (
                    <div className="evidence-quote">"{m[k].evidence}"</div>
                  )}
                </dd>
              </>
            ))}
          </dl>
        )}
        {project.aiExtraction.notes && (
          <div className="small soft" style={{ marginTop: 8, fontStyle: "italic" }}>
            {project.aiExtraction.notes}
          </div>
        )}
      </div>
    );
  })();

  // ── Quality issues ─────────────────────────────────────────────────────
  const qualityBlock = qualityIssues.length > 0 && (
    <div style={{ marginBottom: 14 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <b style={{ fontSize: 12.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--ink-faint)" }}>
          Quality check — {qualityIssues.length} issue{qualityIssues.length !== 1 ? "s" : ""} found
        </b>
        <button className="linkbtn small" onClick={() => setQualityIssues([])}>Dismiss all</button>
      </div>
      {qualityIssues.map(iss => {
        const r = iss.resultId ? results.find(x => x.id === iss.resultId) : null;
        const canAccept = !!(r && (iss.suggestedRevision || iss.suggestedLevel));
        return (
          <div key={iss._id} className="card" style={{ borderColor: "var(--gold)", background: "var(--gold-soft)", marginBottom: 10 }}>
            <span className="tag tag-inferred">{RF_QUALITY_ISSUE_TYPES[iss.issueType] || iss.issueType}</span>
            {(iss.currentStatement || r?.statement) && (
              <div className="small muted" style={{ marginTop: 8 }}>
                <b>Current statement:</b> {iss.currentStatement || r.statement}
              </div>
            )}
            <div className="small" style={{ marginTop: 6 }}>
              <b>Issue detected:</b> {iss.issueDetected || ""}
            </div>
            {iss.suggestedRevision && (
              <div className="small" style={{ marginTop: 6 }}>
                <b>Suggested revision:</b> {iss.suggestedRevision}
              </div>
            )}
            {iss.suggestedLevel && (
              <div className="small" style={{ marginTop: 6 }}>
                <b>Suggested level:</b> {iss.suggestedLevel}
              </div>
            )}
            <div className="row" style={{ marginTop: 10 }}>
              {canAccept && (
                <button className="btn btn-sm btn-primary" onClick={() => acceptQualityIssue(iss)}>
                  <CheckIcon /> Accept
                </button>
              )}
              <button className="btn btn-sm" onClick={() => rejectQualityIssue(iss._id)}>
                {canAccept ? "Reject" : "Dismiss"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Pending AI suggestion ──────────────────────────────────────────────
  const pendingBlock = pendingSuggest && (
    <div className="card" style={{ borderColor: "var(--gold)", background: "var(--gold-soft)", marginBottom: 14 }}>
      <span className="tag tag-inferred">AI suggested — not yet added</span>
      <div className="prose" style={{ marginTop: 8, fontSize: 13.5 }}>
        <b>{pendingSuggest.level}:</b> {pendingSuggest.statement}
      </div>
      <div className="small soft" style={{ marginTop: 6 }}>{pendingSuggest.rationale}</div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn btn-sm btn-primary" onClick={acceptSuggestion}>
          <CheckIcon /> Accept
        </button>
        <button className="btn btn-sm" onClick={() => setPendingSuggest(null)}>Reject</button>
      </div>
    </div>
  );

  // ── Diagram ────────────────────────────────────────────────────────────
  const diagramView = (
    <>
      <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginBottom: 10 }}>
        <button className="btn btn-sm btn-ghost" onClick={collapseToOverview} title="Show just the overview levels">
          <DiagramIcon /> Collapse to overview
        </button>
        <button className="btn btn-sm btn-ghost" onClick={expandAll} title="Show every result and every link">
          <SparkleIcon /> Expand all
        </button>
      </div>
      <div className="rf-diagram" ref={diagramRef}>
        <svg className="rf-diagram-svg" />
        {roots.length === 0
          ? <div className="small muted" style={{ padding: "24px 0", textAlign: "center" }}>Add at least one result to see the diagram.</div>
          : (
            <div className="rf-tree-roots">
              {roots.map(r => (
                <TreeNode
                  key={r.id}
                  result={r}
                  results={results}
                  childrenOf={childrenOf}
                  numbers={numbers}
                  editingId={editingId}
                  nodeOverrides={nodeOverrides}
                  onToggle={toggleNode}
                  onEdit={id => setEditingId(editingId === id ? null : id)}
                  onSave={saveResult}
                  onCancel={() => setEditingId(null)}
                  onDelete={deleteResult}
                />
              ))}
            </div>
          )
        }
      </div>
      <p className="hint" style={{ textAlign: "center", marginTop: 10 }}>
        Click a box to edit it, or the count below a box to show or hide what's linked to it.
      </p>
    </>
  );

  // ── Table view ─────────────────────────────────────────────────────────
  const tableView = (() => {
    if (!results.length) return (
      <div className="small muted" style={{ padding: "24px 0", textAlign: "center" }}>
        Add at least one result to see the table.
      </div>
    );

    const rows = [];
    const visited = new Set();
    function walk(r, depth) {
      rows.push({ r, depth });
      visited.add(r.id);
      (childrenOf[r.id] || []).forEach(k => walk(k, depth + 1));
    }
    roots.forEach(r => walk(r, 0));
    const levelIndex = l => RESULT_LEVELS.indexOf(l);
    results.filter(r => !visited.has(r.id))
      .sort((a, b) => levelIndex(a.level) - levelIndex(b.level))
      .forEach(r => rows.push({ r, depth: 0 }));

    return (
      <>
        <div className="table-wrap rf-table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ whiteSpace: "nowrap" }}>No.</th>
                <th style={{ whiteSpace: "nowrap" }}>Level</th>
                <th>Statement</th>
                <th>Linked to</th>
                <th>Existing indicator(s)</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ r, depth }) => {
                const parent = r.parentId ? results.find(x => x.id === r.parentId) : null;
                return (
                  <tr key={r.id} className={`lvl-${rfLevelSlug(r.level)}`}>
                    <td className="mono small" style={{ whiteSpace: "nowrap" }}>{numbers[r.id] || "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{r.level}</td>
                    <td style={{ paddingLeft: 12 + depth * 16 }}>
                      {r.statement}
                      {r.sourceRef && <div className="evidence-quote">"{r.sourceRef}"</div>}
                    </td>
                    <td>{parent ? truncate(parent.statement, 60) : <span className="small muted">—</span>}</td>
                    <td>{r.existingIndicators || <span className="small muted">—</span>}</td>
                    <td><OriginTag origin={r.origin} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>Read-only — edit statements and links in Diagram or List view.</p>
      </>
    );
  })();

  // ── List view ──────────────────────────────────────────────────────────
  const listView = RESULT_LEVELS.map(level => {
    const group = grouped[level] || [];
    return (
      <div key={level} style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h4 style={{ fontSize: 12.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--ink-faint)" }}>
            {level === "Activity" ? "Activities" : level + "s"}
          </h4>
        </div>
        {group.length ? group.map(r => {
          const num = numbers[r.id];
          const parent = r.parentId ? results.find(x => x.id === r.parentId) : null;
          return (
            <div key={r.id} className="card" style={{ padding: "12px 14px", marginBottom: 8 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {num && <span className={`rf-level-tag lvl-${rfLevelSlug(r.level)}`} style={{ marginBottom: 6 }}>{num}</span>}
                  {editingId === r.id ? (
                    <ResultEditor result={r} results={results} onSave={saveResult} onCancel={() => setEditingId(null)} />
                  ) : (
                    <>
                      <div className="prose" style={{ fontSize: 13.5 }}>{r.statement}</div>
                      <div className="row small muted" style={{ marginTop: 6, gap: 8 }}>
                        <OriginTag origin={r.origin} />
                        {parent && <span>↳ linked to: {truncate(parent.statement, 50)}</span>}
                        {r.existingIndicators && <span>· existing indicator(s): {r.existingIndicators}</span>}
                      </div>
                      {r.sourceRef && <div className="evidence-quote">"{r.sourceRef}"</div>}
                    </>
                  )}
                </div>
                {editingId !== r.id && (
                  <div className="row" style={{ flex: "0 0 auto" }}>
                    <button className="icon-btn" style={{ width: 28, height: 28 }}
                      onClick={() => setEditingId(r.id)} title="Edit">
                      <EditIcon />
                    </button>
                    <button className="icon-btn" style={{ width: 28, height: 28 }}
                      onClick={() => deleteResult(r.id)} title="Delete">
                      <TrashIcon />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        }) : (
          <div className="small muted" style={{ padding: "8px 0" }}>
            No {level.toLowerCase()} defined yet.
          </div>
        )}
      </div>
    );
  });

  /* ── Final render ────────────────────────────────────────────────────── */
  return (
    <div className="card">
      {/* Header */}
      <div className="section-head">
        <h3>Results Framework</h3>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {project.aiExtraction?.results && (
            <button className="btn btn-sm" onClick={handleLoadDraft}
              disabled={loading.loadDraft}>
              <SparkleIcon /> {results.length === 0 ? "Load AI-extracted draft" : "Re-sync AI-extracted results"}
            </button>
          )}
          <button className="btn btn-sm" onClick={addResult}>
            <PlusIcon /> Add result
          </button>
          <button className="btn btn-sm" onClick={handleSuggestMissing}
            disabled={loading.suggest}>
            <SparkleIcon /> {loading.suggest ? "Checking…" : "AI: suggest missing link"}
          </button>
          {missingLevels.length > 0 && results.length > 0 && (
            <button className="btn btn-sm" onClick={handleDraftMissingLevels}
              disabled={loading.draftMissing}>
              <SparkleIcon /> {loading.draftMissing ? "Drafting…" : "AI: draft missing levels"}
            </button>
          )}
          {results.length > 0 && (
            <button className="btn btn-sm" onClick={handleQualityCheck}
              disabled={loading.quality}>
              <SparkleIcon /> {loading.quality ? "Checking…" : "AI: quality check"}
            </button>
          )}
        </div>
      </div>

      <p className="hint" style={{ marginBottom: 10 }}>
        Impact → Outcome → Intermediate Outcome → Output → Activity. Edit statements, link levels, and accept or reject AI suggestions individually — nothing from AI is added silently.
      </p>

      {/* View toggle */}
      <div className="row" style={{ justifyContent: "space-between", margin: "10px 0 4px" }}>
        <div className="segctl">
          <button className={`segctl-btn ${view === "diagram" ? "active" : ""}`}
            onClick={() => setView("diagram")}>
            <DiagramIcon /> Diagram
          </button>
          <button className={`segctl-btn ${view === "table" ? "active" : ""}`}
            onClick={() => setView("table")}>
            <TableIcon /> Table
          </button>
          <button className={`segctl-btn ${view === "list" ? "active" : ""}`}
            onClick={() => setView("list")}>
            <ListIcon /> List
          </button>
        </div>
      </div>

      {/* Missing levels warning */}
      {missingLevels.length > 0 && results.length > 0 && (
        <div className="ai-note" style={{ marginBottom: 10 }}>
          ⚠ No {missingLevels.map(l => l.toLowerCase() + (l === "Activity" ? "ies" : "s")).join(", ")} yet.
          {" "}Use "AI: draft missing levels" above to get draft suggestions to review — they're tagged{" "}
          <span className="tag tag-drafted" style={{ verticalAlign: "middle" }}>AI drafted</span>
          {" "}and are never added without you reviewing each one.
        </div>
      )}

      {/* Loading indicators */}
      {loading.draftMissing && (
        <div className="ai-note" style={{ marginBottom: 10 }}>
          <Spinner /> Drafting suggestions for the missing level(s)…
        </div>
      )}
      {loading.quality && (
        <div className="ai-note" style={{ marginBottom: 10 }}>
          <Spinner /> Reviewing the framework for structural issues — duplicates, wrong levels, activities filed as outputs, missing links…
        </div>
      )}

      {aiError && (
        <div className="alert alert-critical" style={{ marginBottom: 14 }}>{aiError}</div>
      )}

      {/* Metadata + quality + pending */}
      {metaBlock}
      {qualityBlock}
      {pendingBlock}

      {/* Main view */}
      {view === "diagram" && diagramView}
      {view === "table"   && tableView}
      {view === "list"    && listView}

      <hr className="divider" />

      {/* Approve / unapprove */}
      {rf.approved ? (
        <div className="alert alert-success">
          <CheckIcon />
          <div>
            <b>Approved</b> on {rf.approvedAt ? new Date(rf.approvedAt).toLocaleString() : ""}
            {" "}· version {rf.version}.{" "}
            <button className="linkbtn" onClick={unapproveRF}>Revert to draft to edit</button>
          </div>
        </div>
      ) : (
        <>
          <button
            className="btn btn-primary btn-block"
            onClick={approveRF}
            disabled={results.length === 0}
          >
            <CheckIcon /> Approve Results Framework
          </button>
          {results.length === 0 && (
            <div className="hint" style={{ textAlign: "center" }}>
              Add at least one result before approving.
            </div>
          )}
        </>
      )}
    </div>
  );
}

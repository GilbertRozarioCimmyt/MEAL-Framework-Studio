/**
 * TheoryOfChange — exact port of renderStepToC() + all helpers from app.html.
 *
 * Requires approved Results Framework.
 * One synthesised pathway: IF … AND IF … THEN … WHICH CONTRIBUTES TO …
 * + Assumptions, Risks, Risk Mitigation Plan.
 * PATHWAY_DETAIL_CAP = 4 (max items per list, matching the original).
 */
import { useState } from "react";
import { askAIJson, askAIText } from "../api/ai.js";
import Spinner from "./Spinner.jsx";
import { useNavigate, useParams } from "react-router-dom";

/* ── Constants ─────────────────────────────────────────────────────────── */
const PATHWAY_DETAIL_CAP = 4;

const KPI_TIERS = {
  core:       "A · Core accountability",
  optional:   "B · Management / optional",
  evaluation: "C · Evaluation-only",
};

/** Remove any leading "IF " / "AND IF " the model sometimes writes itself */
function stripIfPrefix(s) {
  return String(s || "").replace(/^\s*(and\s+if|if)\s+/i, "");
}

function uid() {
  return "path_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}

function truncate(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n) + "…" : s; }

/* ── Icons ──────────────────────────────────────────────────────────────── */
const SparkleIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ width: 13, height: 13 }}>
    <path d="M7 1v2M7 11v2M1 7h2M11 7h2M3.2 3.2l1.4 1.4M9.4 9.4l1.4 1.4M3.2 10.8l1.4-1.4M9.4 4.6l1.4-1.4"/><circle cx="7" cy="7" r="2"/>
  </svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 13, height: 13 }}>
    <line x1="7" y1="2" x2="7" y2="12"/><line x1="2" y1="7" x2="12" y2="7"/>
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
const SearchIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ width: 13, height: 13 }}>
    <circle cx="6" cy="6" r="4"/><line x1="9.5" y1="9.5" x2="13" y2="13"/>
  </svg>
);

/* ── Pathway editor (inline form) ───────────────────────────────────────── */
function PathwayEditor({ path, onSave, onCancel, onAIImprove, loadingImprove }) {
  const [ifs,         setIfs]         = useState((path.ifs || []).map(stripIfPrefix).join("\n"));
  const [then_,       setThen]        = useState(path.then || "");
  const [contrib,     setContrib]     = useState(path.contributesTo || "");
  const [assumptions, setAssumptions] = useState((path.assumptions || []).join("\n"));
  const [risks,       setRisks]       = useState((path.risks || []).join("\n"));
  const [mitigation,  setMitigation]  = useState((path.riskMitigation || []).join("\n"));

  function handleSave() {
    const parseLines = (s, cap) => s.split("\n").map(l => l.trim()).filter(Boolean).slice(0, cap);
    onSave({
      ...path,
      ifs:           parseLines(ifs, PATHWAY_DETAIL_CAP),
      then:          then_.trim(),
      contributesTo: contrib.trim(),
      assumptions:   parseLines(assumptions, PATHWAY_DETAIL_CAP),
      risks:         parseLines(risks, PATHWAY_DETAIL_CAP),
      riskMitigation:parseLines(mitigation, PATHWAY_DETAIL_CAP),
    });
  }

  return (
    <div style={{ marginTop: 8 }}>
      <label className="field-label">
        IF statements (one per line, first is "IF", rest "AND IF" — max {PATHWAY_DETAIL_CAP}, kept strategic)
      </label>
      <textarea rows={3} value={ifs} onChange={e => setIfs(e.target.value)} />

      <label className="field-label" style={{ marginTop: 8 }}>THEN</label>
      <textarea rows={2} value={then_} onChange={e => setThen(e.target.value)} />

      <label className="field-label" style={{ marginTop: 8 }}>WHICH CONTRIBUTES TO</label>
      <textarea rows={2} value={contrib} onChange={e => setContrib(e.target.value)} />

      <label className="field-label" style={{ marginTop: 8 }}>
        Assumptions (one per line, max {PATHWAY_DETAIL_CAP})
      </label>
      <textarea rows={2} value={assumptions} onChange={e => setAssumptions(e.target.value)} />

      <label className="field-label" style={{ marginTop: 8 }}>
        Risks (one per line, max {PATHWAY_DETAIL_CAP})
      </label>
      <textarea rows={2} value={risks} onChange={e => setRisks(e.target.value)} />

      <label className="field-label" style={{ marginTop: 8 }}>
        Risk mitigation plan (one per line, same order as risks above)
      </label>
      <textarea rows={2} value={mitigation} onChange={e => setMitigation(e.target.value)} />

      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn btn-sm btn-primary" onClick={handleSave}>Save</button>
        <button className="btn btn-sm btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-sm" onClick={() => onAIImprove({
          ...path,
          ifs: ifs.split("\n").map(l => l.trim()).filter(Boolean),
          then: then_.trim(), contributesTo: contrib.trim(),
          assumptions: assumptions.split("\n").map(l => l.trim()).filter(Boolean),
          risks: risks.split("\n").map(l => l.trim()).filter(Boolean),
          riskMitigation: mitigation.split("\n").map(l => l.trim()).filter(Boolean),
        })} disabled={loadingImprove}>
          <SparkleIcon /> {loadingImprove ? "Improving…" : "AI: improve this section"}
        </button>
      </div>
    </div>
  );
}

/* ── Pathway card (view + edit) ─────────────────────────────────────────── */
function PathwayCard({
  project, path, index, editingId,
  onEdit, onSave, onCancel, onDelete,
  onAIImprove, onAIExplain, onAIRegenerate, onAIDraftRisks,
  loadingImprove, loadingExplain, loadingRisks,
}) {
  const isEditing = editingId === path.id;

  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      {/* Header */}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b className="small" style={{ textTransform: "uppercase", letterSpacing: ".04em", color: "var(--ink-faint)" }}>
          Pathway {index + 1} — project theory of change
        </b>
        <div className="row">
          <button className="btn btn-sm btn-ghost" onClick={() => onAIExplain(path)} disabled={loadingExplain === path.id}>
            {loadingExplain === path.id ? <><Spinner /> Explaining…</> : "Explain logic"}
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => onAIRegenerate(path)}>
            Regenerate
          </button>
          <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => onEdit(path.id)} title="Edit">
            <EditIcon />
          </button>
          <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => onDelete(path.id)} title="Delete">
            <TrashIcon />
          </button>
        </div>
      </div>

      {isEditing ? (
        <PathwayEditor
          path={path}
          onSave={onSave}
          onCancel={onCancel}
          onAIImprove={onAIImprove}
          loadingImprove={loadingImprove}
        />
      ) : (
        <>
          {/* IF / AND IF / THEN / WHICH CONTRIBUTES TO */}
          <div className="prose" style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.7 }}>
            {(path.ifs || []).map((f, j) => (
              <div key={j}>
                <b>{j === 0 ? "IF" : "AND IF"}</b> {stripIfPrefix(f)}
              </div>
            ))}
            <div style={{ marginTop: 4 }}><b>THEN</b> {path.then}</div>
            <div><b>WHICH CONTRIBUTES TO</b> {path.contributesTo}</div>
          </div>

          {/* Actors / Assumptions / Enabling conditions */}
          <div className="grid-2" style={{ marginTop: 10 }}>
            {path.actors?.length > 0 && (
              <div className="small"><b className="soft">Actors:</b> {path.actors.join(", ")}</div>
            )}
            {path.assumptions?.length > 0 && (
              <div className="small"><b className="soft">Assumptions:</b> {path.assumptions.join("; ")}</div>
            )}
            {path.enablingConditions?.length > 0 && (
              <div className="small"><b className="soft">Enabling conditions:</b> {path.enablingConditions.join("; ")}</div>
            )}
          </div>

          {/* Risks & mitigation */}
          <div style={{ marginTop: 10 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <b className="small soft">Risks &amp; mitigation:</b>
              <button className="btn btn-sm btn-ghost" onClick={() => onAIDraftRisks(path)} disabled={loadingRisks === path.id}>
                <SparkleIcon /> {loadingRisks === path.id ? "Drafting…" : (path.risks?.length ? "Redraft" : "AI: draft risks & mitigation")}
              </button>
            </div>
            {path.risks?.length > 0 ? (
              <div className="stack" style={{ marginTop: 4 }}>
                {path.risks.map((r, j) => (
                  <div key={j} className="small" style={{ padding: "6px 8px", background: "var(--surface-2)", borderRadius: 6 }}>
                    <b>Risk:</b> {r}
                    {path.riskMitigation?.[j] && (
                      <><br /><b>Mitigation:</b> {path.riskMitigation[j]}</>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="small muted" style={{ marginTop: 4 }}>
                No risks captured yet. Use "AI: draft risks &amp; mitigation" above, or use the edit icon above to add them manually.
              </div>
            )}
          </div>

          {/* AI explanation */}
          {path.aiExplain && (
            <div className="ai-note" style={{ marginTop: 8 }}>
              <SparkleIcon /> <span>{path.aiExplain}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Weak assumptions display ───────────────────────────────────────────── */
function WeakAssumptions({ list }) {
  if (!list) return null;
  if (!list.length) return (
    <div className="alert alert-success" style={{ marginTop: 10 }}>
      <CheckIcon /> No notably weak assumptions flagged.
    </div>
  );
  return (
    <div className="card" style={{ borderColor: "var(--warning)", background: "var(--warning-soft)", marginTop: 10 }}>
      <b style={{ fontSize: 12.5 }}>⚠ AI-flagged weak assumptions</b>
      {list.map((a, i) => (
        <div key={i} style={{ marginTop: 8, fontSize: 12.5 }}>
          <b>{a.assumption}</b>
          <div className="soft">{a.concern}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export default function TheoryOfChange({ project, onChange }) {
  const navigate = useNavigate();
  const { id }   = useParams();

  const toc     = project.theoryOfChange ?? { pathways: [], narrativeIntro: "", approved: false, version: 0 };
  const rfDone  = project.resultsFramework?.approved;

  const [editingId,        setEditingId]        = useState(null);
  const [weakAssumptions,  setWeakAssumptions]  = useState(null);
  const [aiError,          setAiError]          = useState("");
  const [loading, setLoading] = useState({
    toc: false, weakAssumptions: false, improve: null, explain: null, risks: null,
  });

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function saveToc(pathways, extra = {}) {
    onChange({
      ...project,
      theoryOfChange: { ...toc, pathways, ...extra },
    });
  }

  function newPathway() {
    return {
      id: uid(), ifs: [], then: "", contributesTo: "",
      assumptions: [], risks: [], riskMitigation: [],
      actors: [], enablingConditions: [],
    };
  }

  function savePathway(updated) {
    saveToc(toc.pathways.map(p => p.id === updated.id ? updated : p));
    setEditingId(null);
  }

  function deletePathway(id) {
    saveToc(toc.pathways.filter(p => p.id !== id));
    if (editingId === id) setEditingId(null);
  }

  /* ── AI: generate / regenerate full ToC ─────────────────────────────── */
  async function handleGenerate() {
    setLoading(l => ({ ...l, toc: true }));
    setAiError("");
    try {
      const rfSummary = (project.resultsFramework?.results || [])
        .map(r => `[${r.level}] ${r.statement}`).join("\n");
      const pt = await fetch("/data/project-types.json").then(r => r.json())
        .then(types => types.find(t => t.id === project.projectTypeId))
        .catch(() => null);

      const result = await askAIJson(
        `Generate a single Theory of Change pathway for this CIMMYT project.

Project type: ${pt?.userLabel || project.projectTypeId || "general"}
Project title: ${project.title || ""}

Results Framework:
${rfSummary}

Proposal excerpt:
${(project.proposal?.text || "").slice(0, 8000)}

The pathway must be strategic-level, not a copy of the Results Framework.
Max ${PATHWAY_DETAIL_CAP} IF conditions, ${PATHWAY_DETAIL_CAP} assumptions, ${PATHWAY_DETAIL_CAP} risks.

Return JSON:
{
  "ifs": ["condition 1", "condition 2"],
  "then": "THEN statement",
  "contributesTo": "WHICH CONTRIBUTES TO statement",
  "assumptions": ["assumption 1"],
  "risks": ["risk 1"],
  "riskMitigation": ["mitigation for risk 1"]
}`,
        { modelTier: "complex", feature: "toc_generate" }
      );

      const pathway = {
        ...newPathway(),
        ifs:           (result.ifs || []).map(stripIfPrefix).slice(0, PATHWAY_DETAIL_CAP),
        then:          result.then || "",
        contributesTo: result.contributesTo || "",
        assumptions:   (result.assumptions || []).slice(0, PATHWAY_DETAIL_CAP),
        risks:         (result.risks || []).slice(0, PATHWAY_DETAIL_CAP),
        riskMitigation:(result.riskMitigation || []).slice(0, PATHWAY_DETAIL_CAP),
      };

      saveToc([pathway], { narrativeIntro: result.narrativeIntro || toc.narrativeIntro || "" });
    } catch (err) {
      setAiError(err.userMessage || err.message);
    } finally {
      setLoading(l => ({ ...l, toc: false }));
    }
  }

  /* ── AI: regenerate a single pathway ────────────────────────────────── */
  async function handleAIRegenerate(path) {
    setLoading(l => ({ ...l, toc: true }));
    setAiError("");
    try {
      const rfSummary = (project.resultsFramework?.results || [])
        .map(r => `[${r.level}] ${r.statement}`).join("\n");
      const result = await askAIJson(
        `Regenerate this Theory of Change pathway for a CIMMYT project. Keep the same logical structure but improve quality, specificity and CGIAR alignment.
Max ${PATHWAY_DETAIL_CAP} items per list.

Current pathway:
IF: ${path.ifs.join("; ")}
THEN: ${path.then}
WHICH CONTRIBUTES TO: ${path.contributesTo}

Results Framework context:
${rfSummary.slice(0, 4000)}

Return same JSON shape.`,
        { modelTier: "default", feature: "toc_generate" }
      );
      savePathway({
        ...path,
        ifs:           (result.ifs || path.ifs).map(stripIfPrefix).slice(0, PATHWAY_DETAIL_CAP),
        then:          result.then || path.then,
        contributesTo: result.contributesTo || path.contributesTo,
        assumptions:   (result.assumptions || path.assumptions || []).slice(0, PATHWAY_DETAIL_CAP),
        risks:         (result.risks || path.risks || []).slice(0, PATHWAY_DETAIL_CAP),
        riskMitigation:(result.riskMitigation || path.riskMitigation || []).slice(0, PATHWAY_DETAIL_CAP),
      });
    } catch (err) {
      setAiError(err.userMessage || err.message);
    } finally {
      setLoading(l => ({ ...l, toc: false }));
    }
  }

  /* ── AI: improve a pathway (from editor) ────────────────────────────── */
  async function handleAIImprove(path) {
    setLoading(l => ({ ...l, improve: path.id }));
    setAiError("");
    try {
      const result = await askAIJson(
        `Improve this Theory of Change pathway for a CIMMYT project.
Max ${PATHWAY_DETAIL_CAP} items per list. Return same JSON shape.
Current: IF: ${path.ifs.join("; ")} THEN: ${path.then} WHICH CONTRIBUTES TO: ${path.contributesTo}
Assumptions: ${(path.assumptions || []).join("; ")} Risks: ${(path.risks || []).join("; ")}`,
        { modelTier: "default", feature: "toc_improve_section" }
      );
      savePathway({
        ...path,
        ifs:           (result.ifs || path.ifs).map(stripIfPrefix).slice(0, PATHWAY_DETAIL_CAP),
        then:          result.then || path.then,
        contributesTo: result.contributesTo || path.contributesTo,
        assumptions:   (result.assumptions || path.assumptions || []).slice(0, PATHWAY_DETAIL_CAP),
        risks:         (result.risks || path.risks || []).slice(0, PATHWAY_DETAIL_CAP),
        riskMitigation:(result.riskMitigation || path.riskMitigation || []).slice(0, PATHWAY_DETAIL_CAP),
      });
    } catch (err) {
      setAiError(err.userMessage || err.message);
    } finally {
      setLoading(l => ({ ...l, improve: null }));
    }
  }

  /* ── AI: explain logic ───────────────────────────────────────────────── */
  async function handleAIExplain(path) {
    setLoading(l => ({ ...l, explain: path.id }));
    setAiError("");
    try {
      const { text } = await askAIText(
        `Explain in 2-3 sentences why this Theory of Change pathway is logical for a CIMMYT project — focus on the causal chain and why the assumptions are reasonable.
IF: ${path.ifs.join("; ")} THEN: ${path.then} WHICH CONTRIBUTES TO: ${path.contributesTo}`,
        { modelTier: "quick", feature: "toc_pathway_explain" }
      );
      saveToc(toc.pathways.map(p => p.id === path.id ? { ...p, aiExplain: text } : p));
    } catch (err) {
      setAiError(err.userMessage || err.message);
    } finally {
      setLoading(l => ({ ...l, explain: null }));
    }
  }

  /* ── AI: draft risks & mitigation ───────────────────────────────────── */
  async function handleAIDraftRisks(path) {
    setLoading(l => ({ ...l, risks: path.id }));
    setAiError("");
    try {
      const result = await askAIJson(
        `Draft up to ${PATHWAY_DETAIL_CAP} strategic risks and mitigations for this CIMMYT Theory of Change pathway.
IF: ${path.ifs.join("; ")} THEN: ${path.then} WHICH CONTRIBUTES TO: ${path.contributesTo}
Existing assumptions: ${(path.assumptions || []).join("; ")}
Return JSON: {"risks":["risk 1"],"riskMitigation":["mitigation 1"]} — same count for each array, max ${PATHWAY_DETAIL_CAP}.`,
        { modelTier: "default", feature: "toc_draft_risks" }
      );
      savePathway({
        ...path,
        risks:          (result.risks || []).slice(0, PATHWAY_DETAIL_CAP),
        riskMitigation: (result.riskMitigation || []).slice(0, PATHWAY_DETAIL_CAP),
      });
    } catch (err) {
      setAiError(err.userMessage || err.message);
    } finally {
      setLoading(l => ({ ...l, risks: null }));
    }
  }

  /* ── AI: identify weak assumptions ──────────────────────────────────── */
  async function handleWeakAssumptions() {
    setLoading(l => ({ ...l, weakAssumptions: true }));
    setWeakAssumptions(null);
    setAiError("");
    try {
      const allAssumptions = toc.pathways.flatMap(p => p.assumptions || []);
      if (!allAssumptions.length) { setWeakAssumptions([]); return; }
      const result = await askAIJson(
        `Identify any notably weak, vague or unstated assumptions in this CIMMYT Theory of Change.
Assumptions to review: ${allAssumptions.join("; ")}
Return JSON: {"weakAssumptions":[{"assumption":"...","concern":"why this is weak or risky"}]} — empty array if none.`,
        { modelTier: "default", feature: "toc_weak_assumptions" }
      );
      setWeakAssumptions(result.weakAssumptions || []);
    } catch (err) {
      setAiError(err.userMessage || err.message);
    } finally {
      setLoading(l => ({ ...l, weakAssumptions: false }));
    }
  }

  /* ── Approve / unapprove ─────────────────────────────────────────────── */
  function approveToc() {
    onChange({
      ...project,
      theoryOfChange: { ...toc, approved: true, approvedAt: new Date().toISOString(), version: (toc.version || 0) + 1 },
      stepStatus: { ...project.stepStatus, toc: "approved" },
    });
  }
  function unapproveToc() {
    onChange({ ...project, theoryOfChange: { ...toc, approved: false }, stepStatus: { ...project.stepStatus, toc: "draft" } });
  }

  /* ── Gate: RF must be approved ───────────────────────────────────────── */
  if (!rfDone) {
    return (
      <div className="card">
        <div className="empty">
          <div className="empty-title">Approve the Results Framework first</div>
          <div className="small" style={{ marginTop: 6 }}>The Theory of Change is grounded in the approved Results Framework.</div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => navigate(`/projects/${id}?step=rf`)}>
            Go to Results Framework
          </button>
        </div>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="card">
      {/* Header */}
      <div className="section-head">
        <h3>Theory of Change</h3>
        <div className="row">
          <button className="btn btn-sm btn-primary" onClick={handleGenerate} disabled={loading.toc}>
            {loading.toc ? <><Spinner /> Drafting…</> : <><SparkleIcon /> {toc.pathways.length ? "Regenerate" : "Generate with AI"}</>}
          </button>
          {toc.pathways.length > 0 && (
            <button className="btn btn-sm" onClick={handleWeakAssumptions} disabled={loading.weakAssumptions}>
              <SearchIcon /> {loading.weakAssumptions ? "Checking…" : "Identify weak assumptions"}
            </button>
          )}
        </div>
      </div>

      <p className="hint">
        One synthesised pathway per project, kept strategic: IF … AND IF … THEN … WHICH CONTRIBUTES TO … followed by high-level Assumptions, Risks and a Risk Mitigation Plan.
        At most {PATHWAY_DETAIL_CAP} "IF/AND IF" conditions, {PATHWAY_DETAIL_CAP} assumptions and {PATHWAY_DETAIL_CAP} risks, each written at the level of the whole project.
        Granular, result-by-result detail belongs in the Results Framework, not here.
      </p>

      {aiError && <div className="alert alert-critical" style={{ marginBottom: 14 }}>{aiError}</div>}
      {loading.toc && <div className="small muted"><Spinner /> Drafting the Theory of Change…</div>}

      {/* Narrative intro */}
      {toc.narrativeIntro && (
        <div className="card" style={{ background: "var(--surface-2)", padding: "12px 14px", marginTop: 8 }}>
          <div className="prose">{toc.narrativeIntro}</div>
        </div>
      )}

      {/* Weak assumptions */}
      <WeakAssumptions list={weakAssumptions} />

      {/* Pathways */}
      <div className="stack" style={{ marginTop: 12 }}>
        {toc.pathways.map((path, i) => (
          <PathwayCard
            key={path.id}
            project={project}
            path={path}
            index={i}
            editingId={editingId}
            onEdit={id => setEditingId(editingId === id ? null : id)}
            onSave={savePathway}
            onCancel={() => setEditingId(null)}
            onDelete={deletePathway}
            onAIImprove={handleAIImprove}
            onAIExplain={handleAIExplain}
            onAIRegenerate={handleAIRegenerate}
            onAIDraftRisks={handleAIDraftRisks}
            loadingImprove={loading.improve}
            loadingExplain={loading.explain}
            loadingRisks={loading.risks}
          />
        ))}
      </div>

      {!toc.pathways.length && (
        <button
          className="btn btn-sm"
          style={{ marginTop: 10 }}
          onClick={() => {
            const p = newPathway();
            saveToc([...toc.pathways, p]);
            setEditingId(p.id);
          }}
        >
          <PlusIcon /> Add pathway manually
        </button>
      )}

      <hr className="divider" />

      {/* Approve / unapprove */}
      {toc.approved ? (
        <div className="alert alert-success">
          <CheckIcon />
          <div>
            <b>Approved</b> on {toc.approvedAt ? new Date(toc.approvedAt).toLocaleString() : ""} · version {toc.version}.{" "}
            <button className="linkbtn" onClick={unapproveToc}>Revert to draft to edit</button>
          </div>
        </div>
      ) : (
        <>
          <button
            className="btn btn-primary btn-block"
            onClick={approveToc}
            disabled={toc.pathways.length === 0}
          >
            <CheckIcon /> Approve Theory of Change
          </button>
          {toc.pathways.length === 0 && (
            <div className="hint" style={{ textAlign: "center" }}>
              Generate or add at least one pathway before approving.
            </div>
          )}
        </>
      )}
    </div>
  );
}

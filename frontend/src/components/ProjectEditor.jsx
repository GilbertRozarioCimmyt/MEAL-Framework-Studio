/**
 * ProjectEditor — the full wizard matching renderProjectScreen() in app.html.
 *
 * 7 steps: type → upload → rf → toc → kpi → dr → review
 * Step is tracked in the URL: /projects/:id?step=upload
 * Stepper + Back/Continue nav matches stepperHtml() / stepNav() from app.html.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { getDoc, setDoc } from "../api/documents.js";
import { uploadFile } from "../api/uploads.js";
import ResultsFramework from "./ResultsFramework.jsx";
import TheoryOfChange   from "./TheoryOfChange.jsx";
import KPISelector      from "./KPISelector.jsx";
import Spinner          from "./Spinner.jsx";

// ── Wizard steps (mirrors WIZARD_STEPS in app.html) ────────────────────────
const WIZARD_STEPS = [
  { key: "type",   label: "Project Type" },
  { key: "upload", label: "Proposal Upload" },
  { key: "rf",     label: "Results Framework" },
  { key: "toc",    label: "Theory of Change" },
  { key: "kpi",    label: "KPI Selection" },
  { key: "dr",     label: "Data Requirements" },
  { key: "review", label: "Final Review" },
];

// ── Status computation (mirrors computeStepStatus in app.html) ─────────────
function computeStepStatus(project, key) {
  if (!project) return "not_started";
  if (key === "kpi") {
    return (project.selectedKPIs?.length > 0) ? "approved" : (project.stepStatus?.kpi || "not_started");
  }
  if (key === "dr") {
    return project.dataRequirements?.approved ? "approved" : (project.stepStatus?.dr || "not_started");
  }
  return project.stepStatus?.[key] || "not_started";
}

function isDone(status) { return status === "approved" || status === "complete"; }

// ── Icons ───────────────────────────────────────────────────────────────────
const CheckIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}>
    <polyline points="2 6 5 9 10 3"/>
  </svg>
);
const ArrowLeftIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
    <polyline points="9 2 4 7 9 12"/>
  </svg>
);
const ArrowRightIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
    <polyline points="5 2 10 7 5 12"/>
  </svg>
);
const SparkleIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
    <path d="M7 1v2M7 11v2M1 7h2M11 7h2M3.2 3.2l1.4 1.4M9.4 9.4l1.4 1.4M3.2 10.8l1.4-1.4M9.4 4.6l1.4-1.4"/>
    <circle cx="7" cy="7" r="2"/>
  </svg>
);

// ── Stepper ─────────────────────────────────────────────────────────────────
function Stepper({ project, currentStep, onStepClick }) {
  return (
    <div className="stepper">
      {WIZARD_STEPS.map((s, i) => {
        const status  = computeStepStatus(project, s.key);
        const done    = isDone(status);
        const current = currentStep === s.key;
        return (
          <div
            key={s.key}
            className={`step ${done ? "done" : ""} ${current ? "current" : ""}`}
            onClick={() => onStepClick(s.key)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === "Enter" && onStepClick(s.key)}
            title={s.label}
          >
            <div className="dot">{done ? <CheckIcon /> : i + 1}</div>
            <div className="lbl">{s.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Step navigation (matches stepNav() in app.html) ────────────────────────
function StepNav({ project, currentKey, nextDisabled }) {
  const navigate = useNavigate();
  const { id }   = useParams();
  const idx  = WIZARD_STEPS.findIndex(s => s.key === currentKey);
  const prev = WIZARD_STEPS[idx - 1];
  const next = WIZARD_STEPS[idx + 1];

  function go(key) { navigate(`/projects/${id}?step=${key}`); }

  return (
    <div className="row" style={{ justifyContent: "space-between", marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
      <div>
        {prev && (
          <button className="btn" onClick={() => go(prev.key)}>
            <ArrowLeftIcon /> Back: {prev.label}
          </button>
        )}
      </div>
      <div>
        {next && (
          <button
            className={`btn ${nextDisabled ? "" : "btn-primary"}`}
            disabled={!!nextDisabled}
            onClick={() => go(next.key)}
          >
            Continue: {next.label} <ArrowRightIcon />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Step: Project Type (within existing project) ────────────────────────────
function StepType({ project, onChange, projectTypes }) {
  return (
    <div className="card">
      <div className="section-head"><h3>Project type</h3></div>
      <div className="grid-2">
        {projectTypes.map(pt => {
          const selected = project.projectTypeId === pt.id;
          return (
            <div
              key={pt.id}
              className="card clickable"
              role="button"
              tabIndex={0}
              style={{
                padding: "12px 14px",
                cursor: "pointer",
                borderColor: selected ? "var(--primary)" : undefined,
                background: selected ? "var(--primary-soft)" : undefined,
              }}
              onClick={() => {
                const updated = { ...project, projectTypeId: pt.id, title: project.title.startsWith("New ") ? `New ${pt.userLabel} project` : project.title };
                updated.stepStatus = { ...updated.stepStatus, type: "approved" };
                onChange(updated);
              }}
              onKeyDown={e => e.key === "Enter" && e.currentTarget.click()}
            >
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{pt.userLabel}</div>
                {selected && <CheckIcon />}
              </div>
              <div className="small muted" style={{ marginTop: 3 }}>
                <code className="idchip" style={{ fontSize: 10.5 }}>{pt.canonicalName}</code> {pt.footnote}
              </div>
              <div className="small soft" style={{ marginTop: 5 }}>{pt.focus}</div>
            </div>
          );
        })}
      </div>
      <StepNav project={project} currentKey="type" nextDisabled={!project.projectTypeId} />
    </div>
  );
}

// ── Step: Proposal Upload ───────────────────────────────────────────────────
function StepUpload({ project, onChange }) {
  const [uploadBusy, setUploadBusy] = useState(false);
  const [piiConfirmed, setPiiConfirmed] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiErr, setAiErr] = useState("");
  const textRef = useRef(null);

  function readFileText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.onerror = reject;
      r.readAsText(file);
    });
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadBusy(true);
    try {
      const text = await readFileText(file);
      const updated = {
        ...project,
        proposal: { ...project.proposal, text, filename: file.name },
      };
      onChange(updated);
      uploadFile(file).catch(() => {});
    } catch { setAiErr("Could not read the file."); }
    finally { setUploadBusy(false); e.target.value = ""; }
  }

  async function handleSaveText() {
    const text = textRef.current?.value ?? project.proposal?.text ?? "";
    onChange({ ...project, proposal: { ...project.proposal, text } });
  }

  async function handleAnalyze() {
    if (!project.proposal?.text?.trim()) return;
    setAnalyzing(true); setAiErr("");
    try {
      // Dynamic import so we don't force-load anthropic at startup
      const { askAIJson } = await import("../api/ai.js");
      const excerpt = project.proposal.text.slice(0, 42000);
      const extracted = await askAIJson(
        `Extract metadata and a draft Results Framework from this CIMMYT project proposal. Return JSON:\n{\n  "title": "...",\n  "projectObjective": "...",\n  "countries": ["..."],\n  "crops": ["..."],\n  "partners": ["..."],\n  "results": [{"level":"Impact"|"Outcome"|"Intermediate Outcome"|"Output","statement":"...","origin":"extracted"|"inferred"}]\n}\n\nPROPOSAL:\n${excerpt}`,
        { modelTier: "complex", feature: "proposal_analysis" }
      );
      const updated = {
        ...project,
        aiExtraction: extracted,
        metadata: {
          title: extracted.title,
          projectObjective: extracted.projectObjective,
          countries: extracted.countries,
          crops: extracted.crops,
          partners: extracted.partners,
        },
        resultsFramework: {
          ...project.resultsFramework,
          results: (extracted.results || []).map(r => ({
            id: "res_" + Math.random().toString(36).slice(2, 9),
            level: r.level ?? "Output",
            statement: r.statement ?? "",
            origin: r.origin ?? "inferred",
            linkedResultIds: [],
          })),
        },
        proposal: { ...project.proposal, analyzedAt: new Date().toISOString() },
        stepStatus: { ...project.stepStatus, upload: "approved" },
      };
      onChange(updated);
    } catch (err) { setAiErr(err.userMessage || err.message); }
    finally { setAnalyzing(false); }
  }

  const text = project.proposal?.text ?? "";
  const analyzed = !!project.aiExtraction && project.stepStatus?.upload !== "ai_processing";

  return (
    <div className="card">
      <div className="section-head"><h3>Upload the project proposal</h3></div>
      <p className="hint" style={{ marginBottom: 14 }}>
        Supported for automatic text extraction: PDF and DOCX (also TXT/MD).
        PPTX and XLSX can be attached, but paste their key text below for AI analysis.
      </p>

      {/* File upload */}
      <div className="field">
        <label className="field-label">Upload file</label>
        <input
          type="file"
          accept=".pdf,.docx,.txt,.md,.pptx,.xlsx"
          onChange={handleFileSelect}
          disabled={uploadBusy}
        />
        {project.proposal?.filename && (
          <div className="small" style={{ marginTop: 6 }}>
            📄 <strong>{project.proposal.filename}</strong> attached
          </div>
        )}
        {uploadBusy && (
          <div className="small muted" style={{ marginTop: 6 }}>
            <Spinner /> Reading document…
          </div>
        )}
      </div>

      {/* Paste area */}
      <div className="field">
        <label className="field-label">Or paste / edit proposal text directly</label>
        <textarea
          ref={textRef}
          rows={10}
          defaultValue={text}
          placeholder="Paste the proposal narrative here — objectives, results framework, target geographies, partners, indicators already defined, etc."
          style={{ fontFamily: "ui-monospace,'SF Mono',Consolas,monospace", fontSize: 12.5 }}
        />
        <div className="hint">{text.length.toLocaleString()} characters captured</div>
      </div>

      {/* PII confirmation (matches original requirement) */}
      <div className="field" style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px" }}>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, cursor: "pointer", margin: 0 }}>
          <input
            type="checkbox"
            style={{ marginTop: 3 }}
            checked={piiConfirmed}
            onChange={e => setPiiConfirmed(e.target.checked)}
          />
          <span>
            I confirm this proposal is already signed, public or fictitious — or that exact budget
            figures, dates, and donor/contact names have been removed before pasting or uploading it here.{" "}
            <strong>Required before saving or analyzing a proposal.</strong>
          </span>
        </label>
      </div>

      <button
        className="btn"
        onClick={handleSaveText}
        disabled={!piiConfirmed}
        title={!piiConfirmed ? "Confirm the checkbox above first" : undefined}
      >
        Save proposal text
      </button>

      <hr className="divider" />

      {/* AI Analysis */}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <strong>AI Proposal Analysis</strong>
          <div className="small muted">Extracts project metadata and a draft Results Framework, tagging every field Extracted or AI-inferred.</div>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleAnalyze}
          disabled={!piiConfirmed || !text.trim() || analyzing}
          title={!piiConfirmed ? "Confirm the checkbox above first" : undefined}
        >
          {analyzing ? <><Spinner /> Analyzing…</> : <><SparkleIcon /> {project.aiExtraction ? "Re-run AI analysis" : "Analyze with AI"}</>}
        </button>
      </div>

      {analyzing && (
        <div className="ai-note" style={{ marginTop: 10 }}>
          <Spinner /> Reading the proposal and drafting a Results Framework — this can take up to 90
          seconds for a long document.
        </div>
      )}

      {aiErr && <div className="alert alert-critical" style={{ marginTop: 10 }}>{aiErr}</div>}

      {analyzed && !analyzing && (
        <div className="alert alert-success" style={{ marginTop: 10 }}>
          ✓ Proposal analyzed {project.proposal?.analyzedAt
            ? new Date(project.proposal.analyzedAt).toLocaleString()
            : ""}
          . Proceed to Results Framework to review the draft →
        </div>
      )}

      <StepNav project={project} currentKey="upload" nextDisabled={!text.trim()} />
    </div>
  );
}

// ── Data Requirements helpers ───────────────────────────────────────────────
/** Matches deriveDataRequirementRow() in app.html */
function deriveDataRequirementRow(kpi) {
  const unit = kpi?.unit || "";
  return {
    variables: (kpi?.unitOfObservation || "").split(".")[0] || kpi?.name || "",
    dataType: /percentage|%|rate|share/i.test(unit)
      ? "Numeric (percentage)"
      : /count|number|volume|tonnes|kg|ha/i.test(unit)
        ? "Numeric (quantity)"
        : "Numeric / structured",
  };
}

/** Matches sourcedMethodologyHtml() — fixed Toolbox fields, not AI-generated */
function SourcedMethodology({ kpi }) {
  if (!kpi) return null;
  return (
    <dl className="kv" style={{ marginTop: 6 }}>
      <dt>Data source</dt>          <dd style={{ fontSize: 12.5 }}>{kpi.dataSource || "—"}</dd>
      <dt>Collection instrument</dt><dd style={{ fontSize: 12.5 }}>{kpi.collectionInstrument || "—"}</dd>
      <dt>Unit of observation</dt>  <dd style={{ fontSize: 12.5 }}>{kpi.unitOfObservation || "—"}</dd>
      <dt>Frequency</dt>
      <dd style={{ fontSize: 12.5 }}>
        {kpi.collectionFrequency || "—"}
        {kpi.reportingFrequency ? <> (reported {kpi.reportingFrequency})</> : null}
      </dd>
      <dt>Aggregation</dt><dd style={{ fontSize: 12.5 }}>{kpi.aggregationRule || "—"}</dd>
    </dl>
  );
}

/** Matches renderDRKpiTable() */
function DRKpiTable({ rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>KPI</th>
            <th>Required variables</th>
            <th>Data type</th>
            <th>Unit</th>
            <th>Disaggregation</th>
            <th>Data source</th>
            <th>Frequency</th>
            <th>Vocabulary</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(kpi => {
            const dr = deriveDataRequirementRow(kpi);
            return (
              <tr key={kpi.id}>
                <td><span className="idchip">{kpi.id}</span></td>
                <td style={{ maxWidth: 160, fontSize: 12.5 }}>{(dr.variables || "").slice(0, 80)}</td>
                <td style={{ fontSize: 12.5 }}>{dr.dataType}</td>
                <td style={{ fontFamily: "ui-monospace,'SF Mono',Consolas,monospace", fontSize: 12 }}>{kpi.unit}</td>
                <td style={{ maxWidth: 180, fontSize: 12.5 }}>{(kpi.disaggregationRequired || "").slice(0, 90)}</td>
                <td style={{ maxWidth: 180, fontSize: 12.5 }}>{(kpi.dataSource || "").slice(0, 90)}</td>
                <td style={{ fontSize: 12.5 }}>{kpi.collectionFrequency}</td>
                <td><span className="tag tag-missing">No approved term found</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Matches renderDRMethodologyCard() — per-KPI card with Toolbox fields + notes textarea */
function DRMethodologyCard({ project, kpi, onNoteChange, onAIDraft, draftingId }) {
  const note = project.dataRequirements?.narrativeNotes?.[kpi.id] || "";
  return (
    <div className="card" style={{ padding: "12px 14px" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b className="small">
          <span className="idchip">{kpi.id}</span>{" "}
          {kpi.name}
          {kpi.isCustom && (
            <span className="tag tag-useredited" style={{ verticalAlign: "middle", marginLeft: 6 }}>
              Project-specific
            </span>
          )}
        </b>
        {!kpi.isCustom && (
          <button
            className="linkbtn small"
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            onClick={() => alert(
              `CIMMYT Toolbox — Vol ${kpi.volumeNumber} · ${kpi.volumeTitle}\n\n${kpi.name}\n\n` +
              `Definition:\n${kpi.definition}\n\nData source:\n${kpi.dataSource}\n\n` +
              `Collection instrument:\n${kpi.collectionInstrument}\n\nUnit of observation:\n` +
              `${kpi.unitOfObservation}\n\nAggregation:\n${kpi.aggregationRule}`
            )}
          >
            📄 Full guide — Vol {kpi.volumeNumber}
          </button>
        )}
      </div>

      {kpi.isCustom && (
        <div className="small soft" style={{ marginTop: 4 }}>{kpi.definition}</div>
      )}

      {/* Fixed Toolbox fields (not AI) */}
      <SourcedMethodology kpi={kpi} />

      {/* Project-specific notes textarea — library KPIs only */}
      {!kpi.isCustom && (
        <>
          <label className="field-label" style={{ marginTop: 10 }}>
            Project-specific notes (optional)
          </label>
          <textarea
            key={kpi.id + "_note"}
            rows={3}
            style={{ marginTop: 4 }}
            defaultValue={note}
            placeholder="Only what's specific to this project beyond the standard method above — or write your own."
            onBlur={e => onNoteChange(kpi.id, e.target.value)}
          />
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <div className="small muted">
              <i>Optional — confirm with the M&amp;E team where project-specific statistical design is required.</i>
            </div>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => onAIDraft(kpi)}
              disabled={draftingId === kpi.id}
            >
              {draftingId === kpi.id
                ? <><Spinner /> Drafting…</>
                : <><SparkleIcon /> {note ? "Redraft" : "AI: draft"}</>
              }
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const KPI_TIERS_DR = {
  core:       "A · Core accountability",
  optional:   "B · Management / optional",
  evaluation: "C · Evaluation-only",
};
function normalizeTierDR(t) { return (t && KPI_TIERS_DR[t]) ? t : "core"; }

function buildKpiDisplayRow(sel, allKpis) {
  const kpi = allKpis.find(k => k.id === sel.kpiId);
  if (kpi) return { ...kpi, isCustom: false, tier: normalizeTierDR(sel.tier) };
  if (sel.source === "project-specific" && sel.customFields) {
    const c = sel.customFields;
    return {
      id: sel.customId || "PS", name: c.name || "(unnamed)", definition: c.definition || "",
      unit: c.unit || "—", resultsLevel: "Project-specific", volumeNumber: null, volumeTitle: null,
      dataSource: c.dataSource || "—", collectionInstrument: c.calculation || "—",
      unitOfObservation: c.responsibleUnit || "—", collectionFrequency: c.frequency || "—",
      reportingFrequency: "", aggregationRule: c.calculation || "—",
      disaggregationRequired: c.disaggregation || "—", isCustom: true, tier: normalizeTierDR(sel.tier),
    };
  }
  return null;
}

// ── Step: Data Requirements ─────────────────────────────────────────────────
/**
 * Exact port of renderStepDR() + renderDRKpiTable() + renderDRMethodologyCard()
 * + sourcedMethodologyHtml() + deriveDataRequirementRow() from app.html.
 */
function StepDataRequirements({ project, onChange }) {
  const navigate = useNavigate();
  const { id }   = useParams();
  const [allKpis,     setAllKpis]     = useState([]);
  const [draftingId,  setDraftingId]  = useState(null);
  const [draftingAll, setDraftingAll] = useState(false);
  const [aiError,     setAiError]     = useState("");
  const [saved,       setSaved]       = useState(false);

  useEffect(() => {
    fetch("/data/kpis.json").then(r => r.json()).then(setAllKpis).catch(() => {});
  }, []);

  /* ── Gate ─────────────────────────────────────────────────────────── */
  if (!project.selectedKPIs?.length) {
    return (
      <div className="card">
        <div className="empty">
          <div className="empty-title">Select KPIs first</div>
          <button className="btn" style={{ marginTop: 12 }}
            onClick={() => navigate(`/projects/${id}?step=kpi`)}>
            Go to KPI Selection
          </button>
        </div>
        <StepNav project={project} currentKey="dr" nextDisabled />
      </div>
    );
  }

  /* ── Helpers ─────────────────────────────────────────────────────── */
  const dr     = project.dataRequirements || { rows: {}, narrativeNotes: {}, approved: false };
  const notes  = dr.narrativeNotes || {};
  const rows   = project.selectedKPIs.map(sel => buildKpiDisplayRow(sel, allKpis)).filter(Boolean);
  const byTier = {
    core:       rows.filter(r => r.tier === "core"),
    optional:   rows.filter(r => r.tier === "optional"),
    evaluation: rows.filter(r => r.tier === "evaluation"),
  };

  function updateDR(patch) {
    onChange({ ...project, dataRequirements: { ...dr, ...patch } });
  }

  function handleNoteChange(kpiId, value) {
    updateDR({ narrativeNotes: { ...notes, [kpiId]: value }, approved: false });
  }

  function handleSaveNotes() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  /* ── AI: draft guidance for one KPI ─────────────────────────────── */
  async function handleAIDraft(kpi) {
    setDraftingId(kpi.id); setAiError("");
    try {
      const { askAIText } = await import("../api/ai.js");
      const proposalExcerpt = (project.proposal?.text || "").slice(0, 3000);
      const pt = await fetch("/data/project-types.json").then(r => r.json())
        .then(types => types.find(t => t.id === project.projectTypeId)).catch(() => null);

      const prompt =
        `A CIMMYT MEAL team is about to collect data for this indicator on a specific project. ` +
        `Its institutional methodology (from the CIMMYT Toolbox, Vol ${kpi.volumeNumber} — ${kpi.volumeTitle}) ` +
        `is fixed and already shown to them elsewhere — you must NOT restate or paraphrase the definition, ` +
        `data source, instrument, unit of observation or frequency below; they already have that verbatim.\n\n` +
        `KPI: ${kpi.name}\nID: ${kpi.id}\nUnit: ${kpi.unit}\nResults level: ${kpi.resultsLevel}\n` +
        `Project type: ${pt?.userLabel || project.projectTypeId || "general"} (${pt?.canonicalName || ""})\n\n` +
        `Proposal context (excerpt):\n"""\n${proposalExcerpt || "(none)"}\n"""\n\n` +
        `In 2-3 sentences, add ONLY what is specific to applying this indicator in THIS project — ` +
        `e.g. adapting the instrument to this project's target group/geography, a sampling or timing ` +
        `consideration tied to the proposal, or a quality-assurance risk specific to this context. ` +
        `If nothing genuinely project-specific applies, say so plainly rather than inventing generic advice.\n` +
        `Return plain text only, no headers.`;

      const { text } = await askAIText(prompt, { modelTier: "quick", feature: "kpi_method_guidance" });
      updateDR({ narrativeNotes: { ...notes, [kpi.id]: text.trim() }, approved: false });
    } catch (err) {
      setAiError(err.userMessage || err.message);
    } finally {
      setDraftingId(null);
    }
  }

  /* ── AI: draft notes for ALL KPIs (skip those already drafted) ───── */
  async function handleAIDraftAll() {
    setDraftingAll(true); setAiError("");
    let updatedNotes = { ...notes };
    try {
      const { askAIText } = await import("../api/ai.js");
      const proposalExcerpt = (project.proposal?.text || "").slice(0, 3000);
      const pt = await fetch("/data/project-types.json").then(r => r.json())
        .then(types => types.find(t => t.id === project.projectTypeId)).catch(() => null);

      for (const kpi of rows) {
        if (kpi.isCustom || updatedNotes[kpi.id]) continue;
        try {
          const prompt =
            `A CIMMYT MEAL team is about to collect data for this indicator on a specific project. ` +
            `Do NOT restate the standard method.\n\nKPI: ${kpi.name} (${kpi.id})\nUnit: ${kpi.unit}\n` +
            `Project type: ${pt?.userLabel || project.projectTypeId || "general"}\n\n` +
            `Proposal:\n"""\n${proposalExcerpt || "(none)"}\n"""\n\n` +
            `2-3 sentences — ONLY project-specific. If nothing applies, say so plainly.\nPlain text only.`;
          const { text } = await askAIText(prompt, { modelTier: "quick", feature: "kpi_method_guidance" });
          updatedNotes[kpi.id] = text.trim();
        } catch { /* skip on failure — matches original */ }
      }
      updateDR({ narrativeNotes: updatedNotes, generatedAt: new Date().toISOString(), approved: false });
    } catch (err) {
      setAiError(err.userMessage || err.message);
    } finally {
      setDraftingAll(false);
    }
  }

  /* ── Approve / Unapprove ─────────────────────────────────────────── */
  function handleApprove() {
    onChange({
      ...project,
      dataRequirements: { ...dr, approved: true, approvedAt: new Date().toISOString() },
      stepStatus: { ...project.stepStatus, dr: "approved" },
    });
  }
  function handleUnapprove() {
    onChange({ ...project, dataRequirements: { ...dr, approved: false }, stepStatus: { ...project.stepStatus, dr: "draft" } });
  }

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="card">
      {/* Header */}
      <div className="section-head">
        <h3>Data Requirements</h3>
        <button className="btn btn-sm btn-primary" onClick={handleAIDraftAll} disabled={draftingAll}>
          {draftingAll ? <><Spinner /> Drafting…</> : <><SparkleIcon /> AI: draft project-specific notes for all</>}
        </button>
      </div>

      {/* Vocabulary warning — always shown (matches original exactly) */}
      <div className="alert alert-warning" style={{ marginBottom: 16 }}>
        <span>⚠</span>
        <div>
          <b>No CIMMYT controlled vocabulary source has been loaded into this tool.</b>{" "}
          Every field below is flagged "No approved term found" pending review —
          this tool never invents vocabulary terms.
          An Administrator can add real terms in Admin → Controlled Vocabulary.
        </div>
      </div>

      {aiError && <div className="alert alert-critical" style={{ marginBottom: 14 }}>{aiError}</div>}

      {/* KPI summary tables by tier (Core → Optional → Evaluation) */}
      {["core", "optional", "evaluation"].map(tier => {
        if (!byTier[tier]?.length) return null;
        return (
          <div key={tier} style={{ marginTop: 18 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <b className="small soft" style={{ textTransform: "uppercase", letterSpacing: ".04em" }}>
                {KPI_TIERS_DR[tier]} ({byTier[tier].length})
              </b>
            </div>
            {tier === "evaluation" && (
              <p className="hint" style={{ marginBottom: 8 }}>
                These need a dedicated study design — comparison/control group, survey, longitudinal
                tracking or a full impact evaluation — not routine monitoring.
                Don't treat them as indicators to report on every cycle.
              </p>
            )}
            <DRKpiTable rows={byTier[tier]} />
          </div>
        );
      })}

      {/* Methodology per KPI */}
      <div className="stack" style={{ marginTop: 16 }}>
        <b className="small soft">Methodology per KPI</b>
        <p className="hint" style={{ marginTop: 2 }}>
          For a library KPI, the fields below come straight from the CIMMYT Toolbox Methodological
          Companion — fixed, not AI-generated. Use "Project-specific notes" only for what's
          particular to this project; it should never restate the method itself.
          A project-specific indicator shows the fields defined for it when it was created.
        </p>
        {rows.map(kpi => (
          <DRMethodologyCard
            key={kpi.id}
            project={project}
            kpi={kpi}
            onNoteChange={handleNoteChange}
            onAIDraft={handleAIDraft}
            draftingId={draftingId}
          />
        ))}
      </div>

      {/* Save notes + Export */}
      <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <button className="btn btn-sm" onClick={handleSaveNotes}>
          {saved ? "✓ Saved" : "Save notes"}
        </button>
      </div>

      <hr className="divider" />

      {/* Approve / Unapprove */}
      {dr.approved ? (
        <div className="alert alert-success">
          <span style={{ color: "var(--success)" }}>✓</span>
          <div>
            <b>Approved</b>
            {dr.approvedAt ? ` on ${new Date(dr.approvedAt).toLocaleString()}` : ""}.{" "}
            <button className="linkbtn" onClick={handleUnapprove}>Revert to draft to edit</button>
          </div>
        </div>
      ) : (
        <>
          <button className="btn btn-primary btn-block" onClick={handleApprove}>
            ✓ Approve Data Requirements
          </button>
          <div className="hint" style={{ textAlign: "center" }}>
            Marks this step reviewed — editing a note afterwards reverts it to draft.
          </div>
        </>
      )}

      <StepNav project={project} currentKey="dr" />
    </div>
  );
}

// ── computeUnresolvedIssues — matches app.html exactly ─────────────────────
function computeUnresolvedIssues(project) {
  const issues = [];
  if (!project.resultsFramework?.approved)
    issues.push({ text: "Results Framework not yet approved." });
  if (!project.theoryOfChange?.approved)
    issues.push({ text: "Theory of Change not yet approved." });
  const rf = (project.resultsFramework?.results || [])
    .filter(r => ["Outcome", "Output", "Impact"].includes(r.level));
  rf.forEach(r => {
    const has = (project.selectedKPIs || []).some(s =>
      (s.linkedResultIds || []).includes(r.id)
    );
    if (!has) issues.push({ text: `"${r.statement.slice(0, 60)}" (${r.level}) has no linked KPI.` });
  });
  if ((project.selectedKPIs?.length || 0) > 20)
    issues.push({ text: `${project.selectedKPIs.length} KPIs selected — review for an excessive indicator burden.` });
  issues.push({ text: "Controlled vocabulary: no institutional vocabulary source loaded — every field flagged for review." });
  return issues;
}

// ── Step: Final Review ──────────────────────────────────────────────────────
/**
 * Exact port of renderStepReview() from app.html.
 *
 * Clean card: 8-item checklist + unresolved issues + kv summary +
 * mark-complete + ONE "Go to Export / Download" button (no embedded export).
 * The export is a SEPARATE page (/projects/:id/export).
 */
function StepReview({ project, onChange, projectTypes }) {
  const navigate = useNavigate();
  const { id }   = useParams();
  const pt       = projectTypes.find(p => p.id === project.projectTypeId);

  const issues   = computeUnresolvedIssues(project);
  const checklist = [
    { label: "Project type selected",                         ok: !!project.projectTypeId },
    { label: "Proposal uploaded / text captured",             ok: !!(project.proposal?.text) },
    { label: "Results Framework approved",                    ok: !!project.resultsFramework?.approved },
    { label: "Theory of Change approved",                     ok: !!project.theoryOfChange?.approved },
    { label: "At least one KPI selected",                     ok: (project.selectedKPIs?.length || 0) > 0 },
    { label: "Every Outcome/Output/Impact result has a linked KPI",
      ok: !issues.some(i => i.text.includes("has no linked KPI")) },
    { label: "No pending KPI suggestions blocking sign-off",
      ok: !issues.some(i => i.text.includes("pending M&E validation")) },
    { label: "Data Requirements approved",                    ok: !!project.dataRequirements?.approved },
  ];
  const allOk = checklist.every(c => c.ok);

  function handleMarkComplete() {
    onChange({
      ...project,
      completedBy: "current user",
      completedAt: new Date().toISOString(),
      stepStatus: { ...project.stepStatus, review: "complete" },
    });
  }

  return (
    <div className="card">
      <div className="section-head"><h3>Final Review</h3></div>

      {/* 8-item checklist — matches original icon/color scheme */}
      <div className="stack">
        {checklist.map((c, i) => (
          <div key={i} className="row">
            {c.ok
              ? <span style={{ color: "var(--success)", flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "1em", height: "1em" }}>
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                </span>
              : <span style={{ color: "var(--warning)", flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "1em", height: "1em" }}>
                    <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>
                  </svg>
                </span>
            }
            <span>{c.label}</span>
          </div>
        ))}
      </div>

      <hr className="divider" />

      {/* Unresolved issues */}
      <b className="small soft">Unresolved issues</b>
      {issues.length
        ? <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {issues.map((iss, i) => <li key={i} className="small">{iss.text}</li>)}
          </ul>
        : <div className="small muted" style={{ marginTop: 4 }}>None detected.</div>
      }

      <hr className="divider" />

      {/* Project summary kv */}
      <dl className="kv">
        <dt>Project</dt>      <dd>{project.title}</dd>
        <dt>Type</dt>         <dd>{pt?.userLabel ?? "—"}</dd>
        <dt>Results</dt>      <dd>{project.resultsFramework?.results?.length ?? 0}</dd>
        <dt>Pathways</dt>     <dd>{project.theoryOfChange?.pathways?.length ?? 0}</dd>
        <dt>KPIs selected</dt><dd>{project.selectedKPIs?.length ?? 0}</dd>
      </dl>

      {/* Mark complete / complete banner */}
      {project.stepStatus?.review === "complete"
        ? <div className="alert alert-success" style={{ marginTop: 14 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "1em", height: "1em", flexShrink: 0 }}>
              <path d="M20 6 9 17l-5-5"/>
            </svg>
            {" "}Marked complete{project.completedBy ? ` by ${project.completedBy}` : ""}{project.completedAt ? ` on ${new Date(project.completedAt).toLocaleString()}` : ""}.
          </div>
        : <>
            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: 14 }}
              onClick={handleMarkComplete}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "1em", height: "1em" }}>
                <path d="M20 6 9 17l-5-5"/>
              </svg>
              {" "}Mark project complete
            </button>
            {!allOk && (
              <div className="hint" style={{ textAlign: "center" }}>
                You can complete with open issues, but they will carry into the exported record.
              </div>
            )}
          </>
      }

      {/* Go to Export / Download — centered single button, matches original */}
      <div className="row" style={{ justifyContent: "center", marginTop: 14 }}>
        <button
          className="btn"
          onClick={() => navigate(`/projects/${id}/export`)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "1em", height: "1em" }}>
            <path d="M4 4h16v16H4z"/><path d="M4 9h16M9 4v16"/>
          </svg>
          {" "}Go to Export / Download
        </button>
      </div>

      <StepNav project={project} currentKey="review" />
    </div>
  );
}

// Note: buildDataRequirementsDoc and download helpers live in ExportPage.jsx

// ── Main ProjectEditor ──────────────────────────────────────────────────────
export default function ProjectEditor() {
  const { id }              = useParams();
  const navigate            = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const step                = searchParams.get("step") || "type";

  const [project,    setProject]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [savedFlag,  setSavedFlag]  = useState(false);
  const [error,      setError]      = useState("");
  const [projectTypes, setProjectTypes] = useState([]);

  // Load project
  useEffect(() => {
    getDoc("projects", id)
      .then(({ exists, data }) => {
        if (!exists) { setError("Project not found."); return; }
        setProject(data);
        // If step is still "type" but type is already set, jump to upload
        if ((searchParams.get("step") === "type" || !searchParams.get("step")) && data.projectTypeId) {
          setSearchParams({ step: "upload" }, { replace: true });
        }
      })
      .catch(() => setError("Could not load project."))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load project types
  useEffect(() => {
    fetch("/data/project-types.json").then(r => r.json()).then(setProjectTypes).catch(() => {});
  }, []);

  // Auto-save with debounce
  const saveTimer = useRef(null);
  const save = useCallback(async (proj) => {
    if (!proj) return;
    setSaving(true);
    try {
      const updated = { ...proj, updatedAt: new Date().toISOString() };
      await setDoc("projects", id, updated);
      setProject(updated);
      setSavedFlag(true);
      setTimeout(() => setSavedFlag(false), 2000);
    } catch {
      setError("Auto-save failed — changes may not have been saved.");
    } finally {
      setSaving(false);
    }
  }, [id]);

  function handleChange(updated) {
    setProject(updated);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(updated), 800);
  }

  function goStep(key) { setSearchParams({ step: key }); }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="empty"><span className="spinner lg" /><p className="small muted" style={{ marginTop: 12 }}>Loading project…</p></div>
  );

  if (error && !project) return (
    <div className="empty">
      <div className="alert alert-critical" style={{ display: "inline-flex", marginBottom: 12 }}>{error}</div>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate("/projects")}>← Back to projects</button>
    </div>
  );

  const pt = projectTypes.find(p => p.id === project.projectTypeId);

  return (
    <>
      {/* Back link + project header */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div>
          <div className="row" style={{ gap: 8, cursor: "pointer" }}>
            <h2 style={{ fontSize: 19 }}>{project.title}</h2>
          </div>
          <div className="small muted">
            {pt ? pt.userLabel : "No type set"} · Updated {new Date(project.updatedAt).toLocaleString()}
            {" · "}
            <span className="save-indicator" style={{ display: "inline-flex" }}>
              {saving ? <><Spinner /> Saving…</> : savedFlag ? <span style={{ color: "var(--success)" }}>Saved</span> : null}
            </span>
          </div>
        </div>
        <button className="btn btn-sm" onClick={() => navigate("/projects")}>
          ← All projects
        </button>
      </div>

      {/* Stepper */}
      <Stepper project={project} currentStep={step} onStepClick={goStep} />

      {error && <div className="alert alert-critical" style={{ marginBottom: 14 }}>{error}</div>}

      {/* Step content */}
      <div style={{ marginTop: 8 }}>
        {step === "type" && (
          <StepType project={project} onChange={handleChange} projectTypes={projectTypes} />
        )}
        {step === "upload" && (
          <StepUpload project={project} onChange={handleChange} />
        )}
        {step === "rf" && (
          <div>
            <ResultsFramework project={project} onChange={handleChange} />
            <StepNav project={project} currentKey="rf" nextDisabled={!project.resultsFramework?.approved} />
          </div>
        )}
        {step === "toc" && (
          <div>
            <TheoryOfChange project={project} onChange={handleChange} />
            <StepNav project={project} currentKey="toc" nextDisabled={!project.theoryOfChange?.approved} />
          </div>
        )}
        {step === "kpi" && (
          <div>
            <KPISelector project={project} onChange={handleChange} />
            <StepNav project={project} currentKey="kpi" nextDisabled={!(project.selectedKPIs?.length > 0)} />
          </div>
        )}
        {step === "dr" && (
          <StepDataRequirements project={project} onChange={handleChange} />
        )}
        {step === "review" && (
          <StepReview project={project} onChange={handleChange} projectTypes={projectTypes} />
        )}
      </div>
    </>
  );
}

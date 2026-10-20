/**
 * KPISelector — exact port of renderStepKPI() + all helpers from app.html.
 *
 * Requires approved Theory of Change.
 * Tabs: A · Recommended | B · Explore all | My selection
 * KPI_TIERS: core / optional / evaluation
 * Features: AI recommend, AI search, AI overlap-check, KPI detail modal,
 *            link-results modal, suggest-new-KPI modal, project-specific modal.
 */
import { useState, useEffect } from "react";
import { askAIJson } from "../api/ai.js";
import Spinner from "./Spinner.jsx";
import { useNavigate, useParams } from "react-router-dom";

/* ── Constants ─────────────────────────────────────────────────────────── */
const KPI_TIERS = {
  core:       "A · Core accountability",
  optional:   "B · Management / optional",
  evaluation: "C · Evaluation-only",
};
function normalizeTier(t) { return (t && KPI_TIERS[t]) ? t : "core"; }
function truncate(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n) + "…" : s; }
function uid() { return "sel_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7); }

/* ── Icons ──────────────────────────────────────────────────────────────── */
const SparkleIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ width: 13, height: 13 }}>
    <path d="M7 1v2M7 11v2M1 7h2M11 7h2M3.2 3.2l1.4 1.4M9.4 9.4l1.4 1.4M3.2 10.8l1.4-1.4M9.4 4.6l1.4-1.4"/>
    <circle cx="7" cy="7" r="2"/>
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
const DocIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ width: 12, height: 12 }}>
    <path d="M8 1H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6L8 1z"/>
    <polyline points="8 1 8 6 13 6"/><line x1="5" y1="9" x2="9" y2="9"/><line x1="5" y1="7" x2="9" y2="7"/>
  </svg>
);
const XIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 10, height: 10 }}>
    <line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/>
  </svg>
);
const ChevLeftIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 12, height: 12 }}>
    <polyline points="9 2 4 7 9 12"/>
  </svg>
);
const ChevRightIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 12, height: 12 }}>
    <polyline points="5 2 10 7 5 12"/>
  </svg>
);

/* ── Tier tag ─────────────────────────────────────────────────────────── */
function TierTag({ tier }) {
  const t   = normalizeTier(tier);
  const cls = t === "core" ? "tag-validated" : t === "evaluation" ? "tag-missing" : "tag-optional";
  return (
    <span className={`tag ${cls}`} title={KPI_TIERS[t]}>
      {KPI_TIERS[t].split(" · ")[0]}
    </span>
  );
}

/* ── KPI row card (matches renderKpiRow in app.html) ─────────────────── */
function KpiRow({ kpi, project, opts = {}, onAdd, onRemove, onOpenDetail }) {
  if (!kpi) return null;
  const selected = project?.selectedKPIs?.some(s => s.kpiId === kpi.id);

  return (
    <div className="card" style={{ padding: "12px 14px" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {/* ID + tags row */}
          <div className="row" style={{ gap: 8 }}>
            <span className="idchip">{kpi.id}</span>
            {opts.tagHtml === "recommended" && <span className="tag tag-recommended">AI recommended</span>}
            {opts.tier && <TierTag tier={opts.tier} />}
            <span className="tag tag-optional">{kpi.resultsLevel}</span>
          </div>

          {/* Name — clickable for detail modal */}
          <div
            className="clickable"
            style={{ fontWeight: 600, fontSize: 13.5, marginTop: 5, cursor: "pointer" }}
            onClick={() => onOpenDetail(kpi.id, opts)}
          >
            {kpi.name}
          </div>

          {/* Definition excerpt */}
          <div className="small soft" style={{ marginTop: 3 }}>
            {truncate(kpi.definition, 180)}
          </div>

          {/* AI rationale */}
          {opts.rationale && (
            <div className="ai-note" style={{ marginTop: 6 }}>
              <SparkleIcon /> {opts.rationale}
            </div>
          )}
          {opts.fitNotes && (
            <div className="small muted" style={{ marginTop: 4 }}>
              <i>Fit: {opts.fitNotes}</i>
            </div>
          )}

          {/* Linked results preview */}
          {opts.linkedResultIds?.length > 0 && project?.resultsFramework?.results && (
            <div className="small muted" style={{ marginTop: 4 }}>
              Measures:{" "}
              {opts.linkedResultIds.map(rid => {
                const r = project.resultsFramework.results.find(x => x.id === rid);
                return r ? truncate(r.statement, 50) : rid;
              }).join("; ")}
            </div>
          )}

          {/* Methodological guide link */}
          <button
            className="linkbtn small"
            style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4 }}
            onClick={() => onOpenDetail(kpi.id, opts)}
          >
            <DocIcon /> Methodological guide — Vol {kpi.volumeNumber} · {kpi.volumeTitle}
          </button>
        </div>

        {/* Add / Added+Remove */}
        <div className="row" style={{ flex: "0 0 auto", gap: 6 }}>
          {project?.id ? (
            selected ? (
              <>
                <span className="tag tag-validated"><CheckIcon /> Added</span>
                <button
                  className="icon-btn"
                  style={{ width: 28, height: 28 }}
                  title="Remove from selection"
                  onClick={() => onRemove(kpi.id)}
                >
                  <TrashIcon />
                </button>
              </>
            ) : (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => onAdd(kpi.id, opts)}
              >
                Add
              </button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── KPI Detail Modal (matches kpiDetailModalHtml in app.html) ─────────── */
function KpiDetailModal({ kpiId, kpi, project, volumes, opts = {}, onClose, onAdd, onRemove }) {
  if (!kpi) return null;
  const vol = volumes.find(v => v.volumeNumber === kpi.volumeNumber);
  const selected = project?.selectedKPIs?.some(s => s.kpiId === kpi.id);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={e => e.stopPropagation()}>
        {/* Head */}
        <div className="modal-head">
          <div>
            <div className="row" style={{ gap: 8 }}>
              <span className="idchip">{kpi.id}</span>
              <span className="tag tag-optional">{kpi.resultsLevel}</span>
              {kpi.indicatorScope && <span className="tag tag-optional">{kpi.indicatorScope}</span>}
            </div>
            <h3 style={{ marginTop: 8, fontSize: 16 }}>{kpi.name}</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><XIcon /></button>
        </div>

        {/* Body */}
        <div className="modal-body">
          <div className="stack">
            <div>
              <b className="small soft">Purpose &amp; definition</b>
              <div className="prose" style={{ marginTop: 4, fontSize: 13.5 }}>{kpi.definition}</div>
            </div>
            <div>
              <b className="small soft">Rationale</b>
              <div className="prose" style={{ marginTop: 4, fontSize: 13 }}>{kpi.rationale}</div>
            </div>

            <dl className="kv">
              <dt>Unit</dt>          <dd style={{ fontFamily: "ui-monospace,'SF Mono',Consolas,monospace" }}>{kpi.unit}</dd>
              <dt>Direction</dt>     <dd>{kpi.directionOfChange}</dd>
              <dt>Domain</dt>        <dd>{kpi.domain}</dd>
              <dt>Pathway</dt>       <dd>Vol {kpi.volumeNumber} · {kpi.volumeTitle}{vol ? ` — "${vol.tagline}"` : ""}</dd>
              <dt>Indicator group</dt><dd>{kpi.indicatorGroup}</dd>
              <dt>CIMMYT 2030 objective</dt><dd style={{ fontSize: 12 }}>{kpi.primaryObjective}</dd>
              <dt>CGIAR impact area</dt><dd style={{ fontSize: 12 }}>{kpi.cgiarImpactArea}</dd>
            </dl>

            <div>
              <b className="small soft">Applicable project types</b>
              <div className="chip-row" style={{ marginTop: 5 }}>
                {kpi.projectTypesApply?.length
                  ? kpi.projectTypesApply.map(t => <span key={t} className="tag tag-recommended">{t}</span>)
                  : <span className="small muted">Institutional indicator — no project-type instance</span>
                }
                {kpi.projectTypesNotApplicable?.map(t => (
                  <span key={t} className="tag tag-missing">{t} — n/a</span>
                ))}
              </div>
            </div>

            <hr className="divider" />
            <div>
              <b className="small soft">Calculation</b>
              <div className="prose" style={{ fontSize: 13 }}>{kpi.calculationSummary}</div>
            </div>

            <div>
              <b className="small soft">Data collection</b>
              <dl className="kv">
                <dt>Data source</dt>          <dd style={{ fontSize: 12.5 }}>{kpi.dataSource}</dd>
                <dt>Instrument</dt>           <dd style={{ fontSize: 12.5 }}>{kpi.collectionInstrument}</dd>
                <dt>Unit of observation</dt>  <dd style={{ fontSize: 12.5 }}>{kpi.unitOfObservation}</dd>
                <dt>Collection frequency</dt> <dd>{kpi.collectionFrequency}</dd>
                <dt>Reporting frequency</dt>  <dd>{kpi.reportingFrequency}</dd>
                <dt>Baseline required</dt>    <dd>{kpi.baselineRequired}</dd>
              </dl>
            </div>

            <div>
              <b className="small soft">Disaggregation</b>
              <dl className="kv">
                <dt>Required (institutional)</dt>     <dd style={{ fontSize: 12.5 }}>{kpi.disaggregationRequired}</dd>
                <dt>Project-specific / optional</dt>  <dd style={{ fontSize: 12.5 }}>{kpi.disaggregationProjectSpecific}</dd>
              </dl>
            </div>

            <div>
              <b className="small soft">Aggregation</b>
              <div className="prose" style={{ fontSize: 12.5 }}>{kpi.aggregationRule}</div>
            </div>

            <div>
              <b className="small soft">Interpretation &amp; limitations</b>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12.5 }}>
                {(kpi.limitations || []).map((l, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{l}</li>
                ))}
              </ul>
            </div>

            {kpi.subMetrics && kpi.subMetrics !== "None" && (
              <div>
                <b className="small soft">Sub-metrics</b>
                <div className="small">{kpi.subMetrics}</div>
              </div>
            )}

            {kpi.relatedKPIs?.length > 0 && (
              <div>
                <b className="small soft">Related KPIs</b>
                <div className="chip-row" style={{ marginTop: 4 }}>
                  {kpi.relatedKPIs.map(r => (
                    <span key={r} className="idchip">{r}</span>
                  ))}
                </div>
              </div>
            )}

            <hr className="divider" />
            <div className="small muted">
              Source: {kpi.sourceRef} · Status: {kpi.status} · Last updated {kpi.lastUpdated}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Close</button>
          {project?.id && (
            selected ? (
              <>
                <span className="tag tag-validated"><CheckIcon /> Added</span>
                <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => { onRemove(kpi.id); }}>
                  <TrashIcon />
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => {
                // Close this modal first, then addKpi will open the link popup
                onClose();
                onAdd(kpi.id, opts);
              }}>
                Add to selection
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Link-results modal ────────────────────────────────────────────────── */
/**
 * Matches linkResultsModalHtml() in app.html exactly:
 * - Title: Link "<kpiName>" to results
 * - Shows Impact / Outcome / Intermediate Outcome / Output only
 * - Activities are explicitly excluded with a count note
 * - "select/clear all" toggles per level group
 * - Opens automatically when a KPI is added with no pre-linked results
 */
function LinkResultsModal({ project, refId, kpiName, onClose, onSave }) {
  const sel = project.selectedKPIs?.find(s => s.kpiId === refId || s.customId === refId);
  const [linked, setLinked] = useState(new Set(sel?.linkedResultIds || []));
  const LINKABLE = ["Impact", "Outcome", "Intermediate Outcome", "Output"];
  const results  = (project.resultsFramework?.results || []).filter(r => LINKABLE.includes(r.level));
  const actCount = (project.resultsFramework?.results || []).length - results.length;
  const byLevel  = LINKABLE.map(level => ({ level, items: results.filter(r => r.level === level) })).filter(g => g.items.length);

  function toggleLevel(level) {
    const ids     = results.filter(r => r.level === level).map(r => r.id);
    const allOn   = ids.every(id => linked.has(id));
    const next    = new Set(linked);
    ids.forEach(id => allOn ? next.delete(id) : next.add(id));
    setLinked(next);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {/* Head */}
        <div className="modal-head">
          <h3 style={{ fontSize: 15 }}>
            Link &ldquo;{kpiName || refId}&rdquo; to results
          </h3>
          <button className="icon-btn" onClick={onClose}><XIcon /></button>
        </div>

        {/* Body */}
        <div className="modal-body">
          <p className="hint">
            Every selected KPI must link to at least one Results Framework result.
            Showing Impact, Outcome, Intermediate Outcome and Output levels
            {actCount > 0 && (
              <> ({actCount} {actCount === 1 ? "Activity is" : "Activities are"} not shown — KPIs measure results, not individual activities)</>
            )}.
          </p>

          {byLevel.length ? byLevel.map(g => (
            <div key={g.level} style={{ marginTop: 14 }}>
              {/* Level header + select/clear all */}
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <b className="small soft">{g.level} ({g.items.length})</b>
                <button className="linkbtn small" onClick={() => toggleLevel(g.level)}>
                  select/clear all
                </button>
              </div>

              {/* Result checkboxes */}
              <div className="stack" style={{ gap: 4 }}>
                {g.items.map(r => (
                  <label
                    key={r.id}
                    className="row"
                    style={{ alignItems: "flex-start", cursor: "pointer", gap: 8, padding: "4px 0" }}
                  >
                    <input
                      type="checkbox"
                      checked={linked.has(r.id)}
                      onChange={e => {
                        const next = new Set(linked);
                        e.target.checked ? next.add(r.id) : next.delete(r.id);
                        setLinked(next);
                      }}
                      style={{ marginTop: 3, flexShrink: 0, accentColor: "var(--primary)" }}
                    />
                    <span style={{ fontSize: 13, lineHeight: 1.45 }}>{r.statement}</span>
                  </label>
                ))}
              </div>
            </div>
          )) : (
            <div className="small muted" style={{ marginTop: 14 }}>
              No Impact / Outcome / Intermediate Outcome / Output results in the framework yet.
              Go back and complete the Results Framework first.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-foot" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
          {/* Validation: warn if saving with 0 links when results exist */}
          {byLevel.length > 0 && linked.size === 0 && (
            <div className="alert alert-warning" style={{ margin: 0 }}>
              <span>⚠</span>
              <span>You haven't linked this KPI to any result yet. Every selected KPI should link to at least one result.</span>
            </div>
          )}
          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => { onSave(refId, Array.from(linked)); onClose(); }}
            >
              Save links
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Project-specific indicator modal ──────────────────────────────────── */
function ProjectSpecificModal({ project, onClose, onSave }) {
  const [form, setForm] = useState({
    name: "", definition: "", resultId: "", unit: "", frequency: "Annual",
    calculation: "", dataSource: "", disaggregation: "None", responsibleUnit: "",
  });

  function handleSave() {
    if (!form.name.trim()) return;
    const customId = "ps_" + Date.now().toString(36);
    const sel = {
      kpiId: null,
      customId,
      source: "project-specific",
      linkedResultIds: form.resultId ? [form.resultId] : [],
      addedBy: "user",
      addedAt: new Date().toISOString(),
      tier: "core",
      customFields: { ...form },
    };
    onSave(sel);
    onClose();
  }

  const results = (project.resultsFramework?.results || []);
  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3 style={{ fontSize: 15 }}>Add a project-specific indicator</h3>
          <button className="icon-btn" onClick={onClose}><XIcon /></button>
        </div>
        <div className="modal-body">
          <div className="alert alert-info" style={{ marginBottom: 12 }}>
            Use this when an important result isn't captured by any institutional KPI.
            It's added straight to this project's selection — no M&amp;E validation queue — because it's meant to serve this project only.
          </div>
          <div className="field"><label className="field-label">Indicator name</label>
            <input type="text" value={form.name} onChange={e => f("name", e.target.value)} autoFocus />
          </div>
          <div className="field"><label className="field-label">Definition</label>
            <textarea rows={2} value={form.definition} onChange={e => f("definition", e.target.value)} />
          </div>
          <div className="field"><label className="field-label">Linked Results Framework result</label>
            <select value={form.resultId} onChange={e => f("resultId", e.target.value)}>
              <option value="">— select —</option>
              {results.map(r => <option key={r.id} value={r.id}>{r.level}: {truncate(r.statement, 60)}</option>)}
            </select>
          </div>
          <div className="row">
            <div className="field" style={{ flex: 1 }}><label className="field-label">Unit</label>
              <input type="text" value={form.unit} onChange={e => f("unit", e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}><label className="field-label">Frequency</label>
              <input type="text" value={form.frequency} onChange={e => f("frequency", e.target.value)} placeholder="e.g. Annual" />
            </div>
          </div>
          <div className="field"><label className="field-label">Calculation / formula</label>
            <textarea rows={2} value={form.calculation} onChange={e => f("calculation", e.target.value)} />
          </div>
          <div className="field"><label className="field-label">Data source</label>
            <input type="text" value={form.dataSource} onChange={e => f("dataSource", e.target.value)} />
          </div>
          <div className="field"><label className="field-label">Disaggregation</label>
            <input type="text" value={form.disaggregation} onChange={e => f("disaggregation", e.target.value)} placeholder='e.g. sex, age — or "None"' />
          </div>
          <div className="field"><label className="field-label">Responsible unit</label>
            <input type="text" value={form.responsibleUnit} onChange={e => f("responsibleUnit", e.target.value)} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!form.name.trim()}>
            <CheckIcon /> Add to project
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Suggest new KPI modal ──────────────────────────────────────────────── */
function SuggestKpiModal({ project, onClose, onSave, askAI }) {
  const [draft, setDraft] = useState({ name: "", measures: "", resultId: "", why: "", method: "", other: "" });
  const [checkResult, setCheckResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const results = project.resultsFramework?.results || [];
  const f = (k, v) => setDraft(prev => ({ ...prev, [k]: v }));

  async function handleCheckAndSubmit() {
    if (!draft.name.trim()) return;
    setChecking(true);
    try {
      const kpiSample = (project._allKpis || []).slice(0, 50).map(k => ({ id: k.id, name: k.name, definition: (k.definition || "").slice(0, 80) }));
      const result = await askAI(
        `Check whether this proposed KPI already exists or is very similar to an institutional KPI.
Proposed KPI: "${draft.name}" — measures: "${draft.measures}"
Library sample: ${JSON.stringify(kpiSample)}
Return JSON: {"matches":[{"kpiId":"...","name":"...","severity":"exact"|"similar","reasons":["..."]}]} — empty matches array if no similarity.`,
        { modelTier: "quick", feature: "kpi_suggestion_duplicate_check" }
      );
      setCheckResult(result.matches || []);
    } catch {
      setCheckResult([]);
    } finally {
      setChecking(false);
    }
  }

  function handleSubmitAnyway() {
    const sel = {
      kpiId: null,
      customId: "sugg_" + Date.now().toString(36),
      source: "suggested",
      linkedResultIds: draft.resultId ? [draft.resultId] : [],
      addedBy: "user",
      addedAt: new Date().toISOString(),
      tier: "core",
      status: "Pending review",
      customFields: { name: draft.name, ...draft },
    };
    onSave(sel);
    setSubmitted({ name: draft.name });
  }

  const hasExact = checkResult?.some(m => m.severity === "exact");

  if (submitted) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-head">
            <h3 style={{ fontSize: 15 }}>Suggest a new KPI</h3>
            <button className="icon-btn" onClick={onClose}><XIcon /></button>
          </div>
          <div className="modal-body">
            <div className="alert alert-success">
              <CheckIcon />
              <div><b>Submitted for M&amp;E validation.</b> "{submitted.name}" was added to this project marked "Pending review".</div>
            </div>
            <p className="hint" style={{ marginTop: 12 }}>
              This tool has no email server. Use your own email client to notify the M&amp;E team.
            </p>
          </div>
          <div className="modal-foot"><button className="btn btn-primary" onClick={onClose}>Done</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3 style={{ fontSize: 15 }}>Suggest a new KPI</h3>
          <button className="icon-btn" onClick={onClose}><XIcon /></button>
        </div>
        <div className="modal-body">
          <div className="alert alert-warning" style={{ marginBottom: 12 }}>
            <b>New KPIs require review and validation by the Monitoring &amp; Evaluation team.</b>{" "}
            AI can help structure your suggestion but cannot approve it. Before it's sent, this checks whether it already exists.
          </div>
          <div className="field"><label className="field-label">Proposed KPI name</label>
            <input type="text" value={draft.name} onChange={e => f("name", e.target.value)} autoFocus />
          </div>
          <div className="field"><label className="field-label">What does it measure?</label>
            <textarea rows={2} value={draft.measures} onChange={e => f("measures", e.target.value)} />
          </div>
          <div className="field"><label className="field-label">Linked Results Framework result</label>
            <select value={draft.resultId} onChange={e => f("resultId", e.target.value)}>
              <option value="">— select —</option>
              {results.map(r => <option key={r.id} value={r.id}>{r.level}: {truncate(r.statement, 60)}</option>)}
            </select>
          </div>
          <div className="field"><label className="field-label">Why are existing KPIs insufficient?</label>
            <textarea rows={2} value={draft.why} onChange={e => f("why", e.target.value)} />
          </div>
          <div className="field"><label className="field-label">Proposed method (if known)</label>
            <textarea rows={2} value={draft.method} onChange={e => f("method", e.target.value)} />
          </div>

          {/* Duplicate check results */}
          {checkResult !== null && (
            checkResult.length === 0
              ? <div className="alert alert-success" style={{ marginTop: 10 }}><CheckIcon /> No existing indicator looks similar — clear to submit.</div>
              : <div className={`alert alert-${hasExact ? "critical" : "warning"}`} style={{ marginTop: 10, flexDirection: "column", alignItems: "stretch" }}>
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <b>{hasExact ? "This appears to already exist in the institutional library." : `This looks similar to ${checkResult.length} existing indicator${checkResult.length > 1 ? "s" : ""}.`}</b>
                  </div>
                  <div className="stack" style={{ marginTop: 8 }}>
                    {checkResult.map(m => (
                      <div key={m.kpiId} className="card" style={{ padding: "8px 10px", background: "var(--surface)" }}>
                        <span className="idchip">{m.kpiId}</span>{" "}
                        <span className="small" style={{ fontWeight: 600 }}>{m.name}</span>
                        <div className="small soft" style={{ marginTop: 2 }}>{m.reasons?.join(" ")}</div>
                      </div>
                    ))}
                  </div>
                </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          {checkResult === null
            ? <button className="btn btn-primary" onClick={handleCheckAndSubmit} disabled={checking || !draft.name.trim()}>
                {checking ? <><Spinner /> Checking…</> : "Check & submit"}
              </button>
            : !hasExact
              ? <>
                  <button className="btn btn-ghost" onClick={() => setCheckResult(null)}>Edit and re-check</button>
                  <button className="btn btn-primary" onClick={handleSubmitAnyway}>Different enough — submit anyway</button>
                </>
              : <button className="btn btn-ghost" onClick={() => setCheckResult(null)}>Edit and re-check</button>
          }
        </div>
      </div>
    </div>
  );
}

/* ── RF Coverage panel — maps every RF result to its linked KPIs ────────── */
/**
 * TWO separate checks, matching the original exactly:
 *
 * CHECK 1 — PER-KPI (COMPULSORY, red error card):
 *   Every selected KPI must link to at least one result.
 *   "Every selected KPI must link to at least one Results Framework result."
 *   Shown as red "none linked" in My selection + as an error card here.
 *
 * CHECK 2 — PER-RESULT (INFORMATIONAL, amber warning only):
 *   "Not every result needs its own dedicated KPI — one indicator often
 *    covers several related results … that's a MEAL judgment call, not a
 *    gap to force-fill." (computeKpiAlerts in app.html)
 *   Shown as amber rows — soft warning, never blocks navigation.
 *
 * Activity results: never linkable to KPIs.
 *   "KPIs measure results, not individual activities."
 */
function RFCoveragePanel({ project, allKpis, onOpenLinks }) {
  const LINKABLE   = ["Impact", "Outcome", "Intermediate Outcome", "Output"];
  const ALL_LEVELS = ["Impact", "Outcome", "Intermediate Outcome", "Output", "Activity"];
  const results    = project.resultsFramework?.results || [];
  const sels       = project.selectedKPIs || [];

  // Build resultId → [sel entries]
  const kpisByResult = {};
  sels.forEach(sel => {
    (sel.linkedResultIds || []).forEach(rid => {
      (kpisByResult[rid] = kpisByResult[rid] || []).push(sel);
    });
  });

  // ── Check 1: KPIs with NO linked results (COMPULSORY) ────────────────
  const kpisWithNoLinks = sels.filter(sel => !(sel.linkedResultIds?.length));

  // ── Check 2: Linkable results with NO KPI (INFORMATIONAL) ────────────
  const linkable         = results.filter(r => LINKABLE.includes(r.level));
  const coveredResults   = linkable.filter(r =>  kpisByResult[r.id]?.length);
  const uncoveredResults = linkable.filter(r => !kpisByResult[r.id]?.length);

  function getKpiId(sel)   { return sel.kpiId || sel.customId || "—"; }
  function getKpiName(sel) {
    const kpi = allKpis.find(k => k.id === sel.kpiId);
    return kpi?.name || sel.customFields?.name || sel.kpiId || sel.customId || "—";
  }

  if (!results.length && !sels.length) {
    return (
      <div className="empty" style={{ padding: "24px 10px" }}>
        <div className="empty-title">No data yet</div>
        <div className="small muted" style={{ marginTop: 6 }}>
          Add Results Framework results and KPIs first.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Summary stats ──────────────────────────────────────────────── */}
      <div className="row" style={{ gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div className="usage-stat" style={{ minWidth: 110 }}>
          <span className="usage-stat-value">{sels.length}</span>
          <span className="usage-stat-label">KPIs selected</span>
        </div>
        <div className="usage-stat" style={{ minWidth: 110 }}>
          <span className="usage-stat-value"
            style={{ color: kpisWithNoLinks.length ? "var(--critical)" : "var(--success)" }}>
            {kpisWithNoLinks.length}
          </span>
          <span className="usage-stat-label">KPIs with no link ⚠</span>
        </div>
        <div className="usage-stat" style={{ minWidth: 110 }}>
          <span className="usage-stat-value">{coveredResults.length}/{linkable.length}</span>
          <span className="usage-stat-label">Results covered</span>
        </div>
        <div className="usage-stat" style={{ minWidth: 110 }}>
          <span className="usage-stat-value" style={{ color: "var(--ink-soft)" }}>
            {results.filter(r => r.level === "Activity").length}
          </span>
          <span className="usage-stat-label">Activities (no KPI)</span>
        </div>
      </div>

      {/* ── CHECK 1 (COMPULSORY): KPIs with no linked results ─ red ────── */}
      {kpisWithNoLinks.length > 0 && (
        <div className="card" style={{ borderColor: "var(--critical)", background: "var(--critical-soft)", marginBottom: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <b style={{ fontSize: 12.5 }}>
              ⚠ {kpisWithNoLinks.length} KPI{kpisWithNoLinks.length > 1 ? "s have" : " has"} no linked result
            </b>
            <span className="tag" style={{ background: "var(--critical)", color: "#fff", fontSize: 10.5, fontWeight: 700 }}>
              Compulsory — must fix
            </span>
          </div>
          <p className="hint" style={{ marginBottom: 10, color: "var(--critical)" }}>
            Every selected KPI must link to at least one Results Framework result.
            Click "edit links" on each row below to fix this.
          </p>
          <div className="stack" style={{ gap: 6 }}>
            {kpisWithNoLinks.map(sel => {
              const refId   = getKpiId(sel);
              const kpiName = getKpiName(sel);
              return (
                <div key={refId} className="row" style={{
                  justifyContent: "space-between", alignItems: "center",
                  background: "var(--surface)", borderRadius: "var(--radius-s)",
                  padding: "8px 12px", gap: 10,
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span className="idchip" style={{ marginRight: 6 }}>{refId}</span>
                    <span style={{ fontSize: 12.5 }}>{truncate(kpiName, 60)}</span>
                  </div>
                  <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                    <span className="small" style={{ color: "var(--critical)", fontWeight: 700 }}>none linked</span>
                    <button className="linkbtn small" onClick={() => onOpenLinks(refId)}>edit links</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CHECK 2 (INFORMATIONAL): Results without a KPI ─ amber ──────── */}
      {uncoveredResults.length > 0 && (
        <div className="ai-note" style={{ marginBottom: 16, padding: "10px 14px" }}>
          <span>ℹ</span>
          <div>
            <b>{uncoveredResults.length} of {linkable.length} result{uncoveredResults.length !== 1 ? "s" : ""} have no linked KPI.</b>{" "}
            Not every result needs its own dedicated KPI — one indicator often covers several related results,
            and some granular results are tracked narratively rather than quantitatively;
            that's a <b>MEAL judgment call</b>, not a gap to force-fill.
          </div>
        </div>
      )}

      {/* ── RF results by level ─────────────────────────────────────────── */}
      {ALL_LEVELS.map(level => {
        const group      = results.filter(r => r.level === level);
        if (!group.length) return null;
        const isLinkable = LINKABLE.includes(level);

        return (
          <div key={level} style={{ marginTop: 16 }}>
            {/* Level header */}
            <div className="row" style={{ alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className={`rf-level-tag lvl-${level.toLowerCase().replace(/ /g, "-")}`}>
                {level}
              </span>
              <span className="small muted">({group.length})</span>
              {!isLinkable && (
                <span className="small muted" style={{ fontStyle: "italic" }}>
                  — KPIs measure results, not individual activities
                </span>
              )}
            </div>

            {/* Results table */}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Result statement</th>
                    {isLinkable && <th style={{ whiteSpace: "nowrap", width: 250 }}>Linked KPIs</th>}
                    {isLinkable && <th style={{ width: 70 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {group.map(r => {
                    const kpiEntries = kpisByResult[r.id] || [];
                    const isCovered  = kpiEntries.length > 0;

                    // ✓ Covered      → green left border
                    // ✗ Uncovered    → amber/gold left border + background (WARNING, not error)
                    // Activity       → normal (not linkable)
                    const rowStyle = !isLinkable
                      ? {}
                      : isCovered
                        ? { borderLeft: "3px solid var(--success)" }
                        : { borderLeft: "3px solid var(--gold)", background: "var(--gold-soft)" };

                    return (
                      <tr key={r.id} style={rowStyle}>
                        <td style={{ fontSize: 12.5, lineHeight: 1.4 }}>{r.statement}</td>

                        {isLinkable && (
                          <td>
                            {isCovered ? (
                              /* Covered: clickable KPI chips → opens that KPI's link modal */
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {kpiEntries.map(sel => {
                                  const refId = getKpiId(sel);
                                  const kpi   = allKpis.find(k => k.id === refId);
                                  return (
                                    <button key={refId} className="linkbtn small"
                                      style={{ textAlign: "left" }}
                                      onClick={() => onOpenLinks(refId)}
                                      title={kpi?.name}>
                                      <span className="idchip" style={{ fontSize: 10.5 }}>{refId}</span>
                                      {kpi && (
                                        <span className="muted" style={{ marginLeft: 5, fontSize: 11 }}>
                                          {truncate(kpi.name, 35)}
                                        </span>
                                      )}
                                      <span style={{ marginLeft: 4, color: "var(--ink-faint)", fontSize: 10 }}>edit ›</span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              /* Uncovered: amber warning — not a red error */
                              <span className="small" style={{ color: "var(--gold)", fontWeight: 600 }}>
                                no KPI linked
                              </span>
                            )}
                          </td>
                        )}

                        {isLinkable && (
                          <td style={{ whiteSpace: "nowrap" }}>
                            {isCovered ? (
                              <button className="linkbtn small"
                                onClick={() => onOpenLinks(getKpiId(kpiEntries[0]))}>
                                edit
                              </button>
                            ) : (
                              /* Uncovered result — open guidance alert */
                              <button className="linkbtn small"
                                style={{ color: "var(--gold)" }}
                                onClick={() => alert(
                                  `This result has no linked KPI — that may be intentional.\n\n` +
                                  `"Not every result needs its own dedicated KPI — one indicator often covers several related results, ` +
                                  `and some granular results are tracked narratively rather than quantitatively; ` +
                                  `that's a MEAL judgment call."\n\n` +
                                  `To add a link:\n` +
                                  `• "A · Recommended" tab → Get AI recommendations\n` +
                                  `• "My selection" → edit links on an existing KPI\n\n` +
                                  `Result: ${truncate(r.statement, 100)}`
                                )}>
                                + link KPI
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="hint" style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
        <span style={{ borderLeft: "3px solid var(--critical)", paddingLeft: 6, marginRight: 12 }}>
          <b>Red card above</b> = compulsory: each KPI must link to at least one result.
        </span>
        <span style={{ borderLeft: "3px solid var(--gold)", paddingLeft: 6, marginRight: 12 }}>
          <b>Amber rows</b> = informational warning: no KPI covers this result — MEAL judgment call.
        </span>
        <span style={{ marginRight: 12 }}>
          <b>Activities</b> are never directly measured by KPIs.
        </span>
      </div>
    </div>
  );
}

/* ── My selection tab ───────────────────────────────────────────────────── */
function SelectionTab({ project, allKpis, onRemove, onSetTier, onOpenLinks, onOpenDetail }) {
  const sels = project.selectedKPIs || [];
  if (!sels.length) return (
    <div className="empty" style={{ padding: "24px 10px" }}>
      <div className="small muted">No KPIs selected yet.</div>
    </div>
  );

  function getRow(sel) {
    const kpi = allKpis.find(k => k.id === sel.kpiId);
    if (kpi) return { ...kpi, isCustom: false, tier: normalizeTier(sel.tier) };
    if (sel.source === "project-specific" && sel.customFields) {
      const c = sel.customFields;
      return {
        id: sel.customId || "PS", name: c.name || "(unnamed)", definition: c.definition || "",
        unit: c.unit || "—", resultsLevel: "Project-specific", volumeNumber: null, volumeTitle: null,
        isCustom: true, tier: normalizeTier(sel.tier),
      };
    }
    return null;
  }

  const srcTag = (sel, row) => {
    if (row?.isCustom) return <span className="tag tag-useredited">Project-specific</span>;
    if (sel.source === "recommended") return <span className="tag tag-recommended">AI recommended</span>;
    if (sel.source === "suggested") return <span className="tag tag-validated">M&amp;E validated</span>;
    return <span className="tag tag-useredited">From library</span>;
  };

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>KPI</th><th>Source</th><th>Tier</th><th>Linked results</th><th></th>
            </tr>
          </thead>
          <tbody>
            {sels.map(sel => {
              const row = getRow(sel);
              const refId = sel.kpiId || sel.customId;
              if (!row) return (
                <tr key={refId}>
                  <td colSpan={5} className="small muted">
                    Custom KPI: {sel.customFields?.name || sel.kpiId || ""} — {sel.status || "pending"} (awaiting M&amp;E validation)
                  </td>
                </tr>
              );
              const linked = (sel.linkedResultIds || []).map(id => {
                const r = project.resultsFramework?.results?.find(x => x.id === id);
                return r ? truncate(r.statement, 36) : id;
              });
              return (
                <tr key={refId}>
                  <td>
                    <span className="idchip">{row.id}</span>
                    <div
                      style={{ marginTop: 3, maxWidth: 260, cursor: row.isCustom ? "default" : "pointer" }}
                      onClick={() => !row.isCustom && onOpenDetail(row.id, {})}
                    >
                      {row.name}
                    </div>
                    {row.isCustom && (
                      <div className="small soft" style={{ marginTop: 2, maxWidth: 260 }}>
                        {truncate(row.definition, 90)}
                      </div>
                    )}
                  </td>
                  <td>{srcTag(sel, row)}</td>
                  <td>
                    <select
                      style={{ width: "auto", fontSize: 12 }}
                      value={normalizeTier(sel.tier)}
                      onChange={e => onSetTier(refId, e.target.value)}
                    >
                      {Object.entries(KPI_TIERS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {linked.length
                      ? linked.map((l, i) => <div key={i} className="small">• {l}</div>)
                      : <span className="small" style={{ color: "var(--critical)" }}>none linked</span>
                    }
                    {" "}
                    <button className="linkbtn small" onClick={() => onOpenLinks(refId)}>edit links</button>
                  </td>
                  <td>
                    <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => onRemove(refId)}>
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Explore all — list view ────────────────────────────────────────────── */
function ExploreTab({ project, allKpis, volumes, projectTypes, aiSearchResults, onAdd, onRemove, onOpenDetail, onAISearch, clearAISearch }) {
  const [q,        setQ]        = useState("");
  const [aiQuery,  setAiQuery]  = useState("");
  const [typeId,   setTypeId]   = useState("");
  const [level,    setLevel]    = useState("");
  const [volume,   setVolume]   = useState("");
  const [libView,  setLibView]  = useState("list"); // list | volumes
  const [volNum,   setVolNum]   = useState(null);
  const [searching,setSearching]= useState(false);

  let list = allKpis;
  if (aiSearchResults) {
    const order = aiSearchResults;
    const byId  = new Map(order.map(o => [o.kpiId, o.why]));
    list = allKpis.filter(k => byId.has(k.id))
      .sort((a, b) => order.findIndex(o => o.kpiId === a.id) - order.findIndex(o => o.kpiId === b.id));
  } else {
    if (q) list = list.filter(k => (k.name + " " + k.definition + " " + k.id).toLowerCase().includes(q.toLowerCase()));
    if (typeId) {
      const pt = projectTypes.find(t => t.id === typeId);
      if (pt) list = list.filter(k => (k.projectTypesApply || []).includes(pt.canonicalName));
    }
    if (level)  list = list.filter(k => k.resultsLevel === level);
    if (volume) list = list.filter(k => String(k.volumeNumber) === volume);
  }

  async function handleAISearch() {
    if (!aiQuery.trim()) return;
    setSearching(true);
    try {
      const sample = allKpis.slice(0, 100).map(k => ({ kpiId: k.id, name: k.name }));
      const result = await onAISearch(aiQuery, sample);
      // result is handled in parent
    } finally {
      setSearching(false);
    }
  }

  /* ── Volumes grid ── */
  if (libView === "volumes") {
    if (volNum !== null) {
      const sortedVols = [...volumes].sort((a, b) => a.volumeNumber - b.volumeNumber);
      const idx = sortedVols.findIndex(v => v.volumeNumber === volNum);
      const vol = sortedVols[idx];
      const prev = sortedVols[idx - 1];
      const next = sortedVols[idx + 1];
      const indicators = allKpis.filter(k => k.volumeNumber === volNum);
      const levels = ["Impact", "Outcome", "Output"];

      return (
        <div>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <button className="linkbtn small" onClick={() => setVolNum(null)}>
              <ChevLeftIcon /> All volumes
            </button>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-sm" onClick={() => setVolNum(prev.volumeNumber)} disabled={!prev}>
                <ChevLeftIcon /> Vol {prev?.volumeNumber}
              </button>
              <span className="small muted">Volume {idx + 1} of {sortedVols.length}</span>
              <button className="btn btn-sm" onClick={() => setVolNum(next.volumeNumber)} disabled={!next}>
                Vol {next?.volumeNumber} <ChevRightIcon />
              </button>
            </div>
          </div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row" style={{ gap: 8 }}>
              <span className="idchip">Vol {vol?.volumeNumber}</span>
              <span className="tag tag-optional">{vol?.pathwayType}</span>
            </div>
            <h3 style={{ marginTop: 8, fontSize: 16 }}>{vol?.volumeTitle}</h3>
            <div className="small soft" style={{ marginTop: 2, fontStyle: "italic" }}>{vol?.tagline}</div>
            <div className="prose small" style={{ marginTop: 10 }}>{vol?.introSummary}</div>
          </div>
          <div className="stack">
            {levels.map(lv => {
              const items = indicators.filter(k => k.resultsLevel === lv);
              if (!items.length) return null;
              return (
                <div key={lv}>
                  <div className="small soft" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", margin: "10px 0 6px" }}>
                    {lv} ({items.length})
                  </div>
                  <div className="stack">
                    {items.map(k => (
                      <KpiRow key={k.id} kpi={k} project={project} opts={{}} onAdd={onAdd} onRemove={onRemove} onOpenDetail={onOpenDetail} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Volumes grid
    return (
      <div>
        <div className="segctl" style={{ marginBottom: 14 }}>
          <button className={`segctl-btn`} onClick={() => setLibView("list")}><SearchIcon /> All indicators — search &amp; filter</button>
          <button className={`segctl-btn active`}><DocIcon /> Browse by volume</button>
        </div>
        <div className="hint" style={{ marginBottom: 10 }}>
          The full CIMMYT Toolbox indicator register — all 13 pathway volumes, {allKpis.length} indicators in total.
        </div>
        <div className="grid-3">
          {[...volumes].sort((a, b) => a.volumeNumber - b.volumeNumber).map(v => (
            <div
              key={v.volumeNumber}
              className="card clickable"
              style={{ padding: "14px 16px", cursor: "pointer" }}
              onClick={() => setVolNum(v.volumeNumber)}
            >
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className="idchip">Vol {v.volumeNumber}</span>
                <span className="tag tag-optional">{v.indicatorCounts?.total || 0} indicators</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 8 }}>{v.volumeTitle}</div>
              <div className="small soft" style={{ marginTop: 4 }}>{v.tagline}</div>
              <div className="small muted" style={{ marginTop: 8 }}>
                {v.pathwayType}{v.indicatorCounts
                  ? ` · ${v.indicatorCounts.impact || 0} Impact · ${v.indicatorCounts.outcome || 0} Outcome · ${v.indicatorCounts.output || 0} Output`
                  : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── List view ── */
  return (
    <div>
      <div className="segctl" style={{ marginBottom: 14 }}>
        <button className="segctl-btn active"><SearchIcon /> All indicators — search &amp; filter</button>
        <button className="segctl-btn" onClick={() => setLibView("volumes")}><DocIcon /> Browse by volume</button>
      </div>

      {/* Search card */}
      <div className="card" style={{ padding: "14px 16px", marginBottom: 14 }}>
        <div className="row">
          <div style={{ flex: 1, minWidth: 220 }}>
            <input
              type="text"
              placeholder='Ask in plain language — e.g. "indicators for women benefiting from mechanization"'
              value={aiQuery}
              onChange={e => setAiQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAISearch()}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleAISearch} disabled={searching || !aiQuery.trim()}>
            {searching ? <Spinner /> : <SparkleIcon />} AI search
          </button>
          {aiSearchResults && (
            <button className="btn btn-sm" onClick={clearAISearch}>Clear AI results</button>
          )}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <input type="text" style={{ maxWidth: 220 }} placeholder="Filter by keyword…"
            value={q} onChange={e => { setQ(e.target.value); }} />
          <select style={{ maxWidth: 200 }} value={typeId} onChange={e => setTypeId(e.target.value)}>
            <option value="">All project types</option>
            {projectTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.userLabel}</option>)}
          </select>
          <select style={{ maxWidth: 170 }} value={level} onChange={e => setLevel(e.target.value)}>
            <option value="">All results levels</option>
            {["Impact", "Outcome", "Output"].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select style={{ maxWidth: 230 }} value={volume} onChange={e => setVolume(e.target.value)}>
            <option value="">All pathway volumes</option>
            {[...volumes].sort((a, b) => a.volumeNumber - b.volumeNumber).map(v => (
              <option key={v.volumeNumber} value={String(v.volumeNumber)}>
                Vol {v.volumeNumber} · {v.volumeTitle}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="small muted" style={{ marginBottom: 8 }}>
        {list.length} indicator{list.length !== 1 ? "s" : ""}{aiSearchResults ? " matched by AI search" : ""}
      </div>

      <div className="stack">
        {list.length
          ? list.map(k => {
              const why = aiSearchResults?.find(o => o.kpiId === k.id)?.why;
              return (
                <KpiRow
                  key={k.id} kpi={k} project={project}
                  opts={{ rationale: why }}
                  onAdd={onAdd} onRemove={onRemove} onOpenDetail={onOpenDetail}
                />
              );
            })
          : (
            <div className="empty">
              <div className="empty-title">No matches</div>
              <div className="small">Try different filters or an AI search.</div>
            </div>
          )
        }
      </div>
    </div>
  );
}

/* ── Recommended tab ────────────────────────────────────────────────────── */
function RecommendedTab({ project, allKpis, onAdd, onRemove, onOpenDetail, recommendations, noFit, loading, onGetRecommendations, onAcceptNoFit, onRejectNoFit }) {
  const pt = project.projectTypeId;

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <p className="hint" style={{ margin: 0 }}>
          AI-recommended against a minimum-credible-evidence standard — construct fit, results-level fit, attribution, feasibility, timing and data burden — chosen only from the institutional KPI library, and tiered by how essential each one is.
        </p>
        <button className="btn btn-sm btn-primary" onClick={onGetRecommendations} disabled={loading}>
          {loading ? <><Spinner /> Scanning…</> : <><SparkleIcon /> {recommendations ? "Refresh recommendations" : "Get AI recommendations"}</>}
        </button>
      </div>

      {loading && <div className="small muted"><Spinner /> Scanning the KPI library…</div>}

      {recommendations?.length > 0 ? (
        <div className="stack">
          {recommendations.map(rec => {
            const kpi = allKpis.find(k => k.id === rec.kpiId);
            if (!kpi) return null;
            return (
              <KpiRow
                key={kpi.id} kpi={kpi} project={project}
                opts={{ tagHtml: "recommended", rationale: rec.why, fitNotes: rec.fitNotes, tier: rec.tier, linkedResultIds: rec.linkedResultIds }}
                onAdd={onAdd} onRemove={onRemove} onOpenDetail={onOpenDetail}
              />
            );
          })}
        </div>
      ) : recommendations ? (
        <div className="empty" style={{ padding: "20px 10px" }}>
          <div className="small muted">
            The AI looked at this project and genuinely didn't find a good match in the institutional KPI library.
            Browse "Explore all" and add indicators manually, or use "Suggest a new KPI".
          </div>
        </div>
      ) : (
        <div className="empty" style={{ padding: "20px 10px" }}>
          <div className="small muted">No recommendations generated yet for this project.</div>
        </div>
      )}

      {/* No-fit suggestions */}
      {noFit?.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <b className="small soft">No existing institutional KPI fully captures these results</b>
          <p className="hint" style={{ marginTop: 2 }}>
            The AI checked the library against the fit criteria and found nothing suitable — each proposes a project-specific indicator instead.
            Review and accept only what's genuinely needed.
          </p>
          <div className="stack" style={{ marginTop: 8 }}>
            {noFit.map(nf => {
              const r = project.resultsFramework?.results?.find(x => x.id === nf.resultId);
              const ind = nf.indicator || {};
              return (
                <div key={nf._id} className="card" style={{ borderColor: "var(--gold)", background: "var(--gold-soft)" }}>
                  {r && <div className="small muted">{truncate(r.statement, 90)}</div>}
                  <div className="small" style={{ marginTop: 4 }}>{nf.reason || ""}</div>
                  <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 8 }}>{ind.name || ""}</div>
                  <div className="small soft" style={{ marginTop: 2 }}>{ind.definition || ""}</div>
                  <dl className="kv" style={{ marginTop: 8 }}>
                    <dt>Unit</dt>         <dd>{ind.unit || "—"}</dd>
                    <dt>Calculation</dt>  <dd>{ind.calculation || "—"}</dd>
                    <dt>Data source</dt>  <dd>{ind.dataSource || "—"}</dd>
                    <dt>Frequency</dt>    <dd>{ind.frequency || "—"}</dd>
                    <dt>Disaggregation</dt><dd>{ind.disaggregation || "—"}</dd>
                  </dl>
                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="btn btn-sm btn-primary" onClick={() => onAcceptNoFit(nf)}>
                      <CheckIcon /> Accept — add to project
                    </button>
                    <button className="btn btn-sm" onClick={() => onRejectNoFit(nf._id)}>Reject</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main KPISelector component ─────────────────────────────────────────── */
export default function KPISelector({ project, onChange }) {
  const navigate = useNavigate();
  const { id }   = useParams();

  const tocDone = project.theoryOfChange?.approved;

  /* ── Data ─────────────────────────────────────────────────────────────── */
  const [allKpis,       setAllKpis]       = useState([]);
  const [volumes,       setVolumes]       = useState([]);
  const [projectTypes,  setProjectTypes]  = useState([]);

  useEffect(() => {
    Promise.all([
      fetch("/data/kpis.json").then(r => r.json()),
      fetch("/data/volumes.json").then(r => r.json()),
      fetch("/data/project-types.json").then(r => r.json()),
    ]).then(([kpis, vols, types]) => {
      setAllKpis(kpis);
      setVolumes(vols);
      setProjectTypes(types);
    }).catch(() => {});
  }, []);

  /* ── Tab ──────────────────────────────────────────────────────────────── */
  const [tab, setTab] = useState("recommended");

  /* ── AI state ─────────────────────────────────────────────────────────── */
  const [recommendations,  setRecommendations]  = useState(null);
  const [noFit,            setNoFit]            = useState([]);
  const [aiSearchResults,  setAiSearchResults]  = useState(null);
  const [overlapCheck,     setOverlapCheck]     = useState(null);
  const [loadingRec,       setLoadingRec]       = useState(false);
  const [loadingOverlap,   setLoadingOverlap]   = useState(false);
  const [aiError,          setAiError]          = useState("");

  /* ── Modals ─────────────────────────────────────────────────────────────── */
  const [detailModal,    setDetailModal]    = useState(null); // { kpiId, opts }
  const [linkModal,      setLinkModal]      = useState(null); // { refId, kpiName }
  const [suggestModal,   setSuggestModal]   = useState(false);
  const [psModal,        setPsModal]        = useState(false);

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function saveProject(updated) { onChange(updated); }

  /**
   * Add a KPI to selectedKPIs.
   * Matches the "add-kpi-to-project" action handler in app.html:
   *   if(!links.length){ openModal(linkResultsModalHtml(p.id, kpiId)); }
   * i.e. when the KPI has no pre-linked results, immediately open the
   * link-results popup so the user maps it to RF results right away.
   */
  function addKpi(kpiId, opts = {}) {
    const alreadyAdded = project.selectedKPIs?.some(s => s.kpiId === kpiId);
    if (alreadyAdded) return;
    const kpi = allKpis.find(k => k.id === kpiId);
    if (!kpi) return;

    const linkedResultIds = opts.linkedResultIds || [];
    const sel = {
      kpiId,
      source: opts.tagHtml === "recommended" ? "recommended" : "library",
      linkedResultIds,
      addedBy: "user",
      addedAt: new Date().toISOString(),
      tier: normalizeTier(opts.tier),
    };

    saveProject({ ...project, selectedKPIs: [...(project.selectedKPIs || []), sel] });

    // ── KEY ORIGINAL BEHAVIOUR ───────────────────────────────────────────
    // If no results are pre-linked (not an AI recommendation that came with
    // linkedResultIds), open the link-results modal immediately so the user
    // maps this KPI to their RF right away — exactly what the original does:
    //   if(!links.length){ UI.pendingLinks=[]; openModal(linkResultsModalHtml(p.id, kpiId)); }
    if (!linkedResultIds.length) {
      setLinkModal({ refId: kpiId, kpiName: kpi.name });
    } else {
      // Has pre-linked results → switch to coverage tab so user sees mapping
      setTab("coverage");
    }
  }

  function removeKpi(refId) {
    saveProject({ ...project, selectedKPIs: (project.selectedKPIs || []).filter(s => s.kpiId !== refId && s.customId !== refId) });
  }

  function setTier(refId, value) {
    saveProject({
      ...project,
      selectedKPIs: (project.selectedKPIs || []).map(s =>
        (s.kpiId === refId || s.customId === refId) ? { ...s, tier: normalizeTier(value) } : s
      ),
    });
  }

  function saveLinks(refId, linkedResultIds) {
    saveProject({
      ...project,
      selectedKPIs: (project.selectedKPIs || []).map(s =>
        (s.kpiId === refId || s.customId === refId) ? { ...s, linkedResultIds } : s
      ),
    });
    // After saving links, switch to coverage tab so user can see the mapping
    setTab("coverage");
  }

  /**
   * Add a custom (project-specific or suggested) KPI.
   * Matches the "finalize" flow: if no resultId was selected, immediately
   * open the link modal so the user can map it:
   *   if(!draft.resultId){ openModal(linkResultsModalHtml(p.id, kpiId)); }
   */
  function addCustomKpi(sel) {
    saveProject({ ...project, selectedKPIs: [...(project.selectedKPIs || []), sel] });
    // Open link modal if no results linked yet (suggested KPI flow)
    if (sel.source === "suggested" && !(sel.linkedResultIds?.length)) {
      const refId   = sel.kpiId || sel.customId;
      const kpiName = sel.customFields?.name || refId;
      setLinkModal({ refId, kpiName });
    }
  }

  /* ── AI: get recommendations ─────────────────────────────────────────── */
  async function handleGetRecommendations() {
    setLoadingRec(true);
    setAiError("");
    try {
      const rfSummary = (project.resultsFramework?.results || [])
        .map(r => `[id:${r.id}][${r.level}] ${r.statement}`).join("\n");
      const pt = projectTypes.find(t => t.id === project.projectTypeId);
      const kpiCompact = allKpis.slice(0, 100).map(k => ({
        id: k.id, name: k.name,
        level: (k.resultsLevel || "").split(",")[0].trim(),
        types: (k.projectTypesApply || []),
        def: (k.definition || "").slice(0, 80),
      }));

      const result = await askAIJson(
        `You are a MEAL expert at CIMMYT. Recommend the most relevant KPIs from the institutional library for this project.

Project type: ${pt?.userLabel || project.projectTypeId || "general"} (${pt?.canonicalName || ""})
Project title: ${project.title || ""}
Results Framework:
${rfSummary}

KPI Library (up to 100 KPIs):
${JSON.stringify(kpiCompact)}

For each recommended KPI, specify:
- tier: "core" (essential), "optional" (management/optional), or "evaluation" (evaluation-only)
- why: 1-2 sentences explaining the fit
- fitNotes: brief note on any fit caveats
- linkedResultIds: array of RF result ids this KPI measures (from the [id:...] tags above)

Return JSON: {
  "recommendations": [{"kpiId":"...","tier":"core"|"optional"|"evaluation","why":"...","fitNotes":"...","linkedResultIds":["..."]}],
  "noFit": [{"resultId":"...","reason":"...","indicator":{"name":"...","definition":"...","unit":"...","calculation":"...","dataSource":"...","frequency":"...","disaggregation":"..."}}]
}
- Recommend 6-12 KPIs. noFit is for results where no library KPI fits well.`,
        { modelTier: "complex", feature: "kpi_recommend" }
      );

      // Filter to valid kpiIds and valid result ids
      const validKpiIds    = new Set(allKpis.map(k => k.id));
      const validResultIds = new Set((project.resultsFramework?.results || []).map(r => r.id));

      const recs = (result.recommendations || [])
        .filter(r => validKpiIds.has(r.kpiId))
        .map(r => ({
          ...r,
          tier: normalizeTier(r.tier),
          linkedResultIds: (r.linkedResultIds || []).filter(rid => validResultIds.has(rid)),
        }));

      const nf = (result.noFit || []).map((n, i) => ({ ...n, _id: `nf_${i}_${Date.now()}` }));

      setRecommendations(recs);
      setNoFit(nf);
    } catch (err) {
      setAiError(err.userMessage || err.message);
    } finally {
      setLoadingRec(false);
    }
  }

  /* ── AI: search ─────────────────────────────────────────────────────── */
  async function handleAISearch(query, sample) {
    try {
      const result = await askAIJson(
        `From the CIMMYT KPI library below, find the most relevant KPIs for: "${query}"
Return JSON: {"results":[{"kpiId":"...","why":"..."}]} — most relevant first, max 20.
Library: ${JSON.stringify(sample)}`,
        { modelTier: "quick", feature: "kpi_search" }
      );
      setAiSearchResults(result.results || []);
    } catch (err) {
      setAiError(err.userMessage || err.message);
    }
  }

  /* ── AI: check overlaps ─────────────────────────────────────────────── */
  async function handleCheckOverlaps() {
    setLoadingOverlap(true);
    setAiError("");
    try {
      const sels = (project.selectedKPIs || []).map(s => {
        const kpi = allKpis.find(k => k.id === s.kpiId);
        return kpi ? { id: kpi.id, name: kpi.name, def: (kpi.definition || "").slice(0, 80) } : null;
      }).filter(Boolean);

      if (sels.length < 2) { setOverlapCheck({ overlaps: [], weakAlignment: [] }); return; }

      const tocSummary = (project.theoryOfChange?.pathways || [])
        .map(p => `IF ${(p.ifs || []).join(", AND IF ")} THEN ${p.then} WHICH CONTRIBUTES TO ${p.contributesTo}`)
        .join("\n");

      const result = await askAIJson(
        `Review this set of CIMMYT project KPIs for measurement overlap and Theory of Change alignment.

KPIs: ${JSON.stringify(sels)}
Theory of Change: ${tocSummary.slice(0, 2000)}

Return JSON: {
  "overlaps":[{"kpiIdA":"...","kpiIdB":"...","reason":"..."}],
  "weakAlignment":[{"kpiId":"...","reason":"..."}]
}
— empty arrays if no issues.`,
        { modelTier: "default", feature: "kpi_check_overlaps" }
      );
      setOverlapCheck(result);
    } catch (err) {
      setAiError(err.userMessage || err.message);
    } finally {
      setLoadingOverlap(false);
    }
  }

  /* ── No-fit accept/reject ────────────────────────────────────────────── */
  function acceptNoFit(nf) {
    const ind = nf.indicator || {};
    const sel = {
      kpiId: null,
      customId: "ps_nf_" + Date.now().toString(36),
      source: "project-specific",
      linkedResultIds: nf.resultId ? [nf.resultId] : [],
      addedBy: "ai",
      addedAt: new Date().toISOString(),
      tier: "core",
      customFields: { name: ind.name || "", definition: ind.definition || "", unit: ind.unit || "", frequency: ind.frequency || "", calculation: ind.calculation || "", dataSource: ind.dataSource || "", disaggregation: ind.disaggregation || "" },
    };
    saveProject({ ...project, selectedKPIs: [...(project.selectedKPIs || []), sel] });
    setNoFit(prev => prev.filter(n => n._id !== nf._id));
  }

  /* ── Coverage alerts (matches computeKpiAlerts in app.html) ─────────── */
  const alerts = (() => {
    const alerts = [];
    const LINKABLE_LEVELS = ["Outcome", "Output", "Impact", "Intermediate Outcome"];

    // ── Check 1: KPIs with no linked results (COMPULSORY — critical) ──────
    const kpisWithNoLinks = (project.selectedKPIs || []).filter(s => !s.linkedResultIds?.length);
    if (kpisWithNoLinks.length) {
      alerts.push({
        kind: "critical",
        text: `${kpisWithNoLinks.length} selected KPI${kpisWithNoLinks.length > 1 ? "s have" : " has"} no linked result. Every selected KPI must link to at least one Results Framework result. Open "RF Coverage" or "My selection" and click "edit links" to fix this.`,
        action: { label: "View RF Coverage", tab: "coverage" },
      });
    }

    // ── Check 2: RF results with no KPI (INFORMATIONAL — warning only) ───
    const rf     = (project.resultsFramework?.results || []).filter(r => LINKABLE_LEVELS.includes(r.level));
    const noKpi  = rf.filter(r =>
      !(project.selectedKPIs || []).some(s => (s.linkedResultIds || []).includes(r.id))
    );
    if (noKpi.length) {
      const names = noKpi.slice(0, 3).map(r => `"${truncate(r.statement, 40)}"`).join(", ");
      alerts.push({
        kind: "warning",
        text: `${noKpi.length} of ${rf.length} Outcome/Intermediate Outcome/Output/Impact result(s) have no linked KPI yet: ${names}${noKpi.length > 3 ? "…" : ""}. Not every result needs its own dedicated KPI — one indicator often covers several related results, and some granular results are tracked narratively rather than quantitatively; that's a MEAL judgment call, not a gap to force-fill. To close a real gap: open "Recommended" and click "Get AI recommendations" — it targets exactly these unlinked results — or open "My selection" and use "edit links" to attach an existing KPI to more results it genuinely also measures.`,
        action: { label: "View RF Coverage", tab: "coverage" },
      });
    }

    if ((project.selectedKPIs?.length || 0) > 20) {
      alerts.push({ kind: "warning", text: `${project.selectedKPIs.length} KPIs selected — consider whether this is an excessive reporting burden.` });
    }
    if (overlapCheck) {
      (overlapCheck.overlaps || []).forEach(o =>
        alerts.push({ kind: "info", text: `These two KPIs may be measuring very similar concepts: ${o.kpiIdA} & ${o.kpiIdB} — ${o.reason}` })
      );
      (overlapCheck.weakAlignment || []).forEach(w =>
        alerts.push({ kind: "info", text: `${w.kpiId} appears weakly aligned with the approved Theory of Change — ${w.reason}` })
      );
    }
    return alerts;
  })();

  /* ── Gate: ToC must be approved ──────────────────────────────────────── */
  if (!tocDone) {
    return (
      <div className="card">
        <div className="empty">
          <div className="empty-title">Approve the Theory of Change first</div>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => navigate(`/projects/${id}?step=toc`)}>
            Go to Theory of Change
          </button>
        </div>
      </div>
    );
  }

  const detailKpi = detailModal ? allKpis.find(k => k.id === detailModal.kpiId) : null;

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <>
      <div className="card">
        <div className="section-head">
          <h3>KPI Selection</h3>
          <div className="small muted">{project.selectedKPIs?.length || 0} selected</div>
        </div>

        <p className="hint">
          Which of these are mandatory for this project will be decided in the M&amp;E validation step, not here —
          this screen is for building the candidate set. Add any KPI and link it to the output(s)/outcome(s) it measures.
        </p>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="stack" style={{ marginBottom: 12 }}>
            {alerts.map((a, i) => (
              <div key={i} className={`alert alert-${a.kind}`}>
                <span>⚠</span>
                <div>
                  {a.text}
                  {a.action && (
                    <> {" "}
                      <button className="linkbtn" style={{ color: "inherit", textDecoration: "underline" }}
                        onClick={() => setTab(a.action.tab)}>
                        {a.action.label} →
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {aiError && <div className="alert alert-critical" style={{ marginBottom: 14 }}>{aiError}</div>}

        {/* Tabs */}
        <div className="chip-row" style={{ marginBottom: 14 }}>
          <button className={`filter-chip ${tab === "recommended" ? "active" : ""}`} onClick={() => setTab("recommended")}>
            A · Recommended
          </button>
          <button className={`filter-chip ${tab === "explore" ? "active" : ""}`} onClick={() => setTab("explore")}>
            B · Explore all ({allKpis.length})
          </button>
          <button className={`filter-chip ${tab === "selection" ? "active" : ""}`} onClick={() => setTab("selection")}>
            My selection ({project.selectedKPIs?.length || 0})
          </button>
          <button className={`filter-chip ${tab === "coverage" ? "active" : ""}`} onClick={() => setTab("coverage")}>
            RF Coverage
          </button>
        </div>

        {/* Tab content */}
        {tab === "recommended" && (
          <RecommendedTab
            project={project}
            allKpis={allKpis}
            onAdd={addKpi}
            onRemove={removeKpi}
            onOpenDetail={(kpiId, opts) => setDetailModal({ kpiId, opts })}
            recommendations={recommendations}
            noFit={noFit}
            loading={loadingRec}
            onGetRecommendations={handleGetRecommendations}
            onAcceptNoFit={acceptNoFit}
            onRejectNoFit={id => setNoFit(prev => prev.filter(n => n._id !== id))}
          />
        )}

        {tab === "explore" && (
          <ExploreTab
            project={project}
            allKpis={allKpis}
            volumes={volumes}
            projectTypes={projectTypes}
            aiSearchResults={aiSearchResults}
            onAdd={addKpi}
            onRemove={removeKpi}
            onOpenDetail={(kpiId, opts) => setDetailModal({ kpiId, opts })}
            onAISearch={handleAISearch}
            clearAISearch={() => setAiSearchResults(null)}
          />
        )}

        {tab === "selection" && (
          <>
            <SelectionTab
              project={project}
              allKpis={allKpis}
              onRemove={removeKpi}
              onSetTier={setTier}
              onOpenLinks={refId => {
                const kpi = allKpis.find(k => k.id === refId);
                const sel = project.selectedKPIs?.find(s => s.kpiId === refId || s.customId === refId);
                const name = kpi?.name || sel?.customFields?.name || refId;
                setLinkModal({ refId, kpiName: name });
              }}
              onOpenDetail={(kpiId, opts) => setDetailModal({ kpiId, opts })}
            />
            <button
              className="btn btn-sm"
              style={{ marginTop: 12 }}
              onClick={handleCheckOverlaps}
              disabled={loadingOverlap || (project.selectedKPIs?.length || 0) < 2}
            >
              <SearchIcon /> {loadingOverlap ? "Checking…" : "AI: check for overlaps & weak alignment"}
            </button>
          </>
        )}

        {tab === "coverage" && (
          <RFCoveragePanel
            project={project}
            allKpis={allKpis}
            onOpenLinks={refId => {
              const kpi = allKpis.find(k => k.id === refId);
              const sel = project.selectedKPIs?.find(s => s.kpiId === refId || s.customId === refId);
              const name = kpi?.name || sel?.customFields?.name || refId;
              setLinkModal({ refId, kpiName: name });
            }}
          />
        )}

        {/* Bottom actions */}
        <div className="row" style={{ marginTop: 16, gap: 8 }}>
          <button className="btn btn-sm" onClick={() => setSuggestModal(true)}>
            <PlusIcon /> Suggest a new KPI
          </button>
          <button className="btn btn-sm" onClick={() => setPsModal(true)}>
            <PlusIcon /> Add project-specific indicator
          </button>
        </div>
        <p className="hint" style={{ marginTop: 4 }}>
          "Suggest a new KPI" proposes an addition to the institutional library and goes to M&amp;E for review.
          "Add project-specific indicator" is for something this project alone needs to track — it's usable right away.
        </p>
      </div>

      {/* Modals */}
      {detailModal && detailKpi && (
        <KpiDetailModal
          kpiId={detailModal.kpiId}
          kpi={detailKpi}
          project={project}
          volumes={volumes}
          opts={detailModal.opts || {}}
          onClose={() => setDetailModal(null)}
          onAdd={addKpi}
          onRemove={removeKpi}
        />
      )}

      {linkModal && (
        <LinkResultsModal
          project={project}
          refId={linkModal.refId}
          kpiName={linkModal.kpiName}
          onClose={() => setLinkModal(null)}
          onSave={saveLinks}
        />
      )}

      {suggestModal && (
        <SuggestKpiModal
          project={{ ...project, _allKpis: allKpis }}
          onClose={() => setSuggestModal(false)}
          onSave={addCustomKpi}
          askAI={async (prompt, opts) => {
            try { return await askAIJson(prompt, opts); } catch { return { matches: [] }; }
          }}
        />
      )}

      {psModal && (
        <ProjectSpecificModal
          project={project}
          onClose={() => setPsModal(false)}
          onSave={addCustomKpi}
        />
      )}
    </>
  );
}

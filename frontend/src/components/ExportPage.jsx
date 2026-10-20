/**
 * ExportPage — exact port of renderOutputs() from app.html.
 *
 * Layout: .outputs-grid (220px project list + export panel)
 * Accessible at /projects/:id/export  and  /export
 *
 * Three download actions matching the original:
 *   - Word-compatible HTML (.html)  — opens in MS Word via File > Open
 *   - KPI table CSV (.csv)
 *   - Print / Save PDF              — window.print()
 *
 * Document preview: full 10-section HTML rendered inline inside
 *   .card.print-area with background:var(--surface-2), max-height 640px.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listCollection } from "../api/documents.js";
import Spinner from "./Spinner.jsx";

/* ── SVG icons (exact copies from app.html iconSvg()) ───────────────────── */
const IconOutput = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "1em", height: "1em" }}>
    <path d="M4 4h16v16H4z"/><path d="M4 9h16M9 4v16"/>
  </svg>
);
const IconDownload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "1em", height: "1em" }}>
    <path d="M12 3v13M6 11l6 6 6-6"/><path d="M4 21h16"/>
  </svg>
);
const IconDoc = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "1em", height: "1em" }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <path d="M14 2v6h6M9 13h6M9 17h6"/>
  </svg>
);
const IconFolder = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "1em", height: "1em" }}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
  </svg>
);

/* ── helpers ─────────────────────────────────────────────────────────────── */
function safeFilename(s) {
  return String(s || "project")
    .replace(/[^a-z0-9\- ]/gi, "").trim()
    .replace(/\s+/g, "-").slice(0, 60) || "project";
}

function truncate(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n) + "…" : s; }

const KPI_TIERS = {
  core:       "A · Core accountability",
  optional:   "B · Management / optional",
  evaluation: "C · Evaluation-only",
};
function normalizeTier(t) { return (t && KPI_TIERS[t]) ? t : "core"; }

function deriveDataRequirementRow(kpi) {
  const unit = kpi?.unit || "";
  return {
    variables: (kpi?.unitOfObservation || "").split(".")[0] || kpi?.name || "",
    dataType:  /percentage|%|rate|share/i.test(unit) ? "Numeric (percentage)"
             : /count|number|volume|tonnes|kg|ha/i.test(unit) ? "Numeric (quantity)"
             : "Numeric / structured",
  };
}

function buildKpiRow(sel, allKpis) {
  const kpi = allKpis.find(k => k.id === sel.kpiId);
  if (kpi) return { ...kpi, isCustom: false, tier: normalizeTier(sel.tier) };
  if (sel.source === "project-specific" && sel.customFields) {
    const c = sel.customFields;
    return {
      id: sel.customId || "PS", name: c.name || "(unnamed)", definition: c.definition || "",
      unit: c.unit || "—", resultsLevel: "Project-specific",
      volumeNumber: null, volumeTitle: null,
      dataSource: c.dataSource || "—", collectionInstrument: c.calculation || "—",
      unitOfObservation: c.responsibleUnit || "—", collectionFrequency: c.frequency || "—",
      reportingFrequency: "", aggregationRule: c.calculation || "—",
      disaggregationRequired: c.disaggregation || "—",
      isCustom: true, tier: normalizeTier(sel.tier),
    };
  }
  return null;
}

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

/* ── buildDataRequirementsDoc — 10-section HTML (matches original exactly) ── */
function buildDataRequirementsDoc(project, allKpis, projectTypes) {
  const pt      = (projectTypes || []).find(t => t.id === project.projectTypeId);
  const rf      = project.resultsFramework?.results || [];
  const kpis    = (project.selectedKPIs || [])
    .map(sel => ({ sel, kpi: buildKpiRow(sel, allKpis || []) }))
    .filter(x => x.kpi);
  const unresolved = computeUnresolvedIssues(project);
  const now        = new Date().toLocaleString();

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); } catch { return iso; }
  }
  function resultName(id) {
    const r = rf.find(x => x.id === id);
    return r ? r.statement : id;
  }
  function stripIfPrefix(s) {
    return String(s || "").replace(/^\s*(and\s+if|if)\s+/i, "");
  }

  return `<div class="dr-doc">
<style>.dr-doc table{table-layout:fixed;} .dr-doc td,.dr-doc th{word-break:break-word; overflow-wrap:break-word;}</style>
<h1 style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">${esc(project.title)}</h1>
<p class="muted">MEAL Framework — Data Requirements &amp; Project Summary · CIMMYT · generated ${esc(now)}</p>
<hr>

<h2>1. Project summary</h2>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;">
  <tr><td><b>Project type</b></td><td>${esc(pt?.userLabel ?? "—")} <span class="muted">(${esc(pt?.canonicalName ?? "")})</span></td></tr>
  <tr><td><b>Results Framework</b></td><td>${project.resultsFramework?.approved ? `Approved ${fmtDate(project.resultsFramework.approvedAt)} · version ${project.resultsFramework.version}` : "Not yet approved"}</td></tr>
  <tr><td><b>Theory of Change</b></td><td>${project.theoryOfChange?.approved ? `Approved ${fmtDate(project.theoryOfChange.approvedAt)} · version ${project.theoryOfChange.version}` : "Not yet approved"}</td></tr>
  <tr><td><b>Data Requirements</b></td><td>${project.dataRequirements?.approved ? `Approved ${fmtDate(project.dataRequirements.approvedAt)}` : "Not yet approved"}</td></tr>
  ${Object.entries(project.metadata || {}).filter(([, v]) => v && v.value).map(([k, v]) =>
    `<tr><td><b>${esc(k.replace(/([A-Z])/g, " $1").trim())}</b></td><td>${esc(v.value)}${v.status === "INFERRED" ? " <i>(AI inferred)</i>" : ""}</td></tr>`
  ).join("")}
</table>

<h2>2. Approved Results Framework</h2>
${project.resultsFramework?.approved
  ? `<p class="muted">Approved ${fmtDate(project.resultsFramework.approvedAt)} · version ${project.resultsFramework.version}</p>`
  : '<p style="color:#a23b2e"><b>Not yet approved.</b></p>'}
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;">
  <tr><th>Level</th><th>Statement</th><th>Source</th></tr>
  ${rf.map(r => `<tr><td>${esc(r.level)}</td><td>${esc(r.statement)}</td><td>${esc(r.origin || "user")}</td></tr>`).join("")}
</table>

<h2>3. Approved Theory of Change</h2>
${project.theoryOfChange?.approved
  ? `<p class="muted">Approved ${fmtDate(project.theoryOfChange.approvedAt)} · version ${project.theoryOfChange.version}</p>`
  : '<p style="color:#a23b2e"><b>Not yet approved.</b></p>'}
${project.theoryOfChange?.narrativeIntro ? `<p>${esc(project.theoryOfChange.narrativeIntro)}</p>` : ""}
${(project.theoryOfChange?.pathways || []).map((p, i) => `
  <p><b>Pathway ${i + 1}:</b><br>
  ${(p.ifs || []).map((f, j) => esc((j === 0 ? "IF " : "AND IF ") + stripIfPrefix(f))).join("<br>")}<br>
  <b>THEN</b> ${esc(p.then)}<br>
  <b>WHICH CONTRIBUTES TO</b> ${esc(p.contributesTo)}</p>
  ${p.assumptions?.length ? `<p><b>Assumptions:</b><br>${p.assumptions.map(a => esc("- " + a)).join("<br>")}</p>` : ""}
  ${p.risks?.length ? `<p><b>Risks and mitigation:</b><br>${p.risks.map((r, j) =>
    esc("- Risk: " + r) + (p.riskMitigation?.[j] ? "<br>&nbsp;&nbsp;" + esc("Mitigation: " + p.riskMitigation[j]) : "")
  ).join("<br>")}</p>` : ""}
`).join("")}

<h2>4–5. Selected KPIs, definitions and methodologies</h2>
<p class="muted">Tiered: A · Core accountability (routine), B · Management/optional (adaptive management), C · Evaluation-only (dedicated study needed).</p>
${kpis.map(({ sel, kpi }) => `
  <h3>${esc(kpi.id)} — ${esc(kpi.name)}${kpi.isCustom ? " (project-specific indicator)" : ""}</h3>
  <p><b>Tier:</b> ${esc(KPI_TIERS[kpi.tier] || kpi.tier)}</p>
  <p><b>Definition:</b> ${esc(kpi.definition)}</p>
  <p><b>Unit:</b> ${esc(kpi.unit)} &nbsp; <b>Results level:</b> ${esc(kpi.resultsLevel)}</p>
  <p><b>Linked results:</b> ${(sel.linkedResultIds || []).map(id => esc(resultName(id))).join("; ") || "<i>none linked</i>"}</p>
`).join("")}

<h2>6. KPI-to-result mapping</h2>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;">
  <tr><th>Result</th><th>Linked KPIs</th></tr>
  ${rf.map(r => {
    const linked = kpis.filter(({ sel }) => (sel.linkedResultIds || []).includes(r.id))
      .map(({ kpi }) => kpi.id).join(", ");
    return `<tr><td>${esc(r.statement)}</td><td>${linked || '<span style="color:#a23b2e">none</span>'}</td></tr>`;
  }).join("")}
</table>

<h2>7. Data requirements</h2>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:11px;">
  <tr><th>KPI ID</th><th>Name</th><th>Tier</th><th>Required variables</th><th>Data type</th><th>Unit</th><th>Disaggregation</th><th>Data source</th><th>Collection method</th><th>Frequency</th><th>Respondent / unit of observation</th><th>Aggregation rule</th></tr>
  ${kpis.map(({ sel, kpi }) => {
    const dr = deriveDataRequirementRow(kpi);
    return `<tr>
      <td>${esc(kpi.id)}</td><td>${esc(kpi.name)}</td>
      <td>${esc((KPI_TIERS[kpi.tier] || kpi.tier).split(" · ")[0])}</td>
      <td>${esc(dr.variables)}</td><td>${esc(dr.dataType)}</td>
      <td>${esc(kpi.unit)}</td><td>${esc(kpi.disaggregationRequired)}</td>
      <td>${esc(kpi.dataSource)}</td><td>${esc(kpi.collectionInstrument)}</td>
      <td>${esc(kpi.collectionFrequency)}</td><td>${esc(kpi.unitOfObservation)}</td>
      <td>${esc(kpi.aggregationRule)}</td>
    </tr>`;
  }).join("")}
</table>

<h2>8. Controlled vocabulary mapping</h2>
<p style="color:#a66a16"><b>No CIMMYT controlled vocabulary source has been loaded into this tool yet.</b> Every field below is flagged "No approved term found" pending review by the M&amp;E team / data standards owner — per policy, this tool does not invent vocabulary terms.</p>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;">
  <tr><th>KPI</th><th>Field</th><th>Status</th></tr>
  ${kpis.map(({ kpi }) => `<tr><td>${esc(kpi.id)}</td><td>${esc(kpi.unit)}</td><td>No approved term found — flagged for review</td></tr>`).join("")}
</table>

<h2>9. Data collection guidance</h2>
${kpis.map(({ kpi }) => {
  const note = project.dataRequirements?.narrativeNotes?.[kpi.id];
  const methodLabel = kpi.isCustom
    ? "Project-specific indicator — defined for this project, not in the CIMMYT Toolbox"
    : `CIMMYT Toolbox methodology (Vol ${kpi.volumeNumber} — ${esc(kpi.volumeTitle)})`;
  return `<p><b>${esc(kpi.id)} — ${esc(kpi.name)}</b><br>
  <i>${methodLabel}:</i>
  Data source: ${esc(kpi.dataSource)}.
  ${kpi.isCustom ? "Calculation" : "Instrument"}: ${esc(kpi.collectionInstrument)}.
  ${kpi.isCustom ? "Responsible unit" : "Unit of observation"}: ${esc(kpi.unitOfObservation)}.
  Frequency: ${esc(kpi.collectionFrequency)}${kpi.reportingFrequency ? ` (reported ${esc(kpi.reportingFrequency)})` : ""}.
  Aggregation: ${esc(kpi.aggregationRule)}.
  ${note ? `<br><i>Project-specific notes:</i> ${esc(note)}` : ""}</p>`;
}).join("")}

<h2>10. Pending issues / validations</h2>
${unresolved.length
  ? `<ul>${unresolved.map(u => `<li>${esc(u.text)}</li>`).join("")}</ul>`
  : "<p>No unresolved issues detected at time of export.</p>"}
<hr>
<p class="muted" style="font-size:10px;">Generated by MEAL Framework Studio. CIMMYT · ${esc(now)}.</p>
</div>`;
}

/* ── Main ExportPage component ───────────────────────────────────────────── */
export default function ExportPage() {
  const navigate = useNavigate();
  const { id }   = useParams(); // may be undefined when accessed from /export directly

  const [projects,     setProjects]     = useState([]);
  const [activeId,     setActiveId]     = useState(id || null);
  const [allKpis,      setAllKpis]      = useState([]);
  const [projectTypes, setProjectTypes] = useState([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    Promise.all([
      listCollection("projects").then(({ docs }) => docs.map(d => d.data)),
      fetch("/data/kpis.json").then(r => r.json()),
      fetch("/data/project-types.json").then(r => r.json()),
    ]).then(([projs, kpis, types]) => {
      const sorted = projs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      setProjects(sorted);
      setAllKpis(kpis);
      setProjectTypes(types);
      // Pick the active project: URL param first, then first in list
      if (!activeId && sorted.length) setActiveId(sorted[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const active = projects.find(p => p.id === activeId) || null;

  if (loading) return (
    <div className="page-center"><Spinner size="lg" /></div>
  );

  if (!projects.length) return (
    <div className="card">
      <div className="empty">
        <IconOutput />
        <div className="empty-title">No projects yet</div>
      </div>
    </div>
  );

  /* ── Download handlers ─────────────────────────────────────────── */
  function handleDownloadWord() {
    if (!active) return;
    const body = buildDataRequirementsDoc(active, allKpis, projectTypes);
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset="utf-8"><title>${active.title}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;} h1{font-size:20pt;} h2{font-size:14pt;margin-top:22px;color:#3F6B21;} h3{font-size:12pt;color:#3F6B21;} table{width:100%;} .muted{color:#666;}</style>
</head><body>${body}</body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = safeFilename(active.title) + "-data-requirements.html";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleDownloadCSV() {
    if (!active) return;
    const kpis = (active.selectedKPIs || [])
      .map(sel => ({ sel, kpi: buildKpiRow(sel, allKpis) }))
      .filter(x => x.kpi);
    const rf = active.resultsFramework?.results || [];
    const headers = [
      "KPI ID", "Name", "Tier", "Linked Result",
      "Required Variables", "Data Type", "Unit", "Disaggregation",
      "Data Source", "Collection Method", "Frequency",
      "Respondent / Unit of Observation", "Aggregation Rule",
      "Controlled Vocabulary Status",
    ];
    const rows = [headers];
    kpis.forEach(({ sel, kpi }) => {
      const dr = deriveDataRequirementRow(kpi);
      const linked = (sel.linkedResultIds || [])
        .map(rid => { const r = rf.find(x => x.id === rid); return r ? r.statement : rid; })
        .join("; ");
      rows.push([
        kpi.id, kpi.name,
        (KPI_TIERS[kpi.tier] || kpi.tier).split(" · ")[0],
        linked, dr.variables, dr.dataType, kpi.unit,
        kpi.disaggregationRequired, kpi.dataSource,
        kpi.collectionInstrument, kpi.collectionFrequency,
        kpi.unitOfObservation, kpi.aggregationRule,
        "No approved term found — flagged for review",
      ]);
    });
    const csv = rows
      .map(r => r.map(c => '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"').join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = safeFilename(active.title) + "-data-requirements.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const docHtml = active ? buildDataRequirementsDoc(active, allKpis, projectTypes) : "";

  /* ── Render — matches renderOutputs() layout exactly ──────────── */
  return (
    <div className="outputs-grid">
      {/* Left: project selector */}
      <div className="card" style={{ padding: 10, minWidth: 0 }}>
        <b className="small soft" style={{ padding: "6px 8px", display: "block" }}>
          Select project
        </b>
        {projects.map(proj => (
          <div
            key={proj.id}
            className={`nav-item ${proj.id === activeId ? "active" : ""}`}
            style={{ cursor: "pointer" }}
            onClick={() => setActiveId(proj.id)}
          >
            {truncate(proj.title || "Untitled", 26)}
          </div>
        ))}
      </div>

      {/* Right: export panel */}
      <div className="card" style={{ minWidth: 0 }}>
        <div className="section-head">
          <h3>Export — {active?.title ?? "—"}</h3>
          <div className="row">
            <button className="btn btn-sm" onClick={handleDownloadWord}>
              <IconDownload /> Word-compatible (.html)
            </button>
            <button className="btn btn-sm" onClick={handleDownloadCSV}>
              <IconDownload /> KPI table (.csv)
            </button>
            <button className="btn btn-sm" onClick={() => window.print()}>
              <IconDoc /> Print / Save PDF
            </button>
          </div>
        </div>

        <div className="hint">
          Preview below. This compiled record covers all 10 sections: project summary, approved
          Results Framework, approved Theory of Change, selected KPIs, definitions &amp; methodologies,
          KPI-to-result mapping, data requirements, controlled vocabulary mapping, data collection
          guidance, and pending issues.
        </div>

        {/* Document preview — matches original .print-area */}
        <div
          className="card print-area"
          style={{
            background: "var(--surface-2)",
            marginTop: 12,
            fontSize: 12.5,
            maxHeight: 640,
            overflowY: "auto",
            overflowX: "auto",
            minWidth: 0,
          }}
        >
          <div
            style={{ minWidth: 640 }}
            dangerouslySetInnerHTML={{ __html: docHtml }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * KpiLibraryPage — matches renderKpiLibraryScreen(null) from app.html.
 * Standalone KPI library (no project context): search + filter + volumes browser.
 * Reuses the ExploreTab logic from KPISelector but without the Add buttons.
 */
import { useEffect, useState } from "react";
import { askAIJson } from "../api/ai.js";
import Spinner from "./Spinner.jsx";

function truncate(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n) + "…" : s; }

export default function KpiLibraryPage() {
  const [allKpis,   setAllKpis]   = useState([]);
  const [volumes,   setVolumes]   = useState([]);
  const [projectTypes, setProjectTypes] = useState([]);
  const [loading,   setLoading]   = useState(true);

  // Filters
  const [q,        setQ]        = useState("");
  const [aiQuery,  setAiQuery]  = useState("");
  const [typeId,   setTypeId]   = useState("");
  const [level,    setLevel]    = useState("");
  const [volume,   setVolume]   = useState("");
  const [aiResults,setAiResults]= useState(null);
  const [searching,setSearching]= useState(false);

  // View mode
  const [view,    setView]    = useState("list"); // list | volumes
  const [volNum,  setVolNum]  = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/kpis.json").then(r => r.json()),
      fetch("/data/volumes.json").then(r => r.json()),
      fetch("/data/project-types.json").then(r => r.json()),
    ]).then(([k, v, t]) => { setAllKpis(k); setVolumes(v); setProjectTypes(t); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* ── Filter list ──────────────────────────────────────────────────────── */
  let list = allKpis;
  if (aiResults) {
    const order = aiResults;
    const byId  = new Map(order.map(o => [o.kpiId, o.why]));
    list = allKpis.filter(k => byId.has(k.id))
      .sort((a, b) => order.findIndex(o => o.kpiId === a.id) - order.findIndex(o => o.kpiId === b.id));
  } else {
    if (q)      list = list.filter(k => (k.name + " " + k.definition + " " + k.id).toLowerCase().includes(q.toLowerCase()));
    if (typeId) { const pt = projectTypes.find(t => t.id === typeId); if (pt) list = list.filter(k => (k.projectTypesApply || []).includes(pt.canonicalName)); }
    if (level)  list = list.filter(k => k.resultsLevel === level);
    if (volume) list = list.filter(k => String(k.volumeNumber) === volume);
  }

  async function handleAISearch(e) {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    setSearching(true);
    try {
      const sample = allKpis.slice(0, 100).map(k => ({ kpiId: k.id, name: k.name }));
      const result = await askAIJson(
        `From the CIMMYT KPI library below, find the most relevant KPIs for: "${aiQuery}"\nReturn JSON: {"results":[{"kpiId":"...","why":"..."}]} — most relevant first, max 20.\nLibrary: ${JSON.stringify(sample)}`,
        { modelTier: "quick", feature: "kpi_search" }
      );
      setAiResults(result.results || []);
    } catch { setAiResults([]); }
    finally { setSearching(false); }
  }

  /* ── Volume detail ────────────────────────────────────────────────────── */
  if (view === "volumes" && volNum !== null) {
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
            ← All volumes
          </button>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-sm" onClick={() => setVolNum(prev.volumeNumber)} disabled={!prev}>
              ← Vol {prev?.volumeNumber}
            </button>
            <span className="small muted">Volume {idx + 1} of {sortedVols.length}</span>
            <button className="btn btn-sm" onClick={() => setVolNum(next.volumeNumber)} disabled={!next}>
              Vol {next?.volumeNumber} →
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
          <div className="prose small" style={{ marginTop: 10, lineHeight: 1.6 }}>{vol?.introSummary}</div>
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
                  {items.map(k => <KpiCard key={k.id} kpi={k} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Volumes grid ─────────────────────────────────────────────────────── */
  if (view === "volumes") {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">KPI Library</h1>
          <span className="small muted">{allKpis.length} indicators · all 13 CIMMYT Toolbox volumes</span>
        </div>

        <div className="segctl" style={{ marginBottom: 14 }}>
          <button className="segctl-btn" onClick={() => setView("list")}>
            🔍 All indicators — search &amp; filter
          </button>
          <button className="segctl-btn active">
            📚 Browse by volume
          </button>
        </div>

        <div className="hint" style={{ marginBottom: 10 }}>
          The full CIMMYT Toolbox indicator register — all 13 pathway volumes, {allKpis.length} indicators in total.
          Open a volume to read its indicators and their methodological guides.
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
                {v.pathwayType}
                {v.indicatorCounts ? ` · ${v.indicatorCounts.impact || 0} Impact · ${v.indicatorCounts.outcome || 0} Outcome · ${v.indicatorCounts.output || 0} Output` : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── List view (default) ──────────────────────────────────────────────── */
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">KPI Library</h1>
        <span className="small muted">{allKpis.length} indicators · all 13 CIMMYT Toolbox volumes</span>
      </div>

      {/* View toggle */}
      <div className="segctl" style={{ marginBottom: 14 }}>
        <button className="segctl-btn active">
          🔍 All indicators — search &amp; filter
        </button>
        <button className="segctl-btn" onClick={() => setView("volumes")}>
          📚 Browse by volume
        </button>
      </div>

      {/* AI search + filters */}
      <div className="card" style={{ padding: "14px 16px", marginBottom: 14 }}>
        <form onSubmit={handleAISearch}>
          <div className="row">
            <div style={{ flex: 1, minWidth: 220 }}>
              <input
                type="text"
                placeholder='Ask in plain language — e.g. "indicators for women benefiting from mechanization"'
                value={aiQuery}
                onChange={e => setAiQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={searching || !aiQuery.trim()}>
              {searching ? <Spinner /> : "✦"} AI search
            </button>
            {aiResults && <button type="button" className="btn btn-sm" onClick={() => { setAiResults(null); setAiQuery(""); }}>Clear</button>}
          </div>
        </form>

        <div className="row" style={{ marginTop: 10 }}>
          <input
            type="text"
            style={{ maxWidth: 220 }}
            placeholder="Filter by keyword…"
            value={q}
            onChange={e => { setQ(e.target.value); setAiResults(null); }}
          />
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

      {loading ? (
        <div className="empty"><span className="spinner lg" /></div>
      ) : (
        <>
          <div className="small muted" style={{ marginBottom: 8 }}>
            {list.length} indicator{list.length !== 1 ? "s" : ""}{aiResults ? " matched by AI search" : ""}
          </div>
          <div className="stack">
            {list.length
              ? list.map(k => <KpiCard key={k.id} kpi={k} why={aiResults?.find(o => o.kpiId === k.id)?.why} />)
              : <div className="empty"><div className="empty-title">No matches</div><div className="small">Try different filters or an AI search.</div></div>
            }
          </div>
        </>
      )}
    </div>
  );
}

/* ── KPI card (read-only library view) ──────────────────────────────────── */
function KpiCard({ kpi, why }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card" style={{ padding: "12px 14px" }}>
      <div className="row" style={{ gap: 8, marginBottom: 4 }}>
        <span className="idchip">{kpi.id}</span>
        <span className="tag tag-optional">{kpi.resultsLevel}</span>
        {kpi.indicatorScope && <span className="tag tag-optional">{kpi.indicatorScope}</span>}
      </div>
      <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 4 }}>{kpi.name}</div>
      <div className="small soft" style={{ marginTop: 3 }}>{truncate(kpi.definition, 180)}</div>
      {why && <div className="ai-note" style={{ marginTop: 6 }}>✦ {why}</div>}
      <div className="row" style={{ marginTop: 8, gap: 8 }}>
        <button className="linkbtn small" onClick={() => setExpanded(v => !v)}>
          {expanded ? "▲ Hide" : "▼ Methodological guide"} — Vol {kpi.volumeNumber}
        </button>
      </div>
      {expanded && (
        <div style={{ marginTop: 10 }}>
          <hr className="divider" />
          <dl className="kv" style={{ marginTop: 8 }}>
            <dt>Definition</dt>     <dd style={{ fontSize: 12.5 }}>{kpi.definition}</dd>
            <dt>Unit</dt>           <dd style={{ fontFamily: "ui-monospace,monospace" }}>{kpi.unit}</dd>
            <dt>Data source</dt>    <dd style={{ fontSize: 12.5 }}>{kpi.dataSource}</dd>
            <dt>Instrument</dt>     <dd style={{ fontSize: 12.5 }}>{kpi.collectionInstrument}</dd>
            <dt>Frequency</dt>      <dd>{kpi.collectionFrequency}{kpi.reportingFrequency ? ` (reported ${kpi.reportingFrequency})` : ""}</dd>
            <dt>Disaggregation</dt> <dd style={{ fontSize: 12.5 }}>{kpi.disaggregationRequired}</dd>
            <dt>Aggregation</dt>    <dd style={{ fontSize: 12.5 }}>{kpi.aggregationRule}</dd>
          </dl>
          {kpi.relatedKPIs?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <b className="small soft">Related KPIs: </b>
              <div className="chip-row" style={{ marginTop: 4 }}>
                {kpi.relatedKPIs.map(r => <span key={r} className="idchip">{r}</span>)}
              </div>
            </div>
          )}
          <div className="small muted" style={{ marginTop: 8 }}>
            Source: {kpi.sourceRef} · Status: {kpi.status} · Updated {kpi.lastUpdated}
          </div>
        </div>
      )}
    </div>
  );
}

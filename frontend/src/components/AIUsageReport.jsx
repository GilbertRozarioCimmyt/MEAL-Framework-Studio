import { useEffect, useState } from "react";
import { getAIUsage } from "../api/admin.js";
import Spinner from "./Spinner.jsx";

const fmt  = n  => n  == null ? "—" : Number(n).toLocaleString();
const fmtC = n  => n  == null ? "—" : `$${n.toFixed(4)}`;

export default function AIUsageReport() {
  const [report,   setReport]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [since,    setSince]    = useState("");
  const [days,     setDays]     = useState("");
  const [showDaily,setShowDaily]= useState(false);

  function load() {
    setLoading(true); setError("");
    getAIUsage({ since: since || undefined, days: days || undefined, daily: showDaily })
      .then(setReport)
      .catch(() => setError("Could not load usage report."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card">
      <div className="section-head"><h3>AI usage &amp; errors</h3></div>

      {/* Filters */}
      <div className="usage-filters">
        <label>Since (YYYY-MM-DD)<input type="date" value={since} onChange={e => setSince(e.target.value)} style={{ marginTop: 4 }} /></label>
        <span className="usage-filters-or">or</span>
        <label>Last N days<input type="number" min="1" max="365" value={days} onChange={e => setDays(e.target.value)} style={{ marginTop: 4 }} /></label>
        <label style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={showDaily} onChange={e => setShowDaily(e.target.checked)} /> Day-by-day
        </label>
        <button className="btn btn-sm" onClick={load}>Refresh</button>
      </div>

      {error && <div className="alert alert-critical" style={{ marginBottom: 12 }}>{error}</div>}
      {loading && <div className="empty"><span className="spinner lg" /></div>}

      {report && !loading && (
        <>
          {/* Totals */}
          <div className="usage-totals">
            <div className="usage-stat"><span className="usage-stat-value">{fmt(report.totals.totalCalls)}</span><span className="usage-stat-label">Total calls</span></div>
            <div className="usage-stat"><span className="usage-stat-value">{fmt(report.totals.totalFailed)}</span><span className="usage-stat-label">Failures</span></div>
            <div className="usage-stat"><span className="usage-stat-value">{fmt(report.totals.totalInputTokens)}</span><span className="usage-stat-label">Input tokens</span></div>
            <div className="usage-stat"><span className="usage-stat-value">{fmt(report.totals.totalOutputTokens)}</span><span className="usage-stat-label">Output tokens</span></div>
            {report.pricesConfigured && <div className="usage-stat"><span className="usage-stat-value">{fmtC(report.totals.totalCostUsd)}</span><span className="usage-stat-label">Est. cost</span></div>}
          </div>
          <p className="usage-window">Window: from {report.sinceIso?.slice(0, 10) ?? "—"}</p>

          {/* By activity */}
          <p className="subsection-title">By activity (feature)</p>
          <div className="table-wrap" style={{ marginBottom: 18 }}>
            <table>
              <thead><tr><th>Feature</th><th>Status</th><th>Calls</th><th>Input tokens</th><th>Output tokens</th></tr></thead>
              <tbody>
                {report.byFeature.map((r, i) => (
                  <tr key={i} className={r.ok ? "" : "row-error"}>
                    <td><code className="idchip">{r.feature}</code></td>
                    <td><span className={`status-badge ${r.ok ? "active" : "revoked"}`}>{r.ok ? "ok" : "failed"}</span></td>
                    <td>{fmt(r.calls)}</td><td>{fmt(r.inputTokens)}</td><td>{fmt(r.outputTokens)}</td>
                  </tr>
                ))}
                {!report.byFeature.length && <tr><td colSpan={5} className="table-empty">No data</td></tr>}
              </tbody>
            </table>
          </div>

          {/* By model */}
          <p className="subsection-title">By model</p>
          <div className="table-wrap" style={{ marginBottom: 18 }}>
            <table>
              <thead><tr><th>Model</th><th>Status</th><th>Calls</th><th>Input</th><th>Output</th><th>Avg ms</th>{report.pricesConfigured && <th>Est. cost</th>}</tr></thead>
              <tbody>
                {report.byModel.map((r, i) => (
                  <tr key={i} className={r.ok ? "" : "row-error"}>
                    <td><code className="idchip model-id">{r.model}</code></td>
                    <td><span className={`status-badge ${r.ok ? "active" : "revoked"}`}>{r.ok ? "ok" : "failed"}</span></td>
                    <td>{fmt(r.calls)}</td><td>{fmt(r.inputTokens)}</td><td>{fmt(r.outputTokens)}</td>
                    <td>{fmt(r.avgDurationMs)}</td>
                    {report.pricesConfigured && <td>{fmtC(r.estCostUsd)}</td>}
                  </tr>
                ))}
                {!report.byModel.length && <tr><td colSpan={6} className="table-empty">No data</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Errors */}
          {report.byError.length > 0 && (
            <>
              <p className="subsection-title">Errors</p>
              <div className="table-wrap" style={{ marginBottom: 18 }}>
                <table>
                  <thead><tr><th>Error code</th><th>Calls</th><th>Last seen</th><th>Sample message</th></tr></thead>
                  <tbody>
                    {report.byError.map((r, i) => (
                      <tr key={i} className="row-error">
                        <td><code className="idchip">{r.errorCode}</code></td>
                        <td>{fmt(r.calls)}</td>
                        <td className="small">{r.lastSeen?.slice(0, 16).replace("T", " ") ?? "—"}</td>
                        <td className="small">{r.sampleMessage ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Daily */}
          {showDaily && report.daily?.length > 0 && (
            <>
              <p className="subsection-title">Day-by-day</p>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Day</th><th>Model</th><th>Calls</th><th>Input</th><th>Output</th>{report.pricesConfigured && <th>Est. cost</th>}</tr></thead>
                  <tbody>
                    {report.daily.map((r, i) => (
                      <tr key={i}>
                        <td>{r.day}</td>
                        <td><code className="idchip model-id">{r.model}</code></td>
                        <td>{fmt(r.calls)}</td><td>{fmt(r.inputTokens)}</td><td>{fmt(r.outputTokens)}</td>
                        {report.pricesConfigured && <td>{fmtC(r.estCostUsd)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

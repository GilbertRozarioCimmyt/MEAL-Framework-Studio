import { useEffect, useState } from "react";
import { listAccessCodes, createAccessCode, revokeAccessCode } from "../api/admin.js";
import Spinner from "./Spinner.jsx";

const ROLES = ["Project User", "M&E Reviewer", "Administrator"];

function roleCss(role) {
  if (role === "Administrator") return "role-administrator";
  if (role === "M&E Reviewer")  return "role-m-e-reviewer";
  return "";
}

export default function AccessCodesTab() {
  const [codes,      setCodes]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [newCode,    setNewCode]    = useState(null); // shown once
  const [showCreate, setShowCreate] = useState(false);
  const [form,       setForm]       = useState({ name: "", email: "", role: "Project User" });
  const [creating,   setCreating]   = useState(false);
  const [revoking,   setRevoking]   = useState(null);

  useEffect(() => {
    listAccessCodes()
      .then(({ accessCodes }) => setCodes(accessCodes))
      .catch(() => setError("Could not load access codes."))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.role) return;
    setCreating(true); setError("");
    try {
      const created = await createAccessCode(form);
      setNewCode(created);
      setCodes(prev => [{ id: created.id, name: created.name, email: created.email, role: created.role, revoked: false, created_at: new Date().toISOString() }, ...prev]);
      setShowCreate(false);
      setForm({ name: "", email: "", role: "Project User" });
    } catch (err) { setError(err.message || "Could not create access code."); }
    finally { setCreating(false); }
  }

  async function handleRevoke(code) {
    if (!confirm(`Revoke access code for ${code.name}? They will be logged out immediately.`)) return;
    setRevoking(code.id);
    try {
      await revokeAccessCode(code.id);
      setCodes(prev => prev.map(c => c.id === code.id ? { ...c, revoked: true } : c));
    } catch { setError("Could not revoke the access code."); }
    finally { setRevoking(null); }
  }

  if (loading) return <div className="empty"><span className="spinner lg" /></div>;

  return (
    <>
      <div className="card">
        <div className="section-head">
          <h3>Participant access codes</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Create code</button>
        </div>

        {error && <div className="alert alert-critical" style={{ marginBottom: 12 }}>{error}</div>}

        {/* One-time code display */}
        {newCode && (
          <div className="alert alert-success new-code-banner" style={{ marginBottom: 14 }}>
            <strong>New code created — copy it now, it will not be shown again:</strong>
            <code className="code-display">{newCode.code}</code>
            <span className="small">{newCode.name} · {newCode.role}</span>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 4, alignSelf: "flex-start" }} onClick={() => setNewCode(null)}>Dismiss</button>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Role</th><th>Created</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map(code => (
                <tr key={code.id} className={code.revoked ? "row-revoked" : ""}>
                  <td style={{ fontWeight: 600 }}>{code.name}</td>
                  <td className="small muted">{code.email || "—"}</td>
                  <td><span className={`role-badge ${roleCss(code.role)}`}>{code.role}</span></td>
                  <td className="small muted">{new Date(code.created_at).toLocaleDateString()}</td>
                  <td>
                    {code.revoked
                      ? <span className="status-badge revoked">Revoked</span>
                      : <span className="status-badge active">Active</span>
                    }
                  </td>
                  <td>
                    {!code.revoked && (
                      <button className="btn btn-ghost btn-sm btn-danger" onClick={() => handleRevoke(code)} disabled={revoking === code.id}>
                        {revoking === code.id ? <Spinner /> : "Revoke"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {codes.length === 0 && <tr><td colSpan={6} className="table-empty">No access codes yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Create access code</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="field">
                  <label className="field-label">Name *</label>
                  <input type="text" required autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">Email (optional)</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label">Role *</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating || !form.name.trim()}>
                  {creating ? <><Spinner /> Creating…</> : "Create code"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

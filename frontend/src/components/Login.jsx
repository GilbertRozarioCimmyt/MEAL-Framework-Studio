import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import Spinner from "./Spinner.jsx";

export default function Login() {
  const { login } = useAuth();
  const [code, setCode]   = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError("");
    try {
      await login(code.trim());
    } catch (err) {
      const msg =
        err.code === "invalid_code"  ? "That access code isn't recognised or was revoked." :
        err.code === "rate_limited"  ? "Too many attempts. Wait a few minutes and try again." :
        err.code === "network_error" ? "Cannot reach the server — make sure the backend is running." :
                                       err.message || "Login failed.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        {/* Brand mark */}
        <div className="login-brand">
          <div className="login-brand-icon">
            {/* leaf / MEAL icon */}
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 17 C10 17 3 13 3 7a7 7 0 0 1 14 0c0 6-7 10-7 10z"/>
              <line x1="10" y1="17" x2="10" y2="10"/>
            </svg>
          </div>
          <div className="login-brand-text">
            <div className="login-brand-title">MEAL Framework Studio</div>
            <div className="login-brand-sub">CIMMYT</div>
          </div>
        </div>

        <h1 className="login-heading">Sign in</h1>
        <p className="login-sub">
          Enter the access code from your workshop handout to continue.
        </p>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <label className="field-label" htmlFor="access-code">Access code</label>
          <input
            id="access-code"
            type="text"
            className="login-code-input"
            placeholder="XXXXX-XXXXX"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            autoComplete="off"
            autoFocus
            spellCheck={false}
            disabled={busy}
          />

          {error && (
            <p className="login-error" role="alert">
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" style={{flex:"0 0 auto",marginTop:1}}>
                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 3.75v4a.75.75 0 0 1-1.5 0v-4a.75.75 0 0 1 1.5 0zM8 12.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z"/>
              </svg>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            style={{ marginTop: 4 }}
            disabled={busy || !code.trim()}
          >
            {busy ? <><Spinner /> Signing in…</> : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * AuthContext — provides the current user identity and login/logout actions
 * to the whole component tree.
 *
 * On mount, calls GET /api/auth/me to restore session state without a full
 * page reload, mirroring the boot() pattern in the original app.html.
 *
 * Error handling:
 *   - 401 → not logged in (normal for a fresh visitor) → user = null
 *   - network_error → backend not reachable → user = null + bootError set
 *   - Any other error → treat as not logged in, show generic boot error
 *
 * setLoading(false) is ALWAYS called, no matter what — the Spinner only
 * shows until this resolves, so it must never be left pending.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { me, login as apiLogin, logout as apiLogout } from "../api/auth.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [bootError, setBootError] = useState(""); // set when backend unreachable

  // Probe the session cookie on first load.
  // Must call setLoading(false) in ALL code paths.
  useEffect(() => {
    me()
      .then((data) => {
        setUser(data);
        setBootError("");
      })
      .catch((err) => {
        setUser(null);
        // 401 = not logged in — totally normal, don't surface an error
        if (err.status === 401 || err.code === "401") {
          setBootError("");
        } else if (err.code === "network_error" || err.status === 0) {
          setBootError("Cannot reach the server. Make sure the backend is running on port 8000.");
        }
        // Any other error: silently treat as not logged in
      })
      .finally(() => {
        setLoading(false); // ← ALWAYS runs — this ends the spinner
      });
  }, []);

  const login = useCallback(async (code) => {
    const data = await apiLogin(code);
    setUser(data);
    setBootError("");
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, bootError, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

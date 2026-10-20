/**
 * Base API client — thin wrapper around fetch().
 * All requests send credentials (session cookie) automatically.
 *
 * 401 handling:
 *   - On GET /api/auth/me (session probe at startup): 401 is EXPECTED for
 *     a visitor who isn't logged in. AuthContext catches the error and sets
 *     user = null, which renders the Login page. A redirect here would
 *     reload the page before setLoading(false) runs → infinite spinner loop.
 *   - On any other authenticated call: 401 means the session expired.
 *     The thrown error carries err.status = 401 so callers can detect it.
 *     RequireAuth redirects to "/" whenever user is null, so the next
 *     navigation will land on Login automatically.
 *
 * Never auto-redirect here — that is the router's job, not the fetch layer's.
 */

const BASE = import.meta.env.VITE_API_BASE ?? "";

async function request(method, path, body, isFormData = false) {
  const url = `${BASE}${path}`;
  const headers = {};
  let bodyContent = undefined;

  if (body !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
    bodyContent = JSON.stringify(body);
  } else if (isFormData) {
    bodyContent = body; // FormData — browser sets Content-Type with boundary
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: bodyContent,
      credentials: "include", // send/receive the session cookie
    });
  } catch (networkErr) {
    // Network failure (backend down, no connection, CORS preflight blocked)
    const err = new Error("Cannot reach the server. Is the backend running?");
    err.code = "network_error";
    err.status = 0;
    throw err;
  }

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json().catch(() => ({}))
    : {};

  if (!res.ok) {
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.code = data.code || String(res.status);
    err.status = res.status;
    throw err;
  }

  return data;
}

export const api = {
  get:    (path)             => request("GET",    path),
  post:   (path, body)       => request("POST",   path, body),
  put:    (path, body)       => request("PUT",    path, body),
  delete: (path)             => request("DELETE", path),
  upload: (path, formData)   => request("POST",   path, formData, true),
};

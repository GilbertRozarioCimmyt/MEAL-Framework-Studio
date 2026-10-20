import { api } from "./client.js";

/** POST /api/auth/login — returns {id, name, role} */
export function login(code) {
  return api.post("/api/auth/login", { code });
}

/** GET /api/auth/me — returns {id, name, role} or throws 401 */
export function me() {
  return api.get("/api/auth/me");
}

/** POST /api/auth/logout */
export function logout() {
  return api.post("/api/auth/logout");
}

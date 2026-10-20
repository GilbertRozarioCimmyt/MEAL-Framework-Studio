import { api } from "./client.js";

/** GET /api/admin/ai-usage?since=&days=&daily= */
export function getAIUsage({ since, days, daily } = {}) {
  const params = new URLSearchParams();
  if (since) params.set("since", since);
  if (days) params.set("days", String(days));
  if (daily) params.set("daily", "1");
  const qs = params.toString();
  return api.get(`/api/admin/ai-usage${qs ? `?${qs}` : ""}`);
}

/** GET /api/admin/access-codes */
export function listAccessCodes() {
  return api.get("/api/admin/access-codes");
}

/** POST /api/admin/access-codes — {name, email, role} */
export function createAccessCode(data) {
  return api.post("/api/admin/access-codes", data);
}

/** POST /api/admin/access-codes/:id/revoke */
export function revokeAccessCode(id) {
  return api.post(`/api/admin/access-codes/${id}/revoke`);
}

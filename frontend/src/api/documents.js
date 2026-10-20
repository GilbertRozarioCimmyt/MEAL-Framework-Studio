/**
 * Generic document-store API — mirrors the Claude Artifact db capability.
 * All calls hit /api/db/<collection>/[<id>].
 */
import { api } from "./client.js";

/** GET /api/db/:collection  →  {docs: [{id, data}]} */
export function listCollection(collection) {
  return api.get(`/api/db/${collection}`);
}

/** GET /api/db/:collection/:id  →  {exists, data} */
export function getDoc(collection, id) {
  return api.get(`/api/db/${collection}/${id}`);
}

/** PUT /api/db/:collection/:id  — upsert */
export function setDoc(collection, id, data) {
  return api.put(`/api/db/${collection}/${id}`, data);
}

/** DELETE /api/db/:collection/:id */
export function deleteDoc(collection, id) {
  return api.delete(`/api/db/${collection}/${id}`);
}

import { api } from "./client.js";

/**
 * POST /api/uploads/ — multipart file upload
 * Returns {id, url, sizeBytes, contentType}
 */
export function uploadFile(file) {
  const form = new FormData();
  form.append("file", file);
  return api.upload("/api/uploads/", form);
}

/**
 * GET /api/uploads/:id — streamed file download URL
 * Returns the URL string (auth cookie is sent automatically)
 */
export function getUploadUrl(id) {
  return `/api/uploads/${id}`;
}

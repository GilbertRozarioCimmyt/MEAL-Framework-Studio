/**
 * AI API — wraps POST /api/ai/json and /api/ai/text.
 * Maps server error codes to user-friendly messages, mirroring the
 * aiErrorMessage() helper from the original app.html.
 */
import { api } from "./client.js";

const ERROR_MESSAGES = {
  rate_limited:      "Too many requests — wait a moment and try again.",
  prompt_too_large:  "The request was too large for the AI model.",
  sampling_disabled: "AI assistance is not enabled for this account.",
  timeout:           "The AI request timed out. Try again.",
  empty_completion:  "The AI returned an empty response. Try again.",
  refused:           "The AI request failed. Try again.",
};

/**
 * Convert an error code + optional server message into a user-facing string.
 * When the code is the generic "refused" and the server provided a real message
 * (not just the generic fallback), show the actual cause so it's debuggable.
 */
export function aiErrorMessage(code, serverMessage) {
  if (
    serverMessage &&
    code === "refused" &&
    serverMessage !== "The AI request failed." &&
    !serverMessage.startsWith("HTTP ")
  ) {
    return serverMessage;
  }
  return ERROR_MESSAGES[code] || serverMessage || "The AI request failed.";
}

/**
 * POST /api/ai/json
 * Returns the parsed JSON object from the model.
 * opts: { modelTier: "quick"|"default"|"complex", feature: string, timeoutMs: number }
 */
export async function askAIJson(prompt, opts = {}) {
  try {
    return await api.post("/api/ai/json", { prompt, opts });
  } catch (err) {
    err.userMessage = aiErrorMessage(err.code, err.message);
    throw err;
  }
}

/**
 * POST /api/ai/text
 * Returns { text: string, truncated: boolean }.
 */
export async function askAIText(prompt, opts = {}) {
  try {
    return await api.post("/api/ai/text", { prompt, opts });
  } catch (err) {
    err.userMessage = aiErrorMessage(err.code, err.message);
    throw err;
  }
}

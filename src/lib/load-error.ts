/**
 * Sorts a page-loading failure into what actually happened, so the shopper sees an accurate sentence
 * instead of a generic "something went wrong". Works on the error object (server render) and on its
 * serialised copy after hydration, so it checks the error's name and status rather than its class.
 */
export type LoadErrorKind = "offline" | "server" | "not_connected" | "unknown";

export function classifyLoadError(error: unknown): LoadErrorKind {
  if (!error || typeof error !== "object") return "unknown";
  const e = error as { name?: unknown; status?: unknown };
  if (e.name === "BackendOfflineError") return "offline";
  if (e.name === "BackendNotConnectedError") return "not_connected";
  if (e.name === "ApiError" && typeof e.status === "number" && e.status >= 500) return "server";
  return "unknown";
}

import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import type { Logger } from "./logger.js";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, "bad_request", message, details);
export const unauthorized = (message = "Please sign in.") => new HttpError(401, "unauthorized", message);
export const forbidden = (message = "You don't have permission to do that.") => new HttpError(403, "forbidden", message);
export const notFound = (message = "Not found.") => new HttpError(404, "not_found", message);
export const conflict = (message: string) => new HttpError(409, "conflict", message);

/** Central error handler: clear messages for expected problems, a generic message (and a log line) for everything else. */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, _next) => {
    const requestId = res.locals["requestId"] as string | undefined;
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) }, requestId });
      return;
    }
    if (err instanceof ZodError) {
      const details = err.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
      res.status(400).json({ error: { code: "validation_failed", message: "Some details are missing or invalid.", details }, requestId });
      return;
    }
    if ((err as { type?: string }).type === "entity.parse.failed") {
      res.status(400).json({ error: { code: "invalid_json", message: "The request body is not valid JSON." }, requestId });
      return;
    }
    if ((err as { type?: string }).type === "entity.too.large") {
      res.status(413).json({ error: { code: "too_large", message: "The request is too large." }, requestId });
      return;
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      res.status(409).json({ error: { code: "conflict", message: "That value is already used by another record." }, requestId });
      return;
    }
    const dbDown = err instanceof Prisma.PrismaClientInitializationError || (err instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1017"].includes(err.code));
    logger.error("request failed", { requestId, method: req.method, path: req.path, error: err instanceof Error ? { name: err.name, message: err.message } : String(err) });
    res.status(dbDown ? 503 : 500).json({
      error: dbDown
        ? { code: "database_unavailable", message: "The store database is not reachable right now. Nothing was saved." }
        : { code: "server_error", message: "Something went wrong on the server. Nothing was saved." },
      requestId,
    });
  };
}

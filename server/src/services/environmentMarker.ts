// Every staging/production database and media folder is stamped with the environment that first used it.
// A staging server pointed at the live database (or the live media folder) — or the other way round —
// refuses to start instead of touching real customers, stock, orders or photos.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Prisma, type PrismaClient } from "@prisma/client";

import type { Deployment } from "../config.js";

export const MARKER_KEY = "deployment.environment";
export const MEDIA_MARKER_FILE = ".bya-environment";

type Stamped = "staging" | "production";
export type MarkerResult = { ok: true; stamped: Stamped | null; created: boolean } | { ok: false; message: string };

const isStamp = (v: unknown): v is Stamped => v === "staging" || v === "production";

function mismatch(what: string, found: Stamped, expected: Stamped): MarkerResult {
  return { ok: false, message: `this ${what} belongs to the ${found} store, but this server is ${expected} (STORE_ENVIRONMENT). Give each store its own ${what}.` };
}

/** Reads the database stamp without changing anything (for deploy:check). */
export async function readDatabaseMarker(prisma: PrismaClient): Promise<Stamped | null | "unknown"> {
  const row = await prisma.storeSetting.findUnique({ where: { key: MARKER_KEY } });
  if (!row) return null;
  const env = (row.value as { environment?: unknown } | null)?.environment;
  return isStamp(env) ? env : "unknown";
}

/** Stamps an unstamped database; refuses a database stamped for the other environment. */
export async function ensureDatabaseMarker(prisma: PrismaClient, deployment: Deployment, now: () => Date = () => new Date()): Promise<MarkerResult> {
  if (deployment === "development") return { ok: true, stamped: null, created: false };
  const found = await readDatabaseMarker(prisma);
  if (found === "unknown") return { ok: false, message: `the database has an unreadable ${MARKER_KEY} setting — check it before starting` };
  if (found) return found === deployment ? { ok: true, stamped: found, created: false } : mismatch("database", found, deployment);
  try {
    await prisma.storeSetting.create({ data: { key: MARKER_KEY, value: { environment: deployment, claimedAt: now().toISOString() } } });
    return { ok: true, stamped: deployment, created: true };
  } catch (e) {
    // another instance stamped it at the same moment: re-read and compare
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return ensureDatabaseMarker(prisma, deployment, now);
    throw e;
  }
}

export async function readMediaMarker(root: string): Promise<Stamped | null | "unknown"> {
  try {
    const v = (await readFile(join(root, MEDIA_MARKER_FILE), "utf8")).trim();
    return isStamp(v) ? v : "unknown";
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

/** Same rule for the media folder (photos, videos, email outbox). */
export async function ensureMediaMarker(root: string, deployment: Deployment): Promise<MarkerResult> {
  if (deployment === "development") return { ok: true, stamped: null, created: false };
  const found = await readMediaMarker(root);
  if (found === "unknown") return { ok: false, message: `MEDIA_ROOT/${MEDIA_MARKER_FILE} is unreadable — check it before starting` };
  if (found) return found === deployment ? { ok: true, stamped: found, created: false } : mismatch("media folder (MEDIA_ROOT)", found, deployment);
  try {
    await writeFile(join(root, MEDIA_MARKER_FILE), `${deployment}\n`, { encoding: "utf8", flag: "wx" });
    return { ok: true, stamped: deployment, created: true };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST") return ensureMediaMarker(root, deployment);
    throw e;
  }
}

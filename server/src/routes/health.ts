import type { PrismaClient } from "@prisma/client";
import { Router } from "express";

import type { Config } from "../config.js";
import { checkDatabase } from "../db.js";

export function healthRoutes(prisma: PrismaClient, config: Pick<Config, "deployment" | "storeTestMode">) {
  const r = Router();
  /** Process is up (no database check) — for Hostinger's liveness probe. */
  r.get("/live", (_req, res) => { res.json({ status: "ok" }); });
  /** Process + database. 503 when MySQL is unreachable. */
  r.get("/", async (_req, res) => {
    const db = await checkDatabase(prisma);
    res.status(db ? 200 : 503).json({ status: db ? "ok" : "degraded", database: db ? "ok" : "unreachable", environment: config.deployment, testOrders: config.storeTestMode, time: new Date().toISOString() });
  });
  return r;
}

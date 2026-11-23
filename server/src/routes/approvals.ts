import { Router } from "express";

import { requirePermission } from "../middleware/auth.js";
import type { ApprovalsService } from "../services/approvalsService.js";

/**
 * The pre-launch checklist, worked out from the database and the server's own settings. Read-only:
 * an item turns confirmed only when the fact behind it exists.
 */
export function adminApprovalsRoutes(approvals: ApprovalsService) {
  const r = Router();
  r.get("/", requirePermission("content.read"), async (_req, res) => {
    res.json(await approvals.checklist());
  });
  return r;
}

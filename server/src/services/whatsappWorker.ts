// Background jobs for WhatsApp, run inside the API process (Hostinger runs one Node.js app; no extra
// service needed). State lives in MySQL, so a restart just continues. A short database lease keeps a
// second copy of the API from running the same jobs at the same time.
import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import type { Logger } from "../logger.js";
import type { CampaignService } from "./campaignService.js";
import type { CartRecoveryService } from "./cartRecovery.js";
import type { WhatsAppService } from "./whatsappService.js";

const LEASE = "whatsapp-worker";

export function createWhatsAppWorker(deps: { prisma: PrismaClient; wa: WhatsAppService; carts: CartRecoveryService; campaigns: CampaignService; logger: Logger; intervalMs?: number }) {
  const { prisma, wa, carts, campaigns, logger } = deps;
  const owner = `${process.pid}-${randomUUID().slice(0, 8)}`;
  const intervalMs = deps.intervalMs ?? 60_000;
  let timer: NodeJS.Timeout | null = null;
  let running: Promise<void> | null = null;
  let again = false;
  let lastPurge = 0;

  async function lease(): Promise<boolean> {
    const t = new Date();
    const until = new Date(t.getTime() + 4 * intervalMs);
    const n = await prisma.jobLease.updateMany({ where: { name: LEASE, OR: [{ owner }, { leaseUntil: { lt: t } }] }, data: { owner, leaseUntil: until } });
    if (n.count === 1) return true;
    try { await prisma.jobLease.create({ data: { name: LEASE, owner, leaseUntil: until } }); return true; } catch { return false; }
  }

  async function tick() {
    if (!(await lease())) return;
    await wa.processPendingEvents();
    await carts.processDue();
    // drain the queue in small batches (natural throttling); stop after a few rounds per tick
    for (let i = 0; i < 4; i++) { const r = await wa.processQueue(25); if (r.attempted < 25) break; }
    await campaigns.completeFinished();
    if (Date.now() - lastPurge > 3_600_000) { lastPurge = Date.now(); await wa.purge(); }
  }

  function run() {
    if (running) { again = true; return running; }
    running = tick()
      .catch((e) => logger.error("whatsapp worker tick failed", { error: e instanceof Error ? e.message : String(e) }))
      .finally(() => { running = null; if (again) { again = false; void run(); } });
    return running;
  }

  return {
    start() {
      if (timer || !wa.configured) return;
      wa.setKicker(() => { setTimeout(() => void run(), 250).unref(); });
      timer = setInterval(() => void run(), intervalMs);
      timer.unref();
      void run();
      logger.info("whatsapp worker started", { everySeconds: intervalMs / 1000 });
    },
    async stop() {
      if (timer) clearInterval(timer);
      timer = null;
      wa.setKicker(null);
      await running;
      await prisma.jobLease.deleteMany({ where: { name: LEASE, owner } }).catch(() => undefined);
    },
    /** one pass now (tests, admin "process now") */
    runOnce: () => tick(),
  };
}

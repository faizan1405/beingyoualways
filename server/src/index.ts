import { createApp, createServices } from "./app.js";
import { ConfigError, loadConfig } from "./config.js";
import { createPrisma } from "./db.js";
import { createLogger } from "./logger.js";
import { ensureDatabaseMarker, ensureMediaMarker } from "./services/environmentMarker.js";
import { checkMediaFolder } from "./startupChecks.js";

const boot = createLogger("info");
let config;
try {
  config = loadConfig();
} catch (e) {
  boot.error(e instanceof ConfigError ? e.message : "Could not read configuration");
  process.exit(1);
}

const media = await checkMediaFolder(config.media.root);
if (!media.ok) {
  boot.error(`Invalid server configuration — ${media.message}`);
  process.exit(1);
}

const mediaMarker = await ensureMediaMarker(config.media.root, config.deployment);
if (!mediaMarker.ok) {
  boot.error(`Refusing to start — ${mediaMarker.message}`);
  process.exit(1);
}

const logger = createLogger(config.logLevel);
const prisma = createPrisma(config.databaseUrl);
try {
  const dbMarker = await ensureDatabaseMarker(prisma, config.deployment);
  if (!dbMarker.ok) {
    boot.error(`Refusing to start — ${dbMarker.message}`);
    process.exit(1);
  }
  if (dbMarker.created || mediaMarker.created) logger.info("environment stamped", { deployment: config.deployment, database: dbMarker.created, media: mediaMarker.created });
} catch (e) {
  // database down at start: Hostinger restarts the app; never start unchecked
  boot.error(`Refusing to start — could not check the database (${e instanceof Error ? e.message.split("\n")[0] : "unknown error"})`);
  process.exit(1);
}
const services = createServices({ config, prisma, logger });
const app = createApp({ config, prisma, logger, services });
const server = app.listen(config.port, () => logger.info("api listening", { port: config.port, env: config.env, deployment: config.deployment, google: config.google ? "on" : "off", mail: config.mail ? "smtp" : "outbox", razorpay: config.razorpay?.mode ?? "off", whatsapp: config.whatsapp ? "on" : "off", testOrders: config.storeTestMode }));

// WhatsApp: sends queued messages, finishes webhook processing, bag reminders and campaigns (all stored in MySQL).
if (config.whatsappWorker) services.worker.start();

// Every 5 minutes: confirm unpaid online orders with Razorpay (missed webhooks, closed tabs) and release expired stock holds.
const sweep = () => services.checkout.reconcileAll().then((r) => { if (r.paid || r.expired) logger.info("payment sweep", r); }).catch((e) => logger.error("payment sweep failed", { error: e instanceof Error ? e.message : String(e) }));
const sweeper = setInterval(sweep, 5 * 60_000);
sweeper.unref();
setTimeout(sweep, 10_000).unref();

let closing = false;
async function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  clearInterval(sweeper);
  logger.info("shutting down", { signal });
  await services.worker.stop().catch(() => undefined);
  const force = setTimeout(() => { logger.error("forced shutdown after 10s"); process.exit(1); }, 10_000);
  force.unref();
  server.close(async () => {
    await prisma.$disconnect().catch(() => undefined);
    logger.info("shutdown complete");
    process.exit(0);
  });
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => logger.error("unhandled rejection", { error: reason instanceof Error ? reason.message : String(reason) }));

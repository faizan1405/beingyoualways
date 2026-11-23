import type { PrismaClient } from "@prisma/client";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";

import type { Config } from "./config.js";
import { errorHandler, notFound } from "./errors.js";
import type { Logger } from "./logger.js";
import { loadSession, requireAdmin } from "./middleware/auth.js";
import { apiLimiter, corsPolicy, csrfGuard, requestId, requestLog } from "./middleware/security.js";
import { authRoutes } from "./routes/auth.js";
import { healthRoutes } from "./routes/health.js";
import { adminProductRoutes, categoryRoutes, publicProductRoutes } from "./routes/products.js";
import { createAuthService } from "./services/authService.js";
import { createProductService } from "./services/productService.js";

export function createApp({ config, prisma, logger }: { config: Config; prisma: PrismaClient; logger: Logger }) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);

  const auth = createAuthService(prisma, config);
  const products = createProductService(prisma);

  app.use(requestId);
  app.use(requestLog(logger));
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(corsPolicy(config));
  app.use("/api", apiLimiter());
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());
  app.use(csrfGuard(config));
  app.use(loadSession(auth, config));

  app.use("/api/health", healthRoutes(prisma));
  app.use("/api/auth", authRoutes(auth, config));
  app.use("/api/products", publicProductRoutes(products));
  app.use("/api/categories", categoryRoutes(products));
  app.use("/api/admin", requireAdmin);
  app.use("/api/admin/products", adminProductRoutes(products));

  app.use((_req, _res, next) => next(notFound("No such API endpoint.")));
  app.use(errorHandler(logger));
  return app;
}

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
import { adminCommerceRoutes, checkoutRoutes, webhookRoutes } from "./routes/commerce.js";
import { adminProductRoutes, categoryRoutes, publicProductRoutes } from "./routes/products.js";
import { createAdminCustomerService } from "./services/adminCustomerService.js";
import { createAdminOrderService } from "./services/adminOrderService.js";
import { createAuthService } from "./services/authService.js";
import { createCheckoutService } from "./services/checkoutService.js";
import { createDashboardService } from "./services/dashboardService.js";
import { createDiscountService } from "./services/discountService.js";
import { createProductService } from "./services/productService.js";
import { createRazorpayGateway, type PaymentGateway } from "./services/razorpay.js";
import { createSettingsService } from "./services/settingsService.js";

export function createServices({ config, prisma, logger, gateway }: { config: Config; prisma: PrismaClient; logger: Logger; gateway?: PaymentGateway | null }) {
  const pay = gateway === undefined ? createRazorpayGateway(config) : gateway;
  const settings = createSettingsService(prisma, config, pay);
  const checkout = createCheckoutService({ prisma, config, settings, gateway: pay, logger });
  return { gateway: pay, settings, checkout, orders: createAdminOrderService(prisma, checkout), customers: createAdminCustomerService(prisma), dashboard: createDashboardService(prisma), discounts: createDiscountService(prisma) };
}

export function createApp({ config, prisma, logger, gateway, services }: { config: Config; prisma: PrismaClient; logger: Logger; gateway?: PaymentGateway | null; services?: ReturnType<typeof createServices> }) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);

  const auth = createAuthService(prisma, config);
  const products = createProductService(prisma);
  const commerce = services ?? createServices({ config, prisma, logger, gateway });

  app.use(requestId);
  app.use(requestLog(logger));
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(corsPolicy(config));
  // Signed server-to-server calls from Razorpay: raw body, no cookies, before the JSON parser.
  app.use("/api/webhooks", webhookRoutes(commerce.checkout));
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
  app.use("/api/checkout", checkoutRoutes(commerce.checkout, commerce.settings, config));
  app.use("/api/admin/products", adminProductRoutes(products));
  app.use("/api/admin", adminCommerceRoutes(commerce));

  app.use((_req, _res, next) => next(notFound("No such API endpoint.")));
  app.use(errorHandler(logger));
  return app;
}

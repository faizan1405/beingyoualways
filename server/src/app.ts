import type { PrismaClient } from "@prisma/client";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";

import type { Config } from "./config.js";
import { errorHandler, notFound } from "./errors.js";
import type { Logger } from "./logger.js";
import { loadSession, requireAdmin } from "./middleware/auth.js";
import { loadCustomerSession } from "./middleware/customerAuth.js";
import { apiLimiter, corsPolicy, csrfGuard, requestId, requestLog } from "./middleware/security.js";
import { adminApprovalsRoutes } from "./routes/approvals.js";
import { authRoutes } from "./routes/auth.js";
import { adminContentRoutes, publicContentRoutes } from "./routes/content.js";
import { customerRoutes } from "./routes/customer.js";
import { googleRoutes } from "./routes/google.js";
import { healthRoutes } from "./routes/health.js";
import { adminMediaRoutes, mediaServeRoutes } from "./routes/media.js";
import { adminCommerceRoutes, checkoutRoutes, webhookRoutes } from "./routes/commerce.js";
import { adminProductRoutes, categoryRoutes, publicProductRoutes } from "./routes/products.js";
import { adminReviewRoutes, publicReviewRoutes } from "./routes/reviews.js";
import { createAdminCustomerService } from "./services/adminCustomerService.js";
import { createAdminOrderService } from "./services/adminOrderService.js";
import { createApprovalsService } from "./services/approvalsService.js";
import { createAuthService } from "./services/authService.js";
import { createCheckoutService } from "./services/checkoutService.js";
import { createCustomerAuthService } from "./services/customerAuthService.js";
import { createDashboardService } from "./services/dashboardService.js";
import { createDiscountService } from "./services/discountService.js";
import { createGoogleAuth } from "./services/googleAuth.js";
import { createMailer } from "./services/mailer.js";
import { createMediaService } from "./services/mediaService.js";
import { createProductService } from "./services/productService.js";
import { createRazorpayGateway, type PaymentGateway } from "./services/razorpay.js";
import { createReviewService } from "./services/reviewService.js";
import { createSettingsService } from "./services/settingsService.js";
import { createSiteContentService } from "./services/siteContentService.js";
import { adminOrderWhatsAppRoutes, adminWhatsAppRoutes, cartReminderRoutes, customerWhatsAppRoutes, whatsappAuthRoutes, whatsappWebhookRoutes } from "./routes/whatsapp.js";
import { createCampaignService } from "./services/campaignService.js";
import { createCartRecovery } from "./services/cartRecovery.js";
import { createChatbot } from "./services/chatbot.js";
import { createWhatsAppAdmin } from "./services/whatsappAdmin.js";
import type { GraphClient } from "./services/whatsappGraph.js";
import { createOrderHooks } from "./services/whatsappOrders.js";
import { createWhatsAppOtp } from "./services/whatsappOtp.js";
import { createWhatsAppService } from "./services/whatsappService.js";
import { createWhatsAppWorker } from "./services/whatsappWorker.js";

export function createServices({ config, prisma, logger, gateway, graph }: { config: Config; prisma: PrismaClient; logger: Logger; gateway?: PaymentGateway | null; graph?: GraphClient | null }) {
  const pay = gateway === undefined ? createRazorpayGateway(config) : gateway;
  const settings = createSettingsService(prisma, config, pay);
  const wa = createWhatsAppService({ prisma, config, logger, ...(graph !== undefined ? { graph } : {}) });
  const hooks = createOrderHooks(wa, config);
  const checkout = createCheckoutService({ prisma, config, settings, gateway: pay, logger, hooks });
  const carts = createCartRecovery({ prisma, config, wa, logger });
  const campaigns = createCampaignService({ prisma, config, wa });
  const chatbot = createChatbot({ prisma, config, wa, settings, logger });
  wa.setInboundHandler((m) => chatbot.reply(m));
  const worker = createWhatsAppWorker({ prisma, wa, carts, campaigns, logger });
  return {
    gateway: pay, settings, checkout, orders: createAdminOrderService(prisma, checkout, hooks), customers: createAdminCustomerService(prisma), dashboard: createDashboardService(prisma), discounts: createDiscountService(prisma),
    wa, carts, campaigns, chatbot, worker, waAdmin: createWhatsAppAdmin({ prisma, config, wa }),
  };
}

export function createApp({ config, prisma, logger, gateway, services }: { config: Config; prisma: PrismaClient; logger: Logger; gateway?: PaymentGateway | null; services?: ReturnType<typeof createServices> }) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);

  const auth = createAuthService(prisma, config);
  const products = createProductService(prisma);
  const mailer = createMailer(config, logger);
  const customers = createCustomerAuthService(prisma, config, mailer);
  const google = createGoogleAuth(config, logger);
  const media = createMediaService(prisma, config);
  const reviews = createReviewService(prisma);
  const content = createSiteContentService(prisma);
  const commerce = services ?? createServices({ config, prisma, logger, gateway });
  const approvals = createApprovalsService(prisma, config, commerce.settings, mailer, media);
  const otp = createWhatsAppOtp({ prisma, config, wa: commerce.wa, customers, logger });

  // The API is never a page for search engines — staging or production.
  app.use((_req, res, next) => { res.setHeader("X-Robots-Tag", "noindex, nofollow"); next(); });
  app.get("/robots.txt", (_req, res) => { res.type("text/plain").send("User-agent: *\nDisallow: /\n"); });
  app.use(requestId);
  app.use(requestLog(logger));
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(corsPolicy(config));
  // Signed server-to-server calls from Razorpay: raw body, no cookies, before the JSON parser.
  app.use("/api/webhooks", webhookRoutes(commerce.checkout));
  // Signed calls from Meta (WhatsApp): same rule — raw body, before the JSON parser and the API rate limit.
  app.use("/api/whatsapp/webhook", whatsappWebhookRoutes(commerce.wa));
  app.use("/api", apiLimiter());
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());
  app.use(csrfGuard(config));
  app.use(loadSession(auth, config));
  app.use(loadCustomerSession(customers, config));

  app.use("/api/health", healthRoutes(prisma, config));
  app.use("/api/auth", authRoutes(auth, config));
  app.use("/api/auth/google", googleRoutes(google, customers, config));
  app.use("/api/auth/whatsapp", whatsappAuthRoutes(otp, config));
  app.use("/api/customer/whatsapp", customerWhatsAppRoutes(commerce.wa, { phoneOf: async (id) => (await prisma.customer.findUnique({ where: { id }, select: { phone: true } }))?.phone ?? null }));
  app.use("/api/customer", customerRoutes(customers, config));
  app.use("/api/products", publicProductRoutes(products));
  app.use("/api/categories", categoryRoutes(products));
  app.use("/api/reviews", publicReviewRoutes(reviews));
  app.use("/api/content", publicContentRoutes(content));
  app.use("/api/media", mediaServeRoutes(media, config));
  app.use("/api/admin", requireAdmin);
  app.use("/api/checkout/reminders", cartReminderRoutes(commerce.carts, config));
  app.use("/api/checkout", checkoutRoutes(commerce.checkout, commerce.settings, config));
  app.use("/api/admin/products", adminProductRoutes(products));
  app.use("/api/admin/media", adminMediaRoutes(media, config));
  app.use("/api/admin/reviews", adminReviewRoutes(reviews));
  app.use("/api/admin/content", adminContentRoutes(content));
  app.use("/api/admin/approvals", adminApprovalsRoutes(approvals));
  app.use("/api/admin/whatsapp", adminWhatsAppRoutes({ wa: commerce.wa, admin: commerce.waAdmin, campaigns: commerce.campaigns, carts: commerce.carts, chatbot: commerce.chatbot }));
  app.use("/api/admin/orders", adminOrderWhatsAppRoutes({ admin: commerce.waAdmin, outForDelivery: (id, a) => commerce.orders.outForDelivery(id, a) }));
  app.use("/api/admin", adminCommerceRoutes(commerce));

  app.use((_req, _res, next) => next(notFound("No such API endpoint.")));
  app.use(errorHandler(logger));
  return app;
}

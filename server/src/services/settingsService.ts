import type { Prisma, PrismaClient } from "@prisma/client";

import type { Config } from "../config.js";
import {
  DEFAULT_COD, DEFAULT_SHIPPING, DEFAULT_STORE, codProblems, codSettingsSchema, estimateText, shippingProblems, shippingSettingsSchema, storeSettingsSchema,
  type CodSettings, type ShippingSettings, type StoreSettings,
} from "../lib/settingsSchema.js";
import { logActivity, type Actor } from "./activity.js";
import type { PaymentGateway } from "./razorpay.js";

type Db = PrismaClient | Prisma.TransactionClient;
const KEYS = { shipping: "shipping", cod: "cod", store: "store" } as const;

async function read<T>(db: Db, key: string, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } }, fallback: T): Promise<T> {
  const row = await db.storeSetting.findUnique({ where: { key } });
  if (!row) return structuredClone(fallback);
  const parsed = schema.safeParse(row.value);
  return parsed.success ? parsed.data : structuredClone(fallback); // a damaged row never enables checkout
}

export function createSettingsService(prisma: PrismaClient, config: Config, gateway: PaymentGateway | null) {
  const svc = {
    shipping: (db: Db = prisma) => read<ShippingSettings>(db, KEYS.shipping, shippingSettingsSchema, DEFAULT_SHIPPING),
    cod: (db: Db = prisma) => read<CodSettings>(db, KEYS.cod, codSettingsSchema, DEFAULT_COD),
    store: (db: Db = prisma) => read<StoreSettings>(db, KEYS.store, storeSettingsSchema, DEFAULT_STORE),

    razorpayStatus() {
      return {
        configured: gateway !== null,
        mode: gateway?.mode ?? null,
        webhookSecretSet: !!config.razorpay?.webhookSecret,
        keyId: gateway?.keyId ?? null,
      };
    },

    async all() {
      const [shipping, cod, store] = await Promise.all([svc.shipping(), svc.cod(), svc.store()]);
      return {
        shipping, cod, store,
        readiness: { shipping: shippingProblems(shipping), cod: codProblems(cod), razorpay: svc.razorpayStatus(), storeTestMode: config.storeTestMode },
      };
    },

    async save(kind: keyof typeof KEYS, input: unknown, actor: Actor) {
      const schema = kind === "shipping" ? shippingSettingsSchema : kind === "cod" ? codSettingsSchema : storeSettingsSchema;
      const value = schema.parse(input) as Prisma.InputJsonValue;
      await prisma.$transaction(async (tx) => {
        await tx.storeSetting.upsert({ where: { key: KEYS[kind] }, create: { key: KEYS[kind], value }, update: { value } });
        await logActivity(tx, actor, { action: "settings.update", entityType: "setting", entityId: KEYS[kind], summary: `Updated ${kind === "cod" ? "Cash on Delivery" : kind} settings`, meta: value });
      });
      return svc.all();
    },

    /** What the shop may show shoppers: rules and availability, never region lists or secrets. */
    async publicConfig() {
      const [shipping, cod, store] = await Promise.all([svc.shipping(), svc.cod(), svc.store()]);
      const shippingReady = shippingProblems(shipping).length === 0;
      return {
        shipping: {
          configured: shippingReady,
          flatFeePaise: shippingReady ? shipping.flatFeePaise : null,
          freeAbovePaise: shippingReady ? shipping.freeAbovePaise : null,
          estimate: shippingReady ? estimateText(shipping) : null,
          estimateNote: shippingReady ? shipping.estimateNote : "",
          limitedRegions: shipping.regions.mode !== "all_india",
          maxQtyPerLine: shipping.maxQtyPerLine,
        },
        cod: codProblems(cod).length === 0 && shippingReady
          ? { available: true, feePaise: cod.feePaise, minOrderPaise: cod.minOrderPaise, maxOrderPaise: cod.maxOrderPaise, limitedRegions: cod.regions.mode !== "all_shipping" }
          : { available: false, feePaise: null, minOrderPaise: null, maxOrderPaise: null, limitedRegions: false },
        razorpay: { available: gateway !== null && shippingReady, testMode: gateway?.mode === "test" },
        store: { contactEmail: store.contactEmail, contactPhone: store.contactPhone },
        testMode: config.storeTestMode,
      };
    },
  };
  return svc;
}
export type SettingsService = ReturnType<typeof createSettingsService>;

// WhatsApp tools (demo). The WhatsApp API is NOT connected: nothing is ever sent from
// the frontend, and no delivery figures exist. Settings and drafts persist in this browser
// so they're ready to hand to the Hostinger backend once the approved API is connected.
import { createDemoStore, isArrayOf, isObject, newId, nowIso } from "@/lib/demo-store";
import { abandonedCarts as cartSeed, campaigns as seed, chatbotConfig } from "@/lib/mock-data";
import type { AbandonedCart, AbandonedCartSettings, CampaignSegment, ChatbotConfig, Customer, Order, OrderEvent, WhatsAppCampaign } from "@/lib/types";

export const WHATSAPP_CONNECTED = false;

export const campaignStore = createDemoStore<WhatsAppCampaign[]>({
  key: "bya.demo.campaigns", label: "WhatsApp campaigns", version: 2,
  seed: () => structuredClone(seed),
  validate: (v): v is WhatsAppCampaign[] => isArrayOf<WhatsAppCampaign>(v, (c) => typeof c["id"] === "string" && typeof c["body"] === "string"),
});

export interface AbandonedState { settings: AbandonedCartSettings; history: OrderEvent[] }
export const DEFAULT_ABANDONED: AbandonedCartSettings = {
  enabled: true,
  delayHours: 6,
  template: "Hi {name}, you left something lovely in your bag 🌿 Complete your order here: {cart_link}",
  includeDiscount: false,
  discountCode: "",
};
export const abandonedStore = createDemoStore<AbandonedState>({
  key: "bya.demo.abandoned", label: "Abandoned-cart reminder", version: 1,
  seed: () => ({ settings: { ...DEFAULT_ABANDONED }, history: [] }),
  validate: (v): v is AbandonedState => isObject(v) && isObject(v["settings"]) && Array.isArray(v["history"]),
});

export const chatbotStore = createDemoStore<ChatbotConfig>({
  key: "bya.demo.chatbot", label: "Chatbot menus", version: 1,
  seed: () => structuredClone(chatbotConfig),
  validate: (v): v is ChatbotConfig => isObject(v) && Array.isArray(v["menus"]) && typeof v["entryMenuId"] === "string",
});

/** Approved-template names expected on WhatsApp Business (names only; content is composed below). */
export const CAMPAIGN_TEMPLATES = ["new_launch", "festive_offer", "restock", "winback", "abandoned_cart_reminder"];

export const SEGMENTS: { key: CampaignSegment; label: string; hint: string }[] = [
  { key: "all", label: "All customers", hint: "Every active customer" },
  { key: "previous-buyers", label: "Previous buyers", hint: "Customers with at least one order" },
  { key: "new", label: "New customers", hint: "Customers marked new" },
  { key: "abandoned", label: "Abandoned carts", hint: "Shoppers with an abandoned cart" },
];

/** How many demo contacts a segment would reach (a count of demo records, not a send figure). */
export function segmentSize(seg: CampaignSegment, customers: Customer[], orders: Order[], carts: AbandonedCart[]): number {
  const active = customers.filter((c) => c.status === "active");
  if (seg === "all") return active.length;
  if (seg === "new") return active.filter((c) => c.segment === "new").length;
  if (seg === "previous-buyers") return active.filter((c) => orders.some((o) => o.customerId === c.id)).length;
  return carts.length;
}

export const fillTemplate = (body: string, vars: Record<string, string>) => body.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

/** When a cart becomes eligible for the reminder. */
export const reminderDueAt = (cart: AbandonedCart, delayHours: number) => new Date(new Date(cart.abandonedAt).getTime() + delayHours * 3_600_000);

export function validateCampaign(c: Pick<WhatsAppCampaign, "name" | "body" | "scheduledFor">, now = new Date()): string[] {
  const e: string[] = [];
  if (c.name.trim().length < 3) e.push("Give the campaign a name (3+ characters).");
  if (c.body.trim().length < 10) e.push("Write the message (at least 10 characters).");
  if (c.body.length > 1024) e.push("WhatsApp messages can be at most 1024 characters.");
  if (c.scheduledFor && new Date(c.scheduledFor) <= now) e.push("Pick a schedule time in the future.");
  return e;
}

export const whatsappService = {
  connected: WHATSAPP_CONNECTED,
  /** Save (create or edit) a campaign. Never sends; "scheduled" is a simulation. */
  saveCampaign: (c: Omit<WhatsAppCampaign, "id" | "createdAt" | "updatedAt" | "history" | "status"> & { id?: string | undefined }) => {
    const at = nowIso();
    const prev = c.id ? campaignStore.get().find((x) => x.id === c.id) : undefined;
    const status = c.scheduledFor ? "scheduled" : "draft";
    const action = prev ? "Edited" : "Created";
    const saved: WhatsAppCampaign = {
      ...c, id: prev?.id ?? newId("w"), status, createdAt: prev?.createdAt ?? at, updatedAt: at,
      history: [...(prev?.history ?? []), { at, label: `${action} as ${status === "scheduled" ? `scheduled simulation for ${c.scheduledFor?.replace("T", " ")}` : "draft"} — not sent` }],
    };
    campaignStore.set((all) => [saved, ...all.filter((x) => x.id !== saved.id)]);
    return saved;
  },
  removeCampaign: (id: string) => campaignStore.set((all) => all.filter((x) => x.id !== id)),
  abandonedCarts: () => cartSeed,
  saveAbandonedSettings: (s: AbandonedCartSettings) => {
    if (!(s.delayHours >= 1 && s.delayHours <= 72)) throw new Error("Reminder timing must be between 1 and 72 hours.");
    if (!s.template.includes("{cart_link}")) throw new Error("The message must include {cart_link} so the shopper can return to their bag.");
    const prev = abandonedStore.get().settings;
    const changes = [
      prev.enabled !== s.enabled && (s.enabled ? "Automation switched on" : "Automation switched off"),
      prev.delayHours !== s.delayHours && `Timing changed from ${prev.delayHours}h to ${s.delayHours}h`,
      prev.template !== s.template && "Message template edited",
      (prev.includeDiscount !== s.includeDiscount || prev.discountCode !== s.discountCode) && (s.includeDiscount ? `Discount code set to ${s.discountCode || "(none)"}` : "Discount code removed"),
    ].filter(Boolean) as string[];
    abandonedStore.set((st) => ({ settings: s, history: [...changes.map((label) => ({ at: nowIso(), label: `${label} (simulation — nothing sent)` })), ...st.history].slice(0, 50) }));
  },
  saveChatbot: (c: ChatbotConfig) => {
    if (!c.menus.some((m) => m.id === c.entryMenuId)) throw new Error("Choose which menu customers see first.");
    for (const m of c.menus) {
      if (!m.name.trim()) throw new Error("Every menu needs a name.");
      if (m.options.some((o) => !o.label.trim())) throw new Error(`Every button in “${m.name}” needs a label.`);
      if (m.options.length > 10) throw new Error(`“${m.name}” has more than 10 buttons — WhatsApp lists allow up to 10.`);
    }
    chatbotStore.set(c);
  },
};

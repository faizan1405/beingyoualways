import { beforeEach, describe, expect, it } from "vitest";

import { buildApprovalChecklist } from "@/lib/approvals";
import { dashboardMetrics, rangeFor } from "@/lib/dashboard";
import { createDemoStore, isArrayOf } from "@/lib/demo-store";
import { evaluateDiscount, validateDiscount } from "@/lib/discounts";
import { products, customers, orders as seedOrders } from "@/lib/mock-data";
import { movedImage, withImageAt } from "@/lib/product-images";
import type { Discount, Order } from "@/lib/types";
import { adminAuthService } from "@/services/adminAuthService";
import { BACKUP_FORMAT, buildBackup, importBackup, resetAllDemoData } from "@/services/backupService";
import { contentStore, defaultContent, validateContent } from "@/services/contentService";
import { withStats } from "@/services/customerService";
import { buildDemoOrder, orderService, orderStore } from "@/services/orderService";
import { duplicateOf, relatedFor, validateProduct } from "@/services/productService";
import { DEFAULT_SETTINGS, validateSettings } from "@/services/settingsService";
import { isPublic, showsOn, type Testimonial } from "@/services/testimonialService";
import { abandonedStore, campaignStore, chatbotStore, reminderDueAt, validateCampaign, whatsappService } from "@/services/whatsappService";

const order = (id: string, status: Order["status"], total: number, createdAt = "2026-11-20T10:00:00Z"): Order => ({ ...seedOrders[0]!, id, status, total, createdAt });
const disc = (p: Partial<Discount> = {}): Discount => ({ id: "d1", code: "WELCOME10", type: "percent", value: 10, used: 0, active: true, ...p });

beforeEach(async () => { localStorage.clear(); sessionStorage.clear(); await resetAllDemoData(); });

describe("dashboard", () => {
  const now = new Date("2026-11-23T12:00:00");
  it("Last 7 days covers today and the 6 days before", () => {
    const r = rangeFor("7d", now);
    expect(r.from.getDate()).toBe(17);
    expect(r.to.getDate()).toBe(23);
  });
  it("sales exclude cancelled and returned orders; pending = new, confirmed, processing", () => {
    const list = [order("A", "new", 100), order("B", "processing", 200), order("C", "cancelled", 400), order("D", "returned", 800), order("E", "delivered", 50)];
    const m = dashboardMetrics(list, products, 5, rangeFor("30d", now));
    expect(m.sales).toBe(350);
    expect(m.pending).toBe(2);
    expect(m.orders).toBe(5);
  });
  it("orders outside the chosen range don't count", () => {
    const m = dashboardMetrics([order("A", "new", 100, "2026-09-01T10:00:00Z")], products, 5, rangeFor("today", now));
    expect(m.orders).toBe(0);
  });
});

describe("discounts", () => {
  it("percentage discount is capped by the maximum discount", () => {
    expect(evaluateDiscount(disc({ value: 20, maxDiscount: 150 }), 1000)).toEqual({ ok: true, amount: 150 });
  });
  it("needs the minimum order amount", () => {
    expect(evaluateDiscount(disc({ minOrder: 999 }), 500).ok).toBe(false);
  });
  it("a fixed discount never exceeds the bag subtotal", () => {
    expect(evaluateDiscount(disc({ type: "fixed", value: 500 }), 300)).toEqual({ ok: true, amount: 300 });
  });
  it("expired, inactive or used-up codes don't apply", () => {
    const now = new Date("2026-11-23T12:00:00");
    expect(evaluateDiscount(disc({ endsAt: "2026-11-01" }), 1000, now).ok).toBe(false);
    expect(evaluateDiscount(disc({ active: false }), 1000, now).ok).toBe(false);
    expect(evaluateDiscount(disc({ usageLimit: 5, used: 5 }), 1000, now).ok).toBe(false);
  });
  it("rejects a percentage above 100 and duplicate codes", () => {
    expect(validateDiscount(disc({ value: 120 }))).not.toHaveLength(0);
    expect(validateDiscount(disc({ id: "d2" }), [disc()])).not.toHaveLength(0);
  });
});

describe("demo orders", () => {
  const input = (paymentMethod: "razorpay" | "cod") => ({
    customer: { id: "c1", name: "Ananya Sharma", email: "a@example.com", phone: "+91 98XXX 10021", address: customers[0]!.addresses[0]! },
    lines: [{ productId: "bya-1069", variantId: "face-serum-1", quantity: 2 }], paymentMethod, products,
  });
  it("a Razorpay demo order is never marked paid", () => {
    const o = buildDemoOrder(input("razorpay"), seedOrders);
    expect(o.paymentStatus).toBe("pending");
    expect(o.status).toBe("new");
    expect(o.shipping).toBeNull();
    expect(o.isDemo).toBe(true);
  });
  it("gets the next order number", () => {
    expect(buildDemoOrder(input("cod"), seedOrders).id).toBe("BYA-1043");
  });
  it("status changes and notes are kept and logged in the timeline", async () => {
    await orderService.updateStatus("BYA-1041", "processing");
    await orderService.addNote("BYA-1041", "Call before delivery");
    const o = orderStore.get().find((x) => x.id === "BYA-1041")!;
    expect(o.status).toBe("processing");
    expect(o.notes.map((n) => n.text)).toEqual(["Call before delivery"]);
    expect(o.timeline.at(-2)?.label).toContain("processing");
    expect(JSON.parse(sessionStorage.getItem("bya.demo.orders")!).data.find((x: Order) => x.id === "BYA-1041").status).toBe("processing");
    expect(localStorage.getItem("bya.demo.orders")).toBeNull();
  });
  it("customer spend ignores cancelled orders", () => {
    const c = withStats(customers[0]!, [order("A", "delivered", 500), order("B", "cancelled", 900)]);
    expect(c.orderCount).toBe(2);
    expect(c.totalSpent).toBe(500);
  });
});

describe("WhatsApp tools never send", () => {
  it("a saved campaign is a draft, or a scheduled simulation", () => {
    const d = whatsappService.saveCampaign({ name: "Launch", template: "new_launch", body: "Hi {name}, new arrivals!", segment: "all" });
    const s = whatsappService.saveCampaign({ name: "Later", template: "new_launch", body: "Hi {name}, new arrivals!", segment: "new", scheduledFor: "2099-01-01T10:00" });
    expect(d.status).toBe("draft");
    expect(s.status).toBe("scheduled");
    expect(campaignStore.get().every((c) => (c.status as string) !== "sent")).toBe(true);
  });
  it("rejects a schedule in the past", () => {
    expect(validateCampaign({ name: "Old", body: "Hello there friend", scheduledFor: "2020-01-01T10:00" })).not.toHaveLength(0);
  });
  it("abandoned-cart reminder is due 6 hours after the cart was left by default", () => {
    expect(abandonedStore.get().settings.delayHours).toBe(6);
    const due = reminderDueAt({ id: "x", customerName: "", phone: "", items: [], abandonedAt: "2026-11-06T06:00:00Z" }, 6);
    expect(due.toISOString()).toBe("2026-11-06T12:00:00.000Z");
  });
  it("reminder timing is configurable within 1–72 hours and changes are logged", () => {
    whatsappService.saveAbandonedSettings({ ...abandonedStore.get().settings, delayHours: 4 });
    expect(abandonedStore.get().settings.delayHours).toBe(4);
    expect(abandonedStore.get().history[0]?.label).toContain("6h to 4h");
    expect(() => whatsappService.saveAbandonedSettings({ ...abandonedStore.get().settings, delayHours: 0 })).toThrow();
  });
  it("chatbot needs a valid first menu", () => {
    expect(() => whatsappService.saveChatbot({ ...chatbotStore.get(), entryMenuId: "missing" })).toThrow();
  });
});

describe("customer stories", () => {
  const t: Testimonial = { id: "t", category: "Skin", name: "A", city: "B", quote: "Q", verified: true, consent: true, published: true };
  it("a video story without a playable link is not public", () => {
    expect(isPublic({ ...t, type: "video" })).toBe(false);
    expect(isPublic({ ...t, type: "video", videoUrl: "https://cdn.example.com/v.mp4" })).toBe(true);
  });
  it("only shows where it is placed (homepage by default)", () => {
    expect(showsOn(t, "home")).toBe(true);
    expect(showsOn(t, "explore")).toBe(false);
    expect(showsOn({ ...t, placements: ["explore"] }, "home")).toBe(false);
  });
});

describe("content & settings", () => {
  it("the top announcement is off by default (client removed the strip)", () => {
    expect(defaultContent().announcement.enabled).toBe(false);
  });
  it("needs a valid contact email", () => {
    expect(validateContent({ ...defaultContent(), contact: { ...defaultContent().contact, email: "nope" } })).not.toHaveLength(0);
  });
  it("shipping and COD start pending — nothing invented", () => {
    expect(DEFAULT_SETTINGS.shipping.fee).toBeNull();
    expect(DEFAULT_SETTINGS.payments.cod).toBe("pending");
    expect(validateSettings({ ...DEFAULT_SETTINGS, shipping: { ...DEFAULT_SETTINGS.shipping, clientConfirmed: true } })).not.toHaveLength(0);
  });
  it("entered shipping rates make the checklist item partly done, not confirmed", () => {
    const items = buildApprovalChecklist({ products, publicReviewCount: 0, entered: { shippingFee: 60, shippingConfirmedByClient: true, cod: "pending", codConfirmedByClient: false, whatsappNumber: "" } });
    expect(items.find((i) => i.id === "shipping")?.status).toBe("partial");
    expect(items.find((i) => i.id === "whatsapp-api")?.status).toBe("waiting");
  });
});

describe("products", () => {
  const serum = products.find((p) => p.slug === "face-serum")!;
  it("a duplicate is a hidden draft with new ids and a unique address", () => {
    const d = duplicateOf(serum, products, 1);
    expect(d.status).toBe("draft");
    expect(d.id).not.toBe(serum.id);
    expect(d.slug).toBe("face-serum-copy");
    expect(d.variants.every((v, i) => v.id !== serum.variants[i]!.id && v.price === serum.variants[i]!.price)).toBe(true);
  });
  it("a visible product needs a price; a hidden draft may wait for one", () => {
    const unpriced = { ...serum, id: "new", slug: "x", variants: [{ ...serum.variants[0]!, price: 0 }] };
    expect(validateProduct(unpriced, products)).not.toHaveLength(0);
    expect(validateProduct({ ...unpriced, status: "draft" }, products)).toHaveLength(0);
  });
  it("hand-picked related products come first, hidden ones never", () => {
    const list = relatedFor(products, { ...serum, relatedSlugs: ["hair-oil", "magic-drop", "kajal"] });
    expect(list.map((p) => p.slug)).toEqual(["hair-oil", "kajal"]);
  });
  it("replacing or reordering a slide only moves images", () => {
    expect(withImageAt(["a", "b", "c", "d"], 1, "x")).toEqual(["a", "x", "c", "d"]);
    expect(movedImage(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
  });
});

describe("persistence & backup", () => {
  it("a store reads back what was saved after a reload", () => {
    const opts = { key: "bya.test.persist", label: "t", version: 1, seed: () => [] as { id: string }[], validate: (v: unknown): v is { id: string }[] => isArrayOf(v, (x) => typeof x["id"] === "string") };
    createDemoStore(opts).set([{ id: "kept" }]);
    expect(createDemoStore(opts).get()).toEqual([{ id: "kept" }]);
  });
  it("backups include content but never orders, customers or reviews", () => {
    const b = buildBackup();
    expect(b.format).toBe(BACKUP_FORMAT);
    expect(Object.keys(b.stores)).toContain("bya.demo.content");
    expect(Object.keys(b.stores)).not.toContain("bya.demo.orders");
    expect(Object.keys(b.stores)).not.toContain("bya.demo.customers");
    expect(Object.keys(b.stores)).not.toContain("bya.demo.testimonials");
  });
  it("import restores a backup and rejects other files", async () => {
    contentStore.set({ ...defaultContent(), announcement: { enabled: true, text: "Hello" } });
    const file = JSON.stringify(buildBackup());
    await resetAllDemoData();
    expect(contentStore.get().announcement.enabled).toBe(false);
    expect((await importBackup(file)).ok).toBe(true);
    expect(contentStore.get().announcement.text).toBe("Hello");
    expect((await importBackup("{\"format\":\"other\"}")).ok).toBe(false);
  });
});

describe("admin access", () => {
  it("the sign-in form never grants access without the backend", async () => {
    expect(await adminAuthService.signIn("owner@example.com", "longpassword")).toEqual({ ok: false, reason: "backend-required" });
  });
});

describe("dashboard chart", () => {
  it("Last 30 days has exactly 30 daily bars", () => {
    const m = dashboardMetrics([], products, 0, rangeFor("30d", new Date("2026-11-23T12:00:00")));
    expect(m.daily).toHaveLength(30);
    expect(m.daily.at(-1)?.day).toBe("11-23");
  });
});

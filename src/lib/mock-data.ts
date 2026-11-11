import catalogue from "./catalogue.json";
import { productImages } from "./product-images";
// SAMPLE DATA — temporary placeholder content until the client supplies real
// products, prices and orders. Only the mock services may import this file.
import type {
  AbandonedCart,
  Category,
  ChatbotMenuItem,
  Customer,
  Order,
  Product,
  WhatsAppCampaign,
  WhatsAppMessage,
} from "./types";

export const categories: Category[] = [
  {
    slug: "skincare",
    name: "Skin Care",
    tagline: "Rituals for radiant skin",
    description: "Plant-based cleansers, serums and moisturisers for a calm, everyday ritual.",
  },
  {
    slug: "haircare",
    name: "Hair Care",
    tagline: "Nourish from root to tip",
    description: "Botanical oils, shampoos and masks crafted for soft, healthy-looking hair.",
  },
  {
    slug: "colour-cosmetics",
    name: "Colour Cosmetics",
    tagline: "Colour that feels like you",
    description: "Lip, cheek and complexion shades in soft, wearable tones.",
  },
];

// Real catalogue imported from beingyoualways.com (Nov 2026) — see catalogue.json.
// Prices are as listed on the original site; stock is DEMO only (not verified inventory).
type Raw = (typeof catalogue)[number];
const tints: Record<string, string> = { skincare: "oklch(0.86 0.05 140)", haircare: "oklch(0.78 0.06 90)", "colour-cosmetics": "oklch(0.6 0.12 20)" };

export const products: Product[] = (catalogue as Raw[]).map((r) => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  category: r.category as Product["category"],
  shortDescription: r.shortDescription,
  description: r.description,
  ingredients: [],
  directions: "Directions to be confirmed by the client.",
  details: [
    { label: "Listed on", value: "beingyoualways.com" },
    { label: "Original site tags", value: r.sourceCategories.join(", ") },
  ],
  variants: r.variants.map((v) => ({ ...v, kind: v.kind as "size" | "shade" })),
  shape: r.shape as Product["shape"],
  tint: tints[r.category] ?? "oklch(0.86 0.05 140)",
  images: productImages(r.slug),
  featured: r.featured,
  // High Demand starts from the products the client featured on beingyoualways.com; admin can change it.
  bestSeller: r.featured,
  status: "active",
  isSample: false,
  sourceUrl: r.sourceUrl,
}));

const addr = (name: string, city: string, state: string, pincode: string) => ({
  id: `a-${name.split(" ")[0]!.toLowerCase()}`,
  label: "Home",
  name,
  phone: "+91 98XXX XXXXX",
  line1: "Sample street address",
  city,
  state,
  pincode,
  isDefault: true,
});

export const customers: Customer[] = [
  { id: "c1", name: "Ananya Sharma", email: "ananya@example.com", phone: "+91 98XXX 10021", joinedAt: "2026-03-14", addresses: [addr("Ananya Sharma", "Mumbai", "Maharashtra", "400050")], segment: "vip", totalSpent: 12480, orderCount: 9 },
  { id: "c2", name: "Riya Mehta", email: "riya@example.com", phone: "+91 98XXX 10022", joinedAt: "2026-06-02", addresses: [addr("Riya Mehta", "Ahmedabad", "Gujarat", "380015")], segment: "repeat", totalSpent: 4320, orderCount: 4 },
  { id: "c3", name: "Kavya Nair", email: "kavya@example.com", phone: "+91 98XXX 10023", joinedAt: "2026-09-21", addresses: [addr("Kavya Nair", "Kochi", "Kerala", "682016")], segment: "new", totalSpent: 1299, orderCount: 1 },
  { id: "c4", name: "Ishita Rao", email: "ishita@example.com", phone: "+91 98XXX 10024", joinedAt: "2026-01-09", addresses: [addr("Ishita Rao", "Bengaluru", "Karnataka", "560034")], segment: "inactive", totalSpent: 899, orderCount: 1 },
  { id: "c5", name: "Meera Kapoor", email: "meera@example.com", phone: "+91 98XXX 10025", joinedAt: "2026-04-30", addresses: [addr("Meera Kapoor", "New Delhi", "Delhi", "110017")], segment: "repeat", totalSpent: 6150, orderCount: 5 },
];

const item = (pid: string, vid: string, qty: number) => {
  const prod = products.find((x) => x.id === pid)!;
  const v = prod.variants.find((x) => x.id === vid)!;
  return { productId: pid, variantId: vid, name: prod.name, variantLabel: v.label, price: v.price, quantity: qty };
};

const mkOrder = (id: string, c: Customer, createdAt: string, items: ReturnType<typeof item>[], o: Pick<Order, "paymentMethod" | "paymentStatus" | "status">): Order => {
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping = subtotal >= 999 ? 0 : 79;
  return { id, customerId: c.id, customerName: c.name, createdAt, items, subtotal, shipping, total: subtotal + shipping, shippingAddress: c.addresses[0]!, ...o };
};

export const orders: Order[] = [
  mkOrder("BYA-1042", customers[0]!, "2026-11-05T10:20:00Z", [item("bya-1069", "face-serum-1", 1), item("bya-1049", "liquid-matte-lipstick-3", 2)], { paymentMethod: "razorpay", paymentStatus: "paid", status: "shipped" }),
  mkOrder("BYA-1041", customers[1]!, "2026-11-04T15:05:00Z", [item("bya-1059", "hair-oil-1", 1)], { paymentMethod: "cod", paymentStatus: "cod", status: "confirmed" }),
  mkOrder("BYA-1040", customers[2]!, "2026-11-03T09:45:00Z", [item("bya-1073", "sunscreen-1", 1)], { paymentMethod: "razorpay", paymentStatus: "paid", status: "delivered" }),
  mkOrder("BYA-1039", customers[4]!, "2026-11-02T18:30:00Z", [item("bya-1037", "true-base-liquid-foundation-2", 1), item("bya-1039", "kajal-1", 1)], { paymentMethod: "razorpay", paymentStatus: "pending", status: "placed" }),
  mkOrder("BYA-1038", customers[0]!, "2026-10-30T12:10:00Z", [item("bya-1047", "volcanic-scrub-1", 1), item("bya-1027", "tomato-face-wash-1", 1)], { paymentMethod: "razorpay", paymentStatus: "paid", status: "delivered" }),
  mkOrder("BYA-1037", customers[3]!, "2026-10-27T08:00:00Z", [item("bya-1055", "aloe-vera-gel-1", 1)], { paymentMethod: "razorpay", paymentStatus: "refunded", status: "cancelled" }),
];

export const salesSeries = [
  { month: "Jun", revenue: 42000 },
  { month: "Jul", revenue: 51000 },
  { month: "Aug", revenue: 47500 },
  { month: "Sep", revenue: 63000 },
  { month: "Oct", revenue: 71200 },
  { month: "Nov", revenue: 38400 },
];

export const campaigns: WhatsAppCampaign[] = [
  { id: "w1", name: "Diwali Glow Edit", template: "festive_offer_v1", segment: "all", scheduledFor: "2026-11-10T10:00", status: "scheduled", recipients: 1240 },
  { id: "w2", name: "New Lip Shades", template: "new_launch_v1", segment: "vip", status: "draft", recipients: 86 },
  { id: "w3", name: "We miss you", template: "winback_v1", segment: "inactive", status: "sent", recipients: 312 },
];

export const messages: WhatsAppMessage[] = [
  { id: "m1", to: "+91 98XXX 10021", template: "order_shipped", sentAt: "2026-11-05T11:00Z", status: "read" },
  { id: "m2", to: "+91 98XXX 10022", template: "order_confirmed", sentAt: "2026-11-04T15:10Z", status: "delivered" },
  { id: "m3", to: "+91 98XXX 10024", template: "winback_v1", sentAt: "2026-10-28T10:00Z", status: "failed" },
];

export const abandonedCarts: AbandonedCart[] = [
  { id: "ac1", customerName: "Riya Mehta", phone: "+91 98XXX 10022", items: 2, value: 1548, abandonedAt: "2026-11-06T06:10Z", reminderDueAt: "2026-11-06T12:10Z" },
  { id: "ac2", customerName: "Guest shopper", phone: "+91 97XXX 44310", items: 1, value: 649, abandonedAt: "2026-11-06T08:40Z", reminderDueAt: "2026-11-06T14:40Z" },
];

export const chatbotMenu: ChatbotMenuItem[] = [
  { id: "b1", keyword: "1", label: "Shop products", response: "Browse our collection: {store_url}/shop" },
  { id: "b2", keyword: "2", label: "Track my order", response: "Please share your order ID (e.g. BYA-1042) and we'll share its status." },
  { id: "b3", keyword: "3", label: "Shipping & returns", response: "Please see {store_url}/shipping-policy for shipping details." },
  { id: "b4", keyword: "4", label: "Talk to our team", response: "Connecting you to a team member during support hours." },
];

import catalogue from "./catalogue.json";
import { catalogueImages } from "./product-images";
import { addedProducts, applyPatch } from "./catalogue-revision";
import { bestSellerSlugs } from "./concerns";
// SAMPLE DATA — temporary placeholder content until the client supplies real
// products, prices and orders. Only the mock services may import this file.
import type {
  AbandonedCart,
  Category,
  ChatbotConfig,
  Customer,
  Order,
  Product,
  WhatsAppCampaign,
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

// Verified packaging/product-sheet facts are layered on in catalogue-revision.ts; drafts the
// client named but hasn't priced (e.g. Magic Drop) are appended hidden.
const imported: Product[] = (catalogue as Raw[]).map((r) => ({
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
  images: catalogueImages(r.slug),
  featured: r.featured,
  // Best Seller starts from the client's four picks (Nov 2026 corrections); admin can change it.
  bestSeller: bestSellerSlugs.includes(r.slug),
  status: "active",
  isSample: false,
  sourceUrl: r.sourceUrl,
}));

export const products: Product[] = [...imported.map(applyPatch), ...addedProducts.map((p) => structuredClone(p))];

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

// DEMO customers — invented names with masked phone numbers and example.com emails.
// Order counts and spend are worked out from the demo orders by customerService.
const cust = (id: string, name: string, phone: string, joinedAt: string, city: string, state: string, pin: string, segment: Customer["segment"]): Customer => ({
  id, name, email: `${name.split(" ")[0]!.toLowerCase()}@example.com`, phone, joinedAt, addresses: [addr(name, city, state, pin)],
  segment, totalSpent: 0, orderCount: 0, status: "active", notes: "", signInMethod: null, isDemo: true,
});

export const customers: Customer[] = [
  cust("c1", "Ananya Sharma", "+91 98XXX 10021", "2026-03-14", "Mumbai", "Maharashtra", "400050", "vip"),
  cust("c2", "Riya Mehta", "+91 98XXX 10022", "2026-06-02", "Ahmedabad", "Gujarat", "380015", "repeat"),
  cust("c3", "Kavya Nair", "+91 98XXX 10023", "2026-09-21", "Kochi", "Kerala", "682016", "new"),
  cust("c4", "Ishita Rao", "+91 98XXX 10024", "2026-01-09", "Bengaluru", "Karnataka", "560034", "inactive"),
  cust("c5", "Meera Kapoor", "+91 98XXX 10025", "2026-04-30", "New Delhi", "Delhi", "110017", "repeat"),
];

const item = (pid: string, vid: string, qty: number) => {
  const prod = products.find((x) => x.id === pid)!;
  const v = prod.variants.find((x) => x.id === vid)!;
  return { productId: pid, variantId: vid, name: prod.name, variantLabel: v.label, price: v.price, quantity: qty };
};

/** Builds a demo order. Shipping stays null (pending) because rates are not confirmed. */
export const mkOrder = (id: string, c: Customer, createdAt: string, items: Order["items"], o: Pick<Order, "paymentMethod" | "paymentStatus" | "status">): Order => {
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  return {
    id, customerId: c.id, customerName: c.name, customerEmail: c.email, customerPhone: c.phone, createdAt, items,
    subtotal, discount: 0, shipping: null, total: subtotal, shippingAddress: c.addresses[0]!, notes: [],
    timeline: [{ at: createdAt, label: "Demo order created" }, ...(o.status !== "new" ? [{ at: createdAt, label: `Status set to ${o.status}` }] : [])],
    isDemo: true, ...o,
  };
};

export const orders: Order[] = [
  mkOrder("BYA-1042", customers[0]!, "2026-11-05T10:20:00Z", [item("bya-1069", "face-serum-1", 1), item("bya-1049", "liquid-matte-lipstick-3", 2)], { paymentMethod: "razorpay", paymentStatus: "paid", status: "shipped" }),
  mkOrder("BYA-1041", customers[1]!, "2026-11-04T15:05:00Z", [item("bya-1059", "hair-oil-1", 1)], { paymentMethod: "cod", paymentStatus: "cod", status: "confirmed" }),
  mkOrder("BYA-1040", customers[2]!, "2026-11-03T09:45:00Z", [item("bya-1073", "sunscreen-1", 1)], { paymentMethod: "razorpay", paymentStatus: "paid", status: "delivered" }),
  mkOrder("BYA-1039", customers[4]!, "2026-11-02T18:30:00Z", [item("bya-1037", "true-base-liquid-foundation-2", 1), item("bya-1039", "kajal-1", 1)], { paymentMethod: "razorpay", paymentStatus: "pending", status: "new" }),
  mkOrder("BYA-1038", customers[0]!, "2026-10-30T12:10:00Z", [item("bya-1047", "volcanic-scrub-1", 1), item("bya-1027", "tomato-face-wash-1", 1)], { paymentMethod: "razorpay", paymentStatus: "paid", status: "delivered" }),
  mkOrder("BYA-1037", customers[3]!, "2026-10-27T08:00:00Z", [item("bya-1055", "aloe-vera-gel-1", 1)], { paymentMethod: "razorpay", paymentStatus: "refunded", status: "cancelled" }),
];

// Campaigns start empty: nothing has ever been sent, so there are no delivery figures to show.
export const campaigns: WhatsAppCampaign[] = [];

// DEMO abandoned carts (invented shoppers, masked numbers). Values come from current prices.
export const abandonedCarts: AbandonedCart[] = [
  { id: "ac1", customerName: "Riya Mehta", phone: "+91 98XXX 10022", items: [{ productId: "bya-1069", variantId: "face-serum-1", quantity: 1 }, { productId: "bya-1059", variantId: "hair-oil-1", quantity: 1 }], abandonedAt: "2026-11-06T06:10:00Z", whatsappConsent: true },
  { id: "ac2", customerName: "Guest shopper", phone: "+91 97XXX 44310", items: [{ productId: "bya-1073", variantId: "sunscreen-1", quantity: 1 }], abandonedAt: "2026-11-06T08:40:00Z", whatsappConsent: null },
];

const opt = (id: string, label: string, response: string, next?: string) => ({ id, label, response, ...(next ? { next } : {}) });

// Rules-based WhatsApp menu (frontend preview only). Replies point to existing pages only.
export const chatbotConfig: ChatbotConfig = {
  entryMenuId: "main",
  handoff: true,
  supportHours: "To be confirmed by the client",
  menus: [
    {
      id: "main", name: "Main menu", enabled: true,
      greeting: "Hi! Welcome to Being You – Always 🌿 Please choose an option:",
      options: [
        opt("o1", "Browse Products", "Here are our ranges:", "browse"),
        opt("o2", "Track Order", "Please share your order ID (for example BYA-1042) and our team will check its status."),
        opt("o3", "Shipping Information", "Please see {store_url}/shipping-policy for shipping details."),
        opt("o4", "Return and Refund", "Please see {store_url}/refund-policy for our return and refund policy."),
        opt("o5", "Contact Support", "We'll connect you with a team member during support hours."),
      ],
    },
    {
      id: "browse", name: "Browse Products", enabled: true,
      greeting: "Which range would you like to see?",
      options: [
        opt("b1", "Skin Care", "{store_url}/skincare"),
        opt("b2", "Hair Care", "{store_url}/haircare"),
        opt("b3", "Cosmetics", "{store_url}/colour-cosmetics"),
        opt("b4", "Back to main menu", "Going back…", "main"),
      ],
    },
  ],
};

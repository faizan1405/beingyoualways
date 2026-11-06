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
    name: "Skincare",
    tagline: "Rituals for radiant skin",
    description: "Plant-based cleansers, serums and moisturisers for a calm, everyday ritual.",
  },
  {
    slug: "haircare",
    name: "Haircare",
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

const baseDetails = [
  { label: "Origin", value: "Made in India (sample)" },
  { label: "Shelf life", value: "To be confirmed" },
  { label: "Sample content", value: "Replace with approved product data" },
];

const p = (x: Omit<Product, "details" | "status" | "isSample"> & Partial<Product>): Product => ({
  details: baseDetails,
  status: "active",
  isSample: true,
  ...x,
});

export const products: Product[] = [
  p({
    id: "p1", slug: "rose-dew-face-serum", name: "Rose Dew Face Serum", category: "skincare", collection: "Glow Ritual",
    shortDescription: "A lightweight serum with rose and plant extracts.",
    description: "A silky, fast-absorbing serum made with rose water and botanical extracts for a dewy, refreshed look. Sample description — replace with approved copy.",
    ingredients: ["Rose water", "Aloe vera", "Glycerin (plant-derived)", "Vitamin E"],
    directions: "Apply 2–3 drops to clean skin morning and night. Follow with moisturiser.",
    variants: [
      { id: "p1-30", label: "30 ml", kind: "size", price: 899, compareAtPrice: 1099, stock: 24 },
      { id: "p1-50", label: "50 ml", kind: "size", price: 1299, stock: 8 },
    ],
    shape: "dropper", tint: "oklch(0.82 0.06 20)", featured: true,
  }),
  p({
    id: "p2", slug: "green-tea-gel-cleanser", name: "Green Tea Gel Cleanser", category: "skincare", collection: "Daily Essentials",
    shortDescription: "A gentle gel cleanser for everyday use.",
    description: "A soft gel cleanser with green tea and cucumber extracts that rinses clean without a tight feeling. Sample description.",
    ingredients: ["Green tea extract", "Cucumber extract", "Coco glucoside"],
    directions: "Massage onto damp skin, rinse thoroughly. Use twice daily.",
    variants: [
      { id: "p2-100", label: "100 ml", kind: "size", price: 549, stock: 40 },
      { id: "p2-200", label: "200 ml", kind: "size", price: 899, stock: 15 },
    ],
    shape: "tube", tint: "oklch(0.8 0.05 140)", featured: true,
  }),
  p({
    id: "p3", slug: "saffron-night-cream", name: "Saffron Night Cream", category: "skincare", collection: "Glow Ritual",
    shortDescription: "A rich night cream with saffron and shea.",
    description: "A comforting, rich cream with saffron and shea butter for a soft overnight ritual. Sample description.",
    ingredients: ["Shea butter", "Saffron extract", "Almond oil"],
    directions: "Warm a small amount between fingertips and press onto face before bed.",
    variants: [{ id: "p3-50", label: "50 g", kind: "size", price: 1199, stock: 12 }],
    shape: "jar", tint: "oklch(0.82 0.08 70)", featured: true,
  }),
  p({
    id: "p4", slug: "hibiscus-toning-mist", name: "Hibiscus Toning Mist", category: "skincare", collection: "Daily Essentials",
    shortDescription: "A refreshing facial mist.",
    description: "A fine facial mist with hibiscus and rose for a refreshing pick-me-up through the day. Sample description.",
    ingredients: ["Hibiscus extract", "Rose water", "Witch hazel"],
    directions: "Mist over face from 20 cm. Use anytime.",
    variants: [{ id: "p4-100", label: "100 ml", kind: "size", price: 499, stock: 0 }],
    shape: "bottle", tint: "oklch(0.75 0.08 0)", featured: false,
  }),
  p({
    id: "p5", slug: "bhringraj-hair-oil", name: "Bhringraj Hair Oil", category: "haircare", collection: "Root Ritual",
    shortDescription: "A traditional blend of botanical oils.",
    description: "A nourishing blend of bhringraj, amla and coconut oils for a relaxing scalp massage. Sample description.",
    ingredients: ["Bhringraj", "Amla", "Coconut oil", "Sesame oil"],
    directions: "Massage into scalp, leave for at least an hour, then wash.",
    variants: [
      { id: "p5-100", label: "100 ml", kind: "size", price: 449, stock: 30 },
      { id: "p5-200", label: "200 ml", kind: "size", price: 799, stock: 22 },
    ],
    shape: "bottle", tint: "oklch(0.72 0.09 85)", featured: true,
  }),
  p({
    id: "p6", slug: "reetha-shikakai-shampoo", name: "Reetha Shikakai Shampoo", category: "haircare", collection: "Root Ritual",
    shortDescription: "A mild cleansing shampoo.",
    description: "A mild shampoo with reetha and shikakai that leaves hair soft and clean. Sample description.",
    ingredients: ["Reetha", "Shikakai", "Aloe vera"],
    directions: "Lather into wet hair, rinse well. Follow with conditioner.",
    variants: [{ id: "p6-250", label: "250 ml", kind: "size", price: 599, stock: 18 }],
    shape: "bottle", tint: "oklch(0.78 0.05 120)", featured: false,
  }),
  p({
    id: "p7", slug: "hibiscus-hair-mask", name: "Hibiscus Hair Mask", category: "haircare", collection: "Weekend Care",
    shortDescription: "A creamy weekly mask.",
    description: "A creamy weekly mask with hibiscus and curry leaf for a soft, smooth feel. Sample description.",
    ingredients: ["Hibiscus", "Curry leaf", "Shea butter"],
    directions: "Apply to damp lengths, leave 15 minutes, rinse.",
    variants: [{ id: "p7-200", label: "200 g", kind: "size", price: 749, stock: 9 }],
    shape: "jar", tint: "oklch(0.7 0.1 15)", featured: true,
  }),
  p({
    id: "p8", slug: "velvet-matte-lipstick", name: "Velvet Matte Lipstick", category: "colour-cosmetics", collection: "Everyday Colour",
    shortDescription: "A soft-matte lipstick in wearable shades.",
    description: "A comfortable soft-matte lipstick with plant butters, in shades made for everyday wear. Sample description.",
    ingredients: ["Candelilla wax", "Shea butter", "Castor oil", "Mineral pigments"],
    directions: "Apply directly to lips. Layer for more intensity.",
    variants: [
      { id: "p8-rose", label: "Rosewood", kind: "shade", price: 649, stock: 20, swatch: "oklch(0.52 0.1 15)" },
      { id: "p8-terra", label: "Terracotta", kind: "shade", price: 649, stock: 14, swatch: "oklch(0.58 0.12 40)" },
      { id: "p8-berry", label: "Berry", kind: "shade", price: 649, stock: 3, swatch: "oklch(0.4 0.12 0)" },
    ],
    shape: "lipstick", tint: "oklch(0.58 0.12 40)", featured: true,
  }),
  p({
    id: "p9", slug: "cheek-tint-balm", name: "Cheek & Lip Tint Balm", category: "colour-cosmetics", collection: "Everyday Colour",
    shortDescription: "A sheer multi-use tint.",
    description: "A sheer, buildable balm for cheeks and lips with a natural flush. Sample description.",
    ingredients: ["Beeswax alternative", "Jojoba oil", "Beetroot extract"],
    directions: "Dab onto cheeks and lips, blend with fingertips.",
    variants: [
      { id: "p9-peach", label: "Peach", kind: "shade", price: 549, stock: 25, swatch: "oklch(0.75 0.09 50)" },
      { id: "p9-blush", label: "Blush", kind: "shade", price: 549, stock: 17, swatch: "oklch(0.7 0.1 10)" },
    ],
    shape: "compact", tint: "oklch(0.75 0.09 50)", featured: false,
  }),
  p({
    id: "p10", slug: "skin-tint-serum-foundation", name: "Skin Tint Serum", category: "colour-cosmetics", collection: "Complexion",
    shortDescription: "A light-coverage tinted serum.",
    description: "A lightweight tinted serum that evens the look of skin with a natural finish. Sample description.",
    ingredients: ["Squalane (plant-derived)", "Niacinamide", "Mineral pigments"],
    directions: "Shake well. Apply with fingertips or a brush.",
    variants: [
      { id: "p10-light", label: "Light", kind: "shade", price: 999, stock: 11, swatch: "oklch(0.86 0.04 70)" },
      { id: "p10-medium", label: "Medium", kind: "shade", price: 999, stock: 13, swatch: "oklch(0.74 0.06 60)" },
      { id: "p10-deep", label: "Deep", kind: "shade", price: 999, stock: 6, swatch: "oklch(0.58 0.07 50)" },
    ],
    shape: "dropper", tint: "oklch(0.74 0.06 60)", featured: true,
  }),
  p({
    id: "p11", slug: "kumkumadi-face-oil", name: "Kumkumadi Face Oil", category: "skincare", collection: "Glow Ritual",
    shortDescription: "A traditional-inspired facial oil.",
    description: "A luxurious face oil inspired by traditional kumkumadi blends. Sample description.",
    ingredients: ["Saffron", "Sandalwood", "Sesame oil"],
    directions: "Warm 2 drops and press onto skin at night.",
    variants: [{ id: "p11-15", label: "15 ml", kind: "size", price: 1499, compareAtPrice: 1799, stock: 7 }],
    shape: "dropper", tint: "oklch(0.7 0.11 60)", featured: false,
  }),
  p({
    id: "p12", slug: "aloe-leave-in-cream", name: "Aloe Leave-In Cream", category: "haircare", collection: "Weekend Care",
    shortDescription: "A light leave-in for smooth hair.",
    description: "A lightweight leave-in cream with aloe and flaxseed for soft, manageable hair. Sample description.",
    ingredients: ["Aloe vera", "Flaxseed extract", "Argan oil"],
    directions: "Smooth a small amount through damp hair. Do not rinse.",
    variants: [{ id: "p12-100", label: "100 ml", kind: "size", price: 499, stock: 26 }],
    shape: "tube", tint: "oklch(0.82 0.05 150)", featured: false,
  }),
];

const addr = (name: string, city: string, state: string, pincode: string) => ({
  id: `a-${name.split(" ")[0].toLowerCase()}`,
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
  return { id, customerId: c.id, customerName: c.name, createdAt, items, subtotal, shipping, total: subtotal + shipping, shippingAddress: c.addresses[0], ...o };
};

export const orders: Order[] = [
  mkOrder("BYA-1042", customers[0], "2026-11-05T10:20:00Z", [item("p1", "p1-30", 1), item("p8", "p8-rose", 2)], { paymentMethod: "razorpay", paymentStatus: "paid", status: "shipped" }),
  mkOrder("BYA-1041", customers[1], "2026-11-04T15:05:00Z", [item("p5", "p5-200", 1)], { paymentMethod: "cod", paymentStatus: "cod", status: "confirmed" }),
  mkOrder("BYA-1040", customers[2], "2026-11-03T09:45:00Z", [item("p1", "p1-50", 1)], { paymentMethod: "razorpay", paymentStatus: "paid", status: "delivered" }),
  mkOrder("BYA-1039", customers[4], "2026-11-02T18:30:00Z", [item("p10", "p10-medium", 1), item("p9", "p9-peach", 1)], { paymentMethod: "razorpay", paymentStatus: "pending", status: "placed" }),
  mkOrder("BYA-1038", customers[0], "2026-10-30T12:10:00Z", [item("p3", "p3-50", 1), item("p11", "p11-15", 1)], { paymentMethod: "razorpay", paymentStatus: "paid", status: "delivered" }),
  mkOrder("BYA-1037", customers[3], "2026-10-27T08:00:00Z", [item("p2", "p2-200", 1)], { paymentMethod: "razorpay", paymentStatus: "refunded", status: "cancelled" }),
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
  { id: "b3", keyword: "3", label: "Shipping & returns", response: "Orders usually ship in 2–4 working days. See {store_url}/shipping-policy" },
  { id: "b4", keyword: "4", label: "Talk to our team", response: "Connecting you to a team member during support hours." },
];

// Domain models shared by the storefront, account screens and admin.
// Mirrors the shape the future Hostinger REST API is expected to return.

export type CategorySlug = "skincare" | "haircare" | "colour-cosmetics";

export interface Category {
  slug: CategorySlug;
  name: string;
  tagline: string;
  description: string;
}

export type ProductStatus = "active" | "draft" | "archived";
export type ProductShape = "bottle" | "jar" | "tube" | "dropper" | "lipstick" | "compact";

export interface ProductVariant {
  id: string;
  label: string; // e.g. "50 ml" or "Rosewood"
  kind: "size" | "shade";
  price: number; // INR
  compareAtPrice?: number | undefined;
  stock: number;
  /** Live mode only: false = stock not counted yet (orderable, no counts shown). */
  stockTracked?: boolean | undefined;
  swatch?: string | undefined; // css colour for shade chips
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  collection?: string | undefined;
  shortDescription: string;
  description: string;
  /** Full ingredient list, only as printed on the pack. */
  ingredients: string[];
  /** Hero ingredients named by the brand (product sheet / pack front) — not a full list. */
  keyIngredients?: string[] | undefined;
  directions: string;
  details: { label: string; value: string }[];
  variants: ProductVariant[];
  shape: ProductShape;
  tint: string; // placeholder visual colour (oklch)
  images?: string[] | undefined; // concept photography URLs, main first
  featured: boolean;
  bestSeller?: boolean | undefined;
  /** Shop-by-concern mapping set in admin; falls back to src/lib/concerns.ts when undefined. */
  concerns?: string[] | undefined;
  status: ProductStatus;
  isSample: true | boolean;
  sourceUrl?: string | undefined; // product page on the client's original website
  /** Benefits the brand states for this product (admin-entered; hidden while empty). */
  benefits?: string[] | undefined;
  /** Hand-picked "related products" (slugs); falls back to same category when empty. */
  relatedSlugs?: string[] | undefined;
}

export interface CartItem {
  productId: string;
  variantId: string;
  quantity: number;
}

/** Shipping is "pending" until the client confirms rates; totals stay unknown until then. */
export type ShippingStatus = { state: "pending" } | { state: "free" } | { state: "charged"; amount: number };

export interface OrderSummary {
  subtotal: number;
  /** Only confirmed discounts; 0 in this prototype. */
  discount: number;
  shipping: ShippingStatus;
  /** Final payable amount, or null while any part of it (e.g. shipping) is unknown. */
  total: number | null;
  itemCount: number;
  /** Cash on Delivery charge set by the store (server totals only). */
  codFee?: number;
}

export type AddressType = "home" | "work" | "other";

export interface Address {
  id: string;
  label: string;
  addressType?: AddressType | undefined;
  name: string;
  phone: string;
  line1: string;
  line2?: string | undefined;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean | undefined;
}

export type CustomerStatus = "active" | "blocked";

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinedAt: string;
  addresses: Address[];
  segment: "new" | "repeat" | "vip" | "inactive";
  /** Worked out from this customer's orders by customerService (never typed in). */
  totalSpent: number;
  orderCount: number;
  status: CustomerStatus;
  /** Internal admin note (demo, this tab only). */
  notes: string;
  /** How the customer signs in, once Google / WhatsApp OTP is connected on the backend. */
  signInMethod: "google" | "whatsapp" | null;
  /** WhatsApp marketing consent. Missing = never asked, so no marketing messages. */
  whatsappOptIn?: WhatsAppOptIn | undefined;
  isDemo: boolean;
}

export type WhatsAppOptIn = "opted-in" | "opted-out";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "cod";
export const ORDER_STATUSES = ["new", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentMethod = "razorpay" | "cod";

export interface OrderItem {
  productId: string;
  variantId: string;
  name: string;
  variantLabel: string;
  price: number;
  quantity: number;
}

export interface OrderNote {
  id: string;
  at: string;
  text: string;
}

export interface OrderEvent {
  at: string;
  label: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  createdAt: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  discountCode?: string | undefined;
  /** null = shipping charges not confirmed yet (shown as "Pending"). */
  shipping: number | null;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  shippingAddress: Address;
  notes: OrderNote[];
  timeline: OrderEvent[];
  /** Every order in this prototype is simulated — nothing was really bought or paid. */
  isDemo: true;
}

export type CampaignSegment = "all" | "previous-buyers" | "new" | "abandoned";
export type CampaignStatus = "draft" | "scheduled";

export interface WhatsAppCampaign {
  id: string;
  name: string;
  template: string;
  body: string;
  segment: CampaignSegment;
  /** Template variable → customer field (e.g. {{1}} → "name"). */
  variables?: string[] | undefined;
  scheduledFor?: string | undefined;
  /** "scheduled" is a simulation only — nothing is sent until the WhatsApp API is connected. */
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
  history: OrderEvent[];
}

export interface AbandonedCart {
  id: string;
  customerName: string;
  phone: string;
  items: { productId: string; variantId: string; quantity: number }[];
  abandonedAt: string;
  /** Shopper agreed to WhatsApp reminders (null = not asked → never remind). */
  whatsappConsent?: boolean | null | undefined;
  /** Set when the shopper later completed checkout → reminder is cancelled. */
  checkedOutAt?: string | undefined;
}

export interface AbandonedCartSettings {
  enabled: boolean;
  delayHours: number;
  template: string;
  includeDiscount: boolean;
  discountCode: string;
}

export interface ChatbotOption {
  id: string;
  label: string;
  response: string;
  /** Optional menu to open after this reply (lets one menu link to another). */
  next?: string | undefined;
}

export interface ChatbotMenu {
  id: string;
  name: string;
  enabled: boolean;
  greeting: string;
  options: ChatbotOption[];
}

export interface ChatbotConfig {
  entryMenuId: string;
  handoff: boolean;
  supportHours: string;
  menus: ChatbotMenu[];
}

export type DiscountType = "percent" | "fixed";

export interface Discount {
  id: string;
  code: string;
  type: DiscountType;
  value: number;
  minOrder?: number | undefined;
  maxDiscount?: number | undefined;
  startsAt?: string | undefined;
  endsAt?: string | undefined;
  usageLimit?: number | undefined;
  used: number;
  active: boolean;
}

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
  ingredients: string[];
  directions: string;
  details: { label: string; value: string }[];
  variants: ProductVariant[];
  shape: ProductShape;
  tint: string; // placeholder visual colour (oklch)
  featured: boolean;
  status: ProductStatus;
  isSample: true | boolean;
}

export interface CartItem {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface Address {
  id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string | undefined;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean | undefined;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinedAt: string;
  addresses: Address[];
  segment: "new" | "repeat" | "vip" | "inactive";
  totalSpent: number;
  orderCount: number;
}

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "cod";
export type OrderStatus = "placed" | "confirmed" | "packed" | "shipped" | "delivered" | "cancelled";
export type PaymentMethod = "razorpay" | "cod";

export interface OrderItem {
  productId: string;
  variantId: string;
  name: string;
  variantLabel: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  createdAt: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  shippingAddress: Address;
}

export type CampaignStatus = "draft" | "scheduled" | "sent";

export interface WhatsAppCampaign {
  id: string;
  name: string;
  template: string;
  segment: Customer["segment"] | "all";
  scheduledFor?: string | undefined;
  status: CampaignStatus;
  recipients: number;
}

export interface WhatsAppMessage {
  id: string;
  to: string;
  template: string;
  sentAt: string;
  status: "queued" | "sent" | "delivered" | "read" | "failed";
}

export interface AbandonedCart {
  id: string;
  customerName: string;
  phone: string;
  items: number;
  value: number;
  abandonedAt: string;
  reminderDueAt: string;
}

export interface AbandonedCartSettings {
  enabled: boolean;
  delayHours: number;
  template: string;
  includeDiscount: boolean;
  discountCode: string;
}

export interface ChatbotMenuItem {
  id: string;
  keyword: string;
  label: string;
  response: string;
}

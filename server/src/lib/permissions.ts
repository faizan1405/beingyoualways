// Roles and permissions seeded into the database. The API checks permissions, never role names,
// so a role can be widened later without code changes.
export const PERMISSIONS = {
  "products.read": "View all products, including hidden drafts",
  "products.write": "Create and edit products, prices, sizes/shades, photos and visibility",
  "products.delete": "Archive products and permanently delete unused drafts",
  "orders.read": "View orders, the sales dashboard and order CSV exports",
  "orders.write": "Move orders through fulfilment, add notes and tracking",
  "orders.cancel": "Cancel orders (stock is put back automatically)",
  "payments.record": "Record cash collected for Cash on Delivery orders (audited)",
  "customers.read": "View customers and their order history",
  "customers.write": "Edit customer notes and block / unblock customers",
  "discounts.write": "Create, edit and switch discount codes on or off",
  "content.read": "View website content and customer stories",
  "content.write": "Edit website content (later phase)",
  "reviews.moderate": "Publish, hide and edit customer stories",
  "media.write": "Upload, replace and remove files",
  "settings.write": "Change shipping, Cash on Delivery and store contact settings",
  "users.manage": "Manage admin users (later phase)",
} as const;
export type PermissionKey = keyof typeof PERMISSIONS;

export const ROLES: Record<string, { name: string; permissions: PermissionKey[] }> = {
  owner: { name: "Owner", permissions: Object.keys(PERMISSIONS) as PermissionKey[] },
  admin: { name: "Admin", permissions: ["products.read", "products.write", "products.delete", "orders.read", "orders.write", "orders.cancel", "customers.read", "customers.write", "discounts.write", "content.read", "content.write", "reviews.moderate", "media.write"] },
  staff: { name: "Staff", permissions: ["products.read", "orders.read", "customers.read", "content.read"] },
};
export type RoleKey = keyof typeof ROLES;

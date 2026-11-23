// Roles and permissions seeded into the database. The API checks permissions, never role names,
// so a role can be widened later without code changes.
export const PERMISSIONS = {
  "products.read": "View all products, including hidden drafts",
  "products.write": "Create and edit products, prices, sizes/shades, photos and visibility",
  "products.delete": "Archive products and permanently delete unused drafts",
  "orders.read": "View orders (later phase)",
  "orders.write": "Update order status (later phase)",
  "customers.read": "View customers (later phase)",
  "content.write": "Edit website content (later phase)",
  "settings.write": "Change store settings (later phase)",
  "users.manage": "Manage admin users (later phase)",
} as const;
export type PermissionKey = keyof typeof PERMISSIONS;

export const ROLES: Record<string, { name: string; permissions: PermissionKey[] }> = {
  owner: { name: "Owner", permissions: Object.keys(PERMISSIONS) as PermissionKey[] },
  admin: { name: "Admin", permissions: ["products.read", "products.write", "products.delete", "orders.read", "orders.write", "customers.read", "content.write"] },
  staff: { name: "Staff", permissions: ["products.read", "orders.read", "customers.read"] },
};
export type RoleKey = keyof typeof ROLES;

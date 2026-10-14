import type { Role } from "@/generated/prisma/enums";

/** Permissions inside a shop. */
export type ShopPermission =
  | "pos.sell"
  | "sales.view"
  | "sales.viewAll"
  | "sales.refund"
  | "products.manage"
  | "inventory.view"
  | "inventory.adjust"
  | "reports.view"
  | "dashboard.view"
  | "suppliers.manage"
  | "users.manage"
  | "settings.manage"
  | "audit.view"
  | "billing.view";

/** Permissions of the platform owner, who runs the platform but works in no shop. */
export type PlatformPermission = "platform.manage";

export type Permission = ShopPermission | PlatformPermission;

const SHOP_ALL: ShopPermission[] = [
  "pos.sell", "sales.view", "sales.viewAll", "sales.refund", "products.manage",
  "inventory.view", "inventory.adjust", "reports.view", "dashboard.view",
  "suppliers.manage", "users.manage", "settings.manage", "audit.view", "billing.view",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // The platform owner has no shop permissions: they create and manage shops, not sell in them.
  PLATFORM_OWNER: ["platform.manage"],
  ADMIN: SHOP_ALL,
  MANAGER: [
    "pos.sell", "sales.view", "sales.viewAll", "sales.refund", "products.manage",
    "inventory.view", "inventory.adjust", "reports.view", "dashboard.view", "suppliers.manage",
  ],
  CASHIER: ["pos.sell", "sales.view", "inventory.view"],
};

export const can = (role: Role, perm: Permission) => ROLE_PERMISSIONS[role].includes(perm);

/** Roles a shop admin may assign to their own staff. */
export const STAFF_ROLES = ["ADMIN", "MANAGER", "CASHIER"] as const;

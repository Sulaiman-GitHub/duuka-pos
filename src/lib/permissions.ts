import type { Role } from "@/generated/prisma/enums";

export type Permission =
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
  | "audit.view";

const ALL: Permission[] = [
  "pos.sell", "sales.view", "sales.viewAll", "sales.refund", "products.manage",
  "inventory.view", "inventory.adjust", "reports.view", "dashboard.view",
  "suppliers.manage", "users.manage", "settings.manage", "audit.view",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: ALL,
  MANAGER: [
    "pos.sell", "sales.view", "sales.viewAll", "sales.refund", "products.manage",
    "inventory.view", "inventory.adjust", "reports.view", "dashboard.view", "suppliers.manage",
  ],
  CASHIER: ["pos.sell", "sales.view", "inventory.view"],
};

export const can = (role: Role, perm: Permission) => ROLE_PERMISSIONS[role].includes(perm);

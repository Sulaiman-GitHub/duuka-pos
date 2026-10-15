import { describe, expect, it } from "vitest";
import { can, ROLE_PERMISSIONS, STAFF_ROLES, type Permission, type ShopPermission } from "@/lib/permissions";

const SHOP_PERMS: ShopPermission[] = ["pos.sell", "sales.view", "sales.viewAll", "sales.refund", "products.manage", "inventory.view", "inventory.adjust", "reports.view", "dashboard.view", "suppliers.manage", "users.manage", "settings.manage", "audit.view", "costs.view"];

describe("role permissions", () => {
  it("lets a shop administrator do everything inside their shop, but nothing on the platform", () => {
    for (const p of SHOP_PERMS) expect(can("ADMIN", p), p).toBe(true);
    expect(can("ADMIN", "platform.manage")).toBe(false);
  });

  it("keeps buying costs away from cashiers but not from managers and admins", () => {
    expect(can("CASHIER", "costs.view")).toBe(false);
    expect(can("MANAGER", "costs.view")).toBe(true);
    expect(can("ADMIN", "costs.view")).toBe(true);
    expect(can("PLATFORM_OWNER", "costs.view")).toBe(false);
  });

  it("limits cashiers to selling, their own sales and read-only inventory", () => {
    for (const p of ["pos.sell", "sales.view", "inventory.view"] as Permission[]) expect(can("CASHIER", p), p).toBe(true);
    for (const p of SHOP_PERMS.filter((p) => !["pos.sell", "sales.view", "inventory.view"].includes(p))) expect(can("CASHIER", p), p).toBe(false);
    expect(can("CASHIER", "platform.manage")).toBe(false);
  });

  it("lets managers run the shop but not administer users or settings", () => {
    for (const p of ["pos.sell", "sales.viewAll", "sales.refund", "products.manage", "inventory.adjust", "reports.view", "dashboard.view", "suppliers.manage"] as Permission[]) expect(can("MANAGER", p), p).toBe(true);
    for (const p of ["users.manage", "settings.manage", "audit.view", "platform.manage"] as Permission[]) expect(can("MANAGER", p), p).toBe(false);
  });

  it("gives the platform owner platform powers only: they run the platform, they do not work inside shops", () => {
    expect(ROLE_PERMISSIONS.PLATFORM_OWNER).toEqual(["platform.manage"]);
    for (const p of SHOP_PERMS) expect(can("PLATFORM_OWNER", p), p).toBe(false);
  });

  it("never lets a shop assign the platform-owner role", () => {
    expect([...STAFF_ROLES]).toEqual(["ADMIN", "MANAGER", "CASHIER"]);
  });
});

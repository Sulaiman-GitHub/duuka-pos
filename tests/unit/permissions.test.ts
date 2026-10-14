import { describe, expect, it } from "vitest";
import { can, ROLE_PERMISSIONS, type Permission } from "@/lib/permissions";

describe("role permissions", () => {
  it("lets administrators do everything", () => {
    const all = new Set(Object.values(ROLE_PERMISSIONS).flat());
    for (const p of all) expect(can("ADMIN", p)).toBe(true);
  });

  it("limits cashiers to selling, their own sales and read-only inventory", () => {
    const allowed: Permission[] = ["pos.sell", "sales.view", "inventory.view"];
    for (const p of allowed) expect(can("CASHIER", p)).toBe(true);
    const denied: Permission[] = ["sales.viewAll", "sales.refund", "products.manage", "inventory.adjust", "reports.view", "dashboard.view", "suppliers.manage", "users.manage", "settings.manage", "audit.view"];
    for (const p of denied) expect(can("CASHIER", p), p).toBe(false);
  });

  it("lets managers run the shop but not administer users or settings", () => {
    for (const p of ["pos.sell", "sales.viewAll", "sales.refund", "products.manage", "inventory.adjust", "reports.view", "dashboard.view", "suppliers.manage"] as Permission[]) expect(can("MANAGER", p), p).toBe(true);
    for (const p of ["users.manage", "settings.manage", "audit.view"] as Permission[]) expect(can("MANAGER", p), p).toBe(false);
  });
});

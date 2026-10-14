import { beforeEach, describe, expect, it } from "vitest";
import { EmailTakenError, createShopWithAdmin } from "@/lib/shops";
import { dbAvailable, makeShop, makeUser, resetDb, asPlatform, withShop } from "../helpers/db";

const up = await dbAvailable();

describe.skipIf(!up)("creating a shop (platform owner)", () => {
  beforeEach(resetDb);
  const base = { shopName: "Nile Hardware", address: "Jinja Road", phone: "+256700", adminName: "Ann Admin", adminEmail: "ann@nile.test", adminPassword: "Secret#123", businessTypes: ["hardware"] };

  it("creates the shop, its first admin and the starter categories", async () => {
    const owner = await makeUser(null, "PLATFORM_OWNER");
    const { shopId, adminId } = await asPlatform((tx) => createShopWithAdmin(tx, owner.id, base));
    const admin = await withShop(shopId, (tx) => tx.user.findUniqueOrThrow({ where: { id: adminId } }));
    expect([admin.role, admin.shopId, admin.email]).toEqual(["ADMIN", shopId, "ann@nile.test"]);
    expect(admin.passwordHash).not.toContain("Secret#123"); // stored hashed
    const cats = await withShop(shopId, (tx) => tx.category.findMany({ orderBy: { name: "asc" } }));
    expect(cats.map((c) => c.name)).toEqual(["Building materials", "Electrical", "Fasteners & fittings", "Garden", "Paint & finishing", "Plumbing", "Tools"]);
    expect(await withShop(shopId, (tx) => tx.auditLog.count({ where: { action: "shop.create" } }))).toBe(1);
  });

  it("merges the categories of several business types without duplicates", async () => {
    const owner = await makeUser(null, "PLATFORM_OWNER");
    const { shopId } = await asPlatform((tx) => createShopWithAdmin(tx, owner.id, { ...base, adminEmail: "x@y.test", businessTypes: ["electronics", "stationery", "general"] }));
    const names = (await withShop(shopId, (tx) => tx.category.findMany())).map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining(["Phones & tablets", "Books", "General"]));
    expect(names).not.toContain("Plumbing");
  });

  it("refuses an email already used by anyone on the platform, and creates nothing", async () => {
    const owner = await makeUser(null, "PLATFORM_OWNER");
    const existing = await makeShop("Existing");
    await makeUser(existing.id, "CASHIER", "taken@test.local");
    await expect(asPlatform((tx) => createShopWithAdmin(tx, owner.id, { ...base, adminEmail: "taken@test.local" }))).rejects.toBeInstanceOf(EmailTakenError);
    expect(await asPlatform((tx) => tx.shop.count())).toBe(1); // only "Existing": the failed attempt rolled back
  });

  it("gives the new shop's admin no access to other shops", async () => {
    const owner = await makeUser(null, "PLATFORM_OWNER");
    const other = await makeShop("Other");
    await makeUser(other.id, "CASHIER");
    const { shopId } = await asPlatform((tx) => createShopWithAdmin(tx, owner.id, base));
    expect(await withShop(shopId, (tx) => tx.user.count())).toBe(1);
    expect(await withShop(shopId, (tx) => tx.shop.findMany())).toHaveLength(1);
  });
});

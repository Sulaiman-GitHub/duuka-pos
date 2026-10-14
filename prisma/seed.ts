import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { PaymentMethod, Role } from "../src/generated/prisma/enums";
import { databaseUrl } from "../src/lib/db-url";
import { kampalaDateString } from "../src/lib/time";
import { categoriesFor } from "../src/lib/templates";
import { CATALOG } from "./catalog";
import { productImage } from "./images";

// Demo data: a platform owner and two shops. Runs as the database owner with the platform flag set (row-level
// security applies to everyone, so even the seed has to say which context it is working in).
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });

// Deterministic PRNG so the demo data is the same every time.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
const hash = (p: string) => bcrypt.hashSync(p, 10);

function daysAgo(d: number, h = 9, m = 0) {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(h, m, 0, 0);
  return t;
}

type P = { id: string; name: string; sku: string; cost: number; price: number; stock: number };
const chunk = <T,>(a: T[], n = 800) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

async function main() {
  // This script WIPES the database before loading demo data, so it must be asked for explicitly.
  if (!process.env.SEED_IF_EMPTY && !process.argv.includes("--wipe")) {
    console.error("Refusing to run: this wipes the whole database. Run `npm run db:seed` (which passes --wipe) only on a development database.");
    process.exit(1);
  }
  if (process.env.SEED_IF_EMPTY && (await db.shop.count().catch(() => 1)) > 0) {
    console.log("Database already has data - skipping seed.");
    return;
  }
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "SaleReturnItem","SaleReturn","SaleItem","Sale","StockMovement","PurchaseOrderItem","PurchaseOrder","Supplier","Product","Category","AuditLog","ReceiptCounter","User","Shop" RESTART IDENTITY CASCADE',
  );

  const counts = await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.platform', 'on', true)`;

      await tx.user.create({ data: { name: "Platform Owner", email: "owner@duuka.test", passwordHash: hash("Owner@123"), role: "PLATFORM_OWNER" } });

      // ------------------------------------------------------------------ Shop 1: Duuka Mart (mini-supermarket)
      const mart = await tx.shop.create({ data: { name: "Duuka Mart", address: "Kansanga, Kampala, Uganda", phone: "+256 700 000 000", planName: "Standard", monthlyPrice: 30000, maxUsers: 10, paidUntil: new Date(Date.now() + 18 * 86_400_000) } });
      const martStaff: { name: string; email: string; password: string; role: Role }[] = [
        { name: "Admin User", email: "admin@pos.test", password: "Admin@123", role: "ADMIN" },
        { name: "Mary Manager", email: "manager@pos.test", password: "Manager@123", role: "MANAGER" },
        { name: "Peter Cashier", email: "cashier@pos.test", password: "Cashier@123", role: "CASHIER" },
        { name: "Grace Cashier", email: "grace@pos.test", password: "Cashier@123", role: "CASHIER" },
      ];
      const martUsers = await Promise.all(martStaff.map((u) => tx.user.create({ data: { shopId: mart.id, name: u.name, email: u.email, passwordHash: hash(u.password), role: u.role } })));
      const [martAdmin, martManager, cashier1, cashier2] = martUsers;

      const suppliers = await Promise.all([
        tx.supplier.create({ data: { shopId: mart.id, name: "Kampala Wholesalers Ltd", phone: "+256700000001", email: "sales@kwl.example", address: "Owino Market, Kampala" } }),
        tx.supplier.create({ data: { shopId: mart.id, name: "Nile Distributors", phone: "+256700000002", email: "orders@nile.example", address: "Industrial Area, Kampala" } }),
      ]);

      const martProducts: P[] = [];
      const martRows: object[] = [];
      let n = 1;
      for (const [cat, items] of Object.entries(CATALOG)) {
        const category = await tx.category.create({ data: { shopId: mart.id, name: cat } });
        for (const [name, cost, price] of items) {
          const sku = `SKU-${String(n).padStart(4, "0")}`;
          const stock = 150 + Math.floor(rand() * 150);
          const id = randomUUID();
          martRows.push({ id, shopId: mart.id, sku, barcode: `600${String(100000 + n * 37).padStart(9, "0")}`, name, categoryId: category.id, costPrice: cost, sellPrice: price, stock, minStock: 15, ...productImage(name) });
          martProducts.push({ id, name, sku, cost, price, stock });
          n++;
        }
      }
      await tx.product.createMany({ data: martRows as never });
      const opening = martProducts.map((p) => ({ shopId: mart.id, productId: p.id, type: "INITIAL" as const, quantity: p.stock, stockAfter: p.stock, reason: "Opening stock", userId: martAdmin.id, createdAt: daysAgo(61) }));

      const mart1 = await generateSales(tx, mart.id, martProducts, [cator(cashier1.id), cator(cashier2.id), cator(martManager.id)], 60, 4, 8);
      await tx.stockMovement.createMany({ data: [...opening, ...mart1.movements] });

      // A few products low / out of stock so the alerts have something to show.
      const adjustments = [];
      for (const idx of [2, 9, 14, 21]) {
        const p = martProducts[idx];
        const target = idx === 21 ? 0 : 4 + (idx % 5);
        adjustments.push({ shopId: mart.id, productId: p.id, type: "ADJUSTMENT_REMOVE" as const, quantity: target - p.stock, stockAfter: target, reason: "Stock count correction", userId: martManager.id });
        p.stock = target;
      }
      await tx.stockMovement.createMany({ data: adjustments });
      for (const p of martProducts) await tx.product.update({ where: { id: p.id }, data: { stock: p.stock } });
      await tx.purchaseOrder.create({
        data: {
          shopId: mart.id, poNumber: "PO-0001", supplierId: suppliers[0].id, status: "ORDERED", createdById: martManager.id, total: martProducts[2].cost * 100,
          items: { create: [{ shopId: mart.id, productId: martProducts[2].id, quantity: 100, unitCost: martProducts[2].cost }] },
        },
      });

      // ------------------------------------------------------------------ Shop 2: Kampala Electronics
      const shop2 = await tx.shop.create({ data: { name: "Kampala Electronics", address: "Nakasero Market, Kampala", phone: "+256 700 000 111", cashierMaxDiscountPercent: 5, planName: "Trial", trialEndsAt: new Date(Date.now() + 4 * 86_400_000), monthlyPrice: 30000 } });
      const s2Users = await Promise.all(
        [
          { name: "Esther Owner", email: "admin@electronics.test", role: "ADMIN" as Role },
          { name: "Moses Manager", email: "manager@electronics.test", role: "MANAGER" as Role },
          { name: "Ivan Cashier", email: "cashier@electronics.test", role: "CASHIER" as Role },
        ].map((u) => tx.user.create({ data: { shopId: shop2.id, name: u.name, email: u.email, passwordHash: hash(u.role === "CASHIER" ? "Cashier@123" : u.role === "ADMIN" ? "Admin@123" : "Manager@123"), role: u.role } })),
      );
      const catMap = new Map<string, string>();
      for (const name of categoriesFor(["electronics"])) catMap.set(name, (await tx.category.create({ data: { shopId: shop2.id, name } })).id);
      const ELECTRONICS: [string, string, number, number][] = [
        ["Phone Charger USB-C", "Chargers & power banks", 8000, 15000], ["Power Bank 10000mAh", "Chargers & power banks", 35000, 55000], ["Earphones", "Audio & headphones", 6000, 12000],
        ["AA Batteries (4 pack)", "Batteries", 3500, 6000], ["Torch (rechargeable)", "Accessories", 12000, 20000], ["Smartphone 6.5\" 64GB", "Phones & tablets", 380000, 450000],
        ["Tablet 8\" 32GB", "Phones & tablets", 260000, 320000], ["Bluetooth Speaker", "Audio & headphones", 45000, 70000], ["HDMI Cable 2m", "Cables & adapters", 7000, 15000], ["USB-C Cable 1m", "Cables & adapters", 4000, 9000],
        ["Laptop Bag 15\"", "Accessories", 25000, 40000], ["Wireless Mouse", "Computers & laptops", 14000, 25000],
      ];
      const s2Products: P[] = [];
      const s2Rows: object[] = [];
      ELECTRONICS.forEach(([name, cat, cost, price], i) => {
        const id = randomUUID();
        const stock = 20 + Math.floor(rand() * 40);
        s2Rows.push({ id, shopId: shop2.id, sku: `EL-${String(i + 1).padStart(3, "0")}`, barcode: `601${String(200000 + i * 53).padStart(9, "0")}`, name, categoryId: catMap.get(cat), costPrice: cost, sellPrice: price, stock, minStock: 5, ...productImage(name) });
        s2Products.push({ id, name, sku: `EL-${String(i + 1).padStart(3, "0")}`, cost, price, stock });
      });
      await tx.product.createMany({ data: s2Rows as never });
      const open2 = s2Products.map((p) => ({ shopId: shop2.id, productId: p.id, type: "INITIAL" as const, quantity: p.stock, stockAfter: p.stock, reason: "Opening stock", userId: s2Users[0].id, createdAt: daysAgo(31) }));
      const e = await generateSales(tx, shop2.id, s2Products, [cator(s2Users[2].id), cator(s2Users[1].id)], 30, 1, 4);
      await tx.stockMovement.createMany({ data: [...open2, ...e.movements] });
      for (const p of s2Products) await tx.product.update({ where: { id: p.id }, data: { stock: p.stock } });

      return { shops: await tx.shop.count(), users: await tx.user.count(), products: await tx.product.count(), sales: await tx.sale.count() };
    },
    { timeout: 300_000, maxWait: 30_000 },
  );
  console.log(`Seeded ${counts.shops} shops, ${counts.users} users, ${counts.products} products, ${counts.sales} sales.`);
}

const cator = (id: string) => id;

/** Generates `days` days of sales for a shop, mutating the products' remaining stock; inserts sales and lines in bulk. */
async function generateSales(tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0], shopId: string, products: P[], cashiers: string[], days: number, minPerDay: number, spread: number) {
  const methods: PaymentMethod[] = ["CASH", "CASH", "CASH", "MOBILE_MONEY", "MOBILE_MONEY", "CARD", "BANK_TRANSFER"];
  const sales: object[] = [], items: object[] = [], movements: { [k: string]: unknown }[] = [];
  const counters = new Map<string, number>();
  const now = new Date();
  for (let d = days; d >= 0; d--) {
    const count = minPerDay + Math.floor(rand() * spread);
    for (let i = 0; i < count; i++) {
      const lines = 1 + Math.floor(rand() * 4);
      const chosen = new Set<number>();
      while (chosen.size < Math.min(lines, products.length)) chosen.add(Math.floor(rand() * products.length));
      const picked = [...chosen].map((idx) => ({ p: products[idx], quantity: 1 + Math.floor(rand() * 3) }));
      if (picked.some((it) => it.p.stock < it.quantity + 3)) continue; // leave a few low-stock items
      const at = daysAgo(d, 8 + Math.floor(rand() * 11), Math.floor(rand() * 60));
      if (at > now) continue; // never create sales timestamped in the future
      const subtotal = picked.reduce((s, it) => s + it.p.price * it.quantity, 0);
      const discount = rand() < 0.15 ? Math.round((subtotal * 0.05) / 100) * 100 : 0;
      const total = subtotal - discount;
      const method = pick(methods);
      const paid = method === "CASH" ? Math.ceil(total / 1000) * 1000 : total;
      const day = kampalaDateString(at);
      const seq = (counters.get(day) ?? 0) + 1;
      counters.set(day, seq);
      const receiptNo = `RCP-${day.replace(/-/g, "")}-${String(seq).padStart(4, "0")}`;
      const cashierId = pick(cashiers);
      const saleId = randomUUID();
      sales.push({ id: saleId, shopId, receiptNo, cashierId, subtotal, discount, total, paymentMethod: method, amountPaid: paid, changeGiven: paid - total, createdAt: at });
      for (const it of picked) {
        items.push({ shopId, saleId, productId: it.p.id, productName: it.p.name, sku: it.p.sku, quantity: it.quantity, unitPrice: it.p.price, unitCost: it.p.cost, lineTotal: it.p.price * it.quantity });
        it.p.stock -= it.quantity;
        movements.push({ shopId, productId: it.p.id, type: "SALE", quantity: -it.quantity, stockAfter: it.p.stock, reference: receiptNo, userId: cashierId, createdAt: at });
      }
    }
  }
  for (const c of chunk(sales)) await tx.sale.createMany({ data: c as never });
  for (const c of chunk(items)) await tx.saleItem.createMany({ data: c as never });
  await tx.receiptCounter.createMany({ data: [...counters].map(([day, last]) => ({ shopId, day, last })) });
  return { movements: movements as never[] };
}

main().finally(() => db.$disconnect());

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { databaseUrl } from "../src/lib/db-url";
import { CATALOG } from "./catalog";
import { productImage } from "./images";
import type { PaymentMethod } from "../src/generated/prisma/enums";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });

// Deterministic PRNG so the demo data is the same every time.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

async function main() {
  if (process.env.SEED_IF_EMPTY && (await db.user.count()) > 0) {
    console.log("Database already has data - skipping seed.");
    return;
  }
  console.log("Resetting data…");
  await db.$transaction([
    db.auditLog.deleteMany(), db.shopSettings.deleteMany(), db.receiptCounter.deleteMany(), db.saleReturnItem.deleteMany(), db.saleReturn.deleteMany(),
    db.saleItem.deleteMany(), db.sale.deleteMany(), db.stockMovement.deleteMany(),
    db.purchaseOrderItem.deleteMany(), db.purchaseOrder.deleteMany(), db.supplier.deleteMany(),
    db.product.deleteMany(), db.category.deleteMany(), db.user.deleteMany(),
  ]);

  const pw = (p: string) => bcrypt.hashSync(p, 10);
  const [admin, manager, cashier1, cashier2] = await Promise.all([
    db.user.create({ data: { name: "Admin User", email: "admin@pos.test", passwordHash: pw("Admin@123"), role: "ADMIN" } }),
    db.user.create({ data: { name: "Mary Manager", email: "manager@pos.test", passwordHash: pw("Manager@123"), role: "MANAGER" } }),
    db.user.create({ data: { name: "Peter Cashier", email: "cashier@pos.test", passwordHash: pw("Cashier@123"), role: "CASHIER" } }),
    db.user.create({ data: { name: "Grace Cashier", email: "grace@pos.test", passwordHash: pw("Cashier@123"), role: "CASHIER" } }),
  ]);

  const suppliers = await Promise.all([
    db.supplier.create({ data: { name: "Kampala Wholesalers Ltd", phone: "+256700000001", email: "sales@kwl.example", address: "Owino Market, Kampala" } }),
    db.supplier.create({ data: { name: "Nile Distributors", phone: "+256700000002", email: "orders@nile.example", address: "Industrial Area, Kampala" } }),
  ]);

  // Create products with a generous opening stock; sales below deduct from it.
  const products: { id: string; name: string; sku: string; cost: number; price: number; stock: number }[] = [];
  let n = 1;
  for (const [cat, items] of Object.entries(CATALOG)) {
    const category = await db.category.create({ data: { name: cat } });
    for (const [name, cost, price] of items) {
      const sku = `SKU-${String(n++).padStart(4, "0")}`;
      const stock = 150 + Math.floor(rand() * 150);
      const p = await db.product.create({
        data: { sku, barcode: `600${String(100000 + n * 37).padStart(9, "0")}`, name, categoryId: category.id, costPrice: cost, sellPrice: price, stock, minStock: 15, ...productImage(name) },
      });
      await db.stockMovement.create({ data: { productId: p.id, type: "INITIAL", quantity: stock, stockAfter: stock, reason: "Opening stock", userId: admin.id, createdAt: daysAgo(61) } });
      products.push({ id: p.id, name, sku, cost, price, stock });
    }
  }

  // 60 days of sales.
  const methods: PaymentMethod[] = ["CASH", "CASH", "CASH", "MOBILE_MONEY", "MOBILE_MONEY", "CARD", "BANK_TRANSFER"];
  const cashiers = [cashier1, cashier2, manager];
  let receipt = 1;
  for (let d = 60; d >= 0; d--) {
    const count = 4 + Math.floor(rand() * 8);
    for (let i = 0; i < count; i++) {
      const lines = 1 + Math.floor(rand() * 4);
      const chosen = new Set<number>();
      while (chosen.size < lines) chosen.add(Math.floor(rand() * products.length));
      const items = [...chosen].map((idx) => {
        const p = products[idx];
        const quantity = 1 + Math.floor(rand() * 3);
        return { p, quantity, lineTotal: p.price * quantity };
      });
      if (items.some((it) => it.p.stock < it.quantity + 3)) continue; // leave a few low-stock items
      const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
      const discount = rand() < 0.15 ? Math.round((subtotal * 0.05) / 100) * 100 : 0;
      const total = subtotal - discount;
      const method = pick(methods);
      const paid = method === "CASH" ? Math.ceil(total / 1000) * 1000 : total;
      const at = daysAgo(d, 8 + Math.floor(rand() * 11), Math.floor(rand() * 60));
      if (at > new Date()) continue; // never create sales timestamped in the future
      const no = `RCP-${at.toISOString().slice(0, 10).replace(/-/g, "")}-${String(receipt++).padStart(4, "0")}`;
      const cashier = pick(cashiers);
      await db.sale.create({
        data: {
          receiptNo: no, cashierId: cashier.id, subtotal, discount, total, paymentMethod: method, amountPaid: paid, changeGiven: paid - total, createdAt: at,
          items: { create: items.map((it) => ({ productId: it.p.id, productName: it.p.name, sku: it.p.sku, quantity: it.quantity, unitPrice: it.p.price, unitCost: it.p.cost, lineTotal: it.lineTotal })) },
        },
      });
      for (const it of items) {
        it.p.stock -= it.quantity;
        await db.stockMovement.create({ data: { productId: it.p.id, type: "SALE", quantity: -it.quantity, stockAfter: it.p.stock, reference: no, userId: cashier.id, createdAt: at } });
      }
    }
  }

  // Make a few products low / out of stock so alerts have something to show.
  for (const idx of [2, 9, 14, 21]) {
    const p = products[idx];
    const target = idx === 21 ? 0 : 4 + (idx % 5);
    const diff = target - p.stock;
    p.stock = target;
    await db.stockMovement.create({ data: { productId: p.id, type: "ADJUSTMENT_REMOVE", quantity: diff, stockAfter: target, reason: "Stock count correction", userId: manager.id } });
  }
  for (const p of products) await db.product.update({ where: { id: p.id }, data: { stock: p.stock } });

  // One received purchase order, one open.
  await db.purchaseOrder.create({
    data: {
      poNumber: "PO-0001", supplierId: suppliers[0].id, status: "ORDERED", createdById: manager.id, total: products[2].cost * 100,
      items: { create: [{ productId: products[2].id, quantity: 100, unitCost: products[2].cost }] },
    },
  });

  const [u, p, s] = await Promise.all([db.user.count(), db.product.count(), db.sale.count()]);
  console.log(`Seeded ${u} users, ${p} products, ${s} sales.`);
}

function daysAgo(d: number, h = 9, m = 0) {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(h, m, 0, 0);
  return t;
}

main().finally(() => db.$disconnect());

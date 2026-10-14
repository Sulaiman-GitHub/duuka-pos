"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { applyStockChange, StockError } from "@/lib/inventory";
import { requirePermission } from "@/lib/session";

export type FormState = { error?: string; values?: Record<string, string> };
const strings = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

// ---------------- suppliers ----------------
const supplierSchema = z.object({
  name: z.string().trim().min(2, "Supplier name is required").max(100),
  phone: z.string().trim().max(30).optional(),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional(),
  address: z.string().trim().max(200).optional(),
});

export async function createSupplier(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("suppliers.manage");
  const parsed = supplierSchema.safeParse(strings(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: strings(fd) };
  const s = await db.supplier.create({ data: { ...parsed.data, email: parsed.data.email || null, phone: parsed.data.phone || null, address: parsed.data.address || null } });
  await audit(user.id, "supplier.create", "Supplier", s.id, s.name);
  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function updateSupplier(id: string, _p: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("suppliers.manage");
  const parsed = supplierSchema.safeParse(strings(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: strings(fd) };
  await db.supplier.update({ where: { id }, data: { ...parsed.data, email: parsed.data.email || null, phone: parsed.data.phone || null, address: parsed.data.address || null, isActive: fd.get("isActive") === "on" } });
  await audit(user.id, "supplier.update", "Supplier", id, parsed.data.name);
  revalidatePath("/suppliers");
  redirect("/suppliers");
}

// ---------------- purchase orders ----------------
const orderSchema = z.object({
  supplierId: z.string().min(1, "Choose a supplier"),
  note: z.string().trim().max(300).optional(),
  submit: z.boolean(), // true = mark as ordered, false = save as draft
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1, "Quantities must be at least 1").max(1_000_000), unitCost: z.number().int().min(0) })).min(1, "Add at least one product"),
});

async function nextPoNumber(tx: Pick<typeof db, "purchaseOrder">) {
  const last = await tx.purchaseOrder.findFirst({ orderBy: { poNumber: "desc" }, select: { poNumber: true } });
  const n = last ? parseInt(last.poNumber.replace(/\D/g, ""), 10) + 1 : 1;
  return `PO-${String(n).padStart(4, "0")}`;
}

export async function createPurchaseOrder(input: unknown): Promise<{ error?: string; id?: string }> {
  const user = await requirePermission("suppliers.manage");
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const ids = d.items.map((i) => i.productId);
  if (new Set(ids).size !== ids.length) return { error: "Each product can only appear once on an order." };

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const po = await db.$transaction(async (tx) => {
        const [supplier, products] = await Promise.all([
          tx.supplier.findUnique({ where: { id: d.supplierId }, select: { isActive: true } }),
          tx.product.count({ where: { id: { in: ids } } }),
        ]);
        if (!supplier?.isActive) throw new StockError("That supplier is not available.");
        if (products !== ids.length) throw new StockError("A product on the order no longer exists.");
        return tx.purchaseOrder.create({
          data: {
            poNumber: await nextPoNumber(tx), supplierId: d.supplierId, createdById: user.id, note: d.note || null,
            status: d.submit ? "ORDERED" : "DRAFT", total: d.items.reduce((s, i) => s + i.quantity * i.unitCost, 0),
            items: { create: d.items },
          },
        });
      });
      await audit(user.id, "po.create", "PurchaseOrder", po.id, `${po.poNumber} ${po.status}`);
      revalidatePath("/suppliers", "layout");
      return { id: po.id };
    } catch (e) {
      if (e instanceof StockError) return { error: e.message };
      if ((e as { code?: string }).code === "P2002") continue; // two orders raced for the same number
      throw e;
    }
  }
  return { error: "Could not allocate an order number. Please try again." };
}

export async function markOrdered(id: string) {
  const user = await requirePermission("suppliers.manage");
  const r = await db.purchaseOrder.updateMany({ where: { id, status: "DRAFT" }, data: { status: "ORDERED" } });
  if (r.count) await audit(user.id, "po.ordered", "PurchaseOrder", id);
  revalidatePath("/suppliers", "layout");
}

export async function cancelOrder(id: string) {
  const user = await requirePermission("suppliers.manage");
  // Orders that already received stock can't be cancelled; that stock is real.
  const po = await db.purchaseOrder.findUnique({ where: { id }, select: { status: true, items: { select: { receivedQty: true } } } });
  if (!po || po.status === "RECEIVED" || po.status === "CANCELLED" || po.items.some((i) => i.receivedQty > 0)) return;
  await db.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
  await audit(user.id, "po.cancel", "PurchaseOrder", id);
  revalidatePath("/suppliers", "layout");
}

const receiveSchema = z.object({
  invoiceNo: z.string().trim().max(60).optional(),
  lines: z.array(z.object({ itemId: z.string().min(1), quantity: z.number().int().min(0) })),
});

export async function receiveStock(orderId: string, input: unknown): Promise<{ error?: string; ok?: boolean }> {
  const user = await requirePermission("suppliers.manage");
  const parsed = receiveSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid quantities." };
  const lines = parsed.data.lines.filter((l) => l.quantity > 0);
  if (lines.length === 0) return { error: "Enter a quantity for at least one item." };

  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${orderId} FOR UPDATE`; // serialise concurrent receipts
      const po = await tx.purchaseOrder.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!po) throw new StockError("Order not found.");
      if (po.status !== "ORDERED") throw new StockError(`Only orders marked "Ordered" can receive stock (this one is ${po.status.toLowerCase()}).`);
      for (const l of lines) {
        const item = po.items.find((i) => i.id === l.itemId);
        if (!item) throw new StockError("An item does not belong to this order.");
        const remaining = item.quantity - item.receivedQty;
        if (l.quantity > remaining) throw new StockError(`Only ${remaining} more can be received for one of the items.`);
        await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQty: { increment: l.quantity } } });
        await applyStockChange(tx, item.productId, l.quantity, "PURCHASE", { userId: user.id, reference: po.poNumber, reason: parsed.data.invoiceNo ? `Supplier invoice ${parsed.data.invoiceNo}` : "Stock received", allowInactive: true });
      }
      const fresh = await tx.purchaseOrderItem.findMany({ where: { orderId } });
      const done = fresh.every((i) => i.receivedQty >= i.quantity);
      await tx.purchaseOrder.update({ where: { id: orderId }, data: { ...(done ? { status: "RECEIVED", receivedAt: new Date() } : {}), ...(parsed.data.invoiceNo ? { invoiceNo: parsed.data.invoiceNo } : {}) } });
    });
  } catch (e) {
    if (e instanceof StockError) return { error: e.message };
    throw e;
  }
  await audit(user.id, "po.receive", "PurchaseOrder", orderId, `${lines.length} line(s)`);
  revalidatePath("/", "layout");
  return { ok: true };
}

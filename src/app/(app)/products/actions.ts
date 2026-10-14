"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export type ProductFormState = { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

// Echo submitted text back so React 19's post-action form reset doesn't wipe what the user typed.
const echo = (fd: FormData): Record<string, string> =>
  Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string") as [string, string][]);

const MAX_IMAGE = 500 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

function sniffImageType(b: Uint8Array): string | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

const int = (label: string, min = 0) =>
  z.coerce.number({ message: `${label} must be a number` }).int(`${label} must be a whole number`).min(min, `${label} cannot be below ${min}`);

const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  sku: z.string().trim().max(40).optional(),
  barcode: z.string().trim().max(40).optional(),
  description: z.string().trim().max(500).optional(),
  categoryId: z.string().optional(),
  costPrice: int("Buying cost"),
  sellPrice: int("Selling price"),
  stock: int("Stock quantity"),
  minStock: int("Minimum stock"),
});

function parse(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return schema.safeParse({ ...raw, categoryId: raw.categoryId || undefined, sku: raw.sku || undefined, barcode: raw.barcode || undefined });
}

function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

async function readImage(formData: FormData): Promise<{ data: Uint8Array<ArrayBuffer>; type: string } | { error: string } | null> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return null;
  if (!IMAGE_TYPES.includes(file.type)) return { error: "Image must be PNG, JPEG or WebP." };
  if (file.size > MAX_IMAGE) return { error: "Image must be 500 KB or smaller." };
  const data = new Uint8Array(await file.arrayBuffer());
  // The browser-declared type is client-controlled, so trust the file's own signature instead.
  const type = sniffImageType(data);
  if (!type) return { error: "That file isn't a valid PNG, JPEG or WebP image." };
  return { data, type };
}

function newSku() {
  return "SKU-" + Date.now().toString(36).toUpperCase().slice(-6);
}

function uniqueError(e: unknown): string | null {
  if (typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2002") {
    const target = JSON.stringify((e as { meta?: unknown }).meta ?? "");
    return target.includes("barcode") ? "That barcode is already used by another product." : "That SKU is already used by another product.";
  }
  return null;
}

export async function createProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const user = await requirePermission("products.manage");
  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: echo(formData) };
  const d = parsed.data;
  if (d.sellPrice < d.costPrice && formData.get("confirmLoss") !== "on")
    return { fieldErrors: { sellPrice: "Selling price is below cost. Tick the confirmation to save anyway." }, values: echo(formData) };
  const img = await readImage(formData);
  if (img && "error" in img) return { fieldErrors: { image: img.error }, values: echo(formData) };

  let id: string;
  try {
    id = await db.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          name: d.name, sku: d.sku ?? newSku(), barcode: d.barcode, description: d.description, categoryId: d.categoryId,
          costPrice: d.costPrice, sellPrice: d.sellPrice, stock: d.stock, minStock: d.minStock,
          ...(img && !("error" in img) ? { imageData: img.data, imageType: img.type } : {}),
        },
      });
      if (d.stock > 0)
        await tx.stockMovement.create({ data: { productId: p.id, type: "INITIAL", quantity: d.stock, stockAfter: d.stock, reason: "Opening stock", userId: user.id } });
      return p.id;
    });
  } catch (e) {
    const msg = uniqueError(e);
    if (msg) return { fieldErrors: { [msg.includes("barcode") ? "barcode" : "sku"]: msg }, values: echo(formData) };
    throw e;
  }
  await audit(user.id, "product.create", "Product", id, d.name);
  revalidatePath("/products");
  redirect("/products");
}

export async function updateProduct(id: string, _prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const user = await requirePermission("products.manage");
  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: echo(formData) };
  const d = parsed.data;
  if (d.sellPrice < d.costPrice && formData.get("confirmLoss") !== "on")
    return { fieldErrors: { sellPrice: "Selling price is below cost. Tick the confirmation to save anyway." }, values: echo(formData) };
  const img = await readImage(formData);
  if (img && "error" in img) return { fieldErrors: { image: img.error }, values: echo(formData) };
  const removeImage = formData.get("removeImage") === "on";

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id }, select: { stock: true } });
      if (!existing) throw new Error("Product not found");
      await tx.product.update({
        where: { id },
        data: {
          name: d.name, sku: d.sku ?? undefined, barcode: d.barcode ?? null, description: d.description ?? null, categoryId: d.categoryId ?? null,
          costPrice: d.costPrice, sellPrice: d.sellPrice, stock: d.stock, minStock: d.minStock,
          ...(img && !("error" in img) ? { imageData: img.data, imageType: img.type } : removeImage ? { imageData: null, imageType: null } : {}),
        },
      });
      const diff = d.stock - existing.stock;
      if (diff !== 0)
        await tx.stockMovement.create({
          data: { productId: id, type: diff > 0 ? "ADJUSTMENT_ADD" : "ADJUSTMENT_REMOVE", quantity: diff, stockAfter: d.stock, reason: "Edited on product form", userId: user.id },
        });
    });
  } catch (e) {
    const msg = uniqueError(e);
    if (msg) return { fieldErrors: { [msg.includes("barcode") ? "barcode" : "sku"]: msg }, values: echo(formData) };
    throw e;
  }
  await audit(user.id, "product.update", "Product", id, d.name);
  revalidatePath("/products");
  redirect("/products");
}

export async function toggleProductActive(id: string) {
  const user = await requirePermission("products.manage");
  const p = await db.product.findUnique({ where: { id }, select: { isActive: true, name: true } });
  if (!p) return;
  await db.product.update({ where: { id }, data: { isActive: !p.isActive } });
  await audit(user.id, p.isActive ? "product.deactivate" : "product.activate", "Product", id, p.name);
  revalidatePath("/products");
}

export async function deleteProduct(id: string): Promise<{ error?: string }> {
  const user = await requirePermission("products.manage");
  const p = await db.product.findUnique({ where: { id }, select: { name: true, _count: { select: { saleItems: true, poItems: true } } } });
  if (!p) return {};
  if (p._count.saleItems > 0 || p._count.poItems > 0)
    return { error: `"${p.name}" has sales or purchase history and can't be deleted. Deactivate it instead.` };
  await db.$transaction([db.stockMovement.deleteMany({ where: { productId: id } }), db.product.delete({ where: { id } })]);
  await audit(user.id, "product.delete", "Product", id, p.name);
  revalidatePath("/products");
  return {};
}

const catSchema = z.object({ name: z.string().trim().min(2, "Name is required").max(60), description: z.string().trim().max(200).optional() });

export async function createCategory(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const user = await requirePermission("products.manage");
  const parsed = catSchema.safeParse({ name: formData.get("name"), description: formData.get("description") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const c = await db.category.create({ data: parsed.data });
    await audit(user.id, "category.create", "Category", c.id, c.name);
  } catch (e) {
    if (uniqueError(e)) return { error: "A category with that name already exists." };
    throw e;
  }
  revalidatePath("/products", "layout");
  return {};
}

export async function deleteCategory(id: string): Promise<{ error?: string }> {
  const user = await requirePermission("products.manage");
  const c = await db.category.findUnique({ where: { id }, select: { name: true, _count: { select: { products: true } } } });
  if (!c) return {};
  if (c._count.products > 0) return { error: `"${c.name}" still has ${c._count.products} product(s). Move them first.` };
  await db.category.delete({ where: { id } });
  await audit(user.id, "category.delete", "Category", id, c.name);
  revalidatePath("/products", "layout");
  return {};
}

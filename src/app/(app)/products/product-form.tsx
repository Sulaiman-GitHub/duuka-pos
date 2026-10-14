"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, Field, inputCls } from "@/components/ui";
import type { ProductFormState } from "./actions";

type Product = {
  id: string; name: string; sku: string; barcode: string | null; description: string | null; categoryId: string | null;
  costPrice: number; sellPrice: number; stock: number; minStock: number; hasImage: boolean;
};

export function ProductForm({
  action, product, categories,
}: {
  action: (prev: ProductFormState, fd: FormData) => Promise<ProductFormState>;
  product?: Product;
  categories: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  const lossError = fe.sellPrice?.includes("below cost");
  // Prefer what the user last submitted (after a failed save) over the stored values.
  const v = (name: string, fallback: string | number | null | undefined) => state.values?.[name] ?? String(fallback ?? "");

  return (
    <form action={formAction} className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Product name *" error={fe.name}>
            <input name="name" defaultValue={v("name", product?.name)} required className={inputCls} />
          </Field>
        </div>
        <Field label="SKU" error={fe.sku} hint="Leave blank to generate automatically">
          <input name="sku" defaultValue={v("sku", product?.sku)} className={inputCls} />
        </Field>
        <Field label="Barcode" error={fe.barcode} hint="Scan or type; used for fast lookup at the till">
          <input name="barcode" defaultValue={v("barcode", product?.barcode)} className={inputCls} />
        </Field>
        <Field label="Category" error={fe.categoryId}>
          <select name="categoryId" defaultValue={v("categoryId", product?.categoryId)} className={inputCls}>
            <option value="">Uncategorised</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Description" error={fe.description}>
          <input name="description" defaultValue={v("description", product?.description)} className={inputCls} />
        </Field>
        <Field label="Buying cost (UGX) *" error={fe.costPrice}>
          <input name="costPrice" type="number" min={0} step={1} defaultValue={v("costPrice", product?.costPrice ?? 0)} required className={inputCls} />
        </Field>
        <Field label="Selling price (UGX) *" error={fe.sellPrice}>
          <input name="sellPrice" type="number" min={0} step={1} defaultValue={v("sellPrice", product?.sellPrice ?? 0)} required className={inputCls} />
        </Field>
        <Field label={product ? "Stock quantity" : "Opening stock"} error={fe.stock} hint={product ? "Changing this records a stock adjustment" : undefined}>
          <input name="stock" type="number" min={0} step={1} defaultValue={v("stock", product?.stock ?? 0)} required className={inputCls} />
        </Field>
        <Field label="Minimum stock level" error={fe.minStock} hint="Low-stock alerts trigger at or below this">
          <input name="minStock" type="number" min={0} step={1} defaultValue={v("minStock", product?.minStock ?? 5)} required className={inputCls} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Product image" error={fe.image} hint="PNG, JPEG or WebP, up to 500 KB">
            <input name="image" type="file" accept="image/png,image/jpeg,image/webp" className={inputCls} />
          </Field>
          {product?.hasImage && (
            <div className="mt-2 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/products/${product.id}/image`} alt="" className="h-16 w-16 rounded-lg border object-cover" />
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="removeImage" /> Remove current image
              </label>
            </div>
          )}
        </div>
        {lossError && (
          <label className="flex items-center gap-2 text-sm text-amber-700 sm:col-span-2">
            <input type="checkbox" name="confirmLoss" /> I understand this product is priced below cost
          </label>
        )}
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : product ? "Save changes" : "Create product"}</Button>
        <Link href="/products" className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link>
      </div>
    </form>
  );
}

"use client";

/**
 * Pop-up for adding or editing a product without leaving the inventory table.
 * Fields: Title, Brand, Category, Price (₦), Stock, Image URL, Description and Tech specs.
 * Products with several variants (e.g. colours or storage sizes) show one price/stock row per variant.
 * Anything this pop-up doesn't show (extra images, tags, compare-at prices…) is kept as it is;
 * the "Full editor" link opens the complete product editor for those.
 */
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Archive, ArchiveRestore, ExternalLink, Loader2, Save } from "lucide-react";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import type { AdminCategoryRow, AdminProductDetail } from "@/types/admin";
import { SafeImage } from "@/components/ui/SafeImage";
import { Modal } from "./Modal";

interface VariantRow {
  sku: string;
  label: string;
  price: string; // Naira, as typed
  stock: string;
}

interface FormState {
  name: string;
  brand: string;
  categoryId: string;
  imageUrl: string;
  description: string;
  specs: string; // one "Key: Value" per line
  variants: VariantRow[];
}

type Errors = Partial<Record<"name" | "brand" | "categoryId" | "imageUrl" | "description" | "specs" | "variants" | "form", string>>;

const toNaira = (kobo: number) => String(Math.round(kobo) / 100);

function emptyForm(categories: AdminCategoryRow[]): FormState {
  return {
    name: "",
    brand: "",
    categoryId: categories[0]?.id ?? "",
    imageUrl: "",
    description: "",
    specs: "",
    variants: [{ sku: "", label: "Standard", price: "", stock: "0" }],
  };
}

function fromDetail(p: AdminProductDetail): FormState {
  return {
    name: p.name,
    brand: p.brand,
    categoryId: p.categoryId,
    imageUrl: p.images[0] ?? "",
    description: p.description,
    specs: p.specs.map((s) => `${s.key}: ${s.value}`).join("\n"),
    variants: p.variants.map((v) => ({ sku: v.sku, label: v.label, price: toNaira(v.price), stock: String(v.stock) })),
  };
}

/** "Display: 6.7-inch AMOLED" lines → [{ key, value }] */
export function parseSpecs(text: string): { specs: { key: string; value: string }[]; badLine: number | null } {
  const specs: { key: string; value: string }[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const at = line.indexOf(":");
    if (at < 1 || at === line.length - 1) return { specs, badLine: i + 1 };
    specs.push({ key: line.slice(0, at).trim().slice(0, 40), value: line.slice(at + 1).trim().slice(0, 80) });
  }
  return { specs, badLine: null };
}

/** First sentence of the description, used as the one-line summary on product cards. */
function summaryOf(description: string): string {
  const clean = description.replace(/\s+/g, " ").trim();
  const sentence = clean.match(/^.{10,}?[.!?](\s|$)/)?.[0]?.trim() ?? clean;
  return sentence.length > 240 ? `${sentence.slice(0, 237).trimEnd()}…` : sentence;
}

function newSku(name: string): string {
  const stem = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AF-${stem || "ITEM"}-${random}`;
}

export function ProductQuickModal({
  productId,
  open,
  categories,
  onClose,
  onSaved,
}: {
  /** null = add a new product */
  productId: string | null;
  open: boolean;
  categories: AdminCategoryRow[];
  onClose: () => void;
  onSaved: (product: AdminProductDetail, message: string) => void;
}) {
  const isNew = productId === null;
  const initialEmpty = useMemo(() => emptyForm(categories), [categories]);
  const [original, setOriginal] = useState<AdminProductDetail | null>(null);
  const [form, setForm] = useState<FormState>(initialEmpty);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Load the product (edit) or reset the form (add) whenever the pop-up opens.
  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (isNew) {
      setOriginal(null);
      setForm(initialEmpty);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    apiFetch<AdminProductDetail>(`/api/admin/products/${productId}`, { signal: controller.signal, cache: "no-store" })
      .then((p) => {
        setOriginal(p);
        setForm(fromDetail(p));
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setErrors({ form: e instanceof Error ? e.message : "Could not load this product." });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, isNew, productId, initialEmpty]);

  const setField = (key: keyof Omit<FormState, "variants">) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  };

  const setVariant = (index: number, key: "price" | "stock", value: string) => {
    setForm((f) => ({ ...f, variants: f.variants.map((v, i) => (i === index ? { ...v, [key]: value } : v)) }));
    setErrors((e) => ({ ...e, variants: undefined, form: undefined }));
  };

  function validate(): { ok: true; specs: { key: string; value: string }[] } | { ok: false } {
    const next: Errors = {};
    if (form.name.trim().length < 3) next.name = "Enter a product title (at least 3 characters)";
    if (!form.brand.trim()) next.brand = "Enter the brand, e.g. Samsung";
    if (!/^[a-f0-9]{24}$/i.test(form.categoryId)) next.categoryId = "Choose a category";
    const url = form.imageUrl.trim();
    if (!url) next.imageUrl = "Paste an image link";
    else if (!(url.startsWith("/") || /^https:\/\//.test(url))) next.imageUrl = "Image must start with https:// (or /images/... for files in the project)";
    if (form.description.trim().length < 20) next.description = "Write at least 20 characters";
    for (const v of form.variants) {
      const price = Number(v.price);
      const stock = Number(v.stock);
      if (!v.price.trim() || !Number.isFinite(price) || price <= 0) {
        next.variants = `Enter a price above ₦0${form.variants.length > 1 ? ` for "${v.label}"` : ""}`;
        break;
      }
      if (!Number.isInteger(stock) || stock < 0) {
        next.variants = `Stock must be a whole number, 0 or more${form.variants.length > 1 ? ` for "${v.label}"` : ""}`;
        break;
      }
    }
    const { specs, badLine } = parseSpecs(form.specs);
    if (badLine) next.specs = `Line ${badLine}: write each spec as "Name: value", e.g. "Battery: 5000 mAh"`;
    setErrors(next);
    return Object.keys(next).length ? { ok: false } : { ok: true, specs };
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const checked = validate();
    if (!checked.ok) return;
    setSaving(true);
    const imageUrl = form.imageUrl.trim();
    const description = form.description.trim();

    const variants = form.variants.map((row, i) => {
      const existing = original?.variants[i];
      return {
        sku: row.sku || newSku(form.name),
        label: row.label || "Standard",
        attributes: existing?.attributes ?? [],
        price: Number(row.price),
        compareAtPrice: existing?.compareAtPrice ? existing.compareAtPrice / 100 : null,
        stock: Number(row.stock),
        imageIndex: existing?.imageIndex ?? 0,
      };
    });

    const images = original ? [imageUrl, ...original.images.slice(1)] : [imageUrl];
    const body = {
      name: form.name.trim(),
      slug: original?.slug ?? "",
      brand: form.brand.trim(),
      categoryId: form.categoryId,
      shortDescription: original && original.description === description ? original.shortDescription : summaryOf(description),
      description,
      images,
      specs: checked.specs,
      variants: variants.map((v) => ({ ...v, imageIndex: Math.min(v.imageIndex, images.length - 1) })),
      tags: original?.tags ?? [],
      featured: original?.featured ?? false,
      active: original?.active ?? true,
      supplierSku: original?.supplierSku ?? "",
      costPrice: original?.costPrice ? original.costPrice / 100 : null,
    };

    try {
      const saved = isNew
        ? await apiFetch<AdminProductDetail>("/api/admin/products", { method: "POST", body: JSON.stringify(body) })
        : await apiFetch<AdminProductDetail>(`/api/admin/products/${productId}`, { method: "PUT", body: JSON.stringify(body) });
      onSaved(saved, isNew ? `"${saved.name}" added to the shop.` : `"${saved.name}" saved.`);
    } catch (e) {
      if (e instanceof ApiClientError) {
        const fe = e.fieldErrors;
        setErrors({
          form: e.message,
          name: fe.name?.[0],
          brand: fe.brand?.[0],
          categoryId: fe.categoryId?.[0],
          imageUrl: fe.images?.[0],
          description: fe.description?.[0] ?? fe.shortDescription?.[0],
          specs: fe.specs?.[0],
          variants: fe.variants?.[0],
        });
      } else {
        setErrors({ form: "Could not save the product. Please try again." });
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchive() {
    if (!original) return;
    setArchiving(true);
    try {
      const updated = await apiFetch<AdminProductDetail>(`/api/admin/products/${original.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !original.active }),
      });
      onSaved(updated, updated.active ? `"${updated.name}" is back in the shop.` : `"${updated.name}" archived. It's hidden from the shop; past orders keep it.`);
    } catch (e) {
      setErrors({ form: e instanceof Error ? e.message : "Could not change this product." });
    } finally {
      setArchiving(false);
    }
  }

  const err = (key: keyof Errors) =>
    errors[key] ? (
      <p className="mt-1.5 text-xs text-neon-magenta" role="alert">
        {errors[key]}
      </p>
    ) : null;
  const bad = (key: keyof Errors) => (errors[key] ? "border-neon-magenta" : "");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? "Add product" : original ? `Edit · ${original.name}` : "Edit product"}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {original && (
            <>
              <button type="button" onClick={() => void toggleArchive()} disabled={archiving || saving} className={original.active ? "btn border border-neon-magenta/40 text-neon-magenta hover:bg-neon-magenta/10" : "btn-ghost"}>
                {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : original.active ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                {original.active ? "Archive" : "Restore to shop"}
              </button>
              <Link href={`/admin/products/${original.id}`} className="btn-ghost">
                <ExternalLink className="h-4 w-4" /> Full editor
              </Link>
            </>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" form="product-quick-form" disabled={saving || loading} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isNew ? "Add product" : "Save changes"}
            </button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-neon-cyan" />
        </div>
      ) : (
        <form id="product-quick-form" onSubmit={save} noValidate className="space-y-5">
          {original && !original.active && (
            <p className="rounded-xl border border-ink-500/40 bg-obsidian-850 p-3 text-sm text-ink-300">
              This product is <strong>archived</strong>: hidden from the shop. Use &ldquo;Restore to shop&rdquo; to show it again.
            </p>
          )}

          <div className="grid gap-5 sm:grid-cols-[1fr_180px]">
            <div className="space-y-5">
              <div>
                <label htmlFor="pq-name" className="label">
                  Title
                </label>
                <input id="pq-name" className={`input ${bad("name")}`} value={form.name} onChange={(e) => setField("name")(e.target.value)} placeholder="e.g. Galaxy A55 5G" />
                {err("name")}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="pq-brand" className="label">
                    Brand
                  </label>
                  <input id="pq-brand" className={`input ${bad("brand")}`} value={form.brand} onChange={(e) => setField("brand")(e.target.value)} placeholder="e.g. Samsung" />
                  {err("brand")}
                </div>
                <div>
                  <label htmlFor="pq-category" className="label">
                    Category
                  </label>
                  <select id="pq-category" className={`input ${bad("categoryId")}`} value={form.categoryId} onChange={(e) => setField("categoryId")(e.target.value)}>
                    {categories.length === 0 && <option value="">Create a category first</option>}
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {err("categoryId")}
                </div>
              </div>
            </div>
            <div>
              <p className="label">Preview</p>
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-obsidian-700 bg-white">
                {form.imageUrl.trim() ? (
                  <SafeImage src={form.imageUrl.trim()} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="px-3 text-center text-xs text-ink-500">Image preview appears here</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="pq-image" className="label">
              Image URL
            </label>
            <input
              id="pq-image"
              className={`input ${bad("imageUrl")}`}
              value={form.imageUrl}
              onChange={(e) => setField("imageUrl")(e.target.value)}
              placeholder="https://… or /images/products/…"
              inputMode="url"
            />
            {err("imageUrl")}
          </div>

          <fieldset>
            <legend className="label">{form.variants.length > 1 ? "Price (₦) and stock for each option" : "Price and stock"}</legend>
            <div className="space-y-2">
              {form.variants.map((v, i) => (
                <div key={v.sku || i} className="grid grid-cols-[1fr_1fr] gap-3 sm:grid-cols-[minmax(0,1fr)_160px_120px] sm:items-center">
                  {form.variants.length > 1 && <p className="col-span-2 truncate text-sm text-ink-300 sm:col-span-1">{v.label}</p>}
                  <div className={form.variants.length > 1 ? "" : "sm:col-span-2"}>
                    <label htmlFor={`pq-price-${i}`} className={form.variants.length > 1 ? "sr-only" : "mb-1 block text-xs text-ink-400"}>
                      Price in Naira (₦){form.variants.length > 1 ? ` for ${v.label}` : ""}
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-ink-400">₦</span>
                      <input
                        id={`pq-price-${i}`}
                        className={`input pl-8 font-mono ${bad("variants")}`}
                        value={v.price}
                        onChange={(e) => setVariant(i, "price", e.target.value.replace(/[^0-9.]/g, ""))}
                        inputMode="decimal"
                        placeholder="250000"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor={`pq-stock-${i}`} className={form.variants.length > 1 ? "sr-only" : "mb-1 block text-xs text-ink-400"}>
                      Stock (units){form.variants.length > 1 ? ` for ${v.label}` : ""}
                    </label>
                    <input
                      id={`pq-stock-${i}`}
                      className={`input font-mono ${bad("variants")}`}
                      value={v.stock}
                      onChange={(e) => setVariant(i, "stock", e.target.value.replace(/[^0-9]/g, ""))}
                      inputMode="numeric"
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>
            {err("variants")}
            <p className="mt-1.5 text-xs text-ink-500">Type the selling price in Naira, without commas. Stock at 0 shows &ldquo;Out of stock&rdquo; in the shop.</p>
          </fieldset>

          <div>
            <label htmlFor="pq-description" className="label">
              Description
            </label>
            <textarea
              id="pq-description"
              rows={4}
              className={`input resize-y ${bad("description")}`}
              value={form.description}
              onChange={(e) => setField("description")(e.target.value)}
              placeholder="What it is, who it's for, what's in the box."
            />
            {err("description")}
          </div>

          <div>
            <label htmlFor="pq-specs" className="label">
              Tech specs <span className="normal-case tracking-normal text-ink-500">(one per line, &ldquo;Name: value&rdquo;)</span>
            </label>
            <textarea
              id="pq-specs"
              rows={5}
              className={`input resize-y font-mono text-sm ${bad("specs")}`}
              value={form.specs}
              onChange={(e) => setField("specs")(e.target.value)}
              placeholder={"Display: 6.6-inch Super AMOLED\nBattery: 5000 mAh\nStorage: 128 GB"}
            />
            {err("specs")}
          </div>

          {errors.form && (
            <p className="rounded-xl border border-neon-magenta/40 bg-neon-magenta/5 p-3 text-sm text-neon-magenta" role="alert">
              {errors.form}
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}

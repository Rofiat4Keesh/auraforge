"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, ExternalLink, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import type { AdminCategoryRow, AdminProductDetail } from "@/types/admin";
import { BackLink } from "./ui";
import { SafeImage } from "@/components/ui/SafeImage";

/**
 * Create / edit a product.
 * Prices are typed in Naira; the server stores them in kobo.
 * Variant options are typed as "Name: Value; Name: Value", e.g. "Memory: 16GB / 512GB; Color: Obsidian".
 */

interface VariantForm {
  sku: string;
  label: string;
  options: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  imageIndex: number;
}

interface FormState {
  name: string;
  slug: string;
  brand: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  images: string[];
  specs: { key: string; value: string }[];
  variants: VariantForm[];
  tags: string;
  featured: boolean;
  active: boolean;
  supplierSku: string;
  costPrice: string;
}

const RENDER_TYPES = [
  "laptop",
  "minipc",
  "phone",
  "tablet",
  "gpu",
  "ram",
  "ssd",
  "keyboard",
  "mouse",
  "monitor",
  "headphones",
  "earbuds",
  "watch",
  "charger",
  "cable",
  "software",
];
const ACCENTS = [
  { value: "22F3FF", label: "Cyan" },
  { value: "A855F7", label: "Violet" },
  { value: "B6FF3B", label: "Lime" },
  { value: "FF2BD6", label: "Magenta" },
];

const toNaira = (kobo: number | null) => (kobo === null ? "" : String(kobo / 100));

function fromProduct(p: AdminProductDetail | null, firstCategory: string): FormState {
  if (!p) {
    return {
      name: "",
      slug: "",
      brand: "AuraForge",
      categoryId: firstCategory,
      shortDescription: "",
      description: "",
      images: [],
      specs: [{ key: "Warranty", value: "12 months" }],
      variants: [{ sku: "", label: "", options: "", price: "", compareAtPrice: "", stock: "0", imageIndex: 0 }],
      tags: "",
      featured: false,
      active: true,
      supplierSku: "",
      costPrice: "",
    };
  }
  return {
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    categoryId: p.categoryId,
    shortDescription: p.shortDescription,
    description: p.description,
    images: p.images,
    specs: p.specs,
    variants: p.variants.map((v) => ({
      sku: v.sku,
      label: v.label,
      options: v.attributes.map((a) => `${a.name}: ${a.value}`).join("; "),
      price: toNaira(v.price),
      compareAtPrice: toNaira(v.compareAtPrice),
      stock: String(v.stock),
      imageIndex: v.imageIndex,
    })),
    tags: p.tags.join(", "),
    featured: p.featured,
    active: p.active,
    supplierSku: p.supplierSku ?? "",
    costPrice: toNaira(p.costPrice),
  };
}

function parseOptions(text: string): { name: string; value: string }[] {
  return text
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const i = part.indexOf(":");
      return i === -1
        ? { name: "Option", value: part }
        : { name: part.slice(0, i).trim(), value: part.slice(i + 1).trim() };
    })
    .filter((a) => a.name && a.value);
}

function Section({
  title,
  hint,
  error,
  children,
}: {
  title: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border bg-obsidian-900/70 p-5 ${error ? "border-neon-magenta/50" : "border-obsidian-700"}`}
    >
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
      {error && <p className="mt-2 text-sm text-neon-magenta">{error}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ProductEditor({
  product,
  categories,
}: {
  product: AdminProductDetail | null;
  categories: AdminCategoryRow[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => fromProduct(product, categories[0]?.id ?? ""));
  const [newImage, setNewImage] = useState("");
  const [renderType, setRenderType] = useState("laptop");
  const [renderAccent, setRenderAccent] = useState("22F3FF");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setVariant = (index: number, patch: Partial<VariantForm>) =>
    setForm((f) => ({ ...f, variants: f.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)) }));

  function moveImage(index: number, delta: number) {
    setForm((f) => {
      const images = [...f.images];
      const target = index + delta;
      if (target < 0 || target >= images.length) return f;
      [images[index], images[target]] = [images[target], images[index]];
      return { ...f, images };
    });
  }

  function addImage() {
    const url = newImage.trim();
    if (!url) return;
    if (!url.startsWith("/") && !url.startsWith("https://")) {
      setErrors((e) => ({ ...e, images: "Image links must start with https:// (or / for files on this site)." }));
      return;
    }
    set("images", [...form.images, url]);
    setNewImage("");
    setErrors((e) => ({ ...e, images: "" }));
  }

  function addRenders() {
    const urls = [0, 1, 2, 3].map((v) => `/media/render/${renderType}/${v}?accent=${renderAccent}`);
    set("images", [...form.images, ...urls]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setMessage(null);

    const payload = {
      name: form.name,
      slug: form.slug,
      brand: form.brand,
      categoryId: form.categoryId,
      shortDescription: form.shortDescription,
      description: form.description,
      images: form.images,
      specs: form.specs.filter((s) => s.key.trim() && s.value.trim()),
      variants: form.variants.map((v) => {
        const attributes = parseOptions(v.options);
        return {
          sku: v.sku,
          label: v.label.trim() || attributes.map((a) => a.value).join(" / ") || "Standard",
          attributes,
          price: v.price,
          compareAtPrice: v.compareAtPrice.trim() ? v.compareAtPrice : null,
          stock: v.stock || "0",
          imageIndex: v.imageIndex,
        };
      }),
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      featured: form.featured,
      active: form.active,
      supplierSku: form.supplierSku,
      costPrice: form.costPrice.trim() ? form.costPrice : null,
    };

    try {
      const saved = await apiFetch<AdminProductDetail>(
        product ? `/api/admin/products/${product.id}` : "/api/admin/products",
        {
          method: product ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );
      if (!product) {
        router.push(`/admin/products/${saved.id}?created=1`);
        return;
      }
      setForm(fromProduct(saved, form.categoryId));
      setMessage({ kind: "ok", text: "Changes saved. The shop shows them straight away." });
    } catch (err) {
      if (err instanceof ApiClientError) {
        const next: Record<string, string> = {};
        for (const [key, value] of Object.entries(err.fieldErrors)) {
          const root = key.split(".")[0];
          if (value?.[0]) next[root] = value[0];
        }
        setErrors(next);
        setMessage({ kind: "error", text: err.message });
      } else {
        setMessage({ kind: "error", text: "Could not save. Please try again." });
      }
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof FormState, label: string, input: ReactNode, hint?: string) => (
    <div>
      <label htmlFor={`pe-${String(key)}`} className="label">
        {label}
      </label>
      {input}
      {hint && !errors[key as string] && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
      {errors[key as string] && <p className="mt-1 text-xs text-neon-magenta">{errors[key as string]}</p>}
    </div>
  );

  const cost = Number(form.costPrice) || 0;

  return (
    <form onSubmit={submit} noValidate>
      <BackLink href="/admin/products" label="All products" />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">
            {product ? form.name || "Edit product" : "Add a product"}
          </h1>
          {product && (
            <p className="mt-1 font-mono text-xs text-ink-500">
              Source: {product.source} · /product/{product.slug}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {product && product.active && (
            <Link href={`/product/${product.slug}`} target="_blank" className="btn-ghost">
              <ExternalLink className="h-4 w-4" /> View in shop
            </Link>
          )}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {product ? "Save changes" : "Create product"}
          </button>
        </div>
      </div>

      {product?.source && product.source !== "manual" && (
        <p className="mb-4 rounded-xl border border-obsidian-600 bg-obsidian-900 p-3 text-xs text-ink-400">
          This product comes from the &ldquo;{product.source}&rdquo; supplier feed. Running a supplier sync will
          overwrite edits to its details, prices and images (stock counts set here are kept for price-list feeds).
        </p>
      )}

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`mb-4 flex items-center gap-2 rounded-xl border p-3 text-sm ${
            message.kind === "ok" ? "border-neon-lime/40 text-neon-lime" : "border-neon-magenta/40 text-neon-magenta"
          }`}
        >
          {message.kind === "ok" && <CheckCircle2 className="h-4 w-4" />}
          {message.text}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section title="Basics">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                {field(
                  "name",
                  "Product name",
                  <input
                    id="pe-name"
                    className="input"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                  />,
                )}
              </div>
              {field(
                "brand",
                "Brand",
                <input
                  id="pe-brand"
                  className="input"
                  value={form.brand}
                  onChange={(e) => set("brand", e.target.value)}
                />,
              )}
              {field(
                "categoryId",
                "Category",
                <select
                  id="pe-categoryId"
                  className="input"
                  value={form.categoryId}
                  onChange={(e) => set("categoryId", e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>,
              )}
              <div className="sm:col-span-2">
                {field(
                  "shortDescription",
                  "One-line summary",
                  <input
                    id="pe-shortDescription"
                    className="input"
                    value={form.shortDescription}
                    onChange={(e) => set("shortDescription", e.target.value)}
                    maxLength={240}
                  />,
                  "Shown under the product name and in search results.",
                )}
              </div>
              <div className="sm:col-span-2">
                {field(
                  "description",
                  "Full description",
                  <textarea
                    id="pe-description"
                    rows={6}
                    className="input resize-y"
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                  />,
                )}
              </div>
            </div>
          </Section>

          <Section
            title="Images"
            hint="The first image is the main picture. Paste https:// links to product photos (for example from your supplier or image host)."
            error={errors.images}
          >
            {form.images.length === 0 ? (
              <p className="rounded-xl border border-dashed border-obsidian-600 p-6 text-center text-sm text-ink-400">
                No images yet.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {form.images.map((url, i) => (
                  <li
                    key={`${url}-${i}`}
                    className="flex items-center gap-3 rounded-xl border border-obsidian-700 bg-obsidian-850 p-2"
                  >
                    <SafeImage src={url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-contain" />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[10px] uppercase text-ink-500">
                        {i === 0 ? "Main image" : `Image ${i + 1}`}
                      </p>
                      <p className="truncate font-mono text-xs text-ink-300" title={url}>
                        {url}
                      </p>
                    </div>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        className="p-1 text-ink-400 hover:text-neon-cyan disabled:opacity-30"
                        disabled={i === 0}
                        onClick={() => moveImage(i, -1)}
                        aria-label="Move image up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-1 text-ink-400 hover:text-neon-cyan disabled:opacity-30"
                        disabled={i === form.images.length - 1}
                        onClick={() => moveImage(i, 1)}
                        aria-label="Move image down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="p-1.5 text-ink-500 hover:text-neon-magenta"
                      onClick={() =>
                        set(
                          "images",
                          form.images.filter((_, j) => j !== i),
                        )
                      }
                      aria-label="Remove image"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                id="pe-new-image"
                className="input min-w-0 flex-1 py-2"
                placeholder="https://cdn.example.com/photo.jpg"
                value={newImage}
                onChange={(e) => setNewImage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addImage();
                  }
                }}
                aria-label="Image link"
              />
              <button type="button" className="btn-ghost py-2" onClick={addImage}>
                <ImagePlus className="h-4 w-4" /> Add image
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-400">
              <span>No photos yet? Add the 4 built-in placeholder renders:</span>
              <select
                id="pe-render-type"
                className="rounded-lg border border-obsidian-600 bg-obsidian-850 px-2 py-1"
                value={renderType}
                onChange={(e) => setRenderType(e.target.value)}
                aria-label="Render type"
              >
                {RENDER_TYPES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                id="pe-render-accent"
                className="rounded-lg border border-obsidian-600 bg-obsidian-850 px-2 py-1"
                value={renderAccent}
                onChange={(e) => setRenderAccent(e.target.value)}
                aria-label="Render colour"
              >
                {ACCENTS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
              <button type="button" className="chip" onClick={addRenders}>
                <Plus className="h-3 w-3" /> Add renders
              </button>
            </div>
          </Section>

          <Section
            title="Variants, prices and stock"
            hint='One row per option a customer can buy. Options use "Name: Value; Name: Value", e.g. "Memory: 16GB / 512GB; Color: Obsidian". Prices are in Naira (₦).'
            error={errors.variants}
          >
            <div className="space-y-4">
              {form.variants.map((v, i) => {
                const price = Number(v.price) || 0;
                const margin = cost > 0 && price > 0 ? Math.round(((price - cost) / price) * 100) : null;
                return (
                  <div key={i} className="rounded-xl border border-obsidian-700 bg-obsidian-850 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-mono text-[11px] uppercase tracking-widest text-ink-500">Variant {i + 1}</p>
                      <button
                        type="button"
                        className="text-xs text-ink-500 hover:text-neon-magenta disabled:opacity-30"
                        disabled={form.variants.length === 1}
                        onClick={() =>
                          set(
                            "variants",
                            form.variants.filter((_, j) => j !== i),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-6">
                      <div className="sm:col-span-2">
                        <label htmlFor={`v-sku-${i}`} className="label">
                          SKU
                        </label>
                        <input
                          id={`v-sku-${i}`}
                          className="input py-2 font-mono uppercase"
                          value={v.sku}
                          onChange={(e) => setVariant(i, { sku: e.target.value.toUpperCase() })}
                          placeholder="AF-PX15-16-512"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <label htmlFor={`v-options-${i}`} className="label">
                          Options
                        </label>
                        <input
                          id={`v-options-${i}`}
                          className="input py-2"
                          value={v.options}
                          onChange={(e) => setVariant(i, { options: e.target.value })}
                          placeholder="Memory: 16GB / 512GB; Color: Obsidian"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor={`v-label-${i}`} className="label">
                          Label (optional)
                        </label>
                        <input
                          id={`v-label-${i}`}
                          className="input py-2"
                          value={v.label}
                          onChange={(e) => setVariant(i, { label: e.target.value })}
                          placeholder="Built from options"
                        />
                      </div>
                      <div>
                        <label htmlFor={`v-price-${i}`} className="label">
                          Price ₦
                        </label>
                        <input
                          id={`v-price-${i}`}
                          inputMode="decimal"
                          className="input py-2 font-mono"
                          value={v.price}
                          onChange={(e) => setVariant(i, { price: e.target.value.replace(/[^0-9.]/g, "") })}
                        />
                      </div>
                      <div>
                        <label htmlFor={`v-compare-${i}`} className="label">
                          Was ₦
                        </label>
                        <input
                          id={`v-compare-${i}`}
                          inputMode="decimal"
                          className="input py-2 font-mono"
                          value={v.compareAtPrice}
                          onChange={(e) => setVariant(i, { compareAtPrice: e.target.value.replace(/[^0-9.]/g, "") })}
                          placeholder="optional"
                        />
                      </div>
                      <div>
                        <label htmlFor={`v-stock-${i}`} className="label">
                          Stock
                        </label>
                        <input
                          id={`v-stock-${i}`}
                          inputMode="numeric"
                          className="input py-2 font-mono"
                          value={v.stock}
                          onChange={(e) => setVariant(i, { stock: e.target.value.replace(/[^0-9]/g, "") })}
                        />
                      </div>
                      <div>
                        <label htmlFor={`v-image-${i}`} className="label">
                          Image
                        </label>
                        <select
                          id={`v-image-${i}`}
                          className="input py-2"
                          value={v.imageIndex}
                          onChange={(e) => setVariant(i, { imageIndex: Number(e.target.value) })}
                        >
                          {(form.images.length ? form.images : [""]).map((_, j) => (
                            <option key={j} value={j}>
                              #{j + 1}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {margin !== null && (
                      <p className={`mt-2 text-xs ${margin < 0 ? "text-neon-magenta" : "text-ink-500"}`}>
                        Margin over cost price: {margin}%
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className="btn-ghost mt-4 py-2"
              onClick={() =>
                set("variants", [
                  ...form.variants,
                  {
                    sku: "",
                    label: "",
                    options: "",
                    price: form.variants[0]?.price ?? "",
                    compareAtPrice: "",
                    stock: "0",
                    imageIndex: 0,
                  },
                ])
              }
            >
              <Plus className="h-4 w-4" /> Add variant
            </button>
          </Section>

          <Section
            title="Specifications"
            hint="Shown in the spec table and used for shop filters. Repeat a name for each value customers can choose, e.g. RAM: 16GB and RAM: 32GB."
            error={errors.specs}
          >
            <div className="space-y-2">
              {form.specs.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    id={`spec-key-${i}`}
                    className="input w-2/5 py-2"
                    value={s.key}
                    placeholder="Name, e.g. RAM"
                    onChange={(e) =>
                      set(
                        "specs",
                        form.specs.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)),
                      )
                    }
                    aria-label={`Specification ${i + 1} name`}
                  />
                  <input
                    id={`spec-value-${i}`}
                    className="input min-w-0 flex-1 py-2"
                    value={s.value}
                    placeholder="Value, e.g. 16GB"
                    onChange={(e) =>
                      set(
                        "specs",
                        form.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)),
                      )
                    }
                    aria-label={`Specification ${i + 1} value`}
                  />
                  <button
                    type="button"
                    className="p-2 text-ink-500 hover:text-neon-magenta"
                    onClick={() =>
                      set(
                        "specs",
                        form.specs.filter((_, j) => j !== i),
                      )
                    }
                    aria-label={`Remove specification ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn-ghost mt-3 py-2"
              onClick={() => set("specs", [...form.specs, { key: "", value: "" }])}
            >
              <Plus className="h-4 w-4" /> Add specification
            </button>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Visibility">
            <div className="space-y-3">
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-obsidian-700 bg-obsidian-850 px-3 py-3 text-sm">
                <span>
                  Visible in the shop
                  <span className="block text-xs text-ink-500">Hidden products keep their order history.</span>
                </span>
                <input
                  id="pe-active"
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => set("active", e.target.checked)}
                  className="h-4 w-4 accent-[#22F3FF]"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-obsidian-700 bg-obsidian-850 px-3 py-3 text-sm">
                <span>
                  Featured on the home page
                  <span className="block text-xs text-ink-500">Shown under &ldquo;Featured hardware&rdquo;.</span>
                </span>
                <input
                  id="pe-featured"
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => set("featured", e.target.checked)}
                  className="h-4 w-4 accent-[#22F3FF]"
                />
              </label>
            </div>
          </Section>

          <Section title="Search & links">
            <div className="space-y-4">
              {field(
                "tags",
                "Search tags",
                <input
                  id="pe-tags"
                  className="input"
                  value={form.tags}
                  onChange={(e) => set("tags", e.target.value)}
                  placeholder="gaming, laptop, creator"
                />,
                "Comma-separated words customers might search for.",
              )}
              {field(
                "slug",
                "Web address",
                <input
                  id="pe-slug"
                  className="input font-mono"
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  placeholder="made from the name"
                />,
                "The part after /product/. Leave empty to create it from the name.",
              )}
            </div>
          </Section>

          <Section title="Supplier & cost" hint="Private — never shown to customers.">
            <div className="space-y-4">
              {field(
                "supplierSku",
                "Supplier SKU",
                <input
                  id="pe-supplierSku"
                  className="input font-mono"
                  value={form.supplierSku}
                  onChange={(e) => set("supplierSku", e.target.value)}
                />,
              )}
              {field(
                "costPrice",
                "Cost price ₦ (what you pay)",
                <input
                  id="pe-costPrice"
                  inputMode="decimal"
                  className="input font-mono"
                  value={form.costPrice}
                  onChange={(e) => set("costPrice", e.target.value.replace(/[^0-9.]/g, ""))}
                />,
                "Used to show your margin on each variant.",
              )}
            </div>
          </Section>

          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {product ? "Save changes" : "Create product"}
          </button>
        </div>
      </div>
    </form>
  );
}

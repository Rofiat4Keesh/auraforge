"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, Minus, Plus, ShieldCheck, ShoppingBag, Star, Truck, Zap } from "lucide-react";
import { useCart } from "@/components/providers/CartProvider";
import { formatMoney } from "@/lib/money";
import type { ProductDetailDTO, VariantDTO } from "@/types";
import { ProductGallery } from "./ProductGallery";

function attributesOf(variant: VariantDTO): Record<string, string> {
  return Object.fromEntries(variant.attributes.map((a) => [a.name, a.value]));
}

function matches(variant: VariantDTO, wanted: Record<string, string>): boolean {
  const attrs = attributesOf(variant);
  return Object.entries(wanted).every(([name, value]) => attrs[name] === value);
}

/** Gallery + variant selectors + quantity + add-to-cart for the product detail page. */
export function ProductPurchase({ product }: { product: ProductDetailDTO }) {
  const router = useRouter();
  const { addItem, isAdding } = useCart();

  const initialVariant = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const [selected, setSelected] = useState<Record<string, string>>(attributesOf(initialVariant));
  const [imageIndex, setImageIndex] = useState(initialVariant.imageIndex);
  const [quantity, setQuantity] = useState(1);
  const [buying, setBuying] = useState(false);

  // Attribute groups in the order they first appear, e.g. { Memory: [...], Color: [...] }
  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const variant of product.variants) {
      for (const attr of variant.attributes) {
        const values = map.get(attr.name) ?? [];
        if (!values.includes(attr.value)) values.push(attr.value);
        map.set(attr.name, values);
      }
    }
    return [...map.entries()].map(([name, values]) => ({ name, values }));
  }, [product.variants]);

  const variant = product.variants.find((v) => matches(v, selected)) ?? initialVariant;
  const maxQty = Math.min(variant.stock, 20);
  const inStock = variant.stock > 0;
  const discount =
    variant.compareAtPrice && variant.compareAtPrice > variant.price
      ? Math.round(((variant.compareAtPrice - variant.price) / variant.compareAtPrice) * 100)
      : 0;

  function choose(name: string, value: string) {
    const wanted = { ...selected, [name]: value };
    const exact = product.variants.find((v) => matches(v, wanted));
    const fallback = product.variants.find((v) => attributesOf(v)[name] === value);
    const next = exact ?? fallback;
    if (!next) return;
    setSelected(attributesOf(next));
    setImageIndex(next.imageIndex);
    setQuantity(1);
  }

  function optionState(name: string, value: string): "available" | "soldout" | "unavailable" {
    const candidate = product.variants.find((v) => matches(v, { ...selected, [name]: value }));
    if (!candidate) return "unavailable";
    return candidate.stock > 0 ? "available" : "soldout";
  }

  async function handleAdd() {
    await addItem(product.id, variant.sku, quantity);
  }

  async function handleBuyNow() {
    setBuying(true);
    const added = await addItem(product.id, variant.sku, quantity, { openDrawer: false });
    if (added) router.push("/checkout");
    else setBuying(false);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <ProductGallery
        images={product.images}
        name={product.name}
        activeIndex={imageIndex}
        onChange={setImageIndex}
        categorySlug={product.categorySlug}
      />

      <div>
        <p className="eyebrow">
          {product.brand} · {product.categoryName}
        </p>
        <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{product.name}</h1>
        {product.reviewCount > 0 && (
          <p className="mt-3 flex items-center gap-2 text-sm text-ink-400">
            <span className="flex items-center gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < Math.round(product.rating) ? "fill-neon-lime text-neon-lime" : "text-obsidian-500"}`}
                />
              ))}
            </span>
            {product.rating.toFixed(1)} · {product.reviewCount} reviews
          </p>
        )}
        <p className="mt-4 text-ink-300">{product.shortDescription}</p>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <span className="font-mono text-3xl font-bold text-neon-cyan">{formatMoney(variant.price)}</span>
          {discount > 0 && variant.compareAtPrice && (
            <>
              <span className="pb-1 font-mono text-base text-ink-500 line-through">
                {formatMoney(variant.compareAtPrice)}
              </span>
              <span className="mb-1 rounded-md bg-neon-magenta px-2 py-0.5 font-mono text-xs font-bold text-white">
                Save {discount}%
              </span>
            </>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-500">VAT inclusive · Pay in Naira via card, bank transfer or USSD</p>

        <div className="divider my-6" />

        {groups.map((group) => (
          <fieldset key={group.name} className="mb-5">
            <legend className="label">
              {group.name}: <span className="normal-case tracking-normal text-ink-100">{selected[group.name]}</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {group.values.map((value) => {
                const state = optionState(group.name, value);
                const active = selected[group.name] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => choose(group.name, value)}
                    aria-pressed={active}
                    className={`relative rounded-xl border px-4 py-2.5 text-sm transition ${
                      active
                        ? "border-neon-cyan bg-neon-cyan/10 text-neon-cyan shadow-neon"
                        : state === "available"
                          ? "border-obsidian-600 text-ink-300 hover:border-neon-cyan/50 hover:text-ink-100"
                          : "border-obsidian-700 text-ink-500"
                    } ${state === "soldout" && !active ? "line-through" : ""} ${state === "unavailable" && !active ? "border-dashed" : ""}`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <p className={`mb-5 flex items-center gap-2 text-sm ${inStock ? "text-neon-lime" : "text-neon-magenta"}`}>
          <span className={`h-2 w-2 rounded-full ${inStock ? "bg-neon-lime" : "bg-neon-magenta"}`} />
          {inStock
            ? variant.stock <= 5
              ? `Only ${variant.stock} left in stock`
              : "In stock — ready to ship"
            : "Out of stock in this option"}
          <span className="ml-auto font-mono text-[11px] text-ink-500">SKU {variant.sku}</span>
        </p>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center rounded-xl border border-obsidian-600 bg-obsidian-850">
            <button
              type="button"
              className="p-3 text-ink-300 hover:text-neon-cyan disabled:opacity-30"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1 || !inStock}
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center font-mono" aria-live="polite" aria-label="Quantity">
              {quantity}
            </span>
            <button
              type="button"
              className="p-3 text-ink-300 hover:text-neon-cyan disabled:opacity-30"
              onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              disabled={quantity >= maxQty || !inStock}
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button type="button" onClick={handleAdd} disabled={!inStock || isAdding} className="btn-primary flex-1">
            {isAdding && !buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
            Add to cart
          </button>
          <button
            type="button"
            onClick={handleBuyNow}
            disabled={!inStock || isAdding}
            className="btn-violet w-full sm:w-auto"
          >
            {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Buy now
          </button>
        </div>

        <ul className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Truck, title: "Nationwide delivery", text: "Lagos 1–2 days · others 2–5 days" },
            { icon: ShieldCheck, title: "Secure payment", text: "Processed by Paystack" },
            {
              icon: BadgeCheck,
              title: "Warranty",
              text: product.specs.find((s) => s.key === "Warranty")?.value ?? "Ask us for details",
            },
          ].map((item) => (
            <li key={item.title} className="rounded-xl border border-obsidian-700 bg-obsidian-900/60 p-3">
              <item.icon className="h-4 w-4 text-neon-cyan" />
              <p className="mt-2 text-xs font-semibold">{item.title}</p>
              <p className="text-[11px] text-ink-500">{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

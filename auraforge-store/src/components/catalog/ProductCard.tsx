import Link from "next/link";
import { ArrowUpRight, Star } from "lucide-react";
import { formatMoney } from "@/lib/money";
import type { ProductCardDTO } from "@/types";
import { SafeImage } from "@/components/ui/SafeImage";
import { fallbackImageFor } from "@/lib/fallback-image";

export function ProductCard({ product }: { product: ProductCardDTO }) {
  const discount =
    product.compareAtPrice && product.compareAtPrice > product.minPrice
      ? Math.round(((product.compareAtPrice - product.minPrice) / product.compareAtPrice) * 100)
      : 0;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-obsidian-700 bg-obsidian-900/70 transition duration-300 hover:-translate-y-1 hover:border-neon-cyan/50 hover:shadow-neon"
    >
      <div className="relative aspect-square overflow-hidden bg-obsidian-850">
        <SafeImage
          src={product.image}
          fallbackSrc={fallbackImageFor(product.categorySlug)}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-contain transition duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {discount > 0 && (
            <span className="rounded-md bg-neon-magenta px-2 py-0.5 font-mono text-[10px] font-bold text-white">
              -{discount}%
            </span>
          )}
          {!product.inStock && (
            <span className="rounded-md bg-obsidian-700 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-ink-300">
              Sold out
            </span>
          )}
        </div>
        <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-obsidian-600 bg-obsidian-950/70 text-ink-300 opacity-0 transition group-hover:opacity-100 group-hover:text-neon-cyan">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          {product.brand} · {product.categoryName}
        </p>
        <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-ink-100 group-hover:text-neon-cyan">
          {product.name}
        </h3>
        {product.reviewCount > 0 && (
          <p className="mt-2 flex items-center gap-1 text-xs text-ink-400">
            <Star className="h-3.5 w-3.5 fill-neon-lime text-neon-lime" />
            <span className="text-ink-300">{product.rating.toFixed(1)}</span>
            <span>({product.reviewCount})</span>
          </p>
        )}
        <div className="mt-auto flex items-end gap-2 pt-3">
          <span className="font-mono text-base font-bold text-ink-100">
            {product.maxPrice > product.minPrice && (
              <span className="mr-1 text-[10px] font-normal text-ink-500">from</span>
            )}
            {formatMoney(product.minPrice)}
          </span>
          {discount > 0 && product.compareAtPrice && (
            <span className="pb-0.5 font-mono text-xs text-ink-500 line-through">
              {formatMoney(product.compareAtPrice)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

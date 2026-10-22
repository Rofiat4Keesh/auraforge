import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductPurchase } from "@/components/product/ProductPurchase";
import { getProductBySlug, getRelatedProducts } from "@/server/services/catalog.service";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description: `${product.shortDescription} From ${formatMoney(product.minPrice)}.`,
    openGraph: { title: product.name, description: product.shortDescription, images: [product.images[0]] },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const related = await getRelatedProducts(product);

  // Group repeated spec keys: RAM: 16GB, 32GB
  const specRows = Object.entries(
    product.specs.reduce<Record<string, string[]>>((acc, spec) => {
      acc[spec.key] = [...(acc[spec.key] ?? []), spec.value];
      return acc;
    }, {}),
  );

  return (
    <div className="container-x py-8">
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1 text-xs text-ink-500">
        <Link href="/" className="hover:text-neon-cyan">
          Home
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/shop" className="hover:text-neon-cyan">
          Shop
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/shop?category=${product.categorySlug}`} className="hover:text-neon-cyan">
          {product.categoryName}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-ink-300">{product.name}</span>
      </nav>

      <ProductPurchase key={product.id} product={product} />

      <div className="mt-16 grid gap-8 lg:grid-cols-5">
        <section className="panel p-6 lg:col-span-3">
          <h2 className="eyebrow">Overview</h2>
          <p className="mt-4 whitespace-pre-line leading-relaxed text-ink-300">{product.description}</p>
        </section>
        <section className="panel p-6 lg:col-span-2">
          <h2 className="eyebrow">Specifications</h2>
          <dl className="mt-4 divide-y divide-obsidian-800 text-sm">
            {specRows.map(([key, values]) => (
              <div key={key} className="flex justify-between gap-4 py-2.5">
                <dt className="text-ink-500">{key}</dt>
                <dd className="text-right font-mono text-ink-100">{values.join(" / ")}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <p className="eyebrow">Compatible picks</p>
          <h2 className="mb-6 mt-2 text-2xl font-bold">You may also like</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

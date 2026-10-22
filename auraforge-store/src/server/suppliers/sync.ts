import type { PrismaClient } from "@prisma/client";
import type { NormalizedProduct, ProductSource } from "./types";

export interface SyncReport {
  source: string;
  categories: number;
  created: number;
  updated: number;
  deactivated: number;
  skipped: { externalId: string; reason: string }[];
}

function denormalise(product: NormalizedProduct) {
  const prices = product.variants.map((v) => v.price);
  return {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    totalStock: product.variants.reduce((sum, v) => sum + Math.max(0, v.stock), 0),
  };
}

/**
 * Pulls categories + products from a ProductSource and upserts them into MongoDB.
 * Products that disappeared from the supplier feed are deactivated (not deleted),
 * so old orders keep pointing at valid product records.
 */
export async function syncFromSource(prisma: PrismaClient, source: ProductSource): Promise<SyncReport> {
  const report: SyncReport = { source: source.id, categories: 0, created: 0, updated: 0, deactivated: 0, skipped: [] };

  const categories = await source.fetchCategories();
  const categoryIdBySlug = new Map<string, string>();
  for (const category of categories) {
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      create: category,
      update: { name: category.name, description: category.description, sortOrder: category.sortOrder },
    });
    categoryIdBySlug.set(category.slug, saved.id);
    report.categories += 1;
  }

  const products = await source.fetchProducts();
  const seenExternalIds: string[] = [];
  const now = new Date();

  for (const product of products) {
    const categoryId = categoryIdBySlug.get(product.categorySlug);
    if (!categoryId) {
      report.skipped.push({ externalId: product.externalId, reason: `Unknown category "${product.categorySlug}"` });
      continue;
    }
    if (product.variants.length === 0) {
      report.skipped.push({ externalId: product.externalId, reason: "No variants" });
      continue;
    }

    const data = {
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      shortDescription: product.shortDescription,
      description: product.description,
      images: product.images,
      specs: product.specs,
      variants: product.variants.map((v) => ({
        sku: v.sku,
        label: v.label,
        attributes: v.attributes,
        price: v.price,
        compareAtPrice: v.compareAtPrice ?? null,
        stock: v.stock,
        imageIndex: v.imageIndex,
      })),
      tags: product.tags,
      rating: product.rating,
      reviewCount: product.reviewCount,
      featured: product.featured,
      active: true,
      supplierSku: product.supplierSku ?? null,
      costPrice: product.costPrice ?? null,
      lastSyncedAt: now,
      categoryId,
      ...denormalise(product),
    };

    const existing = await prisma.product.findUnique({
      where: { source_externalId: { source: source.id, externalId: product.externalId } },
      select: { id: true, variants: true },
    });

    if (existing) {
      // Feeds without real stock counts (stockIsEstimate) must not undo sales or the quantities
      // you set in the admin: keep the current stock, except when the feed says "out of stock".
      const variants = data.variants.map((v, i) => {
        const current = existing.variants.find((ev) => ev.sku === v.sku);
        const estimate = product.variants[i]?.stockIsEstimate;
        return current && estimate && v.stock > 0 ? { ...v, stock: current.stock } : v;
      });
      // "featured" is only taken from the feed when a product is first created, so
      // choices made in Admin → Products survive later syncs.
      const { featured: _featured, ...rest } = data;
      void _featured;
      await prisma.product.update({
        where: { id: existing.id },
        data: { ...rest, variants, totalStock: variants.reduce((sum, v) => sum + Math.max(0, v.stock), 0) },
      });
      report.updated += 1;
    } else {
      const slugTaken = await prisma.product.findUnique({ where: { slug: product.slug }, select: { id: true } });
      await prisma.product.create({
        data: {
          ...data,
          slug: slugTaken
            ? `${product.slug}-${product.externalId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
            : product.slug,
          source: source.id,
          externalId: product.externalId,
        },
      });
      report.created += 1;
    }
    seenExternalIds.push(product.externalId);
  }

  const deactivated = await prisma.product.updateMany({
    where: { source: source.id, externalId: { notIn: seenExternalIds }, active: true },
    data: { active: false },
  });
  report.deactivated = deactivated.count;

  // Once a real supplier feed is in use, hide the built-in demo products so they don't
  // mix with real stock. (They are hidden, not deleted, and come back if you sync "mock" again.)
  if (source.id !== "mock") {
    const demo = await prisma.product.updateMany({ where: { source: "mock", active: true }, data: { active: false } });
    report.deactivated += demo.count;
  }

  return report;
}

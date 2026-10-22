import type { Category, Prisma, Product } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BASE_CURRENCY, DISPLAY_CURRENCY, convertMinor, toMinor } from "@/lib/money";
import type { CatalogFacets, CatalogResult, CategoryDTO, FacetValue, ProductCardDTO, ProductDetailDTO } from "@/types";

export const SORT_OPTIONS = ["featured", "price-asc", "price-desc", "newest", "rating"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export interface CatalogQuery {
  q?: string;
  category?: string;
  brands: string[];
  minPrice?: number; // major units of the DISPLAY currency, as typed by the shopper (₦ by default)
  maxPrice?: number;
  specs: Record<string, string[]>;
  inStock: boolean;
  sort: SortOption;
  page: number;
  pageSize: number;
}

/**
 * Converts URL parameters into a typed query.
 * URL format: /shop?q=phone&category=laptops-computers&brand=Nexon&brand=Voltrix
 *             &min=100000&max=900000&spec.RAM=16GB&spec.RAM=32GB&inStock=1&sort=price-asc&page=2
 */
export function parseCatalogQuery(params: URLSearchParams): CatalogQuery {
  const num = (value: string | null) => {
    if (value === null || value.trim() === "") return undefined;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  const specs: Record<string, string[]> = {};
  params.forEach((value, key) => {
    if (key.startsWith("spec.") && value) {
      const specKey = key.slice(5);
      specs[specKey] = [...(specs[specKey] ?? []), value];
    }
  });

  const sortParam = params.get("sort") as SortOption | null;
  const page = Math.max(1, Math.floor(num(params.get("page")) ?? 1));
  const pageSize = Math.min(48, Math.max(1, Math.floor(num(params.get("pageSize")) ?? 12)));

  return {
    q: params.get("q")?.trim().slice(0, 80) || undefined,
    category: params.get("category")?.trim() || undefined,
    brands: params.getAll("brand").filter(Boolean),
    minPrice: num(params.get("min")),
    maxPrice: num(params.get("max")),
    specs,
    inStock: params.get("inStock") === "1",
    sort: sortParam && SORT_OPTIONS.includes(sortParam) ? sortParam : "featured",
    page,
    pageSize,
  };
}

/** Helper for server components, which receive searchParams as a plain object. */
export function searchParamsToURLSearchParams(input: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else if (typeof value === "string") params.append(key, value);
  }
  return params;
}

type ProductWithCategory = Product & { category: Category };

function cheapestVariant(product: Product) {
  return [...product.variants].sort((a, b) => a.price - b.price)[0];
}

export function toProductCard(product: ProductWithCategory): ProductCardDTO {
  const cheapest = cheapestVariant(product);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    shortDescription: product.shortDescription,
    image: product.images[0] ?? "/media/render/software/0?accent=22F3FF",
    minPrice: product.minPrice,
    maxPrice: product.maxPrice,
    compareAtPrice: cheapest?.compareAtPrice ?? null,
    rating: product.rating,
    reviewCount: product.reviewCount,
    inStock: product.totalStock > 0,
    featured: product.featured,
    categorySlug: product.category.slug,
    categoryName: product.category.name,
  };
}

export function toProductDetail(product: ProductWithCategory): ProductDetailDTO {
  return {
    ...toProductCard(product),
    description: product.description,
    images: product.images,
    specs: product.specs.map((s) => ({ key: s.key, value: s.value })),
    variants: product.variants.map((v) => ({
      sku: v.sku,
      label: v.label,
      attributes: v.attributes.map((a) => ({ name: a.name, value: a.value })),
      price: v.price,
      compareAtPrice: v.compareAtPrice ?? null,
      stock: v.stock,
      imageIndex: v.imageIndex,
    })),
    tags: product.tags,
  };
}

async function resolveCategoryId(slug?: string): Promise<string | null | undefined> {
  if (!slug) return undefined;
  const category = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  return category ? category.id : null; // null = unknown category -> no results
}

function baseWhere(query: CatalogQuery, categoryId: string | null | undefined): Prisma.ProductWhereInput[] {
  const and: Prisma.ProductWhereInput[] = [{ active: true }];
  if (categoryId === null) and.push({ id: { in: [] } });
  if (categoryId) and.push({ categoryId });
  if (query.q) {
    const term = query.q;
    and.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { brand: { contains: term, mode: "insensitive" } },
        { shortDescription: { contains: term, mode: "insensitive" } },
        { tags: { has: term.toLowerCase() } },
      ],
    });
  }
  return and;
}

/** Shopper-typed price (display currency, major units) -> stored price (base currency, minor units). */
function priceToBaseMinor(major: number): number {
  return convertMinor(toMinor(major, DISPLAY_CURRENCY), DISPLAY_CURRENCY, BASE_CURRENCY);
}

function refinementWhere(query: CatalogQuery): Prisma.ProductWhereInput[] {
  const and: Prisma.ProductWhereInput[] = [];
  if (query.brands.length > 0) and.push({ brand: { in: query.brands } });
  // Price overlap: a product matches if any of its variants falls within the range.
  if (query.minPrice !== undefined) and.push({ maxPrice: { gte: priceToBaseMinor(query.minPrice) } });
  if (query.maxPrice !== undefined) and.push({ minPrice: { lte: priceToBaseMinor(query.maxPrice) } });
  for (const [key, values] of Object.entries(query.specs)) {
    if (values.length > 0) and.push({ specs: { some: { key, value: { in: values } } } });
  }
  if (query.inStock) and.push({ totalStock: { gt: 0 } });
  return and;
}

function orderBy(sort: SortOption): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price-asc":
      return [{ minPrice: "asc" }];
    case "price-desc":
      return [{ minPrice: "desc" }];
    case "newest":
      return [{ createdAt: "desc" }];
    case "rating":
      return [{ rating: "desc" }, { reviewCount: "desc" }];
    case "featured":
    default:
      return [{ featured: "desc" }, { rating: "desc" }, { name: "asc" }];
  }
}

const SPEC_FACET_EXCLUDE = new Set(["Warranty", "Delivery", "Outputs", "Ports"]);

function countValues(values: string[]): FacetValue[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
}

async function buildFacets(where: Prisma.ProductWhereInput): Promise<CatalogFacets> {
  const rows = await prisma.product.findMany({
    where,
    select: { brand: true, specs: true, minPrice: true, maxPrice: true },
  });

  const specValues = new Map<string, string[]>();
  for (const row of rows) {
    const perProduct = new Map<string, Set<string>>();
    for (const spec of row.specs) {
      if (SPEC_FACET_EXCLUDE.has(spec.key)) continue;
      if (!perProduct.has(spec.key)) perProduct.set(spec.key, new Set());
      perProduct.get(spec.key)!.add(spec.value);
    }
    for (const [key, set] of perProduct) {
      specValues.set(key, [...(specValues.get(key) ?? []), ...set]);
    }
  }

  const specs = [...specValues.entries()]
    .map(([key, values]) => ({ key, values: countValues(values) }))
    .filter((facet) => facet.values.length >= 2)
    .sort((a, b) => b.values.reduce((s, v) => s + v.count, 0) - a.values.reduce((s, v) => s + v.count, 0))
    .slice(0, 8);

  return {
    brands: countValues(rows.map((r) => r.brand)),
    specs,
    priceRange: {
      min: rows.length ? Math.min(...rows.map((r) => r.minPrice)) : 0,
      max: rows.length ? Math.max(...rows.map((r) => r.maxPrice)) : 0,
    },
  };
}

export async function listProducts(query: CatalogQuery): Promise<CatalogResult> {
  const categoryId = await resolveCategoryId(query.category);
  const base = baseWhere(query, categoryId);
  const where: Prisma.ProductWhereInput = { AND: [...base, ...refinementWhere(query)] };

  const [total, rows, facets] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: orderBy(query.sort),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    // Facets use only search + category, so shoppers can still see every option to refine by.
    buildFacets({ AND: base }),
  ]);

  return {
    products: rows.map(toProductCard),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    facets,
  };
}

export async function getProductBySlug(slug: string): Promise<ProductDetailDTO | null> {
  const product = await prisma.product.findFirst({ where: { slug, active: true }, include: { category: true } });
  return product ? toProductDetail(product) : null;
}

export async function getRelatedProducts(product: ProductDetailDTO, limit = 4): Promise<ProductCardDTO[]> {
  const rows = await prisma.product.findMany({
    where: { active: true, category: { is: { slug: product.categorySlug } }, id: { not: product.id } },
    include: { category: true },
    orderBy: [{ rating: "desc" }],
    take: limit,
  });
  return rows.map(toProductCard);
}

/**
 * Products for the home page "Featured" row: items marked Featured in the admin first,
 * then topped up with other in-stock products (highest price first) so the row is never empty.
 */
export async function getFeaturedProducts(limit = 8): Promise<ProductCardDTO[]> {
  const featured = await prisma.product.findMany({
    where: { active: true, featured: true },
    include: { category: true },
    orderBy: [{ rating: "desc" }, { minPrice: "desc" }],
    take: limit,
  });
  if (featured.length >= limit) return featured.map(toProductCard);

  const fill = await prisma.product.findMany({
    where: { active: true, featured: false, totalStock: { gt: 0 } },
    include: { category: true },
    orderBy: [{ minPrice: "desc" }],
    take: limit - featured.length,
  });
  return [...featured, ...fill].map(toProductCard);
}

export async function listCategories(): Promise<CategoryDTO[]> {
  const [categories, counts] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.product.groupBy({ by: ["categoryId"], where: { active: true }, _count: { _all: true } }),
  ]);
  const countById = new Map(counts.map((c) => [c.categoryId, c._count._all]));
  // Only categories that have products in the shop — no empty tiles, filters or footer links.
  return categories
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      productCount: countById.get(c.id) ?? 0,
    }))
    .filter((c) => c.productCount > 0);
}

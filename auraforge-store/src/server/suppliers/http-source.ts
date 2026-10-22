import type { NormalizedCategory, NormalizedProduct, NormalizedVariant, ProductSource } from "./types";

/**
 * Generic wholesale-supplier adapter.
 *
 * It expects the supplier API to expose:
 *   GET {SUPPLIER_API_URL}/categories          -> SupplierCategoryDTO[]
 *   GET {SUPPLIER_API_URL}/products?page=1     -> { items: SupplierProductDTO[], nextPage: number | null }
 * authenticated with "Authorization: Bearer {SUPPLIER_API_KEY}".
 *
 * If your supplier's JSON looks different, only edit the DTO interfaces and the two
 * map*() functions below — nothing else in the application needs to change.
 */

interface SupplierCategoryDTO {
  code: string;
  name: string;
  description?: string;
  position?: number;
}

interface SupplierVariantDTO {
  sku: string;
  name: string;
  options?: Record<string, string>;
  cost_price_ngn: number; // supplier cost in Naira (major units)
  rrp_ngn?: number | null; // supplier recommended retail price in Naira
  stock: number;
  image_index?: number;
}

interface SupplierProductDTO {
  id: string | number;
  sku?: string;
  name: string;
  brand: string;
  category_code: string;
  summary?: string;
  description?: string;
  images: string[];
  specs?: Record<string, string | string[]>;
  variants: SupplierVariantDTO[];
  tags?: string[];
  rating?: number;
  reviews?: number;
  featured?: boolean;
}

interface SupplierProductPage {
  items: SupplierProductDTO[];
  nextPage: number | null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export class HttpSupplierSource implements ProductSource {
  readonly id: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly markup: number;

  constructor(options?: { id?: string; baseUrl?: string; apiKey?: string; markupPercent?: number }) {
    this.id = options?.id ?? "http";
    this.baseUrl = (options?.baseUrl ?? process.env.SUPPLIER_API_URL ?? "").replace(/\/+$/, "");
    this.apiKey = options?.apiKey ?? process.env.SUPPLIER_API_KEY ?? "";
    this.markup = (options?.markupPercent ?? Number(process.env.SUPPLIER_MARKUP_PERCENT || "18")) / 100;
    if (!this.baseUrl) {
      throw new Error("SUPPLIER_API_URL is empty. Set it in .env or use SUPPLIER_SOURCE=mock.");
    }
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Accept: "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Supplier API ${path} responded with HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }

  /** Retail price = cost + markup, rounded up to the nearest ₦100, returned in kobo. */
  private retailKobo(costNaira: number, rrpNaira?: number | null): number {
    const withMarkup = costNaira * (1 + this.markup);
    const retail = rrpNaira && rrpNaira > withMarkup ? rrpNaira : withMarkup;
    return Math.ceil(retail / 100) * 100 * 100;
  }

  private mapCategory(dto: SupplierCategoryDTO, index: number): NormalizedCategory {
    return {
      slug: slugify(dto.code),
      name: dto.name,
      description: dto.description ?? dto.name,
      sortOrder: dto.position ?? index + 1,
    };
  }

  private mapProduct(dto: SupplierProductDTO): NormalizedProduct {
    const variants: NormalizedVariant[] = dto.variants.map((v) => {
      const price = this.retailKobo(v.cost_price_ngn, v.rrp_ngn);
      const rrpKobo = v.rrp_ngn ? Math.round(v.rrp_ngn * 100) : null;
      return {
        sku: v.sku,
        label: v.name,
        attributes: Object.entries(v.options ?? {}).map(([name, value]) => ({ name, value: String(value) })),
        price,
        compareAtPrice: rrpKobo && rrpKobo > price ? rrpKobo : null,
        stock: Math.max(0, Math.floor(v.stock)),
        imageIndex: v.image_index ?? 0,
      };
    });

    const specs = Object.entries(dto.specs ?? {}).flatMap(([key, value]) =>
      (Array.isArray(value) ? value : [value]).map((item) => ({ key, value: String(item) })),
    );

    const cheapest = dto.variants.reduce(
      (min, v) => (v.cost_price_ngn < min ? v.cost_price_ngn : min),
      Number.POSITIVE_INFINITY,
    );

    return {
      externalId: String(dto.id),
      supplierSku: dto.sku ?? null,
      slug: slugify(`${dto.brand}-${dto.name}`),
      name: dto.name,
      brand: dto.brand,
      categorySlug: slugify(dto.category_code),
      shortDescription: dto.summary ?? dto.name,
      description: dto.description ?? dto.summary ?? dto.name,
      images: dto.images.length > 0 ? dto.images : ["/media/render/software/0?accent=22F3FF"],
      specs,
      variants,
      tags: dto.tags ?? [],
      rating: dto.rating ?? 0,
      reviewCount: dto.reviews ?? 0,
      featured: dto.featured ?? false,
      costPrice: Number.isFinite(cheapest) ? Math.round(cheapest * 100) : null,
    };
  }

  async fetchCategories(): Promise<NormalizedCategory[]> {
    const list = await this.get<SupplierCategoryDTO[]>("/categories");
    return list.map((dto, index) => this.mapCategory(dto, index));
  }

  async fetchProducts(): Promise<NormalizedProduct[]> {
    const results: NormalizedProduct[] = [];
    let page: number | null = 1;
    let safety = 0;
    while (page !== null && safety < 500) {
      const data: SupplierProductPage = await this.get<SupplierProductPage>(`/products?page=${page}`);
      for (const item of data.items) {
        if (item.variants && item.variants.length > 0) results.push(this.mapProduct(item));
      }
      page = data.nextPage;
      safety += 1;
    }
    return results;
  }
}

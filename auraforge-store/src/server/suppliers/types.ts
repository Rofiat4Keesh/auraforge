/**
 * RESELLER / SUPPLIER ABSTRACTION
 *
 * Every product source (the built-in mock catalog, or a real wholesale supplier API)
 * must return data in these normalised shapes. The sync job (sync.ts) then writes them
 * into MongoDB. The storefront only ever reads from MongoDB, so switching suppliers
 * never requires touching the UI or the API routes.
 *
 * All money values are integers in kobo (NGN minor units).
 */

export interface NormalizedCategory {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
}

export interface NormalizedVariant {
  sku: string;
  label: string;
  attributes: { name: string; value: string }[];
  price: number; // kobo — retail price we sell at
  compareAtPrice?: number | null; // kobo
  stock: number;
  imageIndex: number;
  /** True when the feed only knows in/out of stock (no real count). Sync then keeps your current quantity. */
  stockIsEstimate?: boolean;
}

export interface NormalizedProduct {
  externalId: string;
  supplierSku?: string | null;
  slug: string;
  name: string;
  brand: string;
  categorySlug: string;
  shortDescription: string;
  description: string;
  images: string[];
  specs: { key: string; value: string }[];
  variants: NormalizedVariant[];
  tags: string[];
  rating: number;
  reviewCount: number;
  featured: boolean;
  costPrice?: number | null; // kobo — what we pay the supplier
}

export interface ProductSource {
  /** Stored on each product as `source`, e.g. "mock" or "acme-wholesale". */
  readonly id: string;
  fetchCategories(): Promise<NormalizedCategory[]>;
  fetchProducts(): Promise<NormalizedProduct[]>;
}

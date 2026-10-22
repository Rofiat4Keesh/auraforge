import { HttpSupplierSource } from "./http-source";
import { JsonCatalogSource } from "./json-source";
import { MockProductSource } from "./mock-source";
import type { ProductSource } from "./types";

/**
 * Picks the product source from SUPPLIER_SOURCE in .env:
 *   "technocrat" (default) — src/data/products.json
 *   "http"                 — a live wholesale supplier API (see http-source.ts)
 *   "mock"                 — the original demo catalog
 * To add another supplier, create a class implementing ProductSource and add a case here.
 */
export function getProductSource(): ProductSource {
  const source = (process.env.SUPPLIER_SOURCE || "technocrat").toLowerCase();
  switch (source) {
    case "http":
      return new HttpSupplierSource();
    case "technocrat":
    case "json":
      return new JsonCatalogSource();
    case "mock":
    default:
      return new MockProductSource();
  }
}

export type { ProductSource, NormalizedProduct, NormalizedCategory, NormalizedVariant } from "./types";

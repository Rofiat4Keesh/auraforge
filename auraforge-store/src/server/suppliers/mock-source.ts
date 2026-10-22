import { mockCategories, mockProducts } from "./mock-catalog";
import type { NormalizedCategory, NormalizedProduct, ProductSource } from "./types";

/** Serves the built-in demo catalog through the same interface a real supplier uses. */
export class MockProductSource implements ProductSource {
  readonly id = "mock";

  async fetchCategories(): Promise<NormalizedCategory[]> {
    return mockCategories;
  }

  async fetchProducts(): Promise<NormalizedProduct[]> {
    return mockProducts;
  }
}

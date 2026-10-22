import type { NextRequest } from "next/server";
import { handle, HttpError, ok } from "@/lib/http";
import {
  getProductBySlug,
  getRelatedProducts,
  listCategories,
  listProducts,
  parseCatalogQuery,
} from "@/server/services/catalog.service";

/** GET /api/products — catalog listing with search, category, brand, price and spec filters. */
export const listProductsController = handle(async (req: NextRequest) => {
  const query = parseCatalogQuery(req.nextUrl.searchParams);
  const result = await listProducts(query);
  return ok(result);
});

/** GET /api/products/:slug — full product detail plus related items. */
export const getProductController = handle(
  async (_req: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    const { slug } = await context.params;
    const product = await getProductBySlug(slug);
    if (!product) throw new HttpError(404, "Product not found.");
    const related = await getRelatedProducts(product);
    return ok({ product, related });
  },
);

/** GET /api/categories */
export const listCategoriesController = handle(async () => {
  return ok(await listCategories());
});

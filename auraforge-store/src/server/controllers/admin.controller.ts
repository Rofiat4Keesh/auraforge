import type { NextRequest } from "next/server";
import { handle, ok, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/admin-guard";
import {
  categoryInputSchema,
  orderStatusUpdateSchema,
  productActiveSchema,
  productInputSchema,
} from "@/lib/admin-validators";
import {
  createCategory,
  createProduct,
  deleteCategory,
  getAdminProduct,
  getCustomerOrders,
  getDashboardStats,
  getOrderDetail,
  listAdminCategories,
  listAdminProducts,
  listCustomers,
  listOrders,
  runSupplierSync,
  setProductActive,
  updateCategory,
  updateOrderStatus,
  updateProduct,
} from "@/server/services/admin.service";

/**
 * Every admin controller starts with requireAdmin(), which rejects guests (401)
 * and signed-in customers (403) before any data is read or changed.
 */

const pageParam = (req: NextRequest) => Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
const textParam = (req: NextRequest, key: string) =>
  req.nextUrl.searchParams.get(key)?.trim().slice(0, 80) || undefined;

type Ctx<K extends string> = { params: Promise<Record<K, string>> };

/** GET /api/admin/stats */
export const statsController = handle(async () => {
  await requireAdmin();
  return ok(await getDashboardStats());
});

/** GET /api/admin/orders?q=&status=&page= */
export const listOrdersController = handle(async (req: NextRequest) => {
  await requireAdmin();
  return ok(await listOrders({ q: textParam(req, "q"), status: textParam(req, "status"), page: pageParam(req) }));
});

/** GET /api/admin/orders/:reference */
export const getOrderController = handle(async (_req: NextRequest, ctx: Ctx<"reference">) => {
  await requireAdmin();
  const { reference } = await ctx.params;
  return ok(await getOrderDetail(reference));
});

/** PATCH /api/admin/orders/:reference  { status: "FULFILLED" | "CANCELLED" | "PAID", restock?: boolean } */
export const updateOrderController = handle(async (req: NextRequest, ctx: Ctx<"reference">) => {
  await requireAdmin();
  const { reference } = await ctx.params;
  const input = orderStatusUpdateSchema.parse(await readJson(req));
  return ok(await updateOrderStatus(reference, input.status, input.restock ?? false));
});

/** GET /api/admin/products?q=&categoryId=&status=active|hidden&stock=low|out&page= */
export const listProductsController = handle(async (req: NextRequest) => {
  await requireAdmin();
  return ok(
    await listAdminProducts({
      q: textParam(req, "q"),
      categoryId: textParam(req, "categoryId"),
      status: textParam(req, "status"),
      stock: textParam(req, "stock"),
      page: pageParam(req),
    }),
  );
});

/** POST /api/admin/products */
export const createProductController = handle(async (req: NextRequest) => {
  await requireAdmin();
  const input = productInputSchema.parse(await readJson(req));
  return ok(await createProduct(input), 201);
});

/** GET /api/admin/products/:id */
export const getProductController = handle(async (_req: NextRequest, ctx: Ctx<"id">) => {
  await requireAdmin();
  const { id } = await ctx.params;
  return ok(await getAdminProduct(id));
});

/** PUT /api/admin/products/:id — full update from the product editor */
export const updateProductController = handle(async (req: NextRequest, ctx: Ctx<"id">) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const input = productInputSchema.parse(await readJson(req));
  return ok(await updateProduct(id, input));
});

/** PATCH /api/admin/products/:id  { active } — show or hide in the shop */
export const toggleProductController = handle(async (req: NextRequest, ctx: Ctx<"id">) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const { active } = productActiveSchema.parse(await readJson(req));
  return ok(await setProductActive(id, active));
});

/** GET /api/admin/categories */
export const listCategoriesController = handle(async () => {
  await requireAdmin();
  return ok(await listAdminCategories());
});

/** POST /api/admin/categories */
export const createCategoryController = handle(async (req: NextRequest) => {
  await requireAdmin();
  return ok(await createCategory(categoryInputSchema.parse(await readJson(req))), 201);
});

/** PUT /api/admin/categories/:id */
export const updateCategoryController = handle(async (req: NextRequest, ctx: Ctx<"id">) => {
  await requireAdmin();
  const { id } = await ctx.params;
  return ok(await updateCategory(id, categoryInputSchema.parse(await readJson(req))));
});

/** DELETE /api/admin/categories/:id — only when the category is empty */
export const deleteCategoryController = handle(async (_req: NextRequest, ctx: Ctx<"id">) => {
  await requireAdmin();
  const { id } = await ctx.params;
  return ok(await deleteCategory(id));
});

/** GET /api/admin/customers?q=&page= */
export const listCustomersController = handle(async (req: NextRequest) => {
  await requireAdmin();
  return ok(await listCustomers({ q: textParam(req, "q"), page: pageParam(req) }));
});

/** GET /api/admin/customers/:id/orders */
export const customerOrdersController = handle(async (_req: NextRequest, ctx: Ctx<"id">) => {
  await requireAdmin();
  const { id } = await ctx.params;
  return ok(await getCustomerOrders(id));
});

/** POST /api/admin/sync — pull the latest catalog from the configured supplier */
export const syncController = handle(async () => {
  await requireAdmin();
  return ok(await runSupplierSync());
});

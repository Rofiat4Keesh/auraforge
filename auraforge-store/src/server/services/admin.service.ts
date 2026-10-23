import { randomBytes } from "crypto";
import type { Order, OrderStatus, PaystackTransaction, Prisma, TransactionStatus, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http";
import type { CategoryInput, ProductInput } from "@/lib/admin-validators";
import { getProductSource } from "@/server/suppliers";
import { syncFromSource } from "@/server/suppliers/sync";
import { adjustStockForOrder, toOrderDTO } from "./order.service";
import { NEXT_STATUSES, ORDER_STATUSES, REVENUE_STATUSES, STATUS_LABEL, type AdminSettableStatus } from "@/lib/order-status";
import type {
  AdminCategoryRow,
  AdminCustomerRow,
  AdminOrderDetail,
  AdminOrderRow,
  AdminProductDetail,
  AdminProductRow,
  AdminStats,
  AdminSyncResult,
  AdminTransactionRow,
  Paged,
  PagedTransactions,
} from "@/types/admin";

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const PAID_STATUSES: OrderStatus[] = REVENUE_STATUSES;
const LOW_STOCK_LIMIT = 5;
const PAGE_SIZE = 20;

function pageOf(page: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safe = Math.min(Math.max(1, page), totalPages);
  return { page: safe, totalPages, skip: (safe - 1) * PAGE_SIZE };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

/** Calendar day in Lagos time (WAT), e.g. "2026-10-21". */
function lagosDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function toOrderRow(order: Order): AdminOrderRow {
  return {
    reference: order.reference,
    status: order.status,
    email: order.email,
    customerName: order.shipping.fullName,
    state: order.shipping.state,
    itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
    total: order.total,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboardStats(): Promise<AdminStats> {
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const since14 = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
  const today = lagosDay(now);

  const [paid30, allTimeRevenue, totalOrders, pendingOrders, toFulfil, customers, activeProducts, products, recent, recentSales] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: PAID_STATUSES }, paidAt: { gte: since30 } },
      select: { total: true, paidAt: true },
    }),
    prisma.order.aggregate({ where: { status: { in: PAID_STATUSES } }, _sum: { total: true }, _count: { _all: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "PENDING" } }),
    // "To ship" = paid or being packed, not yet handed to the courier.
    prisma.order.count({ where: { status: { in: ["PAID", "PROCESSING"] } } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.product.count({ where: { active: true } }),
    prisma.product.findMany({ where: { active: true }, select: { id: true, name: true, variants: true } }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.order.findMany({ where: { status: { in: PAID_STATUSES } }, orderBy: { paidAt: "desc" }, take: 8 }),
  ]);

  const revenue30d = paid30.reduce((sum, o) => sum + o.total, 0);
  const revenueToday = paid30.filter((o) => o.paidAt && lagosDay(o.paidAt) === today).reduce((s, o) => s + o.total, 0);

  const buckets = new Map<string, { total: number; orders: number }>();
  for (let i = 13; i >= 0; i -= 1) {
    buckets.set(lagosDay(new Date(now.getTime() - i * 24 * 60 * 60 * 1000)), { total: 0, orders: 0 });
  }
  for (const order of paid30) {
    if (!order.paidAt || order.paidAt < since14) continue;
    const bucket = buckets.get(lagosDay(order.paidAt));
    if (bucket) {
      bucket.total += order.total;
      bucket.orders += 1;
    }
  }

  const allLowStock = products
    .flatMap((p) =>
      p.variants
        .filter((v) => v.stock <= LOW_STOCK_LIMIT)
        .map((v) => ({ id: p.id, name: p.name, sku: v.sku, label: v.label, stock: v.stock })),
    )
    .sort((a, b) => a.stock - b.stock);
  const lowStock = allLowStock.slice(0, 10);

  return {
    totalRevenue: allTimeRevenue._sum.total ?? 0,
    totalPaidOrders: allTimeRevenue._count._all,
    totalOrders,
    lowStockCount: allLowStock.length,
    outOfStockCount: allLowStock.filter((v) => v.stock === 0).length,
    revenueToday,
    revenue30d,
    paidOrders30d: paid30.length,
    averageOrder30d: paid30.length ? Math.round(revenue30d / paid30.length) : 0,
    pendingOrders,
    toFulfil,
    customers,
    activeProducts,
    dailyRevenue: [...buckets.entries()].map(([date, v]) => ({ date, ...v })),
    lowStock,
    recentOrders: recent.map(toOrderRow),
    recentSales: recentSales.map(toOrderRow),
  };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function listOrders(params: { q?: string; status?: string; page: number }): Promise<Paged<AdminOrderRow>> {
  const and: Prisma.OrderWhereInput[] = [];
  if (params.status && ORDER_STATUSES.includes(params.status as OrderStatus)) {
    and.push({ status: params.status as OrderStatus });
  }
  if (params.q) {
    const q = params.q.trim();
    and.push({
      OR: [
        { reference: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { shipping: { is: { fullName: { contains: q, mode: "insensitive" } } } },
        { shipping: { is: { phone: { contains: q } } } },
      ],
    });
  }
  const where: Prisma.OrderWhereInput = and.length ? { AND: and } : {};
  const total = await prisma.order.count({ where });
  const { page, totalPages, skip } = pageOf(params.page, total);
  const rows = await prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: PAGE_SIZE });
  return { rows: rows.map(toOrderRow), total, page, totalPages };
}

function toAdminOrderDetail(
  order: Order & { transactions: PaystackTransaction[]; user: User | null },
): AdminOrderDetail {
  return {
    ...toOrderDTO(order, true),
    stockDeducted: order.stockDeducted,
    allowedTransitions: NEXT_STATUSES[order.status],
    account: order.user ? { id: order.user.id, fullName: order.user.fullName, email: order.user.email } : null,
    transactions: order.transactions
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((t) => ({
        reference: t.reference,
        status: t.status,
        amount: t.amount,
        channel: t.channel ?? null,
        gatewayResponse: t.gatewayResponse ?? null,
        lastSource: t.lastSource,
        paidAt: t.paidAt ? t.paidAt.toISOString() : null,
        updatedAt: t.updatedAt.toISOString(),
      })),
  };
}

export async function getOrderDetail(reference: string): Promise<AdminOrderDetail> {
  const order = await prisma.order.findUnique({
    where: { reference },
    include: { transactions: true, user: true },
  });
  if (!order) throw new HttpError(404, "Order not found.");
  return toAdminOrderDetail(order);
}

/**
 * Moves an order to its next status (see NEXT_STATUSES in src/lib/order-status.ts):
 *   PAID -> PROCESSING -> SHIPPED -> DELIVERED, or CANCELLED before shipping.
 * Cancelling a paid order can put the stock back; refund the money in your Paystack dashboard.
 */
export async function updateOrderStatus(
  reference: string,
  next: AdminSettableStatus,
  restock: boolean,
): Promise<AdminOrderDetail> {
  const order = await prisma.order.findUnique({ where: { reference } });
  if (!order) throw new HttpError(404, "Order not found.");

  if (!NEXT_STATUSES[order.status].includes(next)) {
    throw new HttpError(
      409,
      `An order that is "${STATUS_LABEL[order.status]}" cannot be changed to "${STATUS_LABEL[next]}".`,
    );
  }

  const changed = await prisma.order.updateMany({
    where: { id: order.id, status: order.status },
    data: { status: next },
  });
  if (changed.count !== 1) throw new HttpError(409, "This order was changed by someone else. Reload and try again.");

  if (next === "CANCELLED" && restock && order.stockDeducted) {
    const released = await prisma.order.updateMany({
      where: { id: order.id, stockDeducted: true },
      data: { stockDeducted: false },
    });
    if (released.count === 1) await adjustStockForOrder(order, 1);
  }

  return getOrderDetail(reference);
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function listAdminProducts(params: {
  q?: string;
  categoryId?: string;
  status?: string;
  stock?: string;
  page: number;
}): Promise<Paged<AdminProductRow>> {
  const and: Prisma.ProductWhereInput[] = [];
  if (params.q) {
    const q = params.q.trim();
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  if (params.categoryId && OBJECT_ID.test(params.categoryId)) and.push({ categoryId: params.categoryId });
  if (params.status === "active") and.push({ active: true });
  if (params.status === "hidden") and.push({ active: false });
  if (params.stock === "out") and.push({ totalStock: 0 });
  if (params.stock === "low") and.push({ variants: { some: { stock: { lte: LOW_STOCK_LIMIT } } } });

  const where: Prisma.ProductWhereInput = and.length ? { AND: and } : {};
  const total = await prisma.product.count({ where });
  const { page, totalPages, skip } = pageOf(params.page, total);
  const rows = await prisma.product.findMany({
    where,
    include: { category: true },
    orderBy: { updatedAt: "desc" },
    skip,
    take: PAGE_SIZE,
  });

  return {
    rows: rows.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      categoryName: p.category.name,
      image: p.images[0] ?? "",
      minPrice: p.minPrice,
      maxPrice: p.maxPrice,
      totalStock: p.totalStock,
      variantCount: p.variants.length,
      active: p.active,
      featured: p.featured,
      source: p.source,
      updatedAt: p.updatedAt.toISOString(),
    })),
    total,
    page,
    totalPages,
  };
}

export async function getAdminProduct(id: string): Promise<AdminProductDetail> {
  if (!OBJECT_ID.test(id)) throw new HttpError(404, "Product not found.");
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) throw new HttpError(404, "Product not found.");
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    categoryId: p.categoryId,
    shortDescription: p.shortDescription,
    description: p.description,
    images: p.images,
    specs: p.specs.map((s) => ({ key: s.key, value: s.value })),
    variants: p.variants.map((v) => ({
      sku: v.sku,
      label: v.label,
      attributes: v.attributes.map((a) => ({ name: a.name, value: a.value })),
      price: v.price,
      compareAtPrice: v.compareAtPrice ?? null,
      stock: v.stock,
      imageIndex: v.imageIndex,
    })),
    tags: p.tags,
    featured: p.featured,
    active: p.active,
    source: p.source,
    supplierSku: p.supplierSku ?? null,
    costPrice: p.costPrice ?? null,
  };
}

const kobo = (naira: number) => Math.round(naira * 100);

/** Turns the admin form (prices in Naira) into database fields (prices in kobo + denormalised totals). */
function productData(input: ProductInput) {
  const variants = input.variants.map((v) => {
    const price = kobo(v.price);
    const compare = v.compareAtPrice ? kobo(v.compareAtPrice) : null;
    return {
      sku: v.sku.toUpperCase(),
      label: v.label,
      attributes: v.attributes,
      price,
      compareAtPrice: compare && compare > price ? compare : null,
      stock: v.stock,
      imageIndex: v.imageIndex,
    };
  });
  const prices = variants.map((v) => v.price);
  return {
    name: input.name,
    brand: input.brand,
    categoryId: input.categoryId,
    shortDescription: input.shortDescription,
    description: input.description,
    images: input.images,
    specs: input.specs,
    variants,
    tags: [...new Set(input.tags)],
    featured: input.featured,
    active: input.active,
    supplierSku: input.supplierSku || null,
    costPrice: input.costPrice ? kobo(input.costPrice) : null,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    totalStock: variants.reduce((sum, v) => sum + v.stock, 0),
  };
}

async function assertCategory(categoryId: string) {
  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!category)
    throw new HttpError(422, "Please check the highlighted fields.", { categoryId: ["Choose a category"] });
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "product";
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const clash = await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!clash || clash.id === excludeId) return candidate;
  }
  return `${root}-${randomBytes(3).toString("hex")}`;
}

async function assertSkusFree(skus: string[], excludeId?: string) {
  const clash = await prisma.product.findFirst({
    where: {
      variants: { some: { sku: { in: skus.map((s) => s.toUpperCase()) } } },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { name: true },
  });
  if (clash) {
    throw new HttpError(422, "Please check the highlighted fields.", {
      variants: [`A SKU in this product is already used by "${clash.name}"`],
    });
  }
}

export async function createProduct(input: ProductInput): Promise<AdminProductDetail> {
  await assertCategory(input.categoryId);
  await assertSkusFree(input.variants.map((v) => v.sku));
  const slug = await uniqueSlug(input.slug || `${input.brand} ${input.name}`);
  const created = await prisma.product.create({
    data: {
      ...productData(input),
      slug,
      source: "manual",
      externalId: `MAN-${randomBytes(6).toString("hex").toUpperCase()}`,
      rating: 0,
      reviewCount: 0,
    },
  });
  return getAdminProduct(created.id);
}

export async function updateProduct(id: string, input: ProductInput): Promise<AdminProductDetail> {
  const existing = await getAdminProduct(id);
  await assertCategory(input.categoryId);
  await assertSkusFree(
    input.variants.map((v) => v.sku),
    id,
  );
  const slug = input.slug && input.slug !== existing.slug ? await uniqueSlug(input.slug, id) : existing.slug;
  await prisma.product.update({ where: { id }, data: { ...productData(input), slug } });
  return getAdminProduct(id);
}

/** Products are hidden rather than deleted, so past orders keep a valid product reference. */
export async function setProductActive(id: string, active: boolean): Promise<AdminProductDetail> {
  await getAdminProduct(id);
  await prisma.product.update({ where: { id }, data: { active } });
  return getAdminProduct(id);
}

// ---------------------------------------------------------------------------
// Transactions (Paystack payment log)
// ---------------------------------------------------------------------------

const TRANSACTION_STATUSES: TransactionStatus[] = ["INITIALIZED", "SUCCESS", "FAILED", "ABANDONED"];

/**
 * Every Paystack payment attempt, newest first, with the order it belongs to.
 * Filter by status, search by reference / Paystack id / email, and an optional date range (Lagos days).
 */
export async function listTransactions(params: {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  page: number;
}): Promise<PagedTransactions> {
  const and: Prisma.PaystackTransactionWhereInput[] = [];
  if (params.status && TRANSACTION_STATUSES.includes(params.status as TransactionStatus)) {
    and.push({ status: params.status as TransactionStatus });
  }
  if (params.q) {
    const q = params.q.trim();
    and.push({
      OR: [
        { reference: { contains: q, mode: "insensitive" } },
        { paystackId: { contains: q } },
        { customerEmail: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const created: Prisma.DateTimeFilter = {};
  // Lagos is UTC+1 all year (no daylight saving), so a Lagos day starts at 23:00 UTC the day before.
  if (params.from && day.test(params.from)) created.gte = new Date(`${params.from}T00:00:00+01:00`);
  if (params.to && day.test(params.to)) created.lt = new Date(new Date(`${params.to}T00:00:00+01:00`).getTime() + 24 * 60 * 60 * 1000);
  if (created.gte || created.lt) and.push({ createdAt: created });

  const where: Prisma.PaystackTransactionWhereInput = and.length ? { AND: and } : {};
  const [total, success, failedCount, pendingCount] = await Promise.all([
    prisma.paystackTransaction.count({ where }),
    prisma.paystackTransaction.aggregate({ where: { AND: [where, { status: "SUCCESS" }] }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.paystackTransaction.count({ where: { AND: [where, { status: { in: ["FAILED", "ABANDONED"] } }] } }),
    prisma.paystackTransaction.count({ where: { AND: [where, { status: "INITIALIZED" }] } }),
  ]);
  const { page, totalPages, skip } = pageOf(params.page, total);
  const rows = await prisma.paystackTransaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: PAGE_SIZE,
    include: { order: { select: { reference: true, status: true, shipping: true } } },
  });

  return {
    rows: rows.map(
      (t): AdminTransactionRow => ({
        reference: t.reference,
        paystackId: t.paystackId ?? null,
        status: t.status,
        amount: t.amount,
        currency: t.currency,
        channel: t.channel ?? null,
        gatewayResponse: t.gatewayResponse ?? null,
        lastSource: t.lastSource,
        customerEmail: t.customerEmail,
        customerName: t.order.shipping?.fullName ?? t.customerEmail,
        orderReference: t.order.reference,
        orderStatus: t.order.status,
        paidAt: t.paidAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }),
    ),
    total,
    page,
    totalPages,
    totals: {
      successAmount: success._sum.amount ?? 0,
      successCount: success._count._all,
      failedCount,
      pendingCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listAdminCategories(): Promise<AdminCategoryRow[]> {
  const [categories, counts] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.product.groupBy({ by: ["categoryId"], _count: { _all: true } }),
  ]);
  const byId = new Map(counts.map((c) => [c.categoryId, c._count._all]));
  return categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    sortOrder: c.sortOrder,
    productCount: byId.get(c.id) ?? 0,
  }));
}

async function uniqueCategorySlug(base: string, excludeId?: string): Promise<string> {
  const slug = slugify(base) || "category";
  const clash = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  if (clash && clash.id !== excludeId) {
    throw new HttpError(422, "Please check the highlighted fields.", {
      slug: ["Another category already uses this link name"],
    });
  }
  return slug;
}

export async function createCategory(input: CategoryInput): Promise<AdminCategoryRow[]> {
  const slug = await uniqueCategorySlug(input.slug || input.name);
  await prisma.category.create({
    data: { name: input.name, slug, description: input.description, sortOrder: input.sortOrder },
  });
  return listAdminCategories();
}

export async function updateCategory(id: string, input: CategoryInput): Promise<AdminCategoryRow[]> {
  if (!OBJECT_ID.test(id)) throw new HttpError(404, "Category not found.");
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Category not found.");
  const slug = input.slug && input.slug !== existing.slug ? await uniqueCategorySlug(input.slug, id) : existing.slug;
  await prisma.category.update({
    where: { id },
    data: { name: input.name, slug, description: input.description, sortOrder: input.sortOrder },
  });
  return listAdminCategories();
}

export async function deleteCategory(id: string): Promise<AdminCategoryRow[]> {
  if (!OBJECT_ID.test(id)) throw new HttpError(404, "Category not found.");
  const count = await prisma.product.count({ where: { categoryId: id } });
  if (count > 0) {
    throw new HttpError(409, `Move or hide the ${count} product(s) in this category before deleting it.`);
  }
  await prisma.category.delete({ where: { id } });
  return listAdminCategories();
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function listCustomers(params: { q?: string; page: number }): Promise<Paged<AdminCustomerRow>> {
  const where: Prisma.UserWhereInput = params.q
    ? {
        OR: [
          { fullName: { contains: params.q.trim(), mode: "insensitive" } },
          { email: { contains: params.q.trim(), mode: "insensitive" } },
          { phone: { contains: params.q.trim() } },
        ],
      }
    : {};
  const total = await prisma.user.count({ where });
  const { page, totalPages, skip } = pageOf(params.page, total);
  const users = await prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: PAGE_SIZE });

  const stats = users.length
    ? await prisma.order.groupBy({
        by: ["userId"],
        where: { userId: { in: users.map((u) => u.id) }, status: { in: PAID_STATUSES } },
        _count: { _all: true },
        _sum: { total: true },
        _max: { createdAt: true },
      })
    : [];
  const byUser = new Map<string, (typeof stats)[number]>();
  for (const s of stats) if (s.userId) byUser.set(s.userId, s);

  return {
    rows: users.map((u) => {
      const s = byUser.get(u.id);
      return {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone ?? null,
        role: u.role,
        joinedAt: u.createdAt.toISOString(),
        orders: s?._count._all ?? 0,
        totalSpent: s?._sum.total ?? 0,
        lastOrderAt: s?._max.createdAt ? s._max.createdAt.toISOString() : null,
      };
    }),
    total,
    page,
    totalPages,
  };
}

export async function getCustomerOrders(userId: string): Promise<AdminOrderRow[]> {
  if (!OBJECT_ID.test(userId)) throw new HttpError(404, "Customer not found.");
  const orders = await prisma.order.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
  return orders.map(toOrderRow);
}

// ---------------------------------------------------------------------------
// Supplier sync
// ---------------------------------------------------------------------------

export async function runSupplierSync(): Promise<AdminSyncResult> {
  let source;
  try {
    source = getProductSource();
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "Supplier source is not configured.");
  }
  try {
    const report = await syncFromSource(prisma, source);
    return { ...report, finishedAt: new Date().toISOString() };
  } catch (error) {
    throw new HttpError(502, `Sync failed: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

export function supplierSourceName(): string {
  return (process.env.SUPPLIER_SOURCE || "technocrat").toLowerCase();
}

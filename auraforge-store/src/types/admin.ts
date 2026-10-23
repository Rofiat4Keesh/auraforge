import type { OrderDTO, OrderStatusDTO } from "@/types";

/** Shapes used only by the admin portal. Money values are integers in kobo. */

export interface AdminStats {
  /** All-time paid revenue, in kobo */
  totalRevenue: number;
  totalPaidOrders: number;
  /** Every order ever created, any status */
  totalOrders: number;
  /** Variants at or below the low-stock limit (including sold-out ones) */
  lowStockCount: number;
  outOfStockCount: number;
  revenueToday: number;
  revenue30d: number;
  paidOrders30d: number;
  averageOrder30d: number;
  pendingOrders: number;
  toFulfil: number;
  customers: number;
  activeProducts: number;
  dailyRevenue: { date: string; total: number; orders: number }[];
  lowStock: { id: string; name: string; sku: string; label: string; stock: number }[];
  recentOrders: AdminOrderRow[];
  /** Latest paid orders, newest payment first */
  recentSales: AdminOrderRow[];
}

export interface AdminOrderRow {
  reference: string;
  status: OrderStatusDTO;
  email: string;
  customerName: string;
  state: string;
  itemCount: number;
  total: number;
  createdAt: string;
  paidAt: string | null;
}

export interface AdminTransaction {
  reference: string;
  status: string;
  amount: number;
  channel: string | null;
  gatewayResponse: string | null;
  lastSource: string;
  paidAt: string | null;
  updatedAt: string;
}

export interface AdminOrderDetail extends OrderDTO {
  stockDeducted: boolean;
  /** Statuses this order may be moved to next */
  allowedTransitions: OrderStatusDTO[];
  account: { id: string; fullName: string; email: string } | null;
  transactions: AdminTransaction[];
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AdminProductRow {
  id: string;
  slug: string;
  name: string;
  brand: string;
  categoryName: string;
  image: string;
  minPrice: number;
  maxPrice: number;
  totalStock: number;
  variantCount: number;
  active: boolean;
  featured: boolean;
  source: string;
  updatedAt: string;
}

export interface AdminProductDetail {
  id: string;
  slug: string;
  name: string;
  brand: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  images: string[];
  specs: { key: string; value: string }[];
  variants: {
    sku: string;
    label: string;
    attributes: { name: string; value: string }[];
    price: number;
    compareAtPrice: number | null;
    stock: number;
    imageIndex: number;
  }[];
  tags: string[];
  featured: boolean;
  active: boolean;
  source: string;
  supplierSku: string | null;
  costPrice: number | null;
}

export interface AdminCategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  productCount: number;
}

export interface AdminCustomerRow {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: "CUSTOMER" | "ADMIN";
  joinedAt: string;
  orders: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

export interface AdminSyncResult {
  source: string;
  categories: number;
  created: number;
  updated: number;
  deactivated: number;
  skipped: { externalId: string; reason: string }[];
  finishedAt: string;
}

/** One row of the Admin → Transactions log (a Paystack payment attempt). */
export interface AdminTransactionRow {
  reference: string;
  paystackId: string | null;
  status: "INITIALIZED" | "SUCCESS" | "FAILED" | "ABANDONED";
  amount: number;
  currency: string;
  channel: string | null;
  gatewayResponse: string | null;
  lastSource: string;
  customerEmail: string;
  customerName: string;
  orderReference: string;
  orderStatus: OrderStatusDTO;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTransactionTotals {
  /** Successful payments in this filtered view, in kobo */
  successAmount: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
}

export interface PagedTransactions extends Paged<AdminTransactionRow> {
  totals: AdminTransactionTotals;
}

import type { OrderStatusDTO } from "@/types";

/**
 * Order status workflow, shared by the admin portal (server + browser) and the account page.
 *
 *   PENDING ──(Paystack confirms)──▶ PAID ─▶ PROCESSING ─▶ SHIPPED ─▶ DELIVERED
 *      │                               │          │
 *      └──▶ CANCELLED ◀────────────────┴──────────┘   (FAILED ─▶ CANCELLED)
 *
 * FULFILLED is kept only for orders marked "fulfilled" before the detailed steps existed;
 * such an order can still move on to DELIVERED or be cancelled.
 */
export const ORDER_STATUSES: OrderStatusDTO[] = [
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
  "FULFILLED",
];

/** Statuses that count as a sale (money received and not cancelled). */
export const REVENUE_STATUSES: OrderStatusDTO[] = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED", "FULFILLED"];

/** Which statuses an admin may move an order to next. PAID itself is only set by Paystack. */
export const NEXT_STATUSES: Record<OrderStatusDTO, OrderStatusDTO[]> = {
  PENDING: ["CANCELLED"],
  FAILED: ["CANCELLED"],
  PAID: ["PROCESSING", "SHIPPED", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  FULFILLED: ["DELIVERED", "CANCELLED"],
  CANCELLED: [],
};

/** Statuses an admin can choose in the status selector (validated on the server). */
export const ADMIN_SETTABLE_STATUSES = ["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
export type AdminSettableStatus = (typeof ADMIN_SETTABLE_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatusDTO, string> = {
  PENDING: "Pending payment",
  PAID: "Paid · to pack",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  FAILED: "Payment failed",
  CANCELLED: "Cancelled",
  FULFILLED: "Fulfilled",
};

export function isPaidStatus(status: OrderStatusDTO): boolean {
  return REVENUE_STATUSES.includes(status);
}

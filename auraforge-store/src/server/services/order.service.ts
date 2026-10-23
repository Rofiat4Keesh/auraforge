import { randomBytes } from "crypto";
import type { Order, PaystackTransaction, Prisma, TransactionSource, TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http";
import { BASE_CURRENCY } from "@/lib/money";
import { siteUrl } from "@/lib/store-config";
import { initializeTransaction, isPaystackConfigured, verifyTransaction, type PaystackTransactionData } from "@/lib/paystack";
import type { CheckoutInput } from "@/lib/validators";
import type { SessionPayload } from "@/lib/auth";
import type { OrderDTO } from "@/types";
import { calculateShipping } from "./cart.service";

/** Order reference doubles as the Paystack reference, e.g. AF-20261021-7F3A9C1D2E */
function generateReference(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `AF-${date}-${randomBytes(5).toString("hex").toUpperCase()}`;
}

type OrderWithTransactions = Order & { transactions: PaystackTransaction[] };

interface OrderItemInput {
  productId: string;
  productSlug: string;
  sku: string;
  name: string;
  variantLabel: string;
  image: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export function toOrderDTO(order: OrderWithTransactions, includePrivate: boolean): OrderDTO {
  const successful = order.transactions.find((t) => t.status === "SUCCESS");
  return {
    reference: order.reference,
    status: order.status,
    email: includePrivate ? order.email : order.email.replace(/^(.{2}).*(@.*)$/, "$1•••$2"),
    currency: order.currency,
    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    total: order.total,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    items: order.items.map((i) => ({
      productSlug: i.productSlug,
      sku: i.sku,
      name: i.name,
      variantLabel: i.variantLabel,
      image: i.image,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    shipping: includePrivate
      ? {
          fullName: order.shipping.fullName,
          phone: order.shipping.phone,
          address: order.shipping.address,
          city: order.shipping.city,
          state: order.shipping.state,
          notes: order.shipping.notes ?? null,
        }
      : null,
    paymentChannel: successful?.channel ?? null,
    paymentMethod: order.paymentMethod === "offline" ? "offline" : "paystack",
  };
}

/**
 * STEP 1 OF CHECKOUT
 * Re-prices the cart on the server, creates a PENDING order, and asks Paystack for a
 * secure payment page. Returns the Paystack URL the shopper is redirected to.
 */
export async function initializeCheckout(
  cartToken: string | undefined,
  session: SessionPayload | null,
  input: CheckoutInput,
): Promise<{ reference: string; authorizationUrl: string; accessCode: string }> {
  if (!cartToken) throw new HttpError(400, "Your cart is empty.");

  const cart = await prisma.cart.findUnique({
    where: { token: cartToken },
    include: { items: { include: { product: true } } },
  });
  if (!cart || cart.items.length === 0) throw new HttpError(400, "Your cart is empty.");

  const orderItems: OrderItemInput[] = [];
  const problems: string[] = [];

  for (const item of cart.items) {
    const variant = item.product.variants.find((v) => v.sku === item.variantSku);
    if (!item.product.active || !variant) {
      problems.push(`${item.product.name} is no longer available`);
      continue;
    }
    if (variant.stock < item.quantity) {
      problems.push(
        variant.stock === 0
          ? `${item.product.name} (${variant.label}) is out of stock`
          : `Only ${variant.stock} of ${item.product.name} (${variant.label}) left`,
      );
      continue;
    }
    orderItems.push({
      productId: item.product.id,
      productSlug: item.product.slug,
      sku: variant.sku,
      name: item.product.name,
      variantLabel: variant.label,
      image: item.product.images[variant.imageIndex] ?? item.product.images[0] ?? "",
      unitPrice: variant.price,
      quantity: item.quantity,
      lineTotal: variant.price * item.quantity,
    });
  }

  if (problems.length > 0) {
    throw new HttpError(409, "Some items in your cart need attention before checkout.", { cart: problems });
  }

  const subtotal = orderItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const shippingFee = calculateShipping(subtotal);
  const total = subtotal + shippingFee;
  const reference = generateReference();

  const order = await prisma.order.create({
    data: {
      reference,
      userId: session?.userId ?? null,
      email: input.email,
      cartToken,
      shipping: {
        fullName: input.fullName,
        phone: input.phone,
        address: input.address,
        city: input.city,
        state: input.state,
        notes: input.notes || null,
      },
      items: orderItems,
      currency: BASE_CURRENCY,
      subtotal,
      shippingFee,
      total,
      status: "PENDING",
      paymentMethod: isPaystackConfigured() ? "paystack" : "offline",
    },
  });

  // No Paystack keys yet: take the order as "pay later" (bank transfer / on delivery).
  // It shows in Admin → Orders straight away as "Pending payment"; the admin marks it Paid
  // when the money arrives, which also deducts the stock.
  if (!isPaystackConfigured()) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return { reference, authorizationUrl: `/checkout/success?reference=${encodeURIComponent(reference)}`, accessCode: "" };
  }

  try {
    const paystack = await initializeTransaction({
      email: input.email,
      amountKobo: total,
      reference,
      currency: BASE_CURRENCY,
      callbackUrl: `${siteUrl}/checkout/success`,
      metadata: {
        orderId: order.id,
        customer_name: input.fullName,
        phone: input.phone,
        custom_fields: [
          { display_name: "Order Reference", variable_name: "order_reference", value: reference },
          { display_name: "Items", variable_name: "items", value: String(orderItems.length) },
        ],
      },
    });

    await prisma.paystackTransaction.create({
      data: {
        reference,
        orderId: order.id,
        amount: total,
        currency: BASE_CURRENCY,
        status: "INITIALIZED",
        lastSource: "INITIALIZE",
        accessCode: paystack.access_code,
        authorizationUrl: paystack.authorization_url,
        customerEmail: input.email,
      },
    });

    return { reference, authorizationUrl: paystack.authorization_url, accessCode: paystack.access_code };
  } catch (error) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
    throw error;
  }
}

function mapTransactionStatus(status: PaystackTransactionData["status"]): TransactionStatus {
  if (status === "success") return "SUCCESS";
  if (status === "abandoned") return "ABANDONED";
  if (status === "failed" || status === "reversed") return "FAILED";
  return "INITIALIZED";
}

/**
 * Changes stock for every item in an order: direction -1 deducts (payment confirmed),
 * +1 puts stock back (an admin cancels a paid order).
 * Uses optimistic concurrency (compare updatedAt) so two simultaneous changes to the
 * same product cannot overwrite each other.
 */
export async function adjustStockForOrder(order: Order, direction: 1 | -1): Promise<void> {
  for (const item of order.items) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) break;
      const variants = product.variants.map((v) =>
        v.sku === item.sku ? { ...v, stock: Math.max(0, v.stock + direction * item.quantity) } : v,
      );
      const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
      const result = await prisma.product.updateMany({
        where: { id: product.id, updatedAt: product.updatedAt },
        data: { variants: { set: variants }, totalStock },
      });
      if (result.count === 1) break;
    }
  }
}

/**
 * STEP 2 OF CHECKOUT — confirms payment. Called from:
 *   - the success page (shopper returns from Paystack) via /api/checkout/verify
 *   - the Paystack webhook (server-to-server, works even if the shopper closes the tab)
 * It is idempotent: whichever arrives first marks the order PAID; the other is a no-op.
 */
export async function confirmPayment(
  reference: string,
  source: Extract<TransactionSource, "VERIFY" | "WEBHOOK">,
  webhookData?: PaystackTransactionData,
): Promise<OrderWithTransactions> {
  const order = await prisma.order.findUnique({ where: { reference } });
  if (!order) throw new HttpError(404, "Order not found.");

  // "Pay later" orders have no Paystack payment to check: return them as they are.
  if (order.paymentMethod === "offline") {
    const current = await prisma.order.findUnique({ where: { id: order.id }, include: { transactions: true } });
    if (!current) throw new HttpError(404, "Order not found.");
    return current;
  }

  // Never trust only the browser: when not coming from a signed webhook, ask Paystack directly.
  const data = webhookData ?? (await verifyTransaction(reference));
  const status = mapTransactionStatus(data.status);
  const amountMatches = data.amount === order.total && data.currency.toUpperCase() === order.currency.toUpperCase();

  await prisma.paystackTransaction.upsert({
    where: { reference },
    create: {
      reference,
      orderId: order.id,
      amount: data.amount,
      currency: data.currency,
      status,
      lastSource: source,
      paystackId: String(data.id),
      channel: data.channel,
      gatewayResponse: data.gateway_response,
      customerEmail: data.customer?.email ?? order.email,
      paidAt: data.paid_at ? new Date(data.paid_at) : null,
      rawPayload: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue,
    },
    update: {
      amount: data.amount,
      currency: data.currency,
      status,
      lastSource: source,
      paystackId: String(data.id),
      channel: data.channel,
      gatewayResponse: data.gateway_response,
      paidAt: data.paid_at ? new Date(data.paid_at) : null,
      rawPayload: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue,
    },
  });

  if (status === "SUCCESS" && amountMatches) {
    // Atomic transition: only one caller can move the order out of PENDING/FAILED.
    const transitioned = await prisma.order.updateMany({
      where: { id: order.id, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "PAID", paidAt: data.paid_at ? new Date(data.paid_at) : new Date() },
    });
    if (transitioned.count === 1) {
      const claimed = await prisma.order.updateMany({
        where: { id: order.id, stockDeducted: false },
        data: { stockDeducted: true },
      });
      if (claimed.count === 1) await adjustStockForOrder(order, -1);
      if (order.cartToken) {
        const cart = await prisma.cart.findUnique({ where: { token: order.cartToken } });
        if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      }
    }
  } else if (status === "SUCCESS" && !amountMatches) {
    console.error(
      `[payments] Amount mismatch for ${reference}: paid ${data.amount} ${data.currency}, expected ${order.total} ${order.currency}`,
    );
  } else if (status === "FAILED" || status === "ABANDONED") {
    await prisma.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "FAILED" } });
  }

  const fresh = await prisma.order.findUnique({ where: { id: order.id }, include: { transactions: true } });
  if (!fresh) throw new HttpError(404, "Order not found.");
  return fresh;
}

/**
 * Whether the current visitor may see the full order (address, phone).
 * Allowed for the logged-in owner, or the same browser that placed the order (cart cookie).
 * Email matching is deliberately NOT used, because emails are not verified at sign-up.
 */
export function canViewPrivate(order: Order, session: SessionPayload | null, cartToken: string | undefined): boolean {
  if (session && order.userId === session.userId) return true;
  if (cartToken && order.cartToken === cartToken) return true;
  return false;
}

export async function listOrdersForUser(session: SessionPayload): Promise<OrderDTO[]> {
  const orders = await prisma.order.findMany({
    where: { userId: session.userId, status: { not: "CANCELLED" } },
    include: { transactions: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return orders.map((o) => toOrderDTO(o, true));
}

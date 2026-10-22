import { NextResponse, type NextRequest } from "next/server";
import { fail, handle, HttpError, ok, readJson } from "@/lib/http";
import { getSession } from "@/lib/auth";
import { readCartToken } from "@/lib/cart-cookie";
import { isValidWebhookSignature, type PaystackTransactionData } from "@/lib/paystack";
import { checkoutSchema } from "@/lib/validators";
import { prisma } from "@/lib/prisma";
import {
  canViewPrivate,
  confirmPayment,
  initializeCheckout,
  listOrdersForUser,
  toOrderDTO,
} from "@/server/services/order.service";

/**
 * POST /api/checkout/initialize
 * Body: { email, fullName, phone, address, city, state, notes? }
 * Returns: { reference, authorizationUrl } — the browser then redirects to authorizationUrl (Paystack).
 */
export const initializeCheckoutController = handle(async (req: NextRequest) => {
  const input = checkoutSchema.parse(await readJson(req));
  const session = await getSession();
  const cartToken = await readCartToken();
  const result = await initializeCheckout(cartToken, session, input);
  return ok(result, 201);
});

/**
 * GET /api/checkout/verify?reference=AF-...
 * Called by the success page after Paystack redirects back. Confirms with Paystack's API.
 */
export const verifyCheckoutController = handle(async (req: NextRequest) => {
  const reference = req.nextUrl.searchParams.get("reference") || req.nextUrl.searchParams.get("trxref");
  if (!reference || !/^[A-Za-z0-9-]{6,64}$/.test(reference)) {
    throw new HttpError(400, "A valid payment reference is required.");
  }
  const order = await confirmPayment(reference, "VERIFY");
  const session = await getSession();
  const cartToken = await readCartToken();
  return ok(toOrderDTO(order, canViewPrivate(order, session, cartToken)));
});

/**
 * POST /api/webhooks/paystack
 * Configure this URL in Paystack Dashboard → Settings → API Keys & Webhooks:
 *   https://<your-domain>/api/webhooks/paystack
 * Paystack retries until it receives HTTP 200, so we always acknowledge valid events.
 */
export async function paystackWebhookController(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  let valid = false;
  try {
    valid = isValidWebhookSignature(rawBody, signature);
  } catch (error) {
    console.error("[webhook] Paystack secret key not configured:", error);
    return fail(500, "Webhook not configured.");
  }
  if (!valid) return fail(401, "Invalid signature.");

  let event: { event?: string; data?: PaystackTransactionData };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return fail(400, "Invalid JSON.");
  }

  const reference = event.data?.reference;
  if (!reference || !event.data) {
    return NextResponse.json({ received: true });
  }

  const order = await prisma.order.findUnique({ where: { reference }, select: { id: true } });
  if (!order) {
    // Not one of our store orders (e.g. a payment made from another integration) — acknowledge and ignore.
    return NextResponse.json({ received: true });
  }

  try {
    if (event.event === "charge.success") {
      await confirmPayment(reference, "WEBHOOK", event.data);
    } else if (event.event === "charge.failed") {
      await confirmPayment(reference, "WEBHOOK", { ...event.data, status: "failed" });
    }
  } catch (error) {
    console.error(`[webhook] Failed to process ${event.event} for ${reference}:`, error);
    // Returning 500 makes Paystack retry later, which is what we want for transient errors.
    return fail(500, "Processing failed; will retry.");
  }

  return NextResponse.json({ received: true });
}

/** GET /api/orders — the signed-in customer's orders */
export const listMyOrdersController = handle(async () => {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Please sign in to view your orders.");
  return ok(await listOrdersForUser(session));
});

/** GET /api/orders/:reference — one order (private fields only for its owner) */
export const getOrderController = handle(
  async (_req: NextRequest, context: { params: Promise<{ reference: string }> }) => {
    const { reference } = await context.params;
    const order = await prisma.order.findUnique({ where: { reference }, include: { transactions: true } });
    if (!order) throw new HttpError(404, "Order not found.");
    const session = await getSession();
    const cartToken = await readCartToken();
    return ok(toOrderDTO(order, canViewPrivate(order, session, cartToken)));
  },
);

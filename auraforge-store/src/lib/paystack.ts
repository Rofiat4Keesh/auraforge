import { createHmac, timingSafeEqual } from "crypto";
import { HttpError } from "@/lib/http";

/**
 * Thin, typed client for the Paystack REST API.
 * Docs: https://paystack.com/docs/api/transaction/
 * The SECRET key is only ever used on the server.
 */

const BASE_URL = (process.env.PAYSTACK_BASE_URL || "https://api.paystack.co").replace(/\/+$/, "");

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !key.startsWith("sk_")) {
    throw new HttpError(500, "Payment gateway is not configured. Set PAYSTACK_SECRET_KEY in .env.");
  }
  return key;
}

export function isTestMode(): boolean {
  const pk = process.env.PAYSTACK_PUBLIC_KEY || "";
  const sk = process.env.PAYSTACK_SECRET_KEY || "";
  return pk.startsWith("pk_test_") || sk.startsWith("sk_test_");
}

interface PaystackEnvelope<T> {
  status: boolean;
  message: string;
  data: T;
}

export interface InitializeData {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaystackTransactionData {
  id: number;
  status: "success" | "failed" | "abandoned" | "ongoing" | "pending" | "processing" | "queued" | "reversed";
  reference: string;
  amount: number; // kobo
  currency: string;
  channel: string | null;
  gateway_response: string | null;
  paid_at: string | null;
  customer: { email: string } | null;
  metadata: unknown;
}

async function paystackRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, "Could not reach Paystack. Check your internet connection and try again.");
  }

  let body: PaystackEnvelope<T>;
  try {
    body = (await response.json()) as PaystackEnvelope<T>;
  } catch {
    throw new HttpError(502, "Paystack returned an unexpected response.");
  }

  if (!response.ok || !body.status) {
    throw new HttpError(502, `Paystack: ${body.message || "request failed"}`);
  }
  return body.data;
}

export async function initializeTransaction(input: {
  email: string;
  amountKobo: number;
  reference: string;
  currency: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<InitializeData> {
  return paystackRequest<InitializeData>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      reference: input.reference,
      currency: input.currency,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });
}

export async function verifyTransaction(reference: string): Promise<PaystackTransactionData> {
  return paystackRequest<PaystackTransactionData>(`/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
  });
}

/**
 * Paystack signs every webhook with HMAC-SHA512 of the RAW request body using your secret key,
 * and sends it in the "x-paystack-signature" header. Anything that fails this check is rejected.
 */
export function isValidWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha512", secretKey()).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

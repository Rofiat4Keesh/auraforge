"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useCart } from "@/components/providers/CartProvider";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import type { OrderDTO } from "@/types";
import { SafeImage } from "@/components/ui/SafeImage";

type ViewState = { kind: "verifying" } | { kind: "done"; order: OrderDTO } | { kind: "error"; message: string };

const MAX_AUTO_CHECKS = 4;

/**
 * Order confirmation screen. Paystack redirects here with ?reference=...
 * We ask our server to verify the payment with Paystack (never trusting the URL alone).
 * If the bank has not confirmed yet (e.g. bank transfer), we re-check a few times.
 */
export function PaymentResult({ reference }: { reference: string | null }) {
  const { refreshCart } = useCart();
  const [state, setState] = useState<ViewState>({ kind: "verifying" });
  const attempts = useRef(0);

  const verify = useCallback(async () => {
    if (!reference) {
      setState({ kind: "error", message: "No payment reference was found in the link." });
      return;
    }
    setState({ kind: "verifying" });
    try {
      const order = await apiFetch<OrderDTO>(`/api/checkout/verify?reference=${encodeURIComponent(reference)}`, {
        cache: "no-store",
      });
      attempts.current += 1;
      setState({ kind: "done", order });
      if (order.status === "PAID" || order.status === "FULFILLED") await refreshCart();
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof ApiClientError ? error.message : "We could not confirm this payment yet.",
      });
    }
  }, [reference, refreshCart]);

  useEffect(() => {
    void verify();
  }, [verify]);

  // Auto re-check pending payments (bank transfers can take a minute).
  useEffect(() => {
    if (state.kind !== "done" || state.order.status !== "PENDING" || attempts.current >= MAX_AUTO_CHECKS) return;
    const timer = setTimeout(() => void verify(), 5000);
    return () => clearTimeout(timer);
  }, [state, verify]);

  if (state.kind === "verifying") {
    return (
      <div className="panel mx-auto flex max-w-lg flex-col items-center gap-4 p-12 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-neon-cyan" />
        <p className="text-lg font-semibold">Confirming your payment…</p>
        <p className="text-sm text-ink-400">Please don&apos;t close this page.</p>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="panel mx-auto flex max-w-lg flex-col items-center gap-4 p-12 text-center">
        <XCircle className="h-12 w-12 text-neon-magenta" />
        <p className="text-lg font-semibold">We couldn&apos;t confirm this payment</p>
        <p className="text-sm text-ink-400">{state.message}</p>
        <div className="mt-2 flex gap-3">
          <button type="button" onClick={() => void verify()} className="btn-ghost">
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
          <Link href="/checkout" className="btn-primary">
            Back to checkout
          </Link>
        </div>
      </div>
    );
  }

  const { order } = state;
  const paid = order.status === "PAID" || order.status === "FULFILLED";
  const pending = order.status === "PENDING";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="panel relative overflow-hidden p-8 text-center sm:p-12">
        <div
          className={`pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full blur-[90px] ${
            paid ? "bg-neon-lime/25" : pending ? "bg-neon-cyan/20" : "bg-neon-magenta/25"
          }`}
        />
        <div className="relative">
          {paid ? (
            <CheckCircle2 className="mx-auto h-16 w-16 text-neon-lime" />
          ) : pending ? (
            <Clock className="mx-auto h-16 w-16 text-neon-cyan" />
          ) : (
            <XCircle className="mx-auto h-16 w-16 text-neon-magenta" />
          )}
          <p className="eyebrow mt-6">
            {paid ? "Payment confirmed" : pending ? "Awaiting confirmation" : "Payment not completed"}
          </p>
          <h1 className="mt-3 text-3xl font-bold">
            {paid
              ? "Thank you — your order is in!"
              : pending
                ? "We're waiting for your bank"
                : "Your payment didn't go through"}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-400">
            {paid
              ? `A confirmation will be sent to ${order.email}. We'll call you before delivery.`
              : pending
                ? "Some payment methods take a few minutes to confirm. This page re-checks automatically."
                : "No money was taken for this attempt. You can try again — your cart has been kept."}
          </p>
          <p className="mt-6 inline-flex items-center gap-2 rounded-xl border border-obsidian-600 bg-obsidian-950/70 px-4 py-2 font-mono text-sm">
            Order ref: <span className="text-neon-cyan">{order.reference}</span>
          </p>
          {pending && (
            <div className="mt-6">
              <button type="button" onClick={() => void verify()} className="btn-ghost">
                <RefreshCw className="h-4 w-4" /> Check again
              </button>
            </div>
          )}
          {!paid && !pending && (
            <div className="mt-6">
              <Link href="/checkout" className="btn-primary">
                Try payment again
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-5">
        <section className="panel p-6 md:col-span-3">
          <h2 className="eyebrow">Items</h2>
          <ul className="mt-4 divide-y divide-obsidian-800">
            {order.items.map((item) => (
              <li key={item.sku} className="flex items-center gap-3 py-3">
                <SafeImage
                  src={item.image}
                  alt=""
                  className="h-12 w-12 rounded-lg border border-obsidian-700 object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{item.name}</p>
                  <p className="font-mono text-[11px] text-ink-500">
                    {item.variantLabel} × {item.quantity}
                  </p>
                </div>
                <p className="font-mono text-sm">{formatMoney(item.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-obsidian-800 pt-4 text-sm">
            <div className="flex justify-between text-ink-400">
              <dt>Subtotal</dt>
              <dd className="font-mono text-ink-100">{formatMoney(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between text-ink-400">
              <dt>Delivery</dt>
              <dd className="font-mono text-ink-100">
                {order.shippingFee === 0 ? "FREE" : formatMoney(order.shippingFee)}
              </dd>
            </div>
            <div className="flex justify-between pt-1 text-base font-bold">
              <dt>{paid ? "Total paid" : "Total"}</dt>
              <dd className="font-mono text-neon-cyan">{formatMoney(order.total)}</dd>
            </div>
          </dl>
        </section>

        <section className="panel p-6 md:col-span-2">
          <h2 className="eyebrow">Delivery</h2>
          {order.shipping ? (
            <address className="mt-4 space-y-1 text-sm not-italic text-ink-300">
              <p className="font-semibold text-ink-100">{order.shipping.fullName}</p>
              <p>{order.shipping.address}</p>
              <p>
                {order.shipping.city}, {order.shipping.state}
              </p>
              <p className="font-mono text-xs text-ink-400">{order.shipping.phone}</p>
            </address>
          ) : (
            <p className="mt-4 text-sm text-ink-400">Sign in to view delivery details for this order.</p>
          )}
          {order.paymentChannel && (
            <p className="mt-4 text-xs text-ink-500">
              Paid via <span className="uppercase text-ink-300">{order.paymentChannel.replace(/_/g, " ")}</span>
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/shop" className="btn-primary">
              Continue shopping
            </Link>
            <Link href="/account" className="btn-ghost">
              View my orders
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

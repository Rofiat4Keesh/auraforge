"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Ban, Check, Copy, ExternalLink, Loader2, Printer, RefreshCw } from "lucide-react";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { STATUS_LABEL, isPaidStatus } from "@/lib/order-status";
import type { AdminOrderDetail } from "@/types/admin";
import type { OrderStatusDTO } from "@/types";
import { BackLink, StatusPill, formatDateTime } from "./ui";
import { SafeImage } from "@/components/ui/SafeImage";

/** What each status means, shown under the status selector so staff pick the right one. */
const STATUS_HELP: Partial<Record<OrderStatusDTO, string>> = {
  PROCESSING: "You are packing the order.",
  SHIPPED: "Handed to the courier / dispatch rider.",
  DELIVERED: "The customer has received it. This is final.",
  CANCELLED: "Stops the order. Paid orders must be refunded from your Paystack dashboard.",
};

/**
 * Full order details: items, shipping address, phone, Paystack reference and transactions,
 * plus a status selector (Processing → Shipped → Delivered, or Cancel).
 * Used as the /admin/orders/[reference] page and inside the order pop-up on the orders list.
 */
export function OrderDetailView({
  reference,
  variant = "page",
  onUpdated,
}: {
  reference: string;
  variant?: "page" | "modal";
  /** Called after the status changes, so the list behind the pop-up can refresh. */
  onUpdated?: (order: AdminOrderDetail) => void;
}) {
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<OrderStatusDTO | "">("");
  const [busy, setBusy] = useState(false);
  const [restock, setRestock] = useState(true);
  const [copied, setCopied] = useState<"address" | "reference" | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const loaded = await apiFetch<AdminOrderDetail>(`/api/admin/orders/${encodeURIComponent(reference)}`, { cache: "no-store" });
      setOrder(loaded);
      setNextStatus(loaded.allowedTransitions[0] ?? "");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not load this order.");
    }
  }, [reference]);

  useEffect(() => {
    void load();
  }, [load]);

  async function applyStatus() {
    if (!order || !nextStatus) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await apiFetch<AdminOrderDetail>(`/api/admin/orders/${encodeURIComponent(reference)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus, restock: nextStatus === "CANCELLED" ? restock : undefined }),
      });
      setOrder(updated);
      setNextStatus(updated.allowedTransitions[0] ?? "");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onUpdated?.(updated);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not update the order.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(kind: "address" | "reference") {
    if (!order) return;
    let text = order.reference;
    if (kind === "address") {
      if (!order.shipping) return;
      const s = order.shipping;
      text = `${s.fullName}\n${s.phone}\n${s.address}\n${s.city}, ${s.state}${s.notes ? `\nNote: ${s.notes}` : ""}`;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  if (!order) {
    return (
      <div>
        {variant === "page" && <BackLink href="/admin/orders" label="All orders" />}
        {error ? (
          <div className="rounded-xl border border-neon-magenta/40 p-4 text-sm text-neon-magenta">
            <p>{error}</p>
            <button type="button" onClick={() => void load()} className="btn-ghost mt-3">
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        ) : (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-neon-cyan" />
          </div>
        )}
      </div>
    );
  }

  const paid = isPaidStatus(order.status);
  const unitCount = order.items.reduce((s, i) => s + i.quantity, 0);
  const finalStatus = order.allowedTransitions.length === 0;
  const successfulPayment = order.transactions.find((t) => t.status === "SUCCESS");

  return (
    <div>
      {variant === "page" && (
        <div className="print:hidden">
          <BackLink href="/admin/orders" label="All orders" />
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className={`font-mono font-bold ${variant === "modal" ? "text-lg" : "text-xl sm:text-2xl"}`} id="order-detail-title">
              {order.reference}
            </h1>
            <StatusPill status={order.status} />
          </div>
          <p className="mt-1 text-sm text-ink-400">
            Placed {formatDateTime(order.createdAt)}
            {order.paidAt && <> · Paid {formatDateTime(order.paidAt)}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {variant === "modal" ? (
            <Link href={`/admin/orders/${order.reference}`} className="btn-ghost">
              <ExternalLink className="h-4 w-4" /> Full page
            </Link>
          ) : (
            <button type="button" className="btn-ghost" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print slip
            </button>
          )}
        </div>
      </div>

      {/* ---------- Status selector ---------- */}
      <section className="mb-6 rounded-2xl border border-neon-cyan/30 bg-neon-cyan/5 p-5 print:hidden">
        <h2 className="font-semibold">Update fulfilment status</h2>
        {finalStatus ? (
          <p className="mt-2 text-sm text-ink-300">
            This order is <strong>{STATUS_LABEL[order.status]}</strong>. That is a final status, so it can&apos;t be changed.
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <label htmlFor={`status-${order.reference}`} className="label">
                  Move order to
                </label>
                <select
                  id={`status-${order.reference}`}
                  className="input"
                  value={nextStatus}
                  onChange={(e) => {
                    setNextStatus(e.target.value as OrderStatusDTO);
                    setSaved(false);
                  }}
                >
                  {order.allowedTransitions.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => void applyStatus()}
                disabled={busy || !nextStatus}
                className={nextStatus === "CANCELLED" ? "btn bg-neon-magenta text-white hover:brightness-110" : "btn-primary"}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : nextStatus === "CANCELLED" ? <Ban className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                {nextStatus === "CANCELLED" ? "Cancel order" : "Update status"}
              </button>
            </div>
            {nextStatus && STATUS_HELP[nextStatus] && <p className="mt-2 text-xs text-ink-400">{STATUS_HELP[nextStatus]}</p>}
            {order.status === "PENDING" && (
              <p className="mt-2 text-xs text-ink-400">
                Awaiting payment: it moves to Paid by itself when Paystack confirms the payment.
              </p>
            )}
            {nextStatus === "CANCELLED" && (
              <div className="mt-3 rounded-xl border border-neon-magenta/40 bg-neon-magenta/5 p-3 text-sm text-ink-300">
                <p>
                  {paid
                    ? "The customer has paid. Cancelling here does not refund them. Issue the refund from your Paystack dashboard (Transactions → this payment → Refund)."
                    : "No payment was taken for this order."}
                </p>
                {order.stockDeducted && (
                  <label className="mt-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={restock}
                      onChange={(e) => setRestock(e.target.checked)}
                      className="h-4 w-4 accent-[#22F3FF]"
                    />
                    Put the {unitCount} unit(s) back into stock
                  </label>
                )}
              </div>
            )}
          </>
        )}
        {saved && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-neon-lime" role="status">
            <Check className="h-4 w-4" /> Status updated to {STATUS_LABEL[order.status]}.
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm text-neon-magenta" role="alert">
            {error}
          </p>
        )}
      </section>

      <div className={`grid gap-6 ${variant === "modal" ? "lg:grid-cols-5" : "xl:grid-cols-3"}`}>
        <section className={`min-w-0 rounded-2xl border border-obsidian-700 bg-obsidian-900/70 p-5 ${variant === "modal" ? "lg:col-span-3" : "xl:col-span-2"}`}>
          <h2 className="font-semibold">Items ({unitCount})</h2>
          <ul className="mt-3 divide-y divide-obsidian-800">
            {order.items.map((item) => (
              <li key={item.sku} className="flex flex-wrap items-center gap-3 py-3">
                <SafeImage src={item.image} alt="" className="h-12 w-12 rounded-lg border border-obsidian-700 object-contain print:hidden" />
                <div className="min-w-0 flex-1">
                  <Link href={`/product/${item.productSlug}`} target="_blank" className="text-sm hover:text-neon-cyan">
                    {item.name}
                  </Link>
                  <p className="font-mono text-[11px] text-ink-500">
                    {item.sku} · {item.variantLabel}
                  </p>
                </div>
                <p className="font-mono text-sm tabular-nums text-ink-400">
                  {item.quantity} × {formatMoney(item.unitPrice)}
                </p>
                <p className="w-28 text-right font-mono text-sm tabular-nums">{formatMoney(item.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1.5 border-t border-obsidian-800 pt-3 text-sm">
            <div className="flex justify-between text-ink-400">
              <dt>Subtotal</dt>
              <dd className="font-mono tabular-nums text-ink-100">{formatMoney(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between text-ink-400">
              <dt>Delivery</dt>
              <dd className="font-mono tabular-nums text-ink-100">{order.shippingFee === 0 ? "Free" : formatMoney(order.shippingFee)}</dd>
            </div>
            <div className="flex justify-between text-base font-bold">
              <dt>Total</dt>
              <dd className="font-mono tabular-nums text-neon-cyan">{formatMoney(order.total)}</dd>
            </div>
          </dl>
        </section>

        <div className={`min-w-0 space-y-6 ${variant === "modal" ? "lg:col-span-2" : ""}`}>
          <section className="rounded-2xl border border-obsidian-700 bg-obsidian-900/70 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Shipping information</h2>
              <button type="button" onClick={() => void copy("address")} className="chip print:hidden">
                {copied === "address" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied === "address" ? "Copied" : "Copy"}
              </button>
            </div>
            {order.shipping ? (
              <address className="mt-3 space-y-0.5 text-sm not-italic text-ink-300">
                <p className="font-semibold text-ink-100">{order.shipping.fullName}</p>
                <p>
                  Phone:{" "}
                  <a href={`tel:${order.shipping.phone.replace(/\s/g, "")}`} className="font-mono text-neon-cyan hover:underline">
                    {order.shipping.phone}
                  </a>
                </p>
                <p>{order.shipping.address}</p>
                <p>
                  {order.shipping.city}, {order.shipping.state}
                </p>
                {order.shipping.notes && <p className="mt-2 rounded-lg bg-obsidian-850 p-2 text-xs text-ink-400">Note: {order.shipping.notes}</p>}
              </address>
            ) : (
              <p className="mt-2 text-sm text-ink-400">No shipping details on this order.</p>
            )}
          </section>

          <section className="rounded-2xl border border-obsidian-700 bg-obsidian-900/70 p-5">
            <h2 className="font-semibold">Customer</h2>
            <p className="mt-2 break-all text-sm text-ink-300">{order.email}</p>
            <p className="mt-1 text-xs text-ink-500">
              {order.account ? <>Account: {order.account.fullName}</> : "Older guest order (no account)"}
            </p>
          </section>

          <section className="rounded-2xl border border-obsidian-700 bg-obsidian-900/70 p-5 print:hidden">
            <h2 className="font-semibold">Payment (Paystack)</h2>
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-obsidian-850 p-3 text-sm">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Paystack reference</p>
                <p className="truncate font-mono text-ink-100">{order.reference}</p>
              </div>
              <button type="button" onClick={() => void copy("reference")} className="chip shrink-0">
                {copied === "reference" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied === "reference" ? "Copied" : "Copy"}
              </button>
            </div>
            {successfulPayment?.channel && (
              <p className="mt-2 text-xs text-ink-400">Paid by {successfulPayment.channel.replace(/_/g, " ")}</p>
            )}
            {order.transactions.length === 0 ? (
              <p className="mt-2 text-sm text-ink-400">No payment attempt recorded yet.</p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm">
                {order.transactions.map((t) => (
                  <li key={`${t.reference}-${t.updatedAt}`} className="rounded-xl border border-obsidian-700 p-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-mono text-xs font-bold ${
                          t.status === "SUCCESS" ? "text-neon-lime" : t.status === "INITIALIZED" ? "text-ink-300" : "text-neon-magenta"
                        }`}
                      >
                        {t.status}
                      </span>
                      <span className="font-mono tabular-nums">{formatMoney(t.amount)}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      {t.channel ? `${t.channel.replace(/_/g, " ")} · ` : ""}
                      {t.gatewayResponse ?? "—"}
                    </p>
                    <p className="text-xs text-ink-500">
                      Confirmed via {t.lastSource.toLowerCase()} · {formatDateTime(t.updatedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-ink-500">Refunds are issued from your Paystack dashboard.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

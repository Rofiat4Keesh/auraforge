"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Ban, Check, Copy, Loader2, PackageCheck, Printer, Undo2 } from "lucide-react";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import type { AdminOrderDetail } from "@/types/admin";
import { BackLink, StatusPill, formatDateTime } from "./ui";
import { SafeImage } from "@/components/ui/SafeImage";

type Action = "FULFILLED" | "PAID" | "CANCELLED";

export function OrderDetailView({ reference }: { reference: string }) {
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [restock, setRestock] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrder(
        await apiFetch<AdminOrderDetail>(`/api/admin/orders/${encodeURIComponent(reference)}`, { cache: "no-store" }),
      );
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not load this order.");
    }
  }, [reference]);

  useEffect(() => {
    void load();
  }, [load]);

  async function change(status: Action) {
    setBusy(status);
    setError(null);
    try {
      const updated = await apiFetch<AdminOrderDetail>(`/api/admin/orders/${encodeURIComponent(reference)}`, {
        method: "PATCH",
        body: JSON.stringify({ status, restock: status === "CANCELLED" ? restock : undefined }),
      });
      setOrder(updated);
      setConfirmCancel(false);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not update the order.");
    } finally {
      setBusy(null);
    }
  }

  async function copyAddress() {
    if (!order?.shipping) return;
    const s = order.shipping;
    const text = `${s.fullName}\n${s.phone}\n${s.address}\n${s.city}, ${s.state}${s.notes ? `\nNote: ${s.notes}` : ""}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!order) {
    return (
      <div>
        <BackLink href="/admin/orders" label="All orders" />
        {error ? (
          <p className="rounded-xl border border-neon-magenta/40 p-4 text-sm text-neon-magenta">{error}</p>
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-neon-cyan" />
        )}
      </div>
    );
  }

  const paidLike = order.status === "PAID" || order.status === "FULFILLED";

  return (
    <div>
      <div className="print:hidden">
        <BackLink href="/admin/orders" label="All orders" />
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-xl font-bold sm:text-2xl">{order.reference}</h1>
            <StatusPill status={order.status} />
          </div>
          <p className="mt-1 text-sm text-ink-400">
            Placed {formatDateTime(order.createdAt)}
            {order.paidAt && <> · Paid {formatDateTime(order.paidAt)}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {order.status === "PAID" && (
            <button type="button" className="btn-primary" disabled={busy !== null} onClick={() => change("FULFILLED")}>
              {busy === "FULFILLED" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PackageCheck className="h-4 w-4" />
              )}
              Mark as fulfilled
            </button>
          )}
          {order.status === "FULFILLED" && (
            <button type="button" className="btn-ghost" disabled={busy !== null} onClick={() => change("PAID")}>
              {busy === "PAID" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
              Move back to "to ship"
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print slip
          </button>
          {order.status !== "CANCELLED" && !confirmCancel && (
            <button
              type="button"
              className="btn border border-neon-magenta/40 text-neon-magenta hover:bg-neon-magenta/10"
              onClick={() => setConfirmCancel(true)}
            >
              <Ban className="h-4 w-4" /> Cancel order
            </button>
          )}
        </div>
      </div>

      {confirmCancel && (
        <div className="mb-6 rounded-2xl border border-neon-magenta/40 bg-neon-magenta/5 p-5 print:hidden">
          <p className="font-semibold">Cancel {order.reference}?</p>
          <p className="mt-1 text-sm text-ink-300">
            {paidLike
              ? "The customer has paid. Cancelling here does not refund them — issue the refund from your Paystack dashboard (Transactions → this payment → Refund)."
              : "No payment was taken for this order."}
          </p>
          {order.stockDeducted && (
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                id="restock"
                type="checkbox"
                checked={restock}
                onChange={(e) => setRestock(e.target.checked)}
                className="h-4 w-4 accent-[#22F3FF]"
              />
              Put the {order.items.reduce((s, i) => s + i.quantity, 0)} unit(s) back into stock
            </label>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn bg-neon-magenta text-white hover:brightness-110"
              disabled={busy !== null}
              onClick={() => change("CANCELLED")}
            >
              {busy === "CANCELLED" && <Loader2 className="h-4 w-4 animate-spin" />} Yes, cancel order
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirmCancel(false)}>
              Keep order
            </button>
          </div>
        </div>
      )}

      {error && <p className="mb-4 rounded-xl border border-neon-magenta/40 p-3 text-sm text-neon-magenta">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-obsidian-700 bg-obsidian-900/70 p-5 xl:col-span-2">
          <h2 className="font-semibold">Items</h2>
          <ul className="mt-3 divide-y divide-obsidian-800">
            {order.items.map((item) => (
              <li key={item.sku} className="flex items-center gap-3 py-3">
                <SafeImage
                  src={item.image}
                  alt=""
                  className="h-12 w-12 rounded-lg border border-obsidian-700 object-contain print:hidden"
                />
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
              <dd className="font-mono tabular-nums text-ink-100">
                {order.shippingFee === 0 ? "Free" : formatMoney(order.shippingFee)}
              </dd>
            </div>
            <div className="flex justify-between text-base font-bold">
              <dt>Total</dt>
              <dd className="font-mono tabular-nums text-neon-cyan">{formatMoney(order.total)}</dd>
            </div>
          </dl>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-obsidian-700 bg-obsidian-900/70 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Deliver to</h2>
              <button type="button" onClick={copyAddress} className="chip print:hidden">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {order.shipping && (
              <address className="mt-3 space-y-0.5 text-sm not-italic text-ink-300">
                <p className="font-semibold text-ink-100">{order.shipping.fullName}</p>
                <p className="font-mono">{order.shipping.phone}</p>
                <p>{order.shipping.address}</p>
                <p>
                  {order.shipping.city}, {order.shipping.state}
                </p>
                {order.shipping.notes && (
                  <p className="mt-2 rounded-lg bg-obsidian-850 p-2 text-xs text-ink-400">
                    Note: {order.shipping.notes}
                  </p>
                )}
              </address>
            )}
          </section>

          <section className="rounded-2xl border border-obsidian-700 bg-obsidian-900/70 p-5">
            <h2 className="font-semibold">Customer</h2>
            <p className="mt-2 text-sm text-ink-300">{order.email}</p>
            <p className="mt-1 text-xs text-ink-500">
              {order.account ? <>Signed-in customer: {order.account.fullName}</> : "Guest checkout (no account)"}
            </p>
          </section>

          <section className="rounded-2xl border border-obsidian-700 bg-obsidian-900/70 p-5 print:hidden">
            <h2 className="font-semibold">Payment (Paystack)</h2>
            {order.transactions.length === 0 ? (
              <p className="mt-2 text-sm text-ink-400">No payment record.</p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm">
                {order.transactions.map((t) => (
                  <li key={t.reference} className="rounded-xl bg-obsidian-850 p-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-mono text-xs font-bold ${
                          t.status === "SUCCESS"
                            ? "text-neon-lime"
                            : t.status === "INITIALIZED"
                              ? "text-ink-300"
                              : "text-neon-magenta"
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

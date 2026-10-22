"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import type { AdminOrderRow, Paged } from "@/types/admin";
import { EmptyRow, Pagination, StatusPill, TableShell, formatDateTime, td, th } from "./ui";

const FILTERS = [
  { value: "", label: "All" },
  { value: "PAID", label: "To ship" },
  { value: "PENDING", label: "Awaiting payment" },
  { value: "FULFILLED", label: "Fulfilled" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function OrdersTable({ initialStatus, initialQuery }: { initialStatus: string; initialQuery: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [query, setQuery] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<AdminOrderRow> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (debounced) params.set("q", debounced);
    params.set("page", String(page));
    window.history.replaceState(null, "", `/admin/orders?${params.toString().replace(/&?page=1$/, "")}`);
    const controller = new AbortController();
    setLoading(true);
    apiFetch<Paged<AdminOrderRow>>(`/api/admin/orders?${params}`, { signal: controller.signal, cache: "no-store" })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Could not load orders.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [status, debounced, page]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setStatus(f.value);
                setPage(1);
              }}
              className={`chip ${status === f.value ? "chip-active" : ""}`}
              aria-pressed={status === f.value}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            id="orders-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Reference, email, name or phone"
            className="input py-2 pl-9"
            aria-label="Search orders"
          />
        </div>
      </div>

      {error && <p className="mb-4 rounded-xl border border-neon-magenta/40 p-3 text-sm text-neon-magenta">{error}</p>}

      <TableShell>
        <thead className="border-b border-obsidian-800">
          <tr>
            <th className={th}>Order</th>
            <th className={th}>Customer</th>
            <th className={th}>Status</th>
            <th className={`${th} text-right`}>Items</th>
            <th className={`${th} text-right`}>Total</th>
            <th className={th}>Placed</th>
          </tr>
        </thead>
        <tbody className={`divide-y divide-obsidian-800 ${loading ? "opacity-60" : ""}`}>
          {!data && loading ? (
            <EmptyRow colSpan={6}>
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-neon-cyan" />
            </EmptyRow>
          ) : data && data.rows.length === 0 ? (
            <EmptyRow colSpan={6}>No orders match this view.</EmptyRow>
          ) : (
            data?.rows.map((o) => (
              <tr key={o.reference} className="transition hover:bg-obsidian-850">
                <td className={td}>
                  <Link href={`/admin/orders/${o.reference}`} className="font-mono text-neon-cyan hover:underline">
                    {o.reference}
                  </Link>
                </td>
                <td className={td}>
                  <p className="text-ink-100">{o.customerName}</p>
                  <p className="text-xs text-ink-500">
                    {o.email} · {o.state}
                  </p>
                </td>
                <td className={td}>
                  <StatusPill status={o.status} />
                </td>
                <td className={`${td} text-right font-mono tabular-nums`}>{o.itemCount}</td>
                <td className={`${td} text-right font-mono tabular-nums`}>{formatMoney(o.total)}</td>
                <td className={`${td} whitespace-nowrap text-xs text-ink-400`}>{formatDateTime(o.createdAt)}</td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>
      {data && (
        <div className="flex flex-wrap items-center justify-between">
          <p className="mt-4 text-xs text-ink-500">{data.total} order(s)</p>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

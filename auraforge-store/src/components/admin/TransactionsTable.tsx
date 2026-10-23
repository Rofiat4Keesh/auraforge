"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import type { AdminTransactionRow, PagedTransactions } from "@/types/admin";
import { EmptyRow, Pagination, StatusPill, TableShell, formatDateTime, td, th } from "./ui";

const FILTERS = [
  { value: "", label: "All" },
  { value: "SUCCESS", label: "Successful" },
  { value: "INITIALIZED", label: "Started, not paid" },
  { value: "FAILED", label: "Failed" },
  { value: "ABANDONED", label: "Abandoned" },
];

const TX_STYLE: Record<AdminTransactionRow["status"], string> = {
  SUCCESS: "border-neon-lime/40 bg-neon-lime/10 text-neon-lime",
  INITIALIZED: "border-ink-500/40 bg-ink-500/10 text-ink-300",
  FAILED: "border-neon-magenta/40 bg-neon-magenta/10 text-neon-magenta",
  ABANDONED: "border-obsidian-500 bg-obsidian-800 text-ink-500",
};

const TX_LABEL: Record<AdminTransactionRow["status"], string> = {
  SUCCESS: "Success",
  INITIALIZED: "Started",
  FAILED: "Failed",
  ABANDONED: "Abandoned",
};

/** Turns the rows on screen into a CSV file for accounting (opens in Excel / Google Sheets). */
function downloadCsv(rows: AdminTransactionRow[]) {
  const header = ["Date (Lagos)", "Paystack reference", "Paystack ID", "Status", "Amount (NGN)", "Channel", "Customer", "Email", "Order status", "Gateway response"];
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      formatDateTime(r.createdAt),
      r.reference,
      r.paystackId ?? "",
      r.status,
      (r.amount / 100).toFixed(2),
      r.channel ?? "",
      r.customerName,
      r.customerEmail,
      r.orderStatus,
      r.gatewayResponse ?? "",
    ]
      .map((v) => cell(String(v)))
      .join(","),
  );
  const blob = new Blob([[header.map(cell).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `auraforge-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Admin → Transactions: every Paystack payment attempt, with totals for the current filter. */
export function TransactionsTable() {
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PagedTransactions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set("status", status);
    if (debounced) params.set("q", debounced);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const controller = new AbortController();
    setLoading(true);
    apiFetch<PagedTransactions>(`/api/admin/transactions?${params}`, { signal: controller.signal, cache: "no-store" })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Could not load transactions.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [status, debounced, from, to, page]);

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  return (
    <div>
      {data && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Collected", value: formatMoney(data.totals.successAmount), tone: "text-neon-lime" },
            { label: "Successful", value: data.totals.successCount.toLocaleString("en-NG"), tone: "text-ink-100" },
            { label: "Started, not paid", value: data.totals.pendingCount.toLocaleString("en-NG"), tone: "text-ink-100" },
            { label: "Failed / abandoned", value: data.totals.failedCount.toLocaleString("en-NG"), tone: "text-neon-magenta" },
          ].map((t) => (
            <div key={t.label} className="min-w-0 rounded-2xl border border-obsidian-700 bg-obsidian-900/70 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">{t.label}</p>
              <p className={`mt-2 truncate font-mono text-xl font-bold tabular-nums ${t.tone}`}>{t.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => resetPage(setStatus)(f.value)}
            className={`chip ${status === f.value ? "chip-active" : ""}`}
            aria-pressed={status === f.value}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => resetPage(setQuery)(e.target.value)}
            placeholder="Reference, Paystack ID or email"
            className="input py-2 pl-9"
            aria-label="Search transactions"
          />
        </div>
        <label className="text-xs text-ink-400">
          From
          <input type="date" value={from} onChange={(e) => resetPage(setFrom)(e.target.value)} className="input mt-1 py-2" />
        </label>
        <label className="text-xs text-ink-400">
          To
          <input type="date" value={to} onChange={(e) => resetPage(setTo)(e.target.value)} className="input mt-1 py-2" />
        </label>
        <button type="button" onClick={() => data && downloadCsv(data.rows)} disabled={!data || data.rows.length === 0} className="btn-ghost ml-auto">
          <Download className="h-4 w-4" /> Download CSV (this page)
        </button>
      </div>

      {error && <p className="mb-4 rounded-xl border border-neon-magenta/40 p-3 text-sm text-neon-magenta">{error}</p>}

      <TableShell>
        <thead className="border-b border-obsidian-800">
          <tr>
            <th className={th}>Date</th>
            <th className={th}>Paystack reference</th>
            <th className={th}>Customer</th>
            <th className={th}>Channel</th>
            <th className={th}>Payment</th>
            <th className={th}>Order</th>
            <th className={`${th} text-right`}>Amount</th>
          </tr>
        </thead>
        <tbody className={`divide-y divide-obsidian-800 ${loading ? "opacity-60" : ""}`}>
          {!data && loading ? (
            <EmptyRow colSpan={7}>
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-neon-cyan" />
            </EmptyRow>
          ) : data && data.rows.length === 0 ? (
            <EmptyRow colSpan={7}>No transactions match this view. They appear here as soon as a shopper reaches the Paystack payment page.</EmptyRow>
          ) : (
            data?.rows.map((t) => (
              <tr key={`${t.reference}-${t.createdAt}`} className="transition hover:bg-obsidian-850">
                <td className={`${td} whitespace-nowrap text-xs text-ink-400`}>{formatDateTime(t.createdAt)}</td>
                <td className={td}>
                  <p className="font-mono text-ink-100">{t.reference}</p>
                  {t.paystackId && <p className="font-mono text-[11px] text-ink-500">ID {t.paystackId}</p>}
                </td>
                <td className={td}>
                  <p className="max-w-[180px] truncate">{t.customerName}</p>
                  <p className="max-w-[180px] truncate text-xs text-ink-500">{t.customerEmail}</p>
                </td>
                <td className={`${td} capitalize text-ink-300`}>{t.channel ? t.channel.replace(/_/g, " ") : "—"}</td>
                <td className={td}>
                  <span
                    className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${TX_STYLE[t.status]}`}
                    title={t.gatewayResponse ?? undefined}
                  >
                    {TX_LABEL[t.status]}
                  </span>
                </td>
                <td className={td}>
                  <Link href={`/admin/orders?open=${t.orderReference}`} className="inline-flex" aria-label={`Open order ${t.orderReference}`}>
                    <StatusPill status={t.orderStatus} />
                  </Link>
                </td>
                <td className={`${td} whitespace-nowrap text-right font-mono font-semibold tabular-nums`}>{formatMoney(t.amount)}</td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>
      {data && (
        <div className="flex flex-wrap items-center justify-between">
          <p className="mt-4 text-xs text-ink-500">{data.total} transaction(s)</p>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { ChevronDown, Loader2, Search, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import type { AdminCustomerRow, AdminOrderRow, Paged } from "@/types/admin";
import { EmptyRow, Pagination, StatusPill, TableShell, formatDate, formatDateTime, td, th } from "./ui";

export function CustomersTable() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<AdminCustomerRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Record<string, AdminOrderRow[]>>({});

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (debounced) params.set("q", debounced);
    const controller = new AbortController();
    setLoading(true);
    apiFetch<Paged<AdminCustomerRow>>(`/api/admin/customers?${params}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Could not load customers.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debounced, page]);

  async function toggle(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (!orders[id]) {
      try {
        const list = await apiFetch<AdminOrderRow[]>(`/api/admin/customers/${id}/orders`, { cache: "no-store" });
        setOrders((o) => ({ ...o, [id]: list }));
      } catch {
        setOrders((o) => ({ ...o, [id]: [] }));
      }
    }
  }

  return (
    <div>
      <div className="relative mb-4 w-full sm:w-80">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
        <input
          id="customers-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Name, email or phone"
          className="input py-2 pl-9"
          aria-label="Search customers"
        />
      </div>

      {error && <p className="mb-4 rounded-xl border border-neon-magenta/40 p-3 text-sm text-neon-magenta">{error}</p>}

      <TableShell>
        <thead className="border-b border-obsidian-800">
          <tr>
            <th className={th}>Customer</th>
            <th className={th}>Phone</th>
            <th className={`${th} text-right`}>Paid orders</th>
            <th className={`${th} text-right`}>Total spent</th>
            <th className={th}>Last order</th>
            <th className={th}>Joined</th>
            <th className={th}>
              <span className="sr-only">Orders</span>
            </th>
          </tr>
        </thead>
        <tbody className={`divide-y divide-obsidian-800 ${loading ? "opacity-60" : ""}`}>
          {!data && loading ? (
            <EmptyRow colSpan={7}>
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-neon-cyan" />
            </EmptyRow>
          ) : data && data.rows.length === 0 ? (
            <EmptyRow colSpan={7}>No customers found. Guest checkouts appear under Orders.</EmptyRow>
          ) : (
            data?.rows.map((c) => (
              <Fragment key={c.id}>
                <tr className="transition hover:bg-obsidian-850">
                  <td className={td}>
                    <p className="flex items-center gap-1.5 text-ink-100">
                      {c.fullName}
                      {c.role === "ADMIN" && (
                        <ShieldCheck className="h-3.5 w-3.5 text-neon-violet" aria-label="Admin" />
                      )}
                    </p>
                    <p className="text-xs text-ink-500">{c.email}</p>
                  </td>
                  <td className={`${td} font-mono text-xs text-ink-300`}>{c.phone ?? "—"}</td>
                  <td className={`${td} text-right font-mono tabular-nums`}>{c.orders}</td>
                  <td className={`${td} text-right font-mono tabular-nums`}>{formatMoney(c.totalSpent)}</td>
                  <td className={`${td} text-xs text-ink-400`}>{formatDate(c.lastOrderAt)}</td>
                  <td className={`${td} text-xs text-ink-400`}>{formatDate(c.joinedAt)}</td>
                  <td className={`${td} text-right`}>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => toggle(c.id)}
                      aria-expanded={openId === c.id}
                      aria-label={`Show orders for ${c.fullName}`}
                    >
                      Orders <ChevronDown className={`h-3 w-3 transition ${openId === c.id ? "rotate-180" : ""}`} />
                    </button>
                  </td>
                </tr>
                {openId === c.id && (
                  <tr className="bg-obsidian-950/60">
                    <td colSpan={7} className="px-4 py-3">
                      {!orders[c.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin text-neon-cyan" />
                      ) : orders[c.id].length === 0 ? (
                        <p className="text-sm text-ink-400">No orders placed while signed in.</p>
                      ) : (
                        <ul className="space-y-1">
                          {orders[c.id].map((o) => (
                            <li key={o.reference}>
                              <Link
                                href={`/admin/orders/${o.reference}`}
                                className="flex flex-wrap items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-obsidian-850"
                              >
                                <span className="font-mono text-neon-cyan">{o.reference}</span>
                                <StatusPill status={o.status} />
                                <span className="ml-auto font-mono tabular-nums">{formatMoney(o.total)}</span>
                                <span className="text-xs text-ink-500">{formatDateTime(o.createdAt)}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))
          )}
        </tbody>
      </TableShell>
      {data && (
        <div className="flex flex-wrap items-center justify-between">
          <p className="mt-4 text-xs text-ink-500">{data.total} account(s)</p>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

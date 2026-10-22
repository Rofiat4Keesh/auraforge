"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Search, Star } from "lucide-react";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import type { AdminCategoryRow, AdminProductRow, Paged } from "@/types/admin";
import { EmptyRow, Pagination, TableShell, formatDate, td, th } from "./ui";
import { SafeImage } from "@/components/ui/SafeImage";

interface Props {
  categories: AdminCategoryRow[];
  initialStock: string;
}

export function ProductsTable({ categories, initialStock }: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [stock, setStock] = useState(initialStock);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<AdminProductRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (debounced) params.set("q", debounced);
    if (categoryId) params.set("categoryId", categoryId);
    if (status) params.set("status", status);
    if (stock) params.set("stock", stock);
    const controller = new AbortController();
    setLoading(true);
    apiFetch<Paged<AdminProductRow>>(`/api/admin/products?${params}`, { signal: controller.signal, cache: "no-store" })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Could not load products.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debounced, categoryId, status, stock, page, reloadKey]);

  async function toggle(row: AdminProductRow) {
    setToggling(row.id);
    try {
      await apiFetch(`/api/admin/products/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !row.active }),
      });
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not change visibility.");
    } finally {
      setToggling(null);
    }
  }

  const select =
    "rounded-xl border border-obsidian-600 bg-obsidian-850 px-3 py-2 text-sm text-ink-100 focus:border-neon-cyan focus:outline-none";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            id="products-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Name, brand or SKU"
            className="input py-2 pl-9"
            aria-label="Search products"
          />
        </div>
        <select
          id="products-category"
          className={select}
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          aria-label="Category"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          id="products-status"
          className={select}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Visibility"
        >
          <option value="">Visible and hidden</option>
          <option value="active">Visible in shop</option>
          <option value="hidden">Hidden</option>
        </select>
        <select
          id="products-stock"
          className={select}
          value={stock}
          onChange={(e) => {
            setStock(e.target.value);
            setPage(1);
          }}
          aria-label="Stock"
        >
          <option value="">Any stock</option>
          <option value="low">Low stock (5 or fewer)</option>
          <option value="out">Out of stock</option>
        </select>
      </div>

      {error && <p className="mb-4 rounded-xl border border-neon-magenta/40 p-3 text-sm text-neon-magenta">{error}</p>}

      <TableShell>
        <thead className="border-b border-obsidian-800">
          <tr>
            <th className={th}>Product</th>
            <th className={th}>Category</th>
            <th className={`${th} text-right`}>Price</th>
            <th className={`${th} text-right`}>Stock</th>
            <th className={th}>Updated</th>
            <th className={`${th} text-right`}>Shop</th>
          </tr>
        </thead>
        <tbody className={`divide-y divide-obsidian-800 ${loading ? "opacity-60" : ""}`}>
          {!data && loading ? (
            <EmptyRow colSpan={6}>
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-neon-cyan" />
            </EmptyRow>
          ) : data && data.rows.length === 0 ? (
            <EmptyRow colSpan={6}>No products match these filters.</EmptyRow>
          ) : (
            data?.rows.map((p) => (
              <tr key={p.id} className={`transition hover:bg-obsidian-850 ${p.active ? "" : "opacity-60"}`}>
                <td className={td}>
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                    <SafeImage
                      src={p.image}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-lg border border-obsidian-700 object-contain"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-ink-100 hover:text-neon-cyan">
                        {p.featured && (
                          <Star className="h-3 w-3 shrink-0 fill-neon-lime text-neon-lime" aria-label="Featured" />
                        )}
                        <span className="truncate">{p.name}</span>
                      </span>
                      <span className="block text-xs text-ink-500">
                        {p.brand} · {p.variantCount} variant{p.variantCount === 1 ? "" : "s"} · {p.source}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className={`${td} text-ink-300`}>{p.categoryName}</td>
                <td className={`${td} whitespace-nowrap text-right font-mono tabular-nums`}>
                  {formatMoney(p.minPrice)}
                  {p.maxPrice > p.minPrice && <span className="text-ink-500"> – {formatMoney(p.maxPrice)}</span>}
                </td>
                <td className={`${td} text-right`}>
                  <span
                    className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold tabular-nums ${
                      p.totalStock === 0
                        ? "bg-neon-magenta/15 text-neon-magenta"
                        : p.totalStock <= 5
                          ? "bg-neon-lime/10 text-neon-lime"
                          : "text-ink-100"
                    }`}
                  >
                    {p.totalStock === 0 ? "OUT" : p.totalStock}
                  </span>
                </td>
                <td className={`${td} whitespace-nowrap text-xs text-ink-400`}>{formatDate(p.updatedAt)}</td>
                <td className={`${td} text-right`}>
                  <button
                    type="button"
                    onClick={() => toggle(p)}
                    disabled={toggling === p.id}
                    className={`chip ${p.active ? "chip-active" : ""}`}
                    aria-label={p.active ? `Hide ${p.name} from the shop` : `Show ${p.name} in the shop`}
                  >
                    {toggling === p.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : p.active ? (
                      <Eye className="h-3 w-3" />
                    ) : (
                      <EyeOff className="h-3 w-3" />
                    )}
                    {p.active ? "Visible" : "Hidden"}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>
      {data && (
        <div className="flex flex-wrap items-center justify-between">
          <p className="mt-4 text-xs text-ink-500">{data.total} product(s)</p>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, SlidersHorizontal, X } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { BASE_CURRENCY, DISPLAY_CURRENCY, convertMinor, currencySymbol, formatMoney, fromMinor } from "@/lib/money";
import type { CatalogResult, CategoryDTO } from "@/types";
import { ProductCard } from "./ProductCard";

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "newest", label: "Newest" },
];

/** Stored price (base minor units) -> whole number in the display currency, for input placeholders. */
const toDisplayMajor = (minor: number) =>
  fromMinor(convertMinor(minor, BASE_CURRENCY, DISPLAY_CURRENCY), DISPLAY_CURRENCY);

const PRICE_PRESETS = [
  { label: `Under ${currencySymbol}50k`, min: "", max: "50000" },
  { label: `${currencySymbol}50k – ${currencySymbol}250k`, min: "50000", max: "250000" },
  { label: `${currencySymbol}250k – ${currencySymbol}1M`, min: "250000", max: "1000000" },
  { label: `Over ${currencySymbol}1M`, min: "1000000", max: "" },
];

interface CatalogViewProps {
  initialResult: CatalogResult;
  categories: CategoryDTO[];
  initialQuery: string;
}

/**
 * Interactive catalog. Every filter change updates the URL (so results are shareable and the
 * back button works) and fetches /api/products in the background — no full page reload.
 */
export function CatalogView({ initialResult, categories, initialQuery }: CatalogViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState(initialResult);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const firstRender = useRef(true);

  const params = useMemo(() => new URLSearchParams(query), [query]);
  const [minInput, setMinInput] = useState(params.get("min") ?? "");
  const [maxInput, setMaxInput] = useState(params.get("max") ?? "");

  const update = useCallback((mutate: (p: URLSearchParams) => void, keepPage = false) => {
    setQuery((current) => {
      const next = new URLSearchParams(current);
      mutate(next);
      if (!keepPage) next.delete("page");
      return next.toString();
    });
  }, []);

  // Fetch results whenever the query changes.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    window.history.replaceState(null, "", query ? `/shop?${query}` : "/shop");
    apiFetch<CatalogResult>(`/api/products?${query}`, { signal: controller.signal })
      .then((data) => setResult(data))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Could not load products.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query]);

  // Debounce the typed price range so we do not fetch on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentMin = params.get("min") ?? "";
      const currentMax = params.get("max") ?? "";
      if (minInput === currentMin && maxInput === currentMax) return;
      update((p) => {
        if (minInput) p.set("min", minInput);
        else p.delete("min");
        if (maxInput) p.set("max", maxInput);
        else p.delete("max");
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [minInput, maxInput, params, update]);

  // Lock scrolling while the mobile filter sheet is open.
  useEffect(() => {
    if (!filtersOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [filtersOpen]);

  const toggleMulti = (key: string, value: string) =>
    update((p) => {
      const values = p.getAll(key);
      p.delete(key);
      const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
      next.forEach((v) => p.append(key, v));
    });

  const setSingle = (key: string, value: string | null) =>
    update((p) => {
      if (value) p.set(key, value);
      else p.delete(key);
    });

  const clearAll = () => {
    const q = params.get("q");
    setMinInput("");
    setMaxInput("");
    setQuery(q ? new URLSearchParams({ q }).toString() : "");
  };

  const activeCategory = params.get("category");
  const activeBrands = params.getAll("brand");
  const searchTerm = params.get("q");
  const sort = params.get("sort") ?? "featured";
  const inStock = params.get("inStock") === "1";

  const activeChips: { label: string; remove: () => void }[] = [];
  if (searchTerm) activeChips.push({ label: `“${searchTerm}”`, remove: () => setSingle("q", null) });
  if (activeCategory) {
    const name = categories.find((c) => c.slug === activeCategory)?.name ?? activeCategory;
    activeChips.push({ label: name, remove: () => setSingle("category", null) });
  }
  activeBrands.forEach((b) => activeChips.push({ label: b, remove: () => toggleMulti("brand", b) }));
  params.forEach((value, key) => {
    if (key.startsWith("spec."))
      activeChips.push({ label: `${key.slice(5)}: ${value}`, remove: () => toggleMulti(key, value) });
  });
  if (params.get("min") || params.get("max")) {
    activeChips.push({
      label: `${params.get("min") ? `${currencySymbol}${Number(params.get("min")).toLocaleString()}` : "Any"} – ${
        params.get("max") ? `${currencySymbol}${Number(params.get("max")).toLocaleString()}` : "Any"
      }`,
      remove: () => {
        setMinInput("");
        setMaxInput("");
      },
    });
  }
  if (inStock) activeChips.push({ label: "In stock", remove: () => setSingle("inStock", null) });

  const filterCount = activeChips.filter((c) => !c.label.startsWith("“")).length;
  const { facets } = result;

  const filterPanel = (
    <div className="space-y-7">
      <section>
        <h3 className="label">Category</h3>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setSingle("category", null)}
            className={`rounded-lg px-3 py-2 text-left text-sm transition ${!activeCategory ? "bg-neon-cyan/10 text-neon-cyan" : "text-ink-300 hover:bg-obsidian-800"}`}
          >
            All products
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSingle("category", c.slug)}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                activeCategory === c.slug ? "bg-neon-cyan/10 text-neon-cyan" : "text-ink-300 hover:bg-obsidian-800"
              }`}
            >
              {c.name}
              <span className="font-mono text-[10px] text-ink-500">{c.productCount}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="label">Price ({currencySymbol})</h3>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-500">
              {currencySymbol}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={minInput}
              onChange={(e) => setMinInput(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder={facets.priceRange.min ? String(Math.floor(toDisplayMajor(facets.priceRange.min))) : "Min"}
              className="input py-2 pl-7 text-xs"
              aria-label="Minimum price"
            />
          </div>
          <span className="text-ink-500">–</span>
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-500">
              {currencySymbol}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={maxInput}
              onChange={(e) => setMaxInput(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder={facets.priceRange.max ? String(Math.ceil(toDisplayMajor(facets.priceRange.max))) : "Max"}
              className="input py-2 pl-7 text-xs"
              aria-label="Maximum price"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRICE_PRESETS.map((preset) => {
            const active = minInput === preset.min && maxInput === preset.max;
            return (
              <button
                key={preset.label}
                type="button"
                className={`chip ${active ? "chip-active" : ""}`}
                onClick={() => {
                  setMinInput(active ? "" : preset.min);
                  setMaxInput(active ? "" : preset.max);
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-obsidian-700 bg-obsidian-850 px-3 py-2.5 text-sm">
          In stock only
          <input
            type="checkbox"
            checked={inStock}
            onChange={(e) => setSingle("inStock", e.target.checked ? "1" : null)}
            className="h-4 w-4 accent-[#22F3FF]"
          />
        </label>
      </section>

      {facets.brands.length > 1 && (
        <section>
          <h3 className="label">Brand</h3>
          <div className="space-y-1">
            {facets.brands.map((b) => (
              <label
                key={b.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-ink-300 hover:bg-obsidian-800"
              >
                <input
                  type="checkbox"
                  checked={activeBrands.includes(b.value)}
                  onChange={() => toggleMulti("brand", b.value)}
                  className="h-4 w-4 accent-[#22F3FF]"
                />
                <span className="flex-1">{b.value}</span>
                <span className="font-mono text-[10px] text-ink-500">{b.count}</span>
              </label>
            ))}
          </div>
        </section>
      )}

      {facets.specs.map((facet) => {
        const key = `spec.${facet.key}`;
        const selected = params.getAll(key);
        return (
          <section key={facet.key}>
            <h3 className="label">{facet.key}</h3>
            <div className="flex flex-wrap gap-1.5">
              {facet.values.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => toggleMulti(key, v.value)}
                  className={`chip ${selected.includes(v.value) ? "chip-active" : ""}`}
                  aria-pressed={selected.includes(v.value)}
                >
                  {v.value}
                  <span className="font-mono text-[9px] opacity-60">{v.count}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );

  const page = result.page;
  const totalPages = result.totalPages;

  return (
    <div className="container-x py-10">
      <div className="mb-8">
        <p className="eyebrow">Catalog</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          {searchTerm
            ? `Results for “${searchTerm}”`
            : activeCategory
              ? (categories.find((c) => c.slug === activeCategory)?.name ?? "Shop")
              : "All hardware & software"}
        </h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div className="panel scrollbar-thin sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto p-5">
            {filterPanel}
          </div>
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setFiltersOpen(true)} className="btn-ghost px-4 py-2 lg:hidden">
              <SlidersHorizontal className="h-4 w-4" />
              Filters{filterCount > 0 ? ` (${filterCount})` : ""}
            </button>
            <p className="text-sm text-ink-400" aria-live="polite">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-neon-cyan" /> Updating…
                </span>
              ) : (
                <>
                  <span className="font-semibold text-ink-100">{result.total}</span> product
                  {result.total === 1 ? "" : "s"}
                </>
              )}
            </p>
            <label className="ml-auto flex items-center gap-2 text-sm text-ink-400">
              <span className="hidden sm:inline">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSingle("sort", e.target.value === "featured" ? null : e.target.value)}
                className="rounded-xl border border-obsidian-600 bg-obsidian-850 px-3 py-2 text-sm text-ink-100 focus:border-neon-cyan focus:outline-none"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {activeChips.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {activeChips.map((chip) => (
                <button key={chip.label} type="button" onClick={chip.remove} className="chip chip-active">
                  {chip.label} <X className="h-3 w-3" />
                </button>
              ))}
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-ink-400 underline-offset-4 hover:text-neon-cyan hover:underline"
              >
                Clear all
              </button>
            </div>
          )}

          {error && <div className="panel mb-5 border-neon-magenta/40 p-4 text-sm text-neon-magenta">{error}</div>}

          {result.products.length === 0 ? (
            <div className="panel flex flex-col items-center gap-3 p-12 text-center">
              <p className="text-lg font-semibold">No products match these filters</p>
              <p className="max-w-sm text-sm text-ink-400">Try removing a filter or widening your price range.</p>
              <button type="button" onClick={clearAll} className="btn-ghost mt-2">
                Reset filters
              </button>
            </div>
          ) : (
            <div className={`grid grid-cols-2 gap-4 transition-opacity md:grid-cols-3 ${loading ? "opacity-50" : ""}`}>
              {result.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
              <button
                type="button"
                className="icon-btn border-obsidian-600 disabled:opacity-30"
                disabled={page <= 1}
                onClick={() => update((p) => p.set("page", String(page - 1)), true)}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => update((p) => p.set("page", String(n)), true)}
                  className={`h-10 w-10 rounded-xl font-mono text-sm transition ${
                    n === page
                      ? "bg-neon-cyan text-obsidian-950 shadow-neon"
                      : "border border-obsidian-600 text-ink-300 hover:border-neon-cyan/60"
                  }`}
                  aria-current={n === page ? "page" : undefined}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className="icon-btn border-obsidian-600 disabled:opacity-30"
                disabled={page >= totalPages}
                onClick={() => update((p) => p.set("page", String(page + 1)), true)}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}

          {facets.priceRange.max > 0 && (
            <p className="mt-8 text-center font-mono text-[11px] text-ink-500">
              Prices in this selection range from {formatMoney(facets.priceRange.min)} to{" "}
              {formatMoney(facets.priceRange.max)}
            </p>
          )}
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button
            type="button"
            className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm"
            onClick={() => setFiltersOpen(false)}
            aria-label="Close filters"
          />
          <div className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm animate-slide-in-left flex-col border-r border-obsidian-700 bg-obsidian-900">
            <div className="flex h-16 items-center justify-between border-b border-obsidian-700 px-5">
              <p className="font-semibold">Filters</p>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto p-5">{filterPanel}</div>
            <div className="flex gap-3 border-t border-obsidian-700 p-4">
              <button type="button" className="btn-ghost flex-1" onClick={clearAll}>
                Clear
              </button>
              <button type="button" className="btn-primary flex-1" onClick={() => setFiltersOpen(false)}>
                Show {result.total} result{result.total === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

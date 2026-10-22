"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface SearchBarProps {
  autoFocus?: boolean;
  onSubmitted?: () => void;
  className?: string;
}

/** Product search — sends the shopper to /shop?q=<term>. */
export function SearchBar({ autoFocus, onSubmitted, className = "" }: SearchBarProps) {
  const router = useRouter();
  const [term, setTerm] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = term.trim();
    router.push(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
    onSubmitted?.();
  }

  return (
    <form onSubmit={submit} role="search" className={`relative ${className}`}>
      <label htmlFor="site-search" className="sr-only">
        Search products
      </label>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
      <input
        id="site-search"
        type="search"
        value={term}
        autoFocus={autoFocus}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search laptops, GPUs, phones..."
        className="h-10 w-full rounded-xl border border-obsidian-600 bg-obsidian-850/80 pl-10 pr-9 text-sm text-ink-100 placeholder:text-ink-500 focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/20 [&::-webkit-search-cancel-button]:hidden"
        autoComplete="off"
        enterKeyHint="search"
      />
      {term && (
        <button
          type="button"
          onClick={() => setTerm("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-500 hover:text-ink-100"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}

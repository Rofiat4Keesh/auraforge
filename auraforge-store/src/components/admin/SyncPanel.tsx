"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import type { AdminSyncResult } from "@/types/admin";
import { formatDateTime } from "./ui";

export function SyncPanel({ source, configured }: { source: string; configured: boolean }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AdminSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      setResult(await apiFetch<AdminSyncResult>("/api/admin/sync", { method: "POST" }));
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Sync failed. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  const stats = result
    ? [
        { label: "Categories", value: result.categories },
        { label: "New products", value: result.created },
        { label: "Updated", value: result.updated },
        { label: "Hidden (left the feed)", value: result.deactivated },
      ]
    : [];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-obsidian-700 bg-obsidian-900/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">Current source</p>
            <p className="mt-1 text-xl font-semibold">
              {source === "mock"
                ? "Built-in demo catalog"
                : source === "http"
                  ? "Supplier API"
                  : source === "technocrat" || source === "json"
                    ? "Technocrat price list (src/data/products.json)"
                    : source}
            </p>
            <p className="mt-1 font-mono text-xs text-ink-500">SUPPLIER_SOURCE=&quot;{source}&quot;</p>
          </div>
          <button type="button" className="btn-primary" onClick={run} disabled={running || !configured}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {running ? "Syncing…" : "Sync now"}
          </button>
        </div>
        {!configured && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-neon-magenta/40 p-3 text-sm text-neon-magenta">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            SUPPLIER_SOURCE is &quot;http&quot; but SUPPLIER_API_URL is empty. Set it in your environment variables and
            restart the server.
          </p>
        )}
        <ul className="mt-5 space-y-1.5 text-sm text-ink-400">
          <li>• New products in the feed are added and appear in the shop.</li>
          <li>
            • Existing products get the feed&apos;s latest details, prices and stock (edits you made to them are
            replaced).
          </li>
          <li>• Products that disappeared from the feed are hidden, not deleted, so past orders stay intact.</li>
          <li>• Products you added yourself in the admin are never touched.</li>
        </ul>
      </section>

      {error && (
        <p
          className="flex items-center gap-2 rounded-xl border border-neon-magenta/40 p-4 text-sm text-neon-magenta"
          role="alert"
        >
          <AlertTriangle className="h-4 w-4" /> {error}
        </p>
      )}

      {result && (
        <section className="rounded-2xl border border-neon-lime/30 bg-obsidian-900/70 p-6" role="status">
          <p className="flex items-center gap-2 font-semibold text-neon-lime">
            <CheckCircle2 className="h-5 w-5" /> Sync finished {formatDateTime(result.finishedAt)}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-obsidian-850 p-4">
                <dt className="text-xs text-ink-500">{s.label}</dt>
                <dd className="mt-1 font-mono text-2xl font-bold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
          {result.skipped.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold text-neon-magenta">{result.skipped.length} item(s) skipped</p>
              <ul className="mt-2 space-y-1 font-mono text-xs text-ink-400">
                {result.skipped.map((s) => (
                  <li key={s.externalId}>
                    {s.externalId}: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

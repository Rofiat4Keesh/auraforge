"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useCart } from "@/components/providers/CartProvider";

/** Small notification shown after cart actions (e.g. "Only 2 units available"). */
export function Toast() {
  const { toast } = useCart();
  if (!toast) return null;
  const success = toast.kind === "success";
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div
        key={toast.id}
        className={`pointer-events-auto flex max-w-md animate-fade-in items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-panel backdrop-blur ${
          success
            ? "border-neon-lime/40 bg-obsidian-900/95 text-ink-100"
            : "border-neon-magenta/50 bg-obsidian-900/95 text-ink-100"
        }`}
      >
        {success ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-neon-lime" />
        ) : (
          <XCircle className="h-5 w-5 shrink-0 text-neon-magenta" />
        )}
        {toast.message}
      </div>
    </div>
  );
}

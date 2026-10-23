import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { OrderStatusDTO } from "@/types";
import { STATUS_LABEL } from "@/lib/order-status";

/** Small shared building blocks for the admin portal. */

const STATUS_STYLE: Record<OrderStatusDTO, string> = {
  PENDING: "border-ink-500/40 bg-ink-500/10 text-ink-300",
  PAID: "border-neon-lime/40 bg-neon-lime/10 text-neon-lime",
  PROCESSING: "border-neon-violet/50 bg-neon-violet/10 text-neon-violet",
  SHIPPED: "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan",
  DELIVERED: "border-neon-cyan/60 bg-neon-cyan/20 text-ink-100",
  FULFILLED: "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan",
  FAILED: "border-neon-magenta/40 bg-neon-magenta/10 text-neon-magenta",
  CANCELLED: "border-obsidian-500 bg-obsidian-800 text-ink-500",
};

export function StatusPill({ status }: { status: OrderStatusDTO }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${STATUS_STYLE[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm">
      <span className="mr-2 font-mono text-xs text-ink-500">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        className="icon-btn border-obsidian-600 disabled:opacity-30"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="icon-btn border-obsidian-600 disabled:opacity-30"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-ink-400">
        {children}
      </td>
    </tr>
  );
}

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-obsidian-700 bg-obsidian-900/70">
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">{children}</table>
      </div>
    </div>
  );
}

export const th = "px-4 py-3 font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-ink-500";
export const td = "px-4 py-3 align-middle";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-4 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-neon-cyan">
      <ChevronLeft className="h-4 w-4" /> {label}
    </Link>
  );
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

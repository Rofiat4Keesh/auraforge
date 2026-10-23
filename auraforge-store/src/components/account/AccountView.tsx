"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2, LogOut, Package, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthForm } from "@/components/auth/AuthForm";
import { apiFetch } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/order-status";
import { safeNextPath } from "@/lib/safe-redirect";
import type { OrderDTO } from "@/types";

const STATUS_STYLES: Record<OrderDTO["status"], string> = {
  PAID: "border-neon-lime/40 text-neon-lime",
  PROCESSING: "border-neon-violet/50 text-neon-violet",
  SHIPPED: "border-neon-cyan/40 text-neon-cyan",
  DELIVERED: "border-neon-cyan/60 text-ink-100",
  FULFILLED: "border-neon-cyan/40 text-neon-cyan",
  PENDING: "border-ink-500/40 text-ink-300",
  FAILED: "border-neon-magenta/40 text-neon-magenta",
  CANCELLED: "border-ink-500/40 text-ink-500",
};

/**
 * /account — sign in / quick sign-up when signed out; profile + order history when signed in.
 * A `?next=/some/path` link (e.g. from the Unauthorized Access alert) sends the shopper back
 * there after signing in. Only same-site paths are honoured.
 */
export function AccountView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const { user, isAdmin, checking, signOut } = useAuth();
  const [orders, setOrders] = useState<OrderDTO[] | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      setOrders(await apiFetch<OrderDTO[]>("/api/orders", { cache: "no-store" }));
    } catch {
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    if (user) void loadOrders();
    else setOrders(null);
  }, [user, loadOrders]);

  if (!user && checking) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-neon-cyan" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="panel mx-auto max-w-md p-8">
        <AuthForm
          idPrefix="account"
          onSuccess={(signedIn) => {
            const destination = safeNextPath(nextPath, "");
            if (!destination) return; // stay here and show the order history
            if (destination.startsWith("/admin") && signedIn.role !== "ADMIN") {
              router.push("/?unauthorized=forbidden");
              return;
            }
            router.push(destination);
          }}
        />
        <p className="mt-6 text-center text-xs text-ink-500">
          Browsing and adding to cart never need an account. You only sign in at checkout, and your cart comes with you.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
      <aside className="panel h-fit p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-neon-cyan/40 bg-neon-cyan/10">
          <UserRound className="h-7 w-7 text-neon-cyan" />
        </div>
        <p className="mt-4 text-lg font-semibold">{user.fullName}</p>
        <p className="break-all text-sm text-ink-400">{user.email}</p>
        {user.phone && <p className="font-mono text-xs text-ink-500">{user.phone}</p>}
        {isAdmin && (
          <Link href="/admin" className="btn-violet mt-6 w-full">
            <ShieldCheck className="h-4 w-4" /> Open Admin Portal
          </Link>
        )}
        <button type="button" onClick={() => void signOut()} className="btn-ghost mt-3 w-full">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Order history</h2>
        {orders === null ? (
          <Loader2 className="h-6 w-6 animate-spin text-neon-cyan" />
        ) : orders.length === 0 ? (
          <div className="panel flex flex-col items-center gap-3 p-10 text-center">
            <Package className="h-8 w-8 text-ink-500" />
            <p className="font-semibold">No orders yet</p>
            <Link href="/shop" className="btn-primary mt-2">
              Start shopping
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {orders.map((order) => (
              <li key={order.reference} className="panel p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-mono text-sm text-neon-cyan">{order.reference}</p>
                  <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase ${STATUS_STYLES[order.status]}`}>
                    {STATUS_LABEL[order.status]}
                  </span>
                  <p className="ml-auto text-xs text-ink-500">
                    {new Date(order.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <p className="mt-3 text-sm text-ink-300">{order.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}</p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="font-mono font-semibold">{formatMoney(order.total)}</p>
                  {order.status === "PENDING" && (
                    <Link href={`/checkout/success?reference=${order.reference}`} className="text-xs text-neon-cyan hover:underline">
                      Check payment status
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

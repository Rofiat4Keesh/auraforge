"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2, LogOut, Package, ShieldCheck, UserRound } from "lucide-react";
import { useCart } from "@/components/providers/CartProvider";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import type { OrderDTO, SessionUserDTO } from "@/types";

const STATUS_STYLES: Record<OrderDTO["status"], string> = {
  PAID: "border-neon-lime/40 text-neon-lime",
  FULFILLED: "border-neon-cyan/40 text-neon-cyan",
  PENDING: "border-ink-500/40 text-ink-300",
  FAILED: "border-neon-magenta/40 text-neon-magenta",
  CANCELLED: "border-ink-500/40 text-ink-500",
};

function AuthForms({ onAuthenticated }: { onAuthenticated: (user: SessionUserDTO) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      const body = mode === "login" ? { email: form.email, password: form.password } : { ...form };
      const user = await apiFetch<SessionUserDTO>(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify(body) });
      onAuthenticated(user);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setMessage(error.message);
        setErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([k, v]) => [k, v?.[0]])));
      } else {
        setMessage("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  const input = (name: keyof typeof form, label: string, type = "text", autoComplete?: string) => (
    <div>
      <label htmlFor={`auth-${name}`} className="label">
        {label}
      </label>
      <input
        id={`auth-${name}`}
        type={type}
        autoComplete={autoComplete}
        value={form[name]}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
        className={`input ${errors[name] ? "border-neon-magenta" : ""}`}
        required={name !== "phone"}
      />
      {errors[name] && <p className="mt-1.5 text-xs text-neon-magenta">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="panel mx-auto max-w-md p-8">
      <div className="mb-6 grid grid-cols-2 rounded-xl border border-obsidian-700 bg-obsidian-950 p-1">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setMessage(null);
              setErrors({});
            }}
            className={`rounded-lg py-2 text-sm font-medium transition ${mode === m ? "bg-neon-cyan text-obsidian-950" : "text-ink-400 hover:text-ink-100"}`}
          >
            {m === "login" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {mode === "register" && input("fullName", "Full name", "text", "name")}
        {input("email", "Email address", "email", "email")}
        {mode === "register" && input("phone", "Phone (optional)", "tel", "tel")}
        {input("password", "Password", "password", mode === "login" ? "current-password" : "new-password")}
        {message && (
          <p
            className="rounded-lg border border-neon-magenta/40 bg-neon-magenta/5 p-3 text-sm text-neon-magenta"
            role="alert"
          >
            {message}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-ink-500">
        You can also check out as a guest — an account just keeps your order history in one place.
      </p>
    </div>
  );
}

export function AccountView() {
  const { refreshCart } = useCart();
  const [user, setUser] = useState<SessionUserDTO | null | undefined>(undefined);
  const [orders, setOrders] = useState<OrderDTO[] | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      setOrders(await apiFetch<OrderDTO[]>("/api/orders", { cache: "no-store" }));
    } catch {
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    apiFetch<SessionUserDTO | null>("/api/auth/me", { cache: "no-store" })
      .then((u) => {
        setUser(u);
        if (u) void loadOrders();
      })
      .catch(() => setUser(null));
  }, [loadOrders]);

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
    setOrders(null);
    await refreshCart();
  }

  if (user === undefined) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-neon-cyan" />
      </div>
    );
  }

  if (!user) {
    return (
      <AuthForms
        onAuthenticated={(u) => {
          setUser(u);
          void loadOrders();
          void refreshCart();
        }}
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
      <aside className="panel h-fit p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-neon-cyan/40 bg-neon-cyan/10">
          <UserRound className="h-7 w-7 text-neon-cyan" />
        </div>
        <p className="mt-4 text-lg font-semibold">{user.fullName}</p>
        <p className="text-sm text-ink-400">{user.email}</p>
        {user.phone && <p className="font-mono text-xs text-ink-500">{user.phone}</p>}
        {user.role === "ADMIN" && (
          <Link href="/admin" className="btn-violet mt-6 w-full">
            <ShieldCheck className="h-4 w-4" /> Open admin console
          </Link>
        )}
        <button type="button" onClick={logout} className="btn-ghost mt-3 w-full">
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
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase ${STATUS_STYLES[order.status]}`}
                  >
                    {order.status}
                  </span>
                  <p className="ml-auto text-xs text-ink-500">
                    {new Date(order.createdAt).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <p className="mt-3 text-sm text-ink-300">
                  {order.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="font-mono font-semibold">{formatMoney(order.total)}</p>
                  {order.status === "PENDING" && (
                    <Link
                      href={`/checkout/success?reference=${order.reference}`}
                      className="text-xs text-neon-cyan hover:underline"
                    >
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

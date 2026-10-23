"use client";

/**
 * Staff sign-in for the Admin Portal (/admin/sign-in).
 * Uses the same accounts as the shop: an account only gets in if its role is ADMIN
 * (set with `npm run seed:admin` or `npm run admin:create`). Customers are turned away
 * with an "Unauthorized Access" message.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AlertTriangle, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { company } from "@/lib/store-config";
import type { SessionUserDTO } from "@/types";

export function AdminSignIn({ next, signedInAsCustomer }: { next: string; signedInAsCustomer: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    signedInAsCustomer
      ? `Unauthorized Access: ${signedInAsCustomer} doesn't have administrator permissions. Sign in with an admin account.`
      : null,
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    try {
      const user = await apiFetch<SessionUserDTO>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (user.role !== "ADMIN") {
        // A customer account: don't leave it signed in on the staff screen.
        await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        setError("Unauthorized Access: this account doesn't have administrator permissions.");
        setBusy(false);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between">
          <Logo />
          <span className="rounded-full border border-neon-violet/50 bg-neon-violet/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-neon-violet">
            Admin Portal
          </span>
        </div>

        <div className="panel mt-6 p-6 sm:p-8">
          <h1 className="text-2xl font-bold">Staff sign-in</h1>
          <p className="mt-1 text-sm text-ink-400">
            Only administrator accounts can open the dashboard, orders, products and transactions.
          </p>

          <form onSubmit={submit} noValidate className="mt-6 space-y-4">
            <div>
              <label htmlFor="admin-email" className="label">
                Email address
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="label">
                Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-400 hover:text-neon-cyan"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex gap-2 rounded-lg border border-neon-magenta/40 bg-neon-magenta/5 p-3 text-sm text-neon-magenta" role="alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Sign in to Admin Portal
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-ink-500">
          Not staff?{" "}
          <Link href="/" className="text-neon-cyan hover:underline">
            Go to the shop
          </Link>
        </p>
        <p className="mt-2 text-center text-[11px] text-ink-500">
          © {new Date().getFullYear()} {company.legalName} · RC No: {company.rcNumber}
        </p>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import type { SessionUserDTO } from "@/types";

/** Shown at /admin to anyone who is not signed in with an admin account. */
export function AdminLogin({ signedInAs }: { signedInAs: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await apiFetch<SessionUserDTO>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (user.role !== "ADMIN") {
        setError("You're signed in, but this account doesn't have admin access.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not sign in. Please try again.");
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo />
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-neon-violet">Admin console</p>
        </div>

        {signedInAs ? (
          <div className="panel space-y-4 p-6 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-neon-magenta" />
            <p className="font-semibold">No admin access</p>
            <p className="text-sm text-ink-400">
              <span className="text-ink-100">{signedInAs}</span> is a customer account. Sign in with an admin account
              instead.
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={signOut} className="btn-primary">
                Sign out and switch account
              </button>
              <Link href="/" className="btn-ghost">
                Back to the store
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="panel space-y-4 p-6" noValidate>
            <div className="flex items-center gap-2 text-sm text-ink-300">
              <ShieldCheck className="h-4 w-4 text-neon-cyan" /> Staff sign-in
            </div>
            <div>
              <label htmlFor="admin-email" className="label">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="label">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                required
              />
            </div>
            {error && (
              <p
                className="rounded-lg border border-neon-magenta/40 bg-neon-magenta/5 p-3 text-sm text-neon-magenta"
                role="alert"
              >
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

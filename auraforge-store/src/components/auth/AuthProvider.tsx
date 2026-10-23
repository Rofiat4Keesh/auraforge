"use client";

/**
 * Who is signed in, shared by the header, account page and checkout.
 *
 * - The store layout reads the user on the server and passes it in as `initialUser`, so the
 *   header shows "Sign In" or "Account" (plus the Admin Portal link for admins) on the very
 *   first paint, with no flicker.
 * - On mount it asks GET /api/auth/me again. That call also refreshes the session cookie if
 *   the account's role changed (for example after `npm run seed:admin`).
 * - signIn() / signUp() / signOut() update this state and reload the cart, because signing in
 *   attaches the guest cart in this browser to the account.
 */
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useCart } from "@/components/providers/CartProvider";
import { apiFetch } from "@/lib/api-client";
import type { SessionUserDTO } from "@/types";

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

interface AuthContextValue {
  user: SessionUserDTO | null;
  isAdmin: boolean;
  /** true until the first /api/auth/me check has finished */
  checking: boolean;
  signIn: (input: SignInInput) => Promise<SessionUserDTO>;
  signUp: (input: SignUpInput) => Promise<SessionUserDTO>;
  signOut: () => Promise<void>;
  /** Re-reads the session from the server (e.g. after a 401 from an API call). */
  refreshUser: () => Promise<SessionUserDTO | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ initialUser, children }: { initialUser: SessionUserDTO | null; children: ReactNode }) {
  const router = useRouter();
  const { refreshCart } = useCart();
  const [user, setUser] = useState<SessionUserDTO | null>(initialUser);
  const [checking, setChecking] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const current = await apiFetch<SessionUserDTO | null>("/api/auth/me", { cache: "no-store" });
      setUser(current);
      return current;
    } catch {
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const afterAuthChange = useCallback(
    async (next: SessionUserDTO | null) => {
      setUser(next);
      await refreshCart();
      router.refresh(); // re-render server components that depend on the session
    },
    [refreshCart, router],
  );

  const signIn = useCallback(
    async (input: SignInInput) => {
      const signedIn = await apiFetch<SessionUserDTO>("/api/auth/login", { method: "POST", body: JSON.stringify(input) });
      await afterAuthChange(signedIn);
      return signedIn;
    },
    [afterAuthChange],
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      // The server ignores any role sent from the browser: every new account is a CUSTOMER.
      const created = await apiFetch<SessionUserDTO>("/api/auth/register", { method: "POST", body: JSON.stringify(input) });
      await afterAuthChange(created);
      return created;
    },
    [afterAuthChange],
  );

  const signOut = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      await afterAuthChange(null);
    }
  }, [afterAuthChange]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAdmin: user?.role === "ADMIN", checking, signIn, signUp, signOut, refreshUser }),
    [user, checking, signIn, signUp, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}

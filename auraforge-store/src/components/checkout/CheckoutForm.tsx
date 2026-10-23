"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertTriangle, Check, Loader2, Lock, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthForm } from "@/components/auth/AuthForm";
import { useCart } from "@/components/providers/CartProvider";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { NIGERIAN_STATES } from "@/lib/store-config";
import type { CartDTO, SessionUserDTO } from "@/types";
import { SafeImage } from "@/components/ui/SafeImage";

type FieldName = "email" | "fullName" | "phone" | "address" | "city" | "state" | "notes";
type FormState = Record<FieldName, string>;

const EMPTY: FormState = { email: "", fullName: "", phone: "", address: "", city: "", state: "", notes: "" };

/**
 * Checkout workflow:
 *  0. Browsing and the cart are public. At checkout the shopper signs in or does a quick sign-up
 *     (the guest cart is attached to the account automatically, nothing is lost).
 *  1. Shopper fills delivery details (validated in the browser AND on the server).
 *  2. POST /api/checkout/initialize — server checks the session, re-prices the cart, creates the order
 *     and asks Paystack for a payment page.
 *  3. Browser is redirected to Paystack's secure page (card / transfer / USSD in Naira).
 *  4. Paystack redirects back to /checkout/success?reference=..., which verifies the payment.
 *
 * If the session expires while the shopper is typing, the server answers 401. The sign-in step
 * reappears with everything they typed kept, and payment continues by itself after they sign in.
 */
export function CheckoutForm({ testMode }: { testMode: boolean }) {
  const { cart, refreshCart } = useCart();
  const { user, checking, refreshUser } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [cartProblems, setCartProblems] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [resumeAfterSignIn, setResumeAfterSignIn] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const formRef = useRef<FormState>(form);
  formRef.current = form;

  // Pre-fill contact details from the signed-in account (never overwrites what the shopper typed).
  const prefill = useCallback((account: SessionUserDTO) => {
    setForm((f) => ({
      ...f,
      email: f.email || account.email,
      fullName: f.fullName || account.fullName,
      phone: f.phone || account.phone || "",
    }));
  }, []);

  useEffect(() => {
    if (user) prefill(user);
  }, [user, prefill]);

  const set = (name: FieldName) => (value: string) => {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  };

  function validate(values: FormState): boolean {
    const next: Partial<Record<FieldName, string>> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = "Enter a valid email address";
    if (values.fullName.trim().length < 2) next.fullName = "Enter the recipient's full name";
    if (!/^\+?[0-9 ]{10,16}$/.test(values.phone.trim())) next.phone = "Enter a valid phone number, e.g. 0803 000 0000";
    if (values.address.trim().length < 5) next.address = "Enter a delivery address";
    if (values.city.trim().length < 2) next.city = "Enter a city";
    if (!values.state) next.state = "Select a state";
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) requestAnimationFrame(() => document.getElementById(`co-${first}`)?.focus());
    return Object.keys(next).length === 0;
  }

  const startPayment = useCallback(async () => {
    const values = formRef.current;
    setFormError(null);
    setCartProblems([]);
    if (!validate(values)) return;
    setSubmitting(true);
    try {
      const result = await apiFetch<{ reference: string; authorizationUrl: string }>("/api/checkout/initialize", {
        method: "POST",
        body: JSON.stringify(values),
      });
      // Hand over to Paystack's hosted, PCI-DSS compliant payment page.
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      setSubmitting(false);
      if (error instanceof ApiClientError) {
        if (error.status === 401) {
          // Session missing or expired: show the sign-in step again, keep the form, resume afterwards.
          setAuthNotice(error.message);
          setResumeAfterSignIn(true);
          await refreshUser();
          return;
        }
        const fieldErrors: Partial<Record<FieldName, string>> = {};
        for (const [key, messages] of Object.entries(error.fieldErrors)) {
          if (key === "cart" && messages) setCartProblems(messages);
          else if (key !== "code" && messages?.[0]) fieldErrors[key as FieldName] = messages[0];
        }
        setErrors(fieldErrors);
        setFormError(error.message);
        if (error.status === 409) await refreshCart();
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    }
    // validate() is a plain function over its argument; refreshCart/refreshUser are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshCart, refreshUser]);

  // After signing in from the "session expired" prompt, continue straight to Paystack.
  useEffect(() => {
    if (user && resumeAfterSignIn) {
      setResumeAfterSignIn(false);
      setAuthNotice(null);
      void startPayment();
    }
  }, [user, resumeAfterSignIn, startPayment]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void startPayment();
  }

  const available = cart.items.filter((i) => i.available);

  if (cart.items.length === 0) {
    return (
      <div className="panel mx-auto max-w-lg p-10 text-center">
        <p className="text-lg font-semibold">Your cart is empty</p>
        <p className="mt-2 text-sm text-ink-400">Add something to your cart before checking out.</p>
        <Link href="/shop" className="btn-primary mt-6">
          Browse products
        </Link>
      </div>
    );
  }

  // ---------- Step 1: sign in or quick sign-up ----------
  if (!user) {
    if (checking && !resumeAfterSignIn) {
      return (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-neon-cyan" />
        </div>
      );
    }
    return (
      <>
        <CheckoutSteps current={1} />
        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <section className="panel p-6 sm:p-8">
            <div className="mb-6 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neon-cyan/40 bg-neon-cyan/10">
                <UserRound className="h-5 w-5 text-neon-cyan" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Sign in to complete your purchase</h2>
                <p className="mt-1 text-sm text-ink-400">
                  New to AuraForge? Quick sign-up takes under a minute. Your cart is saved and comes with you.
                </p>
              </div>
            </div>
            {authNotice && (
              <div className="mb-5 flex gap-2 rounded-lg border border-neon-lime/40 bg-neon-lime/5 p-3 text-sm text-ink-300" role="status">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-neon-lime" />
                <p>{authNotice} Your delivery details are kept, and payment will continue after you sign in.</p>
              </div>
            )}
            <div className="max-w-md">
              <AuthForm
                idPrefix="checkout"
                initialMode="register"
                submitLabels={{ login: "Sign in & continue", register: "Create account & continue" }}
                onSuccess={(account) => prefill(account)}
              />
            </div>
          </section>
          <OrderSummary cart={cart} items={available}>
            <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-ink-500">
              <Lock className="h-4 w-4 text-neon-lime" /> Next: delivery details, then secure payment with Paystack.
            </p>
          </OrderSummary>
        </div>
      </>
    );
  }

  // ---------- Step 2: delivery details → Step 3: Paystack ----------
  const field = (name: FieldName, label: string, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`co-${name}`} className="label">
        {label}
      </label>
      <input
        id={`co-${name}`}
        name={name}
        value={form[name]}
        onChange={(e) => set(name)(e.target.value)}
        className={`input ${errors[name] ? "border-neon-magenta focus:border-neon-magenta focus:ring-neon-magenta/20" : ""}`}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `co-${name}-error` : undefined}
        {...props}
      />
      {errors[name] && (
        <p id={`co-${name}-error`} className="mt-1.5 text-xs text-neon-magenta">
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <>
      <CheckoutSteps current={2} />
      <form onSubmit={submit} noValidate className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          {testMode && (
            <div className="flex gap-3 rounded-xl border border-neon-lime/40 bg-neon-lime/5 p-4 text-sm text-ink-300">
              <AlertTriangle className="h-5 w-5 shrink-0 text-neon-lime" />
              <p>
                <span className="font-semibold text-neon-lime">Paystack test mode.</span> No real money will be charged.
                Use test card <span className="font-mono text-ink-100">4084 0840 8408 4081</span>, any future expiry, CVV{" "}
                <span className="font-mono text-ink-100">408</span>.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-obsidian-700 bg-obsidian-900/60 px-4 py-3 text-sm text-ink-300">
            <Check className="h-4 w-4 text-neon-lime" />
            Signed in as <span className="font-semibold text-ink-100">{user.fullName}</span>
            <span className="break-all text-ink-500">({user.email})</span>
          </div>

          <section className="panel space-y-5 p-6">
            <h2 className="text-lg font-semibold">Contact</h2>
            {field("email", "Email address (for your receipt)", { type: "email", autoComplete: "email", placeholder: "you@example.com" })}
            {field("phone", "Phone number (for the courier)", {
              type: "tel",
              autoComplete: "tel",
              placeholder: "0803 000 0000",
              inputMode: "tel",
            })}
          </section>

          <section className="panel space-y-5 p-6">
            <h2 className="text-lg font-semibold">Delivery address</h2>
            {field("fullName", "Recipient full name", { autoComplete: "name" })}
            {field("address", "Street address", {
              autoComplete: "street-address",
              placeholder: "House number, street, landmark",
            })}
            <div className="grid gap-5 sm:grid-cols-2">
              {field("city", "City / Town", { autoComplete: "address-level2" })}
              <div>
                <label htmlFor="co-state" className="label">
                  State
                </label>
                <select
                  id="co-state"
                  value={form.state}
                  onChange={(e) => set("state")(e.target.value)}
                  className={`input ${errors.state ? "border-neon-magenta" : ""}`}
                  aria-invalid={Boolean(errors.state)}
                >
                  <option value="">Select state</option>
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {errors.state && <p className="mt-1.5 text-xs text-neon-magenta">{errors.state}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="co-notes" className="label">
                Delivery notes (optional)
              </label>
              <textarea
                id="co-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => set("notes")(e.target.value)}
                className="input resize-none"
                placeholder="Gate code, best time to call, nearest bus stop..."
                maxLength={300}
              />
            </div>
          </section>
        </div>

        <OrderSummary cart={cart} items={available}>
          {(formError || cartProblems.length > 0) && (
            <div className="mt-5 rounded-xl border border-neon-magenta/40 bg-neon-magenta/5 p-3 text-sm text-neon-magenta" role="alert">
              <p>{formError}</p>
              {cartProblems.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs">
                  {cartProblems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button type="submit" disabled={submitting || available.length === 0} className="btn-primary mt-6 w-full py-4 text-base">
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Connecting to Paystack…
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" /> Pay {formatMoney(cart.total)}
              </>
            )}
          </button>
          <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-ink-500">
            <ShieldCheck className="h-4 w-4 text-neon-lime" />
            You&apos;ll complete payment on Paystack&apos;s secure page.
          </p>
        </OrderSummary>
      </form>
    </>
  );
}

/** "1 Account → 2 Delivery → 3 Payment" progress bar. */
function CheckoutSteps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Account", "Delivery", "Payment"];
  return (
    <ol className="mb-8 flex items-center gap-2 text-xs sm:gap-3 sm:text-sm" aria-label="Checkout progress">
      {steps.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li key={label} className="flex min-w-0 items-center gap-2 sm:gap-3" aria-current={active ? "step" : undefined}>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold ${
                done
                  ? "border-neon-lime bg-neon-lime/15 text-neon-lime"
                  : active
                    ? "border-neon-cyan bg-neon-cyan text-obsidian-950"
                    : "border-obsidian-600 text-ink-500"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : step}
            </span>
            <span className={`truncate ${active ? "font-semibold text-ink-100" : "text-ink-400"}`}>{label}</span>
            {step < steps.length && <span className="h-px w-6 shrink-0 bg-obsidian-600 sm:w-12" />}
          </li>
        );
      })}
    </ol>
  );
}

function OrderSummary({ cart, items, children }: { cart: CartDTO; items: CartDTO["items"]; children?: ReactNode }) {
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="panel p-6">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <ul className="scrollbar-thin mt-4 max-h-72 space-y-4 overflow-y-auto pr-1">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-obsidian-700">
                <SafeImage src={item.image} alt="" className="h-full w-full object-contain" />
                <span className="absolute right-0 top-0 rounded-bl-lg bg-neon-cyan px-1.5 font-mono text-[10px] font-bold text-obsidian-950">
                  {item.quantity}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{item.name}</p>
                <p className="truncate font-mono text-[11px] text-ink-500">{item.variantLabel}</p>
              </div>
              <p className="font-mono text-sm">{formatMoney(item.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <div className="divider my-5" />
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between text-ink-400">
            <dt>Subtotal</dt>
            <dd className="font-mono text-ink-100">{formatMoney(cart.subtotal)}</dd>
          </div>
          <div className="flex justify-between text-ink-400">
            <dt>Delivery</dt>
            <dd className="font-mono text-ink-100">{cart.shippingFee === 0 ? "FREE" : formatMoney(cart.shippingFee)}</dd>
          </div>
          <div className="flex justify-between pt-2 text-lg font-bold">
            <dt>Total</dt>
            <dd className="font-mono text-neon-cyan">{formatMoney(cart.total)}</dd>
          </div>
        </dl>
        {children}
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { AlertTriangle, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useCart } from "@/components/providers/CartProvider";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { NIGERIAN_STATES } from "@/lib/store-config";
import type { SessionUserDTO } from "@/types";
import { SafeImage } from "@/components/ui/SafeImage";

type FieldName = "email" | "fullName" | "phone" | "address" | "city" | "state" | "notes";
type FormState = Record<FieldName, string>;

const EMPTY: FormState = { email: "", fullName: "", phone: "", address: "", city: "", state: "", notes: "" };

/**
 * Checkout workflow:
 *  1. Shopper fills delivery details (validated in the browser AND on the server).
 *  2. POST /api/checkout/initialize — server re-prices the cart, creates the order, asks Paystack for a payment page.
 *  3. Browser is redirected to Paystack's secure page (card / transfer / USSD in Naira).
 *  4. Paystack redirects back to /checkout/success?reference=..., which verifies the payment.
 */
export function CheckoutForm({ testMode }: { testMode: boolean }) {
  const { cart, refreshCart } = useCart();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [cartProblems, setCartProblems] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill for signed-in customers.
  useEffect(() => {
    apiFetch<SessionUserDTO | null>("/api/auth/me")
      .then((user) => {
        if (user) {
          setForm((f) => ({
            ...f,
            email: f.email || user.email,
            fullName: f.fullName || user.fullName,
            phone: f.phone || user.phone || "",
          }));
        }
      })
      .catch(() => undefined);
  }, []);

  const set = (name: FieldName) => (value: string) => {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: undefined }));
  };

  function validate(): boolean {
    const next: Partial<Record<FieldName, string>> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email address";
    if (form.fullName.trim().length < 2) next.fullName = "Enter the recipient's full name";
    if (!/^\+?[0-9 ]{10,16}$/.test(form.phone.trim())) next.phone = "Enter a valid phone number, e.g. 0803 000 0000";
    if (form.address.trim().length < 5) next.address = "Enter a delivery address";
    if (form.city.trim().length < 2) next.city = "Enter a city";
    if (!form.state) next.state = "Select a state";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setCartProblems([]);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const result = await apiFetch<{ reference: string; authorizationUrl: string }>("/api/checkout/initialize", {
        method: "POST",
        body: JSON.stringify(form),
      });
      // Hand over to Paystack's hosted, PCI-DSS compliant payment page.
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      setSubmitting(false);
      if (error instanceof ApiClientError) {
        const fieldErrors: Partial<Record<FieldName, string>> = {};
        for (const [key, messages] of Object.entries(error.fieldErrors)) {
          if (key === "cart" && messages) setCartProblems(messages);
          else if (messages?.[0]) fieldErrors[key as FieldName] = messages[0];
        }
        setErrors(fieldErrors);
        setFormError(error.message);
        if (error.status === 409) await refreshCart();
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    }
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

        <section className="panel space-y-5 p-6">
          <h2 className="text-lg font-semibold">Contact</h2>
          {field("email", "Email address", { type: "email", autoComplete: "email", placeholder: "you@example.com" })}
          {field("phone", "Phone number", {
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

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="panel p-6">
          <h2 className="text-lg font-semibold">Order summary</h2>
          <ul className="scrollbar-thin mt-4 max-h-72 space-y-4 overflow-y-auto pr-1">
            {available.map((item) => (
              <li key={item.id} className="flex gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-obsidian-700">
                  <SafeImage src={item.image} alt="" className="h-full w-full object-contain" />
                  <span className="absolute -right-0 -top-0 rounded-bl-lg bg-neon-cyan px-1.5 font-mono text-[10px] font-bold text-obsidian-950">
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
              <dd className="font-mono text-ink-100">
                {cart.shippingFee === 0 ? "FREE" : formatMoney(cart.shippingFee)}
              </dd>
            </div>
            <div className="flex justify-between pt-2 text-lg font-bold">
              <dt>Total</dt>
              <dd className="font-mono text-neon-cyan">{formatMoney(cart.total)}</dd>
            </div>
          </dl>

          {(formError || cartProblems.length > 0) && (
            <div
              className="mt-5 rounded-xl border border-neon-magenta/40 bg-neon-magenta/5 p-3 text-sm text-neon-magenta"
              role="alert"
            >
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

          <button
            type="submit"
            disabled={submitting || available.length === 0}
            className="btn-primary mt-6 w-full py-4 text-base"
          >
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
        </div>
      </aside>
    </form>
  );
}

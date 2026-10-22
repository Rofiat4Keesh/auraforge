"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { AlertTriangle, Loader2, Minus, Plus, ShoppingBag, Trash2, Truck, X } from "lucide-react";
import { useCart } from "@/components/providers/CartProvider";
import { formatMoney } from "@/lib/money";
import { SafeImage } from "@/components/ui/SafeImage";

/** Slide-over cart. Totals are always the server-calculated values returned by the cart API. */
export function CartDrawer() {
  const { cart, isOpen, closeCart, updateQuantity, removeItem, busyItemIds } = useCart();
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeCart();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, closeCart]);

  if (!isOpen) return null;

  const threshold = cart.freeShippingThreshold;
  const remaining = Math.max(0, threshold - cart.subtotal);
  const progress = threshold > 0 ? Math.min(100, Math.round((cart.subtotal / threshold) * 100)) : 100;
  const hasUnavailable = cart.items.some((i) => !i.available);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <button
        type="button"
        className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm"
        onClick={closeCart}
        aria-label="Close cart"
      />

      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md animate-slide-in-right flex-col border-l border-obsidian-700 bg-obsidian-900 shadow-panel">
        <div className="flex h-16 items-center justify-between border-b border-obsidian-700 px-5">
          <div>
            <p className="eyebrow">Your cart</p>
            <p className="text-sm text-ink-400">
              {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}
            </p>
          </div>
          <button ref={closeButton} type="button" onClick={closeCart} className="icon-btn" aria-label="Close cart">
            <X className="h-5 w-5" />
          </button>
        </div>

        {cart.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-obsidian-600 bg-obsidian-850">
              <ShoppingBag className="h-7 w-7 text-neon-cyan" />
            </div>
            <p className="text-lg font-semibold">Your cart is empty</p>
            <p className="text-sm text-ink-400">Explore laptops, components and gadgets engineered for performance.</p>
            <Link href="/shop" onClick={closeCart} className="btn-primary mt-2">
              Browse the catalog
            </Link>
          </div>
        ) : (
          <>
            {threshold > 0 && (
              <div className="border-b border-obsidian-800 px-5 py-4">
                <p className="flex items-center gap-2 text-xs text-ink-300">
                  <Truck className="h-4 w-4 text-neon-cyan" />
                  {remaining > 0 ? (
                    <>
                      Add <span className="font-semibold text-neon-cyan">{formatMoney(remaining)}</span> more for free
                      delivery
                    </>
                  ) : (
                    <span className="text-neon-lime">You&apos;ve unlocked free delivery</span>
                  )}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-obsidian-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-violet transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <ul className="scrollbar-thin flex-1 divide-y divide-obsidian-800 overflow-y-auto px-5">
              {cart.items.map((item) => {
                const busy = busyItemIds.includes(item.id);
                return (
                  <li key={item.id} className={`flex gap-4 py-4 transition ${busy ? "opacity-60" : ""}`}>
                    <Link
                      href={`/product/${item.slug}`}
                      onClick={closeCart}
                      className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-obsidian-700 bg-obsidian-850"
                    >
                      <SafeImage src={item.image} alt={item.name} className="h-full w-full object-contain" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/product/${item.slug}`}
                            onClick={closeCart}
                            className="line-clamp-2 text-sm font-medium text-ink-100 hover:text-neon-cyan"
                          >
                            {item.name}
                          </Link>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-ink-500">{item.variantLabel}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={busy}
                          className="rounded-lg p-1.5 text-ink-500 transition hover:bg-obsidian-800 hover:text-neon-magenta"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {item.available ? (
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center rounded-lg border border-obsidian-600">
                            <button
                              type="button"
                              className="p-2 text-ink-300 hover:text-neon-cyan disabled:opacity-40"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              disabled={busy}
                              aria-label="Decrease quantity"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-8 text-center font-mono text-sm" aria-live="polite">
                              {busy ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : item.quantity}
                            </span>
                            <button
                              type="button"
                              className="p-2 text-ink-300 hover:text-neon-cyan disabled:opacity-40"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              disabled={busy || item.quantity >= item.stock}
                              aria-label="Increase quantity"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="font-mono text-sm font-semibold text-ink-100">{formatMoney(item.lineTotal)}</p>
                        </div>
                      ) : (
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-neon-magenta">
                          <AlertTriangle className="h-3.5 w-3.5" /> Unavailable — please remove
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-obsidian-700 bg-obsidian-950/60 px-5 py-5">
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
                <div className="divider my-3" />
                <div className="flex justify-between text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="font-mono text-neon-cyan">{formatMoney(cart.total)}</dd>
                </div>
              </dl>
              {hasUnavailable && (
                <p className="mt-3 text-xs text-neon-magenta">Remove unavailable items to continue to checkout.</p>
              )}
              <Link
                href="/checkout"
                onClick={closeCart}
                aria-disabled={hasUnavailable}
                className={`btn-primary mt-4 w-full ${hasUnavailable ? "pointer-events-none opacity-50" : ""}`}
              >
                Secure checkout
              </Link>
              <button
                type="button"
                onClick={closeCart}
                className="mt-2 w-full py-2 text-center text-xs text-ink-400 hover:text-ink-100"
              >
                Continue shopping
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

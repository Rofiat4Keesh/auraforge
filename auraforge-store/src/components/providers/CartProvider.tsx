"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import type { CartDTO } from "@/types";

interface Toast {
  id: number;
  kind: "success" | "error";
  message: string;
}

interface CartContextValue {
  cart: CartDTO;
  isOpen: boolean;
  busyItemIds: string[];
  isAdding: boolean;
  toast: Toast | null;
  openCart: () => void;
  closeCart: () => void;
  refreshCart: () => Promise<void>;
  addItem: (
    productId: string,
    variantSku: string,
    quantity?: number,
    options?: { openDrawer?: boolean },
  ) => Promise<boolean>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  showToast: (kind: Toast["kind"], message: string) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const EMPTY_CART: CartDTO = {
  items: [],
  itemCount: 0,
  subtotal: 0,
  shippingFee: 0,
  total: 0,
  freeShippingThreshold: 0,
  currency: "NGN",
};

export function CartProvider({ children, initialCart }: { children: ReactNode; initialCart: CartDTO | null }) {
  const [cart, setCart] = useState<CartDTO>(initialCart ?? EMPTY_CART);
  const [isOpen, setIsOpen] = useState(false);
  const [busyItemIds, setBusyItemIds] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((kind: Toast["kind"], message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), kind, message });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const refreshCart = useCallback(async () => {
    try {
      setCart(await apiFetch<CartDTO>("/api/cart", { cache: "no-store" }));
    } catch {
      /* keep the last known cart if the refresh fails */
    }
  }, []);

  // If the server could not provide the cart on first render, fetch it in the browser.
  useEffect(() => {
    if (!initialCart) void refreshCart();
  }, [initialCart, refreshCart]);

  const addItem = useCallback<CartContextValue["addItem"]>(
    async (productId, variantSku, quantity = 1, options = {}) => {
      setIsAdding(true);
      try {
        const next = await apiFetch<CartDTO>("/api/cart/items", {
          method: "POST",
          body: JSON.stringify({ productId, variantSku, quantity }),
        });
        setCart(next);
        if (options.openDrawer !== false) setIsOpen(true);
        else showToast("success", "Added to cart");
        return true;
      } catch (error) {
        showToast("error", error instanceof ApiClientError ? error.message : "Could not add to cart.");
        return false;
      } finally {
        setIsAdding(false);
      }
    },
    [showToast],
  );

  const mutateItem = useCallback(
    async (itemId: string, request: () => Promise<CartDTO>) => {
      setBusyItemIds((ids) => [...ids, itemId]);
      try {
        setCart(await request());
      } catch (error) {
        showToast("error", error instanceof ApiClientError ? error.message : "Could not update your cart.");
        await refreshCart();
      } finally {
        setBusyItemIds((ids) => ids.filter((id) => id !== itemId));
      }
    },
    [refreshCart, showToast],
  );

  const updateQuantity = useCallback(
    (itemId: string, quantity: number) =>
      mutateItem(itemId, () =>
        apiFetch<CartDTO>(`/api/cart/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ quantity }) }),
      ),
    [mutateItem],
  );

  const removeItem = useCallback(
    (itemId: string) => mutateItem(itemId, () => apiFetch<CartDTO>(`/api/cart/items/${itemId}`, { method: "DELETE" })),
    [mutateItem],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      isOpen,
      busyItemIds,
      isAdding,
      toast,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      refreshCart,
      addItem,
      updateQuantity,
      removeItem,
      showToast,
    }),
    [cart, isOpen, busyItemIds, isAdding, toast, refreshCart, addItem, updateQuantity, removeItem, showToast],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside <CartProvider>");
  return context;
}

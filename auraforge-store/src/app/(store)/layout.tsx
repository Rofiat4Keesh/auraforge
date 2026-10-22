import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartProvider } from "@/components/providers/CartProvider";
import { Toast } from "@/components/ui/Toast";
import { readCartToken } from "@/lib/cart-cookie";
import { getCart } from "@/server/services/cart.service";
import { listCategories } from "@/server/services/catalog.service";
import type { CartDTO, CategoryDTO } from "@/types";

// Every shop page shows the live cart badge (read from a cookie) and live stock, so render on request.
export const dynamic = "force-dynamic";

/** Storefront layout: Header (core navigation only) + page + Footer (legal/registration) + cart drawer. */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  // Load the cart on the server so the header badge is correct on the very first paint.
  const cartToken = await readCartToken();
  let initialCart: CartDTO | null = null;
  let categories: CategoryDTO[] = [];
  try {
    [initialCart, categories] = await Promise.all([getCart(cartToken), listCategories()]);
  } catch (error) {
    console.error("[store layout] Could not load cart or categories:", error);
  }

  return (
    <CartProvider initialCart={initialCart}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-neon-cyan focus:px-4 focus:py-2 focus:text-obsidian-950"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer categories={categories} />
      <CartDrawer />
      <Toast />
    </CartProvider>
  );
}

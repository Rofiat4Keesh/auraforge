import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartProvider } from "@/components/providers/CartProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { UnauthorizedNotice } from "@/components/auth/UnauthorizedNotice";
import { Toast } from "@/components/ui/Toast";
import { getSession } from "@/lib/auth";
import { readCartToken } from "@/lib/cart-cookie";
import { getCart } from "@/server/services/cart.service";
import { listCategories } from "@/server/services/catalog.service";
import { getUserById, toSessionUser } from "@/server/services/user.service";
import type { CartDTO, CategoryDTO, SessionUserDTO } from "@/types";

// Every shop page shows the live cart badge (read from a cookie), the signed-in state and live stock,
// so render on request.
export const dynamic = "force-dynamic";

/** Looks up the signed-in shopper (if any). Browsing never requires an account. */
async function loadSessionUser(): Promise<SessionUserDTO | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await getUserById(session.userId);
  return user ? toSessionUser(user) : null;
}

/** Storefront layout: Header (core navigation only) + page + Footer (legal/registration) + cart drawer. */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  // Load the cart and the user on the server so the header is correct on the very first paint.
  const cartToken = await readCartToken();
  let initialCart: CartDTO | null = null;
  let categories: CategoryDTO[] = [];
  let initialUser: SessionUserDTO | null = null;
  try {
    [initialCart, categories, initialUser] = await Promise.all([getCart(cartToken), listCategories(), loadSessionUser()]);
  } catch (error) {
    console.error("[store layout] Could not load cart, categories or session:", error);
  }

  return (
    <CartProvider initialCart={initialCart}>
      <AuthProvider initialUser={initialUser}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-neon-cyan focus:px-4 focus:py-2 focus:text-obsidian-950"
        >
          Skip to content
        </a>
        <Header />
        <Suspense fallback={null}>
          <UnauthorizedNotice />
        </Suspense>
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer categories={categories} />
        <CartDrawer />
        <Toast />
      </AuthProvider>
    </CartProvider>
  );
}

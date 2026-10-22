"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, LayoutGrid, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useCart } from "@/components/providers/CartProvider";
import { Logo } from "./Logo";
import { SearchBar } from "./SearchBar";

/**
 * HEADER — core navigation only: Logo, Home, Shop, Search, Cart (live count), Account.
 * Legal text, policies and addresses live exclusively in the Footer.
 */

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/shop", label: "Shop", icon: LayoutGrid },
];

export function Header() {
  const pathname = usePathname();
  const { cart, openCart } = useCart();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menus whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
    setMobileSearch(false);
  }, [pathname]);

  // Lock page scroll while the mobile drawer is open; close it with Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const count = cart.itemCount;

  return (
    <>
      <header
        className={`sticky top-0 z-40 border-b transition-colors duration-300 ${
          scrolled
            ? "border-obsidian-700 bg-obsidian-950/85 backdrop-blur-xl"
            : "border-transparent bg-obsidian-950/40 backdrop-blur"
        }`}
      >
        <div className="container-x flex h-16 items-center gap-4">
          <button
            type="button"
            className="icon-btn -ml-2 md:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            aria-controls="mobile-drawer"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Logo />

          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive(item.href) ? "text-neon-cyan" : "text-ink-300 hover:text-ink-100"
                }`}
              >
                {item.label}
                {isActive(item.href) && (
                  <span className="mx-auto mt-1 block h-0.5 w-4 rounded bg-neon-cyan shadow-neon" />
                )}
              </Link>
            ))}
          </nav>

          <div className="ml-auto hidden max-w-sm flex-1 md:block">
            <SearchBar />
          </div>

          <div className="ml-auto flex items-center gap-1 md:ml-2">
            <button
              type="button"
              className="icon-btn md:hidden"
              onClick={() => setMobileSearch((v) => !v)}
              aria-label="Search"
              aria-expanded={mobileSearch}
            >
              <Search className="h-5 w-5" />
            </button>

            <Link
              href="/account"
              className={`icon-btn ${isActive("/account") ? "text-neon-cyan" : ""}`}
              aria-label="Account"
            >
              <User className="h-5 w-5" />
            </Link>

            <button
              type="button"
              onClick={openCart}
              className="icon-btn"
              aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
            >
              <ShoppingBag className="h-5 w-5" />
              {count > 0 && (
                <span
                  key={count}
                  className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 animate-fade-in items-center justify-center rounded-full bg-neon-cyan px-1 font-mono text-[10px] font-bold text-obsidian-950 shadow-neon"
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          </div>
        </div>

        {mobileSearch && (
          <div className="container-x animate-fade-in pb-3 md:hidden">
            <SearchBar autoFocus onSubmitted={() => setMobileSearch(false)} />
          </div>
        )}
      </header>

      {/* Mobile drawer — rendered outside <header>, because the header's backdrop blur
          would otherwise trap this fixed-position overlay inside the header's box. */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          id="mobile-drawer"
          aria-label="Menu"
        >
          <button
            type="button"
            className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs animate-slide-in-left flex-col border-r border-obsidian-700 bg-obsidian-900">
            <div className="flex h-16 items-center justify-between border-b border-obsidian-700 px-4">
              <Logo onClick={() => setDrawerOpen(false)} />
              <button type="button" className="icon-btn" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <SearchBar onSubmitted={() => setDrawerOpen(false)} />
            </div>
            <nav className="flex flex-col gap-1 px-3" aria-label="Mobile">
              {[...NAV, { href: "/account", label: "Account", icon: User }].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium transition ${
                    isActive(item.href)
                      ? "bg-neon-cyan/10 text-neon-cyan"
                      : "text-ink-300 hover:bg-obsidian-800 hover:text-ink-100"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  openCart();
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-medium text-ink-300 transition hover:bg-obsidian-800 hover:text-ink-100"
              >
                <ShoppingBag className="h-5 w-5" />
                Cart
                {count > 0 && (
                  <span className="ml-auto rounded-full bg-neon-cyan px-2 py-0.5 font-mono text-xs font-bold text-obsidian-950">
                    {count}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

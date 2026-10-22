"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ExternalLink,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  RefreshCw,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/components/layout/Logo";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ReceiptText },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/sync", label: "Supplier sync", icon: RefreshCw },
];

/** Admin frame: sidebar on desktop, top bar + slide-in menu on phones. Separate from the shop's header/footer. */
export function AdminShell({ adminName, children }: { adminName: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/admin");
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Admin">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            isActive(item.href)
              ? "bg-neon-cyan/10 text-neon-cyan"
              : "text-ink-300 hover:bg-obsidian-800 hover:text-ink-100"
          }`}
          aria-current={isActive(item.href) ? "page" : undefined}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      ))}
      <div className="mt-auto space-y-1 border-t border-obsidian-800 pt-4">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-400 hover:bg-obsidian-800 hover:text-ink-100"
        >
          <ExternalLink className="h-4 w-4" /> View store
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-ink-400 hover:bg-obsidian-800 hover:text-neon-magenta"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
        <p className="px-3 pt-2 font-mono text-[10px] uppercase tracking-widest text-ink-500">
          Signed in as {adminName}
        </p>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-obsidian-800 bg-obsidian-950 p-4 lg:flex">
        <div className="px-1 pt-1">
          <Logo />
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-neon-violet">Admin console</p>
        </div>
        {nav}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-obsidian-800 bg-obsidian-950/90 px-4 backdrop-blur lg:hidden">
          <button type="button" className="icon-btn -ml-2" onClick={() => setOpen(true)} aria-label="Open admin menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold">Admin</span>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 animate-slide-in-left flex-col gap-6 border-r border-obsidian-700 bg-obsidian-950 p-4">
            <div className="flex items-center justify-between">
              <Logo />
              <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </div>
        </div>
      )}
    </div>
  );
}

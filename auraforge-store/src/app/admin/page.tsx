import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock, PackageCheck, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { getAdminUser } from "@/lib/admin-guard";
import { formatMoney } from "@/lib/money";
import { getDashboardStats } from "@/server/services/admin.service";
import { PageHeader, StatusPill, formatDateTime } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  if (!(await getAdminUser())) return null;
  const stats = await getDashboardStats();
  const maxDay = Math.max(1, ...stats.dailyRevenue.map((d) => d.total));
  const total14 = stats.dailyRevenue.reduce((s, d) => s + d.total, 0);

  const tiles = [
    { label: "Sales today", value: formatMoney(stats.revenueToday), icon: TrendingUp, note: "Lagos time" },
    {
      label: "Sales, last 30 days",
      value: formatMoney(stats.revenue30d),
      icon: ShoppingCart,
      note: `${stats.paidOrders30d} paid orders`,
    },
    { label: "Average order", value: formatMoney(stats.averageOrder30d), icon: PackageCheck, note: "Last 30 days" },
    {
      label: "Customers",
      value: stats.customers.toLocaleString("en-NG"),
      icon: Users,
      note: `${stats.activeProducts} products live`,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="Sales, orders that need action, and stock running low." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-obsidian-700 bg-obsidian-900/70 p-5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">{t.label}</p>
              <t.icon className="h-4 w-4 text-neon-cyan" />
            </div>
            <p className="mt-3 font-mono text-2xl font-bold tabular-nums">{t.value}</p>
            <p className="mt-1 text-xs text-ink-500">{t.note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/orders?status=PAID"
          className="flex items-center gap-4 rounded-2xl border border-neon-lime/30 bg-neon-lime/5 p-5 transition hover:border-neon-lime/60"
        >
          <PackageCheck className="h-8 w-8 text-neon-lime" />
          <div className="flex-1">
            <p className="text-2xl font-bold tabular-nums">{stats.toFulfil}</p>
            <p className="text-sm text-ink-300">Paid orders waiting to be shipped</p>
          </div>
          <ArrowRight className="h-5 w-5 text-ink-400" />
        </Link>
        <Link
          href="/admin/orders?status=PENDING"
          className="flex items-center gap-4 rounded-2xl border border-obsidian-600 bg-obsidian-900/70 p-5 transition hover:border-neon-cyan/50"
        >
          <Clock className="h-8 w-8 text-ink-400" />
          <div className="flex-1">
            <p className="text-2xl font-bold tabular-nums">{stats.pendingOrders}</p>
            <p className="text-sm text-ink-300">Orders awaiting payment confirmation</p>
          </div>
          <ArrowRight className="h-5 w-5 text-ink-400" />
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <section className="rounded-2xl border border-obsidian-700 bg-obsidian-900/70 p-5 xl:col-span-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">Daily sales · last 14 days</h2>
            <p className="font-mono text-sm text-ink-400">{formatMoney(total14)} total</p>
          </div>
          <div
            className="mt-6 flex h-48 items-end gap-1.5"
            role="img"
            aria-label="Bar chart of paid sales per day for the last 14 days"
          >
            {stats.dailyRevenue.map((d, i) => {
              const height = d.total === 0 ? 2 : Math.max(4, Math.round((d.total / maxDay) * 100));
              const last = i === stats.dailyRevenue.length - 1;
              return (
                <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end">
                  <div
                    className={`w-full rounded-t-md transition ${
                      last
                        ? "bg-neon-cyan shadow-neon"
                        : d.total
                          ? "bg-neon-cyan/40 group-hover:bg-neon-cyan/70"
                          : "bg-obsidian-700"
                    }`}
                    style={{ height: `${height}%` }}
                  />
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-obsidian-600 bg-obsidian-950 px-2.5 py-1.5 text-xs group-hover:block">
                    <p className="font-mono text-ink-100">{formatMoney(d.total)}</p>
                    <p className="text-ink-500">
                      {d.date} · {d.orders} order{d.orders === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-500">
            <span>{stats.dailyRevenue[0]?.date.slice(5)}</span>
            <span>Today</span>
          </div>
        </section>

        <section className="rounded-2xl border border-obsidian-700 bg-obsidian-900/70 p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-neon-magenta" /> Low stock
            </h2>
            <Link href="/admin/products?stock=low" className="text-xs text-ink-400 hover:text-neon-cyan">
              View all
            </Link>
          </div>
          {stats.lowStock.length === 0 ? (
            <p className="mt-6 text-sm text-ink-400">Every variant has more than 5 units in stock.</p>
          ) : (
            <ul className="mt-4 divide-y divide-obsidian-800">
              {stats.lowStock.map((item) => (
                <li key={item.sku}>
                  <Link
                    href={`/admin/products/${item.id}`}
                    className="flex items-center gap-3 py-2.5 hover:text-neon-cyan"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{item.name}</p>
                      <p className="truncate font-mono text-[11px] text-ink-500">
                        {item.sku} · {item.label}
                      </p>
                    </div>
                    <span
                      className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold ${
                        item.stock === 0 ? "bg-neon-magenta/15 text-neon-magenta" : "bg-obsidian-800 text-ink-100"
                      }`}
                    >
                      {item.stock === 0 ? "OUT" : item.stock}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-obsidian-700 bg-obsidian-900/70">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="font-semibold">Recent orders</h2>
          <Link href="/admin/orders" className="text-xs text-ink-400 hover:text-neon-cyan">
            All orders
          </Link>
        </div>
        {stats.recentOrders.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-ink-400">
            No orders yet. They appear here as soon as a customer checks out.
          </p>
        ) : (
          <ul className="divide-y divide-obsidian-800">
            {stats.recentOrders.map((o) => (
              <li key={o.reference}>
                <Link
                  href={`/admin/orders/${o.reference}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 transition hover:bg-obsidian-850"
                >
                  <span className="font-mono text-sm text-neon-cyan">{o.reference}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-300">{o.customerName}</span>
                  <StatusPill status={o.status} />
                  <span className="w-28 text-right font-mono text-sm tabular-nums">{formatMoney(o.total)}</span>
                  <span className="hidden w-40 text-right text-xs text-ink-500 md:inline">
                    {formatDateTime(o.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

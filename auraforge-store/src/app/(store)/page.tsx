import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Headphones,
  Laptop,
  Cpu,
  Keyboard,
  Plug,
  Smartphone,
  AppWindow,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Hero } from "@/components/home/Hero";
import { ProductCard } from "@/components/catalog/ProductCard";
import { getFeaturedProducts, listCategories } from "@/server/services/catalog.service";

export const dynamic = "force-dynamic";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "laptops-computers": Laptop,
  "smartphones-tablets": Smartphone,
  "computer-parts": Cpu,
  peripherals: Keyboard,
  "audio-wearables": Headphones,
  accessories: Plug,
  "software-apps": AppWindow,
  "spare-parts": Wrench,
};

export default async function HomePage() {
  const [categories, featured] = await Promise.all([listCategories(), getFeaturedProducts(8)]);

  return (
    <>
      <Hero spotlight={featured[0] ?? null} />

      {categories.length > 0 && (
        <section className="container-x py-16">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Browse by system</p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Shop categories</h2>
            </div>
            <Link href="/shop" className="hidden items-center gap-1 text-sm text-ink-300 hover:text-neon-cyan sm:flex">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
            {categories.map((category) => {
              const Icon = CATEGORY_ICONS[category.slug] ?? Cpu;
              return (
                <Link
                  key={category.id}
                  href={`/shop?category=${category.slug}`}
                  className="group flex flex-col gap-3 rounded-2xl border border-obsidian-700 bg-obsidian-900/60 p-4 transition hover:border-neon-cyan/50 hover:bg-obsidian-850"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-obsidian-600 bg-obsidian-850 text-neon-cyan transition group-hover:shadow-neon">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold leading-tight">{category.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                    {category.productCount ?? 0} items
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="container-x pb-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Curated loadout</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Featured hardware</h2>
          </div>
          <Link href="/shop" className="flex items-center gap-1 text-sm text-ink-300 hover:text-neon-cyan">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {featured.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="panel p-10 text-center text-ink-400">
            No products yet. Run <code className="font-mono text-neon-cyan">npm run db:seed</code> to load the catalog.
          </div>
        )}
      </section>

      <section className="container-x">
        <div className="relative overflow-hidden rounded-3xl border border-obsidian-600 bg-gradient-to-br from-obsidian-850 via-obsidian-900 to-obsidian-950 p-8 sm:p-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-neon-violet/25 blur-[90px]" />
          <div className="relative grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="eyebrow">AuraForge service bay</p>
              <h2 className="mt-3 text-2xl font-bold sm:text-3xl">Repairs, upgrades & custom builds</h2>
              <p className="mt-4 max-w-lg text-ink-300">
                Our technicians diagnose, repair and upgrade laptops, phones and desktops — and assemble custom PCs from
                the parts you choose. Every purchase is backed by our warranty and after-sales support.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: Wrench, title: "Diagnostics & repair", text: "Screens, batteries, boards and ports." },
                { icon: Cpu, title: "Custom PC assembly", text: "Built, cable-managed and stress tested." },
                { icon: BadgeCheck, title: "Genuine warranty", text: "Up to 24 months on selected hardware." },
                { icon: AppWindow, title: "Software setup", text: "OS, licences and security installed." },
              ].map((item) => (
                <li key={item.title} className="rounded-2xl border border-obsidian-700 bg-obsidian-950/60 p-4">
                  <item.icon className="h-5 w-5 text-neon-cyan" />
                  <p className="mt-3 text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-ink-400">{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}

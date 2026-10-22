import Link from "next/link";
import { ArrowRight, LayoutGrid, ShieldCheck, Truck, Wrench } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { fallbackImageFor } from "@/lib/fallback-image";
import { formatMoney } from "@/lib/money";
import type { ProductCardDTO } from "@/types";

/** Cyber-themed hero banner for the home page. The showcase card spotlights a real product from the catalog. */
export function Hero({ spotlight }: { spotlight: ProductCardDTO | null }) {
  return (
    <section className="relative overflow-hidden border-b border-obsidian-800">
      <div className="pointer-events-none absolute inset-0 bg-grid [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="pointer-events-none absolute -right-40 top-10 h-[480px] w-[480px] rounded-full bg-neon-violet/20 blur-[120px]" />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-[360px] w-[360px] rounded-full bg-neon-cyan/15 blur-[110px]" />

      <div className="container-x relative grid items-center gap-12 py-16 md:py-24 lg:grid-cols-2">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-neon-cyan shadow-neon" />
            Systems online · Nationwide delivery
          </p>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Hardware that runs
            <br />
            <span className="neon-text">at the speed of thought.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-300 sm:text-lg">
            Business and gaming laptops, tablets, accessories and spare parts — sourced and serviced by
            AuraForge. Pay securely in Naira and get it delivered anywhere in Nigeria.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/shop" className="btn-primary px-6">
              Shop the catalog <ArrowRight className="h-4 w-4" />
            </Link>
            {spotlight && (
              <Link href={`/shop?category=${spotlight.categorySlug}`} className="btn-ghost px-6">
                <LayoutGrid className="h-4 w-4" /> {spotlight.categoryName}
              </Link>
            )}
          </div>

          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-obsidian-800 pt-6">
            {[
              { icon: ShieldCheck, label: "Paystack secured" },
              { icon: Truck, label: "36 states + FCT" },
              { icon: Wrench, label: "In-house repairs" },
            ].map((item) => (
              <div key={item.label} className="flex flex-col gap-2">
                <item.icon className="h-5 w-5 text-neon-cyan" />
                <dt className="text-xs text-ink-400">{item.label}</dt>
              </div>
            ))}
          </dl>
        </div>

        {spotlight && (
          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-neon-cyan/30 via-transparent to-neon-violet/30 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-obsidian-600 bg-obsidian-900/80 p-3 shadow-panel">
              <SafeImage
                src={spotlight.image}
                fallbackSrc={fallbackImageFor(spotlight.categorySlug)}
                alt={spotlight.name}
                className="aspect-square w-full rounded-[1.5rem] bg-obsidian-850 object-contain"
              />
              <div className="pointer-events-none absolute inset-x-3 top-3 h-1/3 animate-scan rounded-t-[1.5rem] bg-gradient-to-b from-neon-cyan/10 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between gap-3 rounded-xl border border-obsidian-600 bg-obsidian-950/85 px-4 py-3 backdrop-blur">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                    Spotlight · {formatMoney(spotlight.minPrice)}
                  </p>
                  <p className="truncate text-sm font-semibold">{spotlight.name}</p>
                </div>
                <Link href={`/product/${spotlight.slug}`} className="btn-primary shrink-0 px-3 py-2 text-xs">
                  View
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

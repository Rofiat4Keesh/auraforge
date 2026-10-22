import Link from "next/link";
import { Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { company, policyPages } from "@/lib/store-config";
import { Logo } from "./Logo";

/**
 * FOOTER — the only place for legal identity, registration details, policy links and address.
 */

/** Shop links come from the categories that currently have products, so none lead to an empty page. */
export function Footer({ categories = [] }: { categories?: { slug: string; name: string }[] }) {
  const shopLinks = [
    { href: "/shop", label: "All products" },
    ...categories.map((c) => ({ href: `/shop?category=${c.slug}`, label: c.name })),
  ];
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-24 border-t border-obsidian-700 bg-obsidian-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-cyan/60 to-transparent" />

      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-400">{company.tagline}</p>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-ink-500">
            We design, assemble, sell, distribute, service and repair electronic devices, computers, components,
            peripherals, software packages and mobile applications.
          </p>
        </div>

        <div className="lg:col-span-3">
          <h2 className="eyebrow mb-4">Shop</h2>
          <ul className="space-y-2.5 text-sm">
            {shopLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-ink-400 transition hover:text-neon-cyan">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-2">
          <h2 className="eyebrow mb-4">Policies</h2>
          <ul className="space-y-2.5 text-sm">
            {policyPages.map((page) => (
              <li key={page.slug}>
                <Link href={`/policies/${page.slug}`} className="text-ink-400 transition hover:text-neon-cyan">
                  {page.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-3">
          <h2 className="eyebrow mb-4">Contact</h2>
          <address className="space-y-3 text-sm not-italic text-ink-400">
            <p className="flex gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neon-cyan" />
              <span>{company.address}</span>
            </p>
            <p className="flex gap-2.5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-neon-cyan" />
              <a href={`mailto:${company.supportEmail}`} className="hover:text-neon-cyan">
                {company.supportEmail}
              </a>
            </p>
            <p className="flex gap-2.5">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-neon-cyan" />
              <a href={`tel:${company.supportPhone.replace(/\s+/g, "")}`} className="hover:text-neon-cyan">
                {company.supportPhone}
              </a>
            </p>
          </address>
        </div>
      </div>

      <div className="border-t border-obsidian-800">
        <div className="container-x flex flex-col gap-4 py-6 text-xs text-ink-500 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p>
              © {year} <span className="font-semibold text-ink-300">{company.legalName}</span>. All rights reserved.
            </p>
            <p className="font-mono tracking-wide">
              Registered with the Corporate Affairs Commission, Nigeria · RC No: {company.rcNumber}
            </p>
          </div>
          <p className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-neon-lime" />
            Payments secured by Paystack · Prices in Nigerian Naira (₦)
          </p>
        </div>
      </div>
    </footer>
  );
}

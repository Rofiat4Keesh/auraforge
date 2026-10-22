import Link from "next/link";
import { Logo } from "@/components/layout/Logo";

/** Shown for any address that doesn't exist (and for missing products). */
export default function NotFound() {
  return (
    <main className="container-x flex flex-1 flex-col items-center py-20 text-center">
      <Logo />
      <p className="neon-text mt-16 font-mono text-7xl font-bold">404</p>
      <h1 className="mt-6 text-2xl font-bold">Signal lost</h1>
      <p className="mt-3 max-w-md text-ink-400">
        The page or product you were looking for doesn&apos;t exist or is no longer available.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="btn-ghost">
          Go home
        </Link>
        <Link href="/shop" className="btn-primary">
          Browse the catalog
        </Link>
      </div>
    </main>
  );
}

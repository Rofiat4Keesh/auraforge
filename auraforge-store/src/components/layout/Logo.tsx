import Link from "next/link";

/** AuraForge wordmark with a hexagonal "forge core" emblem. */
export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link href="/" onClick={onClick} className="group flex items-center gap-2.5" aria-label="AuraForge home">
      <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0" aria-hidden="true">
        <defs>
          <linearGradient id="af-logo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22F3FF" />
            <stop offset="100%" stopColor="#A855F7" />
          </linearGradient>
        </defs>
        <path
          d="M20 2 L36 11 L36 29 L20 38 L4 29 L4 11 Z"
          fill="none"
          stroke="url(#af-logo)"
          strokeWidth="2.5"
          className="transition-all duration-500 group-hover:[stroke-width:3.5]"
        />
        <path d="M20 10 L28 26 L12 26 Z" fill="url(#af-logo)" opacity="0.9" />
        <circle cx="20" cy="21" r="2.6" fill="#05060A" />
      </svg>
      <span className="leading-none">
        <span className="block text-lg font-bold tracking-tight text-ink-100">
          AURA<span className="text-neon-cyan">FORGE</span>
        </span>
        <span className="block font-mono text-[9px] uppercase tracking-[0.32em] text-ink-500">Wide Technologies</span>
      </span>
    </Link>
  );
}

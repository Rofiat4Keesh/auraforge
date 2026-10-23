"use client";

/**
 * "Unauthorized Access" alert shown at the top of the page when the middleware turns
 * a customer account away from the Admin Portal from the shop (e.g. /account?next=/admin).
 * The query parameter is removed from the address bar straight away, so refreshing or
 * sharing the page does not show the alert again.
 */
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldAlert, X } from "lucide-react";
import { UNAUTHORIZED_REASONS, isUnauthorizedReason, type UnauthorizedReason } from "@/lib/safe-redirect";

export function UnauthorizedNotice() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [reason, setReason] = useState<UnauthorizedReason | null>(null);

  useEffect(() => {
    const value = searchParams.get("unauthorized");
    if (!isUnauthorizedReason(value)) return;
    setReason(value);
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete("unauthorized");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  if (!reason) return null;

  return (
    <div className="border-b border-neon-magenta/40 bg-neon-magenta/10">
      <div role="alert" className="container-x flex items-start gap-3 py-3 text-sm text-ink-100">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-neon-magenta" />
        <p className="min-w-0 flex-1">
          <strong className="font-semibold text-neon-magenta">Unauthorized Access.</strong> {UNAUTHORIZED_REASONS[reason]}{" "}
          {reason === "sign-in" && (
            <Link href="/account?next=/admin" className="font-semibold text-neon-cyan underline underline-offset-2">
              Sign in
            </Link>
          )}
        </p>
        <button type="button" onClick={() => setReason(null)} className="icon-btn -my-2 h-8 w-8" aria-label="Dismiss alert">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

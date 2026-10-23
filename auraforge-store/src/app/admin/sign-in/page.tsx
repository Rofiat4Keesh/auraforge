import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminSignIn } from "@/components/admin/AdminSignIn";
import { getAdminUser } from "@/lib/admin-guard";
import { getSession } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-redirect";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff sign-in" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * /admin/sign-in — the Admin Portal's own sign-in screen (no shop header, footer or cart).
 * Already signed in as an admin? Go straight to the dashboard (or the page asked for).
 */
export default async function AdminSignInPage({ searchParams }: Props) {
  const params = await searchParams;
  const rawNext = typeof params.next === "string" ? params.next : "";
  const next = safeNextPath(rawNext, "/admin");
  const destination = next.startsWith("/admin") && !next.startsWith("/admin/sign-in") ? next : "/admin";

  if (await getAdminUser()) redirect(destination);

  const session = await getSession();
  return <AdminSignIn next={destination} signedInAsCustomer={session ? session.email : null} />;
}

import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { getAdminUser } from "@/lib/admin-guard";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · AuraForge Admin" },
  robots: { index: false, follow: false },
};

/**
 * Every /admin page passes through here. Visitors who are not signed in as an admin
 * see the staff sign-in form instead of the page; the API routes enforce the same rule.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  if (!admin) {
    const session = await getSession();
    return <AdminLogin signedInAs={session?.email ?? null} />;
  }
  return <AdminShell adminName={admin.fullName}>{children}</AdminShell>;
}

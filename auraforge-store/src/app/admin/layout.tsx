import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminUser } from "@/lib/admin-guard";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Admin Portal", template: "%s · AuraForge Admin" },
  robots: { index: false, follow: false },
};

/**
 * Every /admin page passes through here.
 * The middleware (src/middleware.ts) already turns away visitors whose sign-in cookie is not an
 * admin one. This layout checks again against the database, so an account whose admin role was
 * removed a moment ago is also sent home, with the "Unauthorized Access" alert.
 * The admin API routes enforce the same rule with requireAdmin().
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  if (!admin) {
    const session = await getSession();
    redirect(session ? "/?unauthorized=forbidden" : "/?unauthorized=sign-in");
  }
  return (
    <AdminShell adminName={admin.fullName} adminEmail={admin.email}>
      {children}
    </AdminShell>
  );
}

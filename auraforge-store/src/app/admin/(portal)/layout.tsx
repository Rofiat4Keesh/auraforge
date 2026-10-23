import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminUser } from "@/lib/admin-guard";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Every Admin Portal page (all of /admin except /admin/sign-in) passes through here.
 * The middleware (src/middleware.ts) already sends visitors without an admin sign-in to the
 * staff sign-in page. This layout checks again against the database, so an account whose admin
 * role was removed a moment ago is also turned away. The admin API routes enforce the same rule
 * with requireAdmin().
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  if (!admin) {
    const session = await getSession();
    redirect(session ? "/admin/sign-in?reason=forbidden" : "/admin/sign-in");
  }
  return (
    <AdminShell adminName={admin.fullName} adminEmail={admin.email}>
      {children}
    </AdminShell>
  );
}

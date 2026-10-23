import { SyncPanel } from "@/components/admin/SyncPanel";
import { PageHeader } from "@/components/admin/ui";
import { getAdminUser } from "@/lib/admin-guard";
import { supplierSourceName } from "@/server/services/admin.service";

export const metadata = { title: "Supplier sync" };

export default async function AdminSyncPage() {
  if (!(await getAdminUser())) return null;
  const source = supplierSourceName();
  const configured = source !== "http" || Boolean(process.env.SUPPLIER_API_URL);
  return (
    <>
      <PageHeader
        title="Supplier sync"
        description="Pull the latest products, prices and stock from your product source."
      />
      <SyncPanel source={source} configured={configured} />
    </>
  );
}

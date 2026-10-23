import { CustomersTable } from "@/components/admin/CustomersTable";
import { PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Customers" };

export default function AdminCustomersPage() {
  return (
    <>
      <PageHeader
        title="Customers"
        description="Registered accounts with what they've spent. Totals count paid and fulfilled orders only."
      />
      <CustomersTable />
    </>
  );
}

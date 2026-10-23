import { OrdersTable } from "@/components/admin/OrdersTable";
import { PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Orders" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminOrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const q = typeof params.q === "string" ? params.q : "";
  const open = typeof params.open === "string" ? params.open : "";
  return (
    <>
      <PageHeader title="Orders" description="Filter by status, click an order for shipping details, phone, Paystack reference and to update its status." />
      <OrdersTable initialStatus={status} initialQuery={q} initialOpen={open} />
    </>
  );
}

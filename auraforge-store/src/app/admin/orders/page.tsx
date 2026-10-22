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
  return (
    <>
      <PageHeader title="Orders" description="Every checkout, from awaiting payment to delivered." />
      <OrdersTable initialStatus={status} initialQuery={q} />
    </>
  );
}

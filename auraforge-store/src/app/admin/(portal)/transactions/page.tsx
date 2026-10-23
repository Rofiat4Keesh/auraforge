import { TransactionsTable } from "@/components/admin/TransactionsTable";
import { PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Transactions" };

export default function AdminTransactionsPage() {
  return (
    <>
      <PageHeader
        title="Transactions"
        description="Every Paystack payment attempt in Naira: successful, started but not paid, failed and abandoned. Refunds are issued from your Paystack dashboard."
      />
      <TransactionsTable />
    </>
  );
}

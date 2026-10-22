import { OrderDetailView } from "@/components/admin/OrderDetailView";

interface Props {
  params: Promise<{ reference: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { reference } = await params;
  return { title: `Order ${reference}` };
}

export default async function AdminOrderPage({ params }: Props) {
  const { reference } = await params;
  return <OrderDetailView key={reference} reference={reference} />;
}

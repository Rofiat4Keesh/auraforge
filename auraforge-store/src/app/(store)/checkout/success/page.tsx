import type { Metadata } from "next";
import { PaymentResult } from "@/components/checkout/PaymentResult";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false },
};

interface SuccessPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Paystack redirects here as /checkout/success?trxref=AF-...&reference=AF-... */
export default async function CheckoutSuccessPage({ searchParams }: SuccessPageProps) {
  const params = await searchParams;
  const raw = params.reference ?? params.trxref;
  const reference = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;

  return (
    <div className="container-x py-12">
      <PaymentResult reference={reference ?? null} />
    </div>
  );
}

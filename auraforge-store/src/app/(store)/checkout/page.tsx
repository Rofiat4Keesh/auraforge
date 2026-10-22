import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { isTestMode } from "@/lib/paystack";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Secure checkout",
  robots: { index: false },
};

export default function CheckoutPage() {
  return (
    <div className="container-x py-10">
      <p className="eyebrow">Step 1 of 2 · Delivery details</p>
      <h1 className="mb-8 mt-2 text-3xl font-bold">Secure checkout</h1>
      <CheckoutForm testMode={isTestMode()} />
    </div>
  );
}

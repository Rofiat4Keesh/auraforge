import type { Metadata } from "next";
import { AccountView } from "@/components/account/AccountView";

export const metadata: Metadata = {
  title: "My account",
  robots: { index: false },
};

export default function AccountPage() {
  return (
    <div className="container-x py-10">
      <p className="eyebrow">Account</p>
      <h1 className="mb-8 mt-2 text-3xl font-bold">Your AuraForge account</h1>
      <AccountView />
    </div>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin Portal", template: "%s · AuraForge Admin" },
  robots: { index: false, follow: false },
};

/**
 * Everything under /admin. The staff sign-in page (/admin/sign-in) sits directly here;
 * every other admin page lives in the (portal) group, whose layout only lets admins in.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

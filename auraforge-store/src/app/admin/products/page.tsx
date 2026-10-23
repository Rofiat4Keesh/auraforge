import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { ProductsTable } from "@/components/admin/ProductsTable";
import { PageHeader } from "@/components/admin/ui";
import { getAdminUser } from "@/lib/admin-guard";
import { listAdminCategories } from "@/server/services/admin.service";

export const metadata = { title: "Products" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminProductsPage({ searchParams }: Props) {
  if (!(await getAdminUser())) return null;
  const [params, categories] = await Promise.all([searchParams, listAdminCategories()]);
  const stock = params.stock === "low" || params.stock === "out" ? params.stock : "";
  const edit = typeof params.edit === "string" && /^[a-f0-9]{24}$/i.test(params.edit) ? params.edit : "";

  return (
    <>
      <PageHeader
        title="Products"
        description="Click a product to edit its title, price (₦), stock, image and specs. Archive hides it from the shop."
        actions={
          <Link href="/admin/products/new" className="btn-ghost">
            <SlidersHorizontal className="h-4 w-4" /> Advanced editor (variants, galleries)
          </Link>
        }
      />
      <ProductsTable categories={categories} initialStock={stock} initialEdit={edit} />
    </>
  );
}

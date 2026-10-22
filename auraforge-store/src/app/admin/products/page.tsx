import Link from "next/link";
import { Plus } from "lucide-react";
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

  return (
    <>
      <PageHeader
        title="Products"
        description="Edit prices and stock, add products, or hide items from the shop."
        actions={
          <Link href="/admin/products/new" className="btn-primary">
            <Plus className="h-4 w-4" /> Add product
          </Link>
        }
      />
      <ProductsTable categories={categories} initialStock={stock} />
    </>
  );
}

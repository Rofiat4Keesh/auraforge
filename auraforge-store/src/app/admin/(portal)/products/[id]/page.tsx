import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { getAdminUser } from "@/lib/admin-guard";
import { HttpError } from "@/lib/http";
import { getAdminProduct, listAdminCategories } from "@/server/services/admin.service";

export const metadata = { title: "Edit product" };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EditProductPage({ params, searchParams }: Props) {
  if (!(await getAdminUser())) return null;
  const [{ id }, query] = await Promise.all([params, searchParams]);

  let product;
  try {
    product = await getAdminProduct(id);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  const categories = await listAdminCategories();

  return (
    <>
      {query.created === "1" && (
        <p
          className="mb-4 flex items-center gap-2 rounded-xl border border-neon-lime/40 p-3 text-sm text-neon-lime"
          role="status"
        >
          <CheckCircle2 className="h-4 w-4" /> Product created
          {product.active ? " and live in the shop" : " (hidden from the shop)"}.
        </p>
      )}
      <ProductEditor key={product.id} product={product} categories={categories} />
    </>
  );
}

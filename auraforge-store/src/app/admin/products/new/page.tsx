import { ProductEditor } from "@/components/admin/ProductEditor";
import { getAdminUser } from "@/lib/admin-guard";
import { listAdminCategories } from "@/server/services/admin.service";

export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  if (!(await getAdminUser())) return null;
  const categories = await listAdminCategories();
  if (categories.length === 0) {
    return (
      <div className="rounded-2xl border border-obsidian-700 bg-obsidian-900/70 p-8 text-center text-ink-300">
        Create a category first (Categories in the menu), then add products to it.
      </div>
    );
  }
  return <ProductEditor product={null} categories={categories} />;
}

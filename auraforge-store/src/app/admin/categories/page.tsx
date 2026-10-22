import { CategoriesManager } from "@/components/admin/CategoriesManager";
import { PageHeader } from "@/components/admin/ui";
import { getAdminUser } from "@/lib/admin-guard";
import { listAdminCategories } from "@/server/services/admin.service";

export const metadata = { title: "Categories" };

export default async function AdminCategoriesPage() {
  if (!(await getAdminUser())) return null;
  const categories = await listAdminCategories();
  return (
    <>
      <PageHeader
        title="Categories"
        description="The shop's departments. Order sets their position in the shop menu and on the home page."
      />
      <CategoriesManager initial={categories} />
    </>
  );
}

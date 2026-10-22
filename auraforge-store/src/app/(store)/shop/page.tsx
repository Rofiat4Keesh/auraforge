import type { Metadata } from "next";
import { CatalogView } from "@/components/catalog/CatalogView";
import {
  listCategories,
  listProducts,
  parseCatalogQuery,
  searchParamsToURLSearchParams,
} from "@/server/services/catalog.service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop",
  description: "Filter laptops, phones, components, peripherals and software by price, brand and specification.",
};

interface ShopPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = searchParamsToURLSearchParams(await searchParams);
  const [result, categories] = await Promise.all([listProducts(parseCatalogQuery(params)), listCategories()]);
  const queryString = params.toString();

  // `key` remounts the catalog when the header search navigates here with a new query.
  return <CatalogView key={queryString} initialResult={result} categories={categories} initialQuery={queryString} />;
}

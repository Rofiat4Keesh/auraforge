import { listCategoriesController } from "@/server/controllers/catalog.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = listCategoriesController;

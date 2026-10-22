import * as c from "@/server/controllers/admin.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = c.listCategoriesController;
export const POST = c.createCategoryController;

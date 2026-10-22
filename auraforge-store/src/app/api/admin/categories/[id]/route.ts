import * as c from "@/server/controllers/admin.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PUT = c.updateCategoryController;
export const DELETE = c.deleteCategoryController;

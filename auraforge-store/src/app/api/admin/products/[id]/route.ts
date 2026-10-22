import * as c from "@/server/controllers/admin.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = c.getProductController;
export const PUT = c.updateProductController;
export const PATCH = c.toggleProductController;

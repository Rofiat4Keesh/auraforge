import { clearCartController, getCartController } from "@/server/controllers/cart.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = getCartController;
export const DELETE = clearCartController;

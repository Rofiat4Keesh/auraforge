import { removeCartItemController, updateCartItemController } from "@/server/controllers/cart.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = updateCartItemController;
export const DELETE = removeCartItemController;

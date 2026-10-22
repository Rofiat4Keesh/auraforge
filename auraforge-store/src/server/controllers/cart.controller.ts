import type { NextRequest } from "next/server";
import { handle, ok, readJson } from "@/lib/http";
import { getSession } from "@/lib/auth";
import { ensureCartToken, readCartToken } from "@/lib/cart-cookie";
import { addToCartSchema, updateCartItemSchema } from "@/lib/validators";
import { addItem, clearCart, getCart, removeItem, updateItemQuantity } from "@/server/services/cart.service";

/** GET /api/cart */
export const getCartController = handle(async () => {
  return ok(await getCart(await readCartToken()));
});

/** DELETE /api/cart — empty the cart */
export const clearCartController = handle(async () => {
  return ok(await clearCart(await readCartToken()));
});

/** POST /api/cart/items  { productId, variantSku, quantity } */
export const addCartItemController = handle(async (req: NextRequest) => {
  const input = addToCartSchema.parse(await readJson(req));
  const token = await ensureCartToken();
  const session = await getSession();
  return ok(await addItem(token, session?.userId ?? null, input), 201);
});

/** PATCH /api/cart/items/:itemId  { quantity } — quantity 0 removes the line */
export const updateCartItemController = handle(
  async (req: NextRequest, context: { params: Promise<{ itemId: string }> }) => {
    const { itemId } = await context.params;
    const { quantity } = updateCartItemSchema.parse(await readJson(req));
    const token = await ensureCartToken();
    return ok(await updateItemQuantity(token, itemId, quantity));
  },
);

/** DELETE /api/cart/items/:itemId */
export const removeCartItemController = handle(
  async (_req: NextRequest, context: { params: Promise<{ itemId: string }> }) => {
    const { itemId } = await context.params;
    const token = await ensureCartToken();
    return ok(await removeItem(token, itemId));
  },
);

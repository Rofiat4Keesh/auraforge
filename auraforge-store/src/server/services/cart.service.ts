import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http";
import { BASE_CURRENCY } from "@/lib/money";
import { shippingConfig } from "@/lib/store-config";
import type { CartDTO, CartItemDTO } from "@/types";

export function calculateShipping(subtotalKobo: number): number {
  if (subtotalKobo <= 0) return 0;
  return subtotalKobo >= shippingConfig.freeThresholdKobo ? 0 : shippingConfig.flatFeeKobo;
}

function emptyCart(): CartDTO {
  return {
    items: [],
    itemCount: 0,
    subtotal: 0,
    shippingFee: 0,
    total: 0,
    freeShippingThreshold: shippingConfig.freeThresholdKobo,
    currency: BASE_CURRENCY,
  };
}

/**
 * Loads a cart and prices it using the CURRENT product prices from the database.
 * The browser never sends prices — so a tampered request cannot change what is charged.
 */
export async function getCart(token: string | undefined): Promise<CartDTO> {
  if (!token) return emptyCart();
  const cart = await prisma.cart.findUnique({
    where: { token },
    include: { items: { include: { product: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!cart) return emptyCart();

  const items: CartItemDTO[] = cart.items.map((item) => {
    const variant = item.product.variants.find((v) => v.sku === item.variantSku);
    const available = Boolean(item.product.active && variant && variant.stock > 0);
    const unitPrice = variant?.price ?? 0;
    // If stock dropped below what is in the cart, cap the quantity at what is left.
    const quantity = available && variant ? Math.min(item.quantity, variant.stock) : item.quantity;
    return {
      id: item.id,
      productId: item.productId,
      slug: item.product.slug,
      name: item.product.name,
      brand: item.product.brand,
      image: item.product.images[variant?.imageIndex ?? 0] ?? item.product.images[0] ?? "",
      variantSku: item.variantSku,
      variantLabel: variant?.label ?? "No longer available",
      unitPrice,
      quantity,
      lineTotal: available ? unitPrice * quantity : 0,
      stock: variant?.stock ?? 0,
      available,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const shippingFee = calculateShipping(subtotal);
  return {
    items,
    itemCount: items.filter((i) => i.available).reduce((sum, i) => sum + i.quantity, 0),
    subtotal,
    shippingFee,
    total: subtotal + shippingFee,
    freeShippingThreshold: shippingConfig.freeThresholdKobo,
    currency: BASE_CURRENCY,
  };
}

async function findOrCreateCart(token: string, userId: string | null) {
  const existing = await prisma.cart.findUnique({ where: { token } });
  if (existing) {
    if (userId && !existing.userId) {
      return prisma.cart.update({ where: { id: existing.id }, data: { userId } });
    }
    return existing;
  }
  return prisma.cart.create({ data: { token, userId } });
}

export async function addItem(
  token: string,
  userId: string | null,
  input: { productId: string; variantSku: string; quantity: number },
): Promise<CartDTO> {
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product || !product.active) throw new HttpError(404, "This product is no longer available.");
  const variant = product.variants.find((v) => v.sku === input.variantSku);
  if (!variant) throw new HttpError(404, "The selected option is no longer available.");
  if (variant.stock <= 0) throw new HttpError(409, `${product.name} (${variant.label}) is out of stock.`);

  const cart = await findOrCreateCart(token, userId);
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantSku: { cartId: cart.id, variantSku: input.variantSku } },
  });

  const desired = (existing?.quantity ?? 0) + input.quantity;
  if (desired > variant.stock) {
    throw new HttpError(409, `Only ${variant.stock} unit(s) of ${variant.label} available.`);
  }

  if (existing) {
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: desired } });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: product.id, variantSku: variant.sku, quantity: input.quantity },
    });
  }
  await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
  return getCart(token);
}

async function findItemInCart(token: string, itemId: string) {
  if (!/^[a-f0-9]{24}$/i.test(itemId)) throw new HttpError(404, "Cart item not found.");
  const item = await prisma.cartItem.findUnique({ where: { id: itemId }, include: { cart: true, product: true } });
  if (!item || item.cart.token !== token) throw new HttpError(404, "Cart item not found.");
  return item;
}

export async function updateItemQuantity(token: string, itemId: string, quantity: number): Promise<CartDTO> {
  const item = await findItemInCart(token, itemId);
  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    return getCart(token);
  }
  const variant = item.product.variants.find((v) => v.sku === item.variantSku);
  if (!variant) throw new HttpError(409, "This option is no longer available. Please remove it.");
  if (quantity > variant.stock) {
    throw new HttpError(409, `Only ${variant.stock} unit(s) available.`);
  }
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  return getCart(token);
}

export async function removeItem(token: string, itemId: string): Promise<CartDTO> {
  const item = await findItemInCart(token, itemId);
  await prisma.cartItem.delete({ where: { id: item.id } });
  return getCart(token);
}

export async function clearCart(token: string | undefined): Promise<CartDTO> {
  if (!token) return emptyCart();
  const cart = await prisma.cart.findUnique({ where: { token } });
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return getCart(token);
}

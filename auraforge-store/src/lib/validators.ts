import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{10,16}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export const addToCartSchema = z.object({
  productId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid product id"),
  variantSku: z.string().min(1),
  quantity: z.number().int().min(1).max(20).default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(20),
});

export const checkoutSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  fullName: z.string().trim().min(2, "Enter the recipient's full name").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{10,16}$/, "Enter a valid Nigerian phone number, e.g. 0803 000 0000"),
  address: z.string().trim().min(5, "Enter a delivery address").max(200),
  city: z.string().trim().min(2, "Enter a city").max(60),
  state: z.string().trim().min(2, "Select a state"),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

import { z } from "zod";
import { ADMIN_SETTABLE_STATUSES } from "./order-status";

/** Prices in admin forms are typed in Naira (major units); the service converts them to kobo. */
const naira = z.coerce.number().min(0, "Price cannot be negative").max(1_000_000_000);

export const variantInputSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(2, "SKU is required")
    .max(60)
    .regex(/^[A-Za-z0-9._-]+$/, "Use letters, numbers, dots, dashes or underscores"),
  label: z.string().trim().min(1, "Label is required").max(80),
  attributes: z
    .array(z.object({ name: z.string().trim().min(1).max(40), value: z.string().trim().min(1).max(60) }))
    .max(5),
  price: naira.refine((n) => n > 0, "Price must be more than ₦0"),
  compareAtPrice: naira.nullable().optional(),
  stock: z.coerce.number().int().min(0).max(1_000_000),
  imageIndex: z.coerce.number().int().min(0).max(19).default(0),
});

export const productInputSchema = z
  .object({
    name: z.string().trim().min(3, "Name is required").max(140),
    slug: z
      .string()
      .trim()
      .max(100)
      .regex(/^[a-z0-9-]*$/, "Use lowercase letters, numbers and dashes")
      .optional()
      .or(z.literal("")),
    brand: z.string().trim().min(1, "Brand is required").max(60),
    categoryId: z.string().regex(/^[a-f0-9]{24}$/i, "Choose a category"),
    shortDescription: z.string().trim().min(10, "Write a one-line summary").max(240),
    description: z.string().trim().min(20, "Write a fuller description").max(5000),
    images: z
      .array(
        z
          .string()
          .trim()
          .refine((u) => u.startsWith("/") || /^https:\/\//.test(u), "Image must be an https:// link or a /path"),
      )
      .min(1, "Add at least one image")
      .max(20),
    specs: z
      .array(z.object({ key: z.string().trim().min(1).max(40), value: z.string().trim().min(1).max(80) }))
      .max(40),
    variants: z.array(variantInputSchema).min(1, "Add at least one variant").max(50),
    tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(20),
    featured: z.boolean(),
    active: z.boolean(),
    supplierSku: z.string().trim().max(60).optional().or(z.literal("")),
    costPrice: naira.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const skus = value.variants.map((v) => v.sku.toUpperCase());
    if (new Set(skus).size !== skus.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["variants"], message: "Each variant needs a different SKU" });
    }
    value.variants.forEach((v, i) => {
      if (v.imageIndex >= value.images.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants"],
          message: `Variant ${i + 1} points to image ${v.imageIndex + 1}, but there are only ${value.images.length} images`,
        });
      }
    });
  });

export type ProductInput = z.infer<typeof productInputSchema>;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(60),
  slug: z
    .string()
    .trim()
    .max(60)
    .regex(/^[a-z0-9-]*$/, "Use lowercase letters, numbers and dashes")
    .optional()
    .or(z.literal("")),
  description: z.string().trim().min(5, "Add a short description").max(300),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const orderStatusUpdateSchema = z.object({
  status: z.enum(ADMIN_SETTABLE_STATUSES),
  restock: z.boolean().optional(),
});

export const productActiveSchema = z.object({ active: z.boolean() });

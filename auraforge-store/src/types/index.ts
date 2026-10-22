/**
 * Data shapes shared between the API (server) and the React components (browser).
 * All money values are integers in kobo.
 */

export interface CategoryDTO {
  id: string;
  slug: string;
  name: string;
  description: string;
  productCount?: number;
}

export interface ProductCardDTO {
  id: string;
  slug: string;
  name: string;
  brand: string;
  shortDescription: string;
  image: string;
  minPrice: number;
  maxPrice: number;
  compareAtPrice: number | null;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  featured: boolean;
  categorySlug: string;
  categoryName: string;
}

export interface VariantDTO {
  sku: string;
  label: string;
  attributes: { name: string; value: string }[];
  price: number;
  compareAtPrice: number | null;
  stock: number;
  imageIndex: number;
}

export interface ProductDetailDTO extends ProductCardDTO {
  description: string;
  images: string[];
  specs: { key: string; value: string }[];
  variants: VariantDTO[];
  tags: string[];
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface CatalogFacets {
  brands: FacetValue[];
  specs: { key: string; values: FacetValue[] }[];
  priceRange: { min: number; max: number };
}

export interface CatalogResult {
  products: ProductCardDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: CatalogFacets;
}

export interface CartItemDTO {
  id: string;
  productId: string;
  slug: string;
  name: string;
  brand: string;
  image: string;
  variantSku: string;
  variantLabel: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stock: number;
  available: boolean;
}

export interface CartDTO {
  items: CartItemDTO[];
  itemCount: number;
  subtotal: number;
  shippingFee: number;
  total: number;
  freeShippingThreshold: number;
  currency: string;
}

export interface OrderItemDTO {
  productSlug: string;
  sku: string;
  name: string;
  variantLabel: string;
  image: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export type OrderStatusDTO = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "FULFILLED";

export interface OrderDTO {
  reference: string;
  status: OrderStatusDTO;
  email: string;
  currency: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  createdAt: string;
  paidAt: string | null;
  items: OrderItemDTO[];
  shipping: {
    fullName: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    notes: string | null;
  } | null;
  paymentChannel: string | null;
}

export interface SessionUserDTO {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: "CUSTOMER" | "ADMIN";
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: { message: string; details?: Record<string, string[] | undefined> };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

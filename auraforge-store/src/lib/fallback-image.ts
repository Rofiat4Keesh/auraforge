/**
 * Picture shown when a product photo link is missing or fails to load (for example a broken
 * supplier image link). It clearly reads "Image unavailable" rather than showing an illustration
 * that could be mistaken for the real product, and it keeps every card the same size.
 */
export const GENERIC_FALLBACK_IMAGE = "/media/render/photo/0?accent=22F3FF";

/** Kept as a function so a category-specific placeholder can be added later without touching callers. */
export function fallbackImageFor(_categorySlug?: string | null, _view = 0): string {
  void _categorySlug;
  void _view;
  return GENERIC_FALLBACK_IMAGE;
}

import { hasText } from "./catalog.ts";

// Editor limits aligned with Shopify's documented product SEO fields; not scoring thresholds.
export const SEO_LIMITS = { title: 70, description: 320 } as const;
export type SeoValues = { title: string; description: string };
export type SeoDraft = {
  title: unknown;
  description: unknown;
  expectedTitle: unknown;
  expectedDescription: unknown;
  clearTitle: boolean;
  clearDescription: boolean;
};
export function validateSeo(
  draft: SeoDraft,
):
  | { ok: true; seo: SeoValues; expected: SeoValues }
  | { ok: false; message: string } {
  const seo: SeoValues = { title: "", description: "" };
  const expected: SeoValues = { title: "", description: "" };
  for (const field of ["title", "description"] as const) {
    const value = draft[field];
    const original =
      field === "title" ? draft.expectedTitle : draft.expectedDescription;
    const clear = field === "title" ? draft.clearTitle : draft.clearDescription;
    if (typeof value !== "string" || typeof original !== "string")
      return {
        ok: false,
        message: "Refresh this product before editing its SEO details.",
      };
    expected[field] = original;
    if (clear) {
      if (value.trim())
        return {
          ok: false,
          message: `Review the SEO ${field}: choose either a value or Clear, not both.`,
        };
      seo[field] = "";
      continue;
    }
    // Preserve an untouched Shopify value exactly, including legacy values beyond editor limits.
    if (value === original) {
      seo[field] = original;
      continue;
    }
    const trimmed = value.trim();
    if (!hasText(trimmed)) {
      if (original !== "" || trimmed !== "")
        return {
          ok: false,
          message: `Enter an SEO ${field}, or select Clear custom SEO ${field} to remove it deliberately.`,
        };
      seo[field] = "";
      continue;
    }
    if (Array.from(trimmed).length > SEO_LIMITS[field])
      return {
        ok: false,
        message: `Use ${SEO_LIMITS[field]} characters or fewer for the SEO ${field}. Your text has not been shortened.`,
      };
    seo[field] = trimmed;
  }
  return { ok: true, seo, expected };
}
export type SeoResult = {
  ok: boolean;
  code: string;
  message: string;
  verified?: boolean;
  productId?: string;
};

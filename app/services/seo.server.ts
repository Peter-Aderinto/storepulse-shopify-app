import {
  validateSeo,
  type SeoDraft,
  type SeoResult,
  type SeoValues,
} from "../domain/seo.ts";
import { toProductGid } from "../domain/product-analysis.ts";
import {
  CatalogError,
  createQuery,
  fetchProduct,
  type GraphqlClient,
} from "./catalog.server.ts";
import type { RemediationContext } from "./remediation-action.server.ts";

export const SEO_MUTATION = `#graphql
  mutation StorePulseUpdateSeo($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product { id seo { title description } }
      userErrors { field }
    }
  }`;
const saving = new Set<string>();
const failure = (code: string, message: string): SeoResult => ({
  ok: false,
  code,
  message,
});
const messages = {
  permission:
    "Shopify denied access. Reopen StorePulse or ask your store administrator for permission to edit products.",
  throttled:
    "Shopify is limiting requests. Refresh the product before trying again.",
  timeout:
    "Shopify did not confirm the save in time. Refresh to check the current SEO details before saving again.",
  invalid:
    "Shopify returned incomplete or unexpected data. Refresh to check the current SEO details before trying again.",
  unavailable:
    "We could not confirm the save with Shopify. Refresh to check the current SEO details before saving again.",
};
function matches(
  actual: { title: string | null; description: string | null },
  expected: SeoValues,
) {
  return (
    (actual.title ?? "") === expected.title &&
    (actual.description ?? "") === expected.description
  );
}
export async function updateProductSeo({
  graphql,
  shop,
  productId,
  draft,
  signal,
}: {
  graphql: GraphqlClient;
  shop: string;
  productId: string | undefined;
  draft: SeoDraft;
  signal?: AbortSignal;
}): Promise<SeoResult> {
  const gid = toProductGid(productId);
  if (!gid)
    return failure(
      "invalid_input",
      "This product link is invalid. Return to Store health and select the product again.",
    );
  const input = validateSeo(draft);
  if (!input.ok) return failure("invalid_input", input.message);
  const key = `${shop}:${gid}`;
  if (saving.has(key))
    return failure(
      "busy",
      "SEO details for this product are already being saved. Wait for that save to finish.",
    );
  saving.add(key);
  try {
    const product = await fetchProduct(graphql, productId!, signal);
    if (!product)
      return failure(
        "not_found",
        "This product is no longer available. Return to Store health and refresh.",
      );
    if (matches(product.seo, input.seo))
      return {
        ok: true,
        code: "unchanged",
        message: "These SEO details are already saved in Shopify.",
        productId: gid,
        verified: true,
      };
    if (!matches(product.seo, input.expected))
      return failure(
        "conflict",
        "SEO details changed since you opened this editor. Cancel, refresh, and review the current values before saving.",
      );
    // Send both fields to preserve the untouched sibling; never send unrelated product fields.
    const result = await createQuery(graphql, signal)<{
      productUpdate: {
        product: {
          id: string;
          seo: { title: string | null; description: string | null };
        } | null;
        userErrors: { field?: string[] }[];
      };
    }>(SEO_MUTATION, { product: { id: gid, seo: input.seo } });
    const payload = result.productUpdate;
    if (!payload || !Array.isArray(payload.userErrors))
      throw new CatalogError("invalid");
    if (payload.userErrors.length)
      return failure(
        "user_error",
        "Shopify could not save these SEO details. Check the values and your product permissions, then refresh before trying again.",
      );
    if (
      payload.product?.id !== gid ||
      !payload.product.seo ||
      !matches(payload.product.seo, input.seo)
    )
      throw new CatalogError("invalid");
    try {
      const fresh = await fetchProduct(graphql, productId!, signal);
      const verified = Boolean(fresh && matches(fresh.seo, input.seo));
      return {
        ok: true,
        code: "saved",
        productId: gid,
        verified,
        message: verified
          ? "SEO details updated in Shopify."
          : "Shopify accepted the update, but the refreshed product does not confirm it yet. Refresh analysis to verify the SEO details and score.",
      };
    } catch (error) {
      if (error instanceof Response) throw error;
      return {
        ok: true,
        code: "saved",
        productId: gid,
        verified: false,
        message:
          "Shopify accepted the update, but we could not refresh the product. Refresh analysis to verify the SEO details and score.",
      };
    }
  } catch (error) {
    if (error instanceof Response) throw error;
    const code = error instanceof CatalogError ? error.code : "unavailable";
    return failure(code, messages[code]);
  } finally {
    saving.delete(key);
  }
}
export const saveSeoFromForm = ({
  shop,
  graphql,
  productId,
  form,
  signal,
}: RemediationContext) =>
  updateProductSeo({
    shop,
    graphql,
    productId,
    signal,
    draft: {
      title: form.get("seoTitle"),
      description: form.get("seoDescription"),
      expectedTitle: form.get("expectedTitle"),
      expectedDescription: form.get("expectedDescription"),
      clearTitle: form.get("clearTitle") === "true",
      clearDescription: form.get("clearDescription") === "true",
    },
  });

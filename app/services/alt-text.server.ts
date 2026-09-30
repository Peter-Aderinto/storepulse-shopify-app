import {
  validateAltText,
  validMediaId,
  type AltTextResult,
} from "../domain/alt-text.ts";
import { toProductGid } from "../domain/product-analysis.ts";
import {
  CatalogError,
  createQuery,
  fetchProduct,
  type GraphqlClient,
} from "./catalog.server.ts";

export const FILE_STATE_QUERY = `#graphql
  query StorePulseImageFile($id: ID!) {
    node(id: $id) { ... on MediaImage { id alt fileStatus } }
  }`;
export const ALT_TEXT_MUTATION = `#graphql
  mutation StorePulseUpdateImageAlt($files: [FileUpdateInput!]!) {
    fileUpdate(files: $files) {
      files { id alt }
      userErrors { field code }
    }
  }`;
const saving = new Set<string>();
const failure = (
  code: string,
  message: string,
  mediaId?: string,
): AltTextResult => ({ ok: false, code, message, mediaId });
const ERROR_MESSAGES = {
  permission:
    "Shopify denied access. Reopen StorePulse and approve its file permission, or ask your store administrator for access to edit files.",
  throttled:
    "Shopify is limiting requests. Refresh the product before trying again.",
  timeout:
    "Shopify did not confirm the save in time. Refresh to check the current alt text before saving again.",
  invalid:
    "Shopify returned incomplete data. Refresh the product before trying again.",
  unavailable:
    "We could not confirm the save with Shopify. Refresh to check the current alt text before saving again.",
};
export async function updateImageAltText({
  graphql,
  shop,
  productId,
  mediaId,
  altText,
  expectedAlt,
  signal,
}: {
  graphql: GraphqlClient;
  shop: string;
  productId: string | undefined;
  mediaId: unknown;
  altText: unknown;
  expectedAlt: unknown;
  signal?: AbortSignal;
}): Promise<AltTextResult> {
  if (!toProductGid(productId) || !validMediaId(mediaId))
    return failure(
      "invalid_input",
      "This product or image link is invalid. Refresh and select the image again.",
    );
  const input = validateAltText(altText);
  if (!input.ok) return failure("invalid_input", input.message, mediaId);
  if (typeof expectedAlt !== "string")
    return failure(
      "invalid_input",
      "Refresh this product before editing its alt text.",
      mediaId,
    );
  // A shop/file lock avoids simultaneous local writes. It is not a distributed lock.
  const key = `${shop}:${mediaId}`;
  if (saving.has(key))
    return failure(
      "busy",
      "This image is already being saved. Wait for that save to finish.",
      mediaId,
    );
  saving.add(key);
  try {
    const product = await fetchProduct(graphql, productId!, signal);
    if (!product)
      return failure(
        "not_found",
        "This product is no longer available. Return to Store health and refresh.",
        mediaId,
      );
    const image = product.images.find((item) => item.id === mediaId);
    if (!image)
      return failure(
        "not_found",
        "This image is not attached to this product. Refresh the product before editing.",
        mediaId,
      );
    const query = createQuery(graphql, signal);
    const state = await query<{
      node: { id: string; alt: string | null; fileStatus: string } | null;
    }>(FILE_STATE_QUERY, { id: mediaId });
    if (!state.node || state.node.id !== mediaId)
      return failure(
        "not_found",
        "This image file is no longer available.",
        mediaId,
      );
    if (state.node.fileStatus !== "READY")
      return failure(
        "not_ready",
        "Shopify is still processing this image or it failed processing. Try again when the image is ready.",
        mediaId,
      );
    if (
      (state.node.alt ?? "") === input.alt &&
      (image.altText ?? "") === input.alt
    )
      return {
        ok: true,
        code: "unchanged",
        message: "This alt text is already saved in Shopify.",
        mediaId,
        alt: input.alt,
        verified: true,
      };
    if (
      (state.node.alt ?? "") !== expectedAlt ||
      (image.altText ?? "") !== expectedAlt
    )
      return failure(
        "conflict",
        "The alt text changed since you opened this editor. Refresh and review the current value before saving.",
        mediaId,
      );
    const result = await query<{
      fileUpdate: {
        files: { id: string; alt: string | null }[] | null;
        userErrors: { field?: string[]; code?: string }[];
      };
    }>(ALT_TEXT_MUTATION, { files: [{ id: mediaId, alt: input.alt }] });
    const payload = result.fileUpdate;
    if (!payload || !Array.isArray(payload.userErrors))
      throw new CatalogError("invalid");
    if (payload.userErrors.length) {
      const code = payload.userErrors[0].code;
      return failure(
        "user_error",
        code === "FILE_DOES_NOT_EXIST"
          ? "This image was removed before the save. Refresh the product."
          : "Shopify could not update this image. Check your alt text and the file's status, then refresh before trying again.",
        mediaId,
      );
    }
    if (
      !payload.files?.some(
        (file) => file.id === mediaId && file.alt === input.alt,
      )
    )
      throw new CatalogError("invalid");
    // Only authoritative reads can confirm resolution. React Router revalidates the loader/score next.
    try {
      const fresh = await fetchProduct(graphql, productId!, signal);
      const verified =
        fresh?.images.some(
          (item) => item.id === mediaId && item.altText === input.alt,
        ) ?? false;
      return {
        ok: true,
        code: "saved",
        mediaId,
        alt: input.alt,
        verified,
        message: verified
          ? "Alt text updated in Shopify."
          : "Shopify accepted the update, but the refreshed product does not confirm it yet. Refresh analysis to verify the image and score.",
      };
    } catch (error) {
      if (error instanceof Response) throw error;
      return {
        ok: true,
        code: "saved",
        mediaId,
        alt: input.alt,
        verified: false,
        message:
          "Shopify accepted the update, but we could not refresh the product. Refresh analysis to verify the image and score.",
      };
    }
  } catch (error) {
    if (error instanceof Response) throw error;
    const code = error instanceof CatalogError ? error.code : "unavailable";
    return failure(code, ERROR_MESSAGES[code], mediaId);
  } finally {
    saving.delete(key);
  }
}

// Injection keeps framework authentication at the boundary and makes rejection behavior testable.
export async function handleAltTextAction(
  request: Request,
  productId: string | undefined,
  authenticate: (
    request: Request,
  ) => Promise<{ shop: string; graphql: GraphqlClient }>,
) {
  const { shop, graphql } = await authenticate(request);
  const headers = { "Cache-Control": "private, no-store" };
  if (request.method !== "POST")
    return Response.json(
      failure("method", "Use Save alt text to update an image."),
      { status: 405, headers },
    );
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json(
      failure(
        "invalid_input",
        "The save request could not be read. Please try again.",
      ),
      { status: 400, headers },
    );
  }
  if (form.get("intent") !== "save-alt-text")
    return Response.json(failure("invalid_input", "Unknown product action."), {
      status: 400,
      headers,
    });
  const result = await updateImageAltText({
    graphql,
    shop,
    productId,
    mediaId: form.get("mediaId"),
    altText: form.get("altText"),
    expectedAlt: form.get("expectedAlt"),
    signal: request.signal,
  });
  // Expected validation failures return action data so loader revalidation remains reliable.
  return Response.json(result, { headers });
}

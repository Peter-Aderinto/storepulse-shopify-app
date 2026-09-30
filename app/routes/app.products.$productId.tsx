import { handleAltTextAction } from "../services/alt-text.server";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { data, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { analyzeProductDetail, toProductGid } from "../domain/product-analysis";
import { CatalogError, fetchProduct } from "../services/catalog.server";
import { ProductAnalysisPage } from "../components/ProductAnalysisPage";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const headers = { "Cache-Control": "private, no-store" };
  if (!toProductGid(params.productId))
    return data(
      {
        ok: false as const,
        heading: "Invalid product link",
        message:
          "This link does not contain a valid Shopify product identifier. Return to Store health and select a product.",
        retryable: false,
      },
      { status: 400, headers },
    );
  try {
    const product = await fetchProduct(
      (query, options) => admin.graphql(query, options),
      params.productId!,
      request.signal,
    );
    if (!product)
      return data(
        {
          ok: false as const,
          heading: "Product not found",
          message:
            "This product may have been deleted or is not available to this app in the current store. Return to Store health and refresh the catalog.",
          retryable: false,
        },
        { status: 404, headers },
      );
    return data(
      {
        ok: true as const,
        analysis: analyzeProductDetail(product),
        adminUrl: `https://admin.shopify.com/store/${session.shop.replace(/\.myshopify\.com$/, "")}/products/${params.productId}`,
        checkedAt: new Date().toISOString(),
      },
      { headers },
    );
  } catch (error) {
    if (error instanceof Response) throw error;
    const code = error instanceof CatalogError ? error.code : "unavailable";
    const messages = {
      permission:
        "Shopify did not allow access to this product. Reopen StorePulse in Shopify Admin and review any requested permissions.",
      throttled:
        "Shopify is limiting requests. Wait a moment, then refresh this analysis.",
      timeout: "This product took too long to load. Refresh to try again.",
      invalid:
        "The product changed or Shopify returned incomplete data. Refresh to retrieve a complete analysis.",
      unavailable:
        "We could not retrieve this product from Shopify. Please try again shortly.",
    };
    return data(
      {
        ok: false as const,
        heading: "Product analysis unavailable",
        message: messages[code],
        retryable: true,
      },
      { status: code === "permission" ? 403 : 503, headers },
    );
  }
};
export default function ProductRoute() {
  return <ProductAnalysisPage result={useLoaderData<typeof loader>()} />;
}
export const headers: HeadersFunction = (args) => {
  const headers = new Headers(boundary.headers(args));
  headers.set("Cache-Control", "private, no-store");
  return headers;
};

export const action = ({ request, params }: ActionFunctionArgs) =>
  handleAltTextAction(request, params.productId, async (request) => {
    const { admin, session } = await authenticate.admin(request);
    return {
      shop: session.shop,
      graphql: (query, options) =>
        admin.graphql(query, { ...options, tries: 1 }),
    };
  });

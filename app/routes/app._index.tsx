import db from "../db.server";
import { createProductSyncStore } from "../services/product-sync.server";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { data, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { aggregateCatalog } from "../domain/catalog";
import { CatalogError, fetchCatalog } from "../services/catalog.server";
import { Dashboard } from "../components/Dashboard";

const ERROR_MESSAGES = {
  permission:
    "Shopify did not allow catalog access. Reopen StorePulse from Shopify Admin and review any requested permissions.",
  throttled:
    "Shopify is temporarily limiting catalog requests. Wait a moment, then refresh the analysis.",
  timeout:
    "The catalog took too long to load. Try again shortly. Large catalogs may need a background scan in a future release.",
  unavailable:
    "We could not retrieve your catalog from Shopify. Please try again shortly.",
  invalid:
    "The catalog changed or Shopify returned incomplete data. Refresh to start a new analysis.",
};
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  try {
    const catalog = await fetchCatalog(
      (query, options) => admin.graphql(query, options),
      request.signal,
    );
    return data(
      {
        ok: true as const,
        health: aggregateCatalog(catalog.products),
        total: catalog.total,
        limited: catalog.limited,
        scannedAt: catalog.scannedAt,
        syncActivity: await createProductSyncStore(db).latest(session.shop),
        adminBase: `https://admin.shopify.com/store/${session.shop.replace(/\.myshopify\.com$/, "")}`,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    // Preserve Shopify's authentication redirects and response headers.
    if (error instanceof Response) throw error;
    const code = error instanceof CatalogError ? error.code : "unavailable";
    return data(
      { ok: false as const, message: ERROR_MESSAGES[code] },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
};

export default function Index() {
  return <Dashboard result={useLoaderData<typeof loader>()} />;
}
export const headers: HeadersFunction = (args) => {
  const headers = new Headers(boundary.headers(args));
  headers.set("Cache-Control", "private, no-store");
  return headers;
};

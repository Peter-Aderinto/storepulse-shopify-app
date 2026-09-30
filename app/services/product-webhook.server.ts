import {
  parseProductUpdate,
  validShop,
  type WebhookContext,
  type ProductUpdateEvent,
} from "../domain/product-webhook.ts";

export type WebhookAuthenticator = (
  request: Request,
) => Promise<WebhookContext>;
const response = (status: number) =>
  new Response(null, { status, headers: { "Cache-Control": "no-store" } });
export async function handleProductUpdate(
  request: Request,
  authenticate: WebhookAuthenticator,
  record: (event: ProductUpdateEvent) => Promise<unknown>,
) {
  try {
    // Shopify's framework verifies the HMAC before any data is read or persisted here.
    const context = await authenticate(request);
    if (request.method !== "POST") return response(405);
    const event = parseProductUpdate(context);
    if (!event) return response(400);
    await record(event);
    return response(200);
  } catch (error) {
    if (error instanceof Response) throw error;
    // No payload, token, shop identity, or upstream error details are logged/returned.
    console.error(
      "StorePulse product webhook processing failed; delivery may be retried.",
    );
    return response(503);
  }
}
export async function handleAppUninstalled(
  request: Request,
  authenticate: WebhookAuthenticator,
  removeShop: (shop: string) => Promise<unknown>,
) {
  try {
    const context = await authenticate(request);
    if (request.method !== "POST") return response(405);
    if (context.topic !== "APP_UNINSTALLED" || !validShop(context.shop))
      return response(400);
    // Cleanup is idempotent even when Shopify's returned session is already absent.
    await removeShop(context.shop);
    return response(200);
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error(
      "StorePulse uninstall cleanup failed; delivery may be retried.",
    );
    return response(503);
  }
}

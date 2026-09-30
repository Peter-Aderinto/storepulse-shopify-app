import { toProductGid } from "./product-analysis.ts";

export type ProductUpdateEvent = {
  shop: string;
  productId: string;
  eventKey: string;
  webhookId: string;
  productUpdatedAt: Date | null;
};
export type WebhookContext = {
  shop: string;
  topic: string;
  payload: unknown;
  webhookId: string;
  eventId?: string;
};
export function validShop(shop: unknown): shop is string {
  return (
    typeof shop === "string" &&
    shop.length <= 253 &&
    /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)
  );
}
function validEventId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id);
}
function timestamp(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const parts =
    /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!parts) return null;
  const [, y, m, d] = parts;
  const year = Number(y),
    month = Number(m),
    day = Number(d);
  if (
    year < 2000 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate()
  )
    return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
export function parseProductUpdate(
  context: WebhookContext,
): ProductUpdateEvent | null {
  if (
    context.topic !== "PRODUCTS_UPDATE" ||
    !validShop(context.shop) ||
    !validEventId(context.webhookId)
  )
    return null;
  if (context.eventId !== undefined && !validEventId(context.eventId))
    return null;
  const payload = context.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return null;
  const fields = payload as Record<string, unknown>;
  const rawGid = fields.admin_graphql_api_id;
  const numeric =
    typeof fields.id === "string"
      ? fields.id
      : typeof fields.id === "number" && Number.isSafeInteger(fields.id)
        ? String(fields.id)
        : undefined;
  const numericGid = toProductGid(numeric);
  const matched =
    typeof rawGid === "string"
      ? /^gid:\/\/shopify\/Product\/([1-9]\d*)$/.exec(rawGid)
      : null;
  const productId =
    rawGid === undefined
      ? numericGid
      : matched
        ? toProductGid(matched[1])
        : null;
  if (!productId || (numericGid && numericGid !== productId)) return null;
  const productUpdatedAt =
    fields.updated_at == null ? null : timestamp(fields.updated_at);
  if (fields.updated_at != null && !productUpdatedAt) return null;
  return {
    shop: context.shop,
    productId,
    eventKey: context.eventId
      ? `event:${context.eventId}`
      : `delivery:${context.webhookId}`,
    webhookId: context.webhookId,
    productUpdatedAt,
  };
}

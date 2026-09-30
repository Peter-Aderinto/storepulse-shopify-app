import type { PrismaClient } from "@prisma/client";
import type { ProductUpdateEvent } from "../domain/product-webhook.ts";

export const RECEIPT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export type SyncActivity = {
  available: boolean;
  lastReceivedAt: string | null;
};
export function createProductSyncStore(db: PrismaClient) {
  return {
    async record(event: ProductUpdateEvent, now = new Date()) {
      return db.$transaction(
        async (tx) => {
          // Read installation state inside the same transaction as the metadata writes.
          const installed = await tx.session.findFirst({
            where: { shop: event.shop, isOnline: false },
            select: { id: true },
          });
          if (!installed) return "ignored" as const;
          await tx.webhookReceipt.deleteMany({
            where: {
              shop: event.shop,
              receivedAt: {
                lt: new Date(now.getTime() - RECEIPT_RETENTION_MS),
              },
            },
          });
          const receiptKey = { shop: event.shop, eventKey: event.eventKey };
          if (
            await tx.webhookReceipt.findUnique({
              where: { shop_eventKey: receiptKey },
            })
          )
            return "duplicate" as const;
          const key = { shop: event.shop, productId: event.productId };
          const previous = await tx.productSync.findUnique({
            where: { shop_productId: key },
          });
          const lastProductUpdatedAt =
            previous?.lastProductUpdatedAt &&
            (!event.productUpdatedAt ||
              previous.lastProductUpdatedAt > event.productUpdatedAt)
              ? previous.lastProductUpdatedAt
              : event.productUpdatedAt;
          const newerReceipt = !previous || now >= previous.lastReceivedAt;
          const metadata = {
            lastReceivedAt: newerReceipt ? now : previous.lastReceivedAt,
            lastWebhookId: newerReceipt
              ? event.webhookId
              : previous.lastWebhookId,
            lastProductUpdatedAt,
          };
          await tx.webhookReceipt.create({
            data: { ...receiptKey, receivedAt: now },
          });
          await tx.productSync.upsert({
            where: { shop_productId: key },
            create: { ...key, ...metadata },
            update: metadata,
          });
          return "recorded" as const;
        },
        { maxWait: 1000, timeout: 2000 },
      );
    },
    async latest(shop: string): Promise<SyncActivity> {
      try {
        const latest = await db.productSync.findFirst({
          where: { shop },
          orderBy: { lastReceivedAt: "desc" },
          select: { lastReceivedAt: true },
        });
        return {
          available: true,
          lastReceivedAt: latest?.lastReceivedAt.toISOString() ?? null,
        };
      } catch {
        // Activity metadata failure must not prevent authoritative catalog analysis.
        return { available: false, lastReceivedAt: null };
      }
    },
    async removeShop(shop: string) {
      await db.$transaction(
        async (tx) => {
          await tx.webhookReceipt.deleteMany({ where: { shop } });
          await tx.productSync.deleteMany({ where: { shop } });
          await tx.session.deleteMany({ where: { shop } });
        },
        { maxWait: 1000, timeout: 2000 },
      );
    },
  };
}

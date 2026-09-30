CREATE TABLE "ProductSync" (
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lastReceivedAt" DATETIME NOT NULL,
    "lastProductUpdatedAt" DATETIME,
    "lastWebhookId" TEXT NOT NULL,
    PRIMARY KEY ("shop", "productId")
);
CREATE INDEX "ProductSync_shop_lastReceivedAt_idx" ON "ProductSync"("shop", "lastReceivedAt");
CREATE TABLE "WebhookReceipt" (
    "shop" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL,
    PRIMARY KEY ("shop", "eventKey")
);
CREATE INDEX "WebhookReceipt_shop_receivedAt_idx" ON "WebhookReceipt"("shop", "receivedAt");

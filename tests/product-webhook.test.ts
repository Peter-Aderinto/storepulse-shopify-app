import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import {
  parseProductUpdate,
  type WebhookContext,
} from "../app/domain/product-webhook.ts";
import {
  createProductSyncStore,
  RECEIPT_RETENTION_MS,
} from "../app/services/product-sync.server.ts";
import {
  handleProductUpdate,
  handleAppUninstalled,
} from "../app/services/product-webhook.server.ts";

// Every database test runs in an isolated /tmp SQLite database; no real session or API client.
const directory = mkdtempSync(join(tmpdir(), "storepulse-webhook-test-"));
const databasePath = join(directory, "test.sqlite");
const sql = new DatabaseSync(databasePath);
for (const dir of readdirSync("prisma/migrations")
  .filter((n) => /^\d/.test(n))
  .sort())
  sql.exec(readFileSync(`prisma/migrations/${dir}/migration.sql`, "utf8"));
sql.close();
const db = new PrismaClient({
  datasources: { db: { url: `file:${databasePath}` } },
});
const store = createProductSyncStore(db);
const shop = "demo-a.myshopify.com";
const other = "demo-b.myshopify.com";
const now = new Date("2026-09-30T10:00:00Z");
function context(patch: Partial<WebhookContext> = {}): WebhookContext {
  return {
    shop,
    topic: "PRODUCTS_UPDATE",
    webhookId: "delivery-1",
    eventId: "event-1",
    payload: {
      id: 123,
      admin_graphql_api_id: "gid://shopify/Product/123",
      updated_at: "2026-09-30T09:00:00Z",
    },
    ...patch,
  };
}
const event = (patch: Partial<WebhookContext> = {}) =>
  parseProductUpdate(context(patch))!;
const request = () =>
  new Request("https://example.test/webhooks/products/update", {
    method: "POST",
    body: "{}",
  });
async function installed(domain = shop) {
  await db.session.create({
    data: {
      id: `offline_${domain}`,
      shop: domain,
      state: "",
      accessToken: "",
      isOnline: false,
    },
  });
}
before(async () => {
  await db.$connect();
});
beforeEach(async () => {
  await db.webhookReceipt.deleteMany();
  await db.productSync.deleteMany();
  await db.session.deleteMany();
});
after(async () => {
  await db.$disconnect();
  rmSync(directory, { recursive: true, force: true });
});

test("valid update normalizes only metadata and prefers event ID", () => {
  const parsed = event();
  assert.equal(parsed.productId, "gid://shopify/Product/123");
  assert.equal(parsed.eventKey, "event:event-1");
  assert.equal(
    parsed.productUpdatedAt?.toISOString(),
    "2026-09-30T09:00:00.000Z",
  );
  assert.deepEqual(Object.keys(parsed).sort(), [
    "eventKey",
    "productId",
    "productUpdatedAt",
    "shop",
    "webhookId",
  ]);
});
test("webhook ID provides a delivery deduplication fallback", () =>
  assert.equal(event({ eventId: undefined }).eventKey, "delivery:delivery-1"));
test("GID preserves identifiers above JavaScript safe integer range", () => {
  const parsed = event({
    payload: {
      id: 9007199254740992,
      admin_graphql_api_id: "gid://shopify/Product/9007199254740993",
    },
  });
  assert.equal(parsed.productId, "gid://shopify/Product/9007199254740993");
});
test("safe numeric and string IDs work when a GID is absent", () => {
  for (const id of [123, "123"])
    assert.equal(
      event({ payload: { id } }).productId,
      "gid://shopify/Product/123",
    );
});
test("missing optional product timestamp is retained as unknown", () =>
  assert.equal(event({ payload: { id: 123 } }).productUpdatedAt, null));
for (const [name, payload] of [
  ["missing payload", null],
  ["array payload", []],
  ["missing ID", {}],
  ["wrong GID type", { admin_graphql_api_id: "gid://shopify/Order/123" }],
  ["zero ID", { id: 0 }],
  ["unsafe number without GID", { id: 9007199254740992 }],
  [
    "mismatched IDs",
    { id: 124, admin_graphql_api_id: "gid://shopify/Product/123" },
  ],
  ["oversized ID", { id: "18446744073709551616" }],
  ["invalid timestamp", { id: 123, updated_at: "yesterday" }],
  ["impossible calendar date", { id: 123, updated_at: "2026-02-30T00:00:00Z" }],
] as const)
  test(`rejects ${name}`, () =>
    assert.equal(parseProductUpdate(context({ payload })), null));
test("rejects wrong topic, invalid shop and invalid event identifiers", () => {
  for (const patch of [
    { topic: "ORDERS_CREATE" },
    { shop: "evil.example" },
    { shop: "demo.myshopify.com/other" },
    { webhookId: "" },
    { eventId: "x".repeat(129) },
  ])
    assert.equal(parseProductUpdate(context(patch)), null);
});
test("authenticated handler records a valid event and acknowledges it", async () => {
  await installed();
  let authenticated = false;
  const result = await handleProductUpdate(
    request(),
    async () => {
      authenticated = true;
      return context();
    },
    async (e) => {
      assert.equal(authenticated, true);
      return store.record(e, now);
    },
  );
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("Cache-Control"), "no-store");
  const row = await db.productSync.findUniqueOrThrow({
    where: { shop_productId: { shop, productId: event().productId } },
  });
  assert.equal(row.lastReceivedAt.toISOString(), now.toISOString());
  assert.equal(
    row.lastProductUpdatedAt?.toISOString(),
    event().productUpdatedAt?.toISOString(),
  );
  assert.equal(await db.webhookReceipt.count(), 1);
});
test("invalid authentication response prevents all persistence", async () => {
  const rejected = new Response(null, { status: 401 });
  let calls = 0;
  await assert.rejects(
    handleProductUpdate(
      request(),
      async () => {
        throw rejected;
      },
      async () => {
        calls++;
      },
    ),
    (e) => e === rejected,
  );
  assert.equal(calls, 0);
  assert.equal(await db.productSync.count(), 0);
});
test("malformed authenticated payload returns 400 without persistence", async () => {
  let calls = 0;
  assert.equal(
    (
      await handleProductUpdate(
        request(),
        async () => context({ payload: {} }),
        async () => {
          calls++;
        },
      )
    ).status,
    400,
  );
  assert.equal(calls, 0);
});
test("handler rejects non-POST after authentication", async () => {
  assert.equal(
    (
      await handleProductUpdate(
        new Request("https://example.test"),
        async () => context(),
        async () => assert.fail("must not write"),
      )
    ).status,
    405,
  );
});
test("database failure returns retryable 503 without leaking details", async () => {
  const result = await handleProductUpdate(
    request(),
    async () => context(),
    async () => {
      throw new Error("private connection detail");
    },
  );
  assert.equal(result.status, 503);
  assert.equal(await result.text(), "");
});
test("duplicate event including a different delivery ID does not change state", async () => {
  await installed();
  assert.equal(await store.record(event(), now), "recorded");
  assert.equal(
    await store.record(
      event({ webhookId: "retry-2" }),
      new Date(now.getTime() + 1000),
    ),
    "duplicate",
  );
  assert.equal(await db.webhookReceipt.count(), 1);
  assert.equal(await db.productSync.count(), 1);
  assert.equal((await store.latest(shop)).lastReceivedAt, now.toISOString());
});
test("out-of-order updates cannot regress product update time", async () => {
  await installed();
  await store.record(event(), now);
  await store.record(
    event({
      eventId: "older-event",
      webhookId: "older-delivery",
      payload: { id: 123, updated_at: "2026-09-29T09:00:00Z" },
    }),
    new Date(now.getTime() + 2000),
  );
  const row = await db.productSync.findFirstOrThrow();
  assert.equal(
    row.lastProductUpdatedAt?.toISOString(),
    "2026-09-30T09:00:00.000Z",
  );
  assert.equal(row.lastReceivedAt.toISOString(), "2026-09-30T10:00:02.000Z");
});
test("timestamp-less event does not erase known product update time", async () => {
  await installed();
  await store.record(event(), now);
  await store.record(event({ eventId: "no-time", payload: { id: 123 } }), now);
  assert.equal(
    (
      await db.productSync.findFirstOrThrow()
    ).lastProductUpdatedAt?.toISOString(),
    "2026-09-30T09:00:00.000Z",
  );
});
test("shop isolation applies to product state, receipt keys and dashboard reads", async () => {
  await installed();
  await installed(other);
  await store.record(event(), now);
  await store.record(event({ shop: other }), new Date(now.getTime() + 1000));
  assert.equal(await db.productSync.count(), 2);
  assert.equal(await db.webhookReceipt.count(), 2);
  assert.equal((await store.latest(shop)).lastReceivedAt, now.toISOString());
  assert.equal(
    (await store.latest(other)).lastReceivedAt,
    "2026-09-30T10:00:01.000Z",
  );
});
test("unknown or uninstalled shops are acknowledged without creating records", async () => {
  assert.equal(await store.record(event(), now), "ignored");
  assert.equal(await db.productSync.count(), 0);
  assert.equal(await db.webhookReceipt.count(), 0);
});
test("expired receipt keys are pruned only for the current shop", async () => {
  await installed();
  await installed(other);
  const old = new Date(now.getTime() - RECEIPT_RETENTION_MS - 1);
  await store.record(event(), old);
  await store.record(event({ shop: other }), old);
  await store.record(event({ eventId: "new-event" }), now);
  assert.equal(await db.webhookReceipt.count({ where: { shop } }), 1);
  assert.equal(await db.webhookReceipt.count({ where: { shop: other } }), 1);
});
test("uninstall atomically removes this shop's metadata and sessions, even on retries", async () => {
  await installed();
  await installed(other);
  await store.record(event(), now);
  await store.record(event({ shop: other }), now);
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await handleAppUninstalled(
          request(),
          async () => context({ topic: "APP_UNINSTALLED" }),
          store.removeShop,
        )
      ).status,
      200,
    );
  assert.equal(await db.session.count({ where: { shop } }), 0);
  assert.equal(await db.productSync.count({ where: { shop } }), 0);
  assert.equal(await db.webhookReceipt.count({ where: { shop } }), 0);
  assert.equal(await db.productSync.count({ where: { shop: other } }), 1);
  assert.equal(await store.record(event(), now), "ignored");
});
test("uninstall authentication and persistence failures are handled safely", async () => {
  const rejected = new Response(null, { status: 401 });
  await assert.rejects(
    handleAppUninstalled(
      request(),
      async () => {
        throw rejected;
      },
      async () => assert.fail("must not clean up"),
    ),
    (e) => e === rejected,
  );
  assert.equal(
    (
      await handleAppUninstalled(
        request(),
        async () => context({ topic: "APP_UNINSTALLED" }),
        async () => {
          throw new Error("private");
        },
      )
    ).status,
    503,
  );
});
test("activity failure degrades independently of catalog retrieval", async () => {
  const unavailable = createProductSyncStore({
    productSync: {
      findFirst: async () => {
        throw new Error("private");
      },
    },
  } as unknown as PrismaClient);
  assert.deepEqual(await unavailable.latest(shop), {
    available: false,
    lastReceivedAt: null,
  });
});
test("remediation-origin update is metadata-only and cannot initiate a Shopify write loop", async () => {
  await installed();
  // No GraphQL/admin/mutation dependency exists at the handler or persistence boundary.
  const payload = {
    id: 123,
    updated_at: "2026-09-30T09:00:00Z",
    images: [{ alt: "Merchant saved description" }],
  };
  assert.equal(
    (
      await handleProductUpdate(
        request(),
        async () => context({ payload }),
        store.record,
      )
    ).status,
    200,
  );
  assert.equal(await db.productSync.count(), 1);
  assert.ok(
    !JSON.stringify(await db.productSync.findMany()).includes(
      "Merchant saved description",
    ),
  );
});

test("concurrent duplicate deliveries leave one receipt and one product row", async () => {
  await installed();
  const results = await Promise.allSettled([
    store.record(event(), now),
    store.record(event(), now),
  ]);
  assert.ok(
    results.some(
      (result) => result.status === "fulfilled" && result.value === "recorded",
    ),
  );
  // SQLite contention may return a retryable error; the retried event must be a no-op.
  assert.equal(await store.record(event(), now), "duplicate");
  assert.equal(await db.webhookReceipt.count(), 1);
  assert.equal(await db.productSync.count(), 1);
});
test("a failed metadata write rolls back the receipt so a retry can succeed", async () => {
  await installed();
  await db.$executeRawUnsafe(
    `CREATE TRIGGER fail_product_sync BEFORE INSERT ON ProductSync BEGIN SELECT RAISE(ABORT, 'test failure'); END`,
  );
  try {
    await assert.rejects(store.record(event(), now));
    assert.equal(await db.webhookReceipt.count(), 0);
    assert.equal(await db.productSync.count(), 0);
  } finally {
    await db.$executeRawUnsafe("DROP TRIGGER fail_product_sync");
  }
  assert.equal(await store.record(event(), now), "recorded");
});
test("distinct products retain separate metadata and the dashboard uses latest receipt", async () => {
  await installed();
  await store.record(event(), now);
  await store.record(
    event({ eventId: "second-product", payload: { id: 456 } }),
    new Date(now.getTime() + 1000),
  );
  assert.equal(await db.productSync.count(), 2);
  assert.equal(
    (await store.latest(shop)).lastReceivedAt,
    "2026-09-30T10:00:01.000Z",
  );
});

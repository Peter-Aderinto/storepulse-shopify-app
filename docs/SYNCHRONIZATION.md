# Product-update synchronization (Phase 4)

## Subscription and authentication

`shopify.app.toml` declares the app-specific `products/update` subscription at `/webhooks/products/update`, using API version `2026-07`. Shopify CLI applies this to the development preview; normal app configuration deployment applies it for production. No per-shop GraphQL registration, additional scope, or deployment is introduced. Existing `write_products` includes the required product read access.

`include_fields` limits the payload to `id`, `admin_graphql_api_id`, and `updated_at`. Including `updated_at` reduces accidental debouncing of identical narrowed payloads. See [delivery structure](https://shopify.dev/docs/apps/build/webhooks/delivery-structure) and [webhook ordering guidance](https://shopify.dev/docs/apps/build/webhooks).

The endpoint uses the scaffold's `authenticate.webhook(request)` before parsing or persisting metadata. Shopify's SDK validates the HMAC and provides the authenticated shop, topic, webhook ID, event ID, and parsed payload. StorePulse does not implement custom signature verification. Invalid authentication responses are preserved. Payloads, tokens, and upstream exceptions are not logged or returned.

## What is stored

The additive migration preserves the existing Session model and adds:

- `ProductSync`: one row per `(shop, productId)`, with latest unique receipt time, greatest known Shopify product `updated_at`, and latest receipt's webhook ID.
- `WebhookReceipt`: unique `(shop, eventKey)` plus receipt time. The event key uses the SDK's `eventId`, falling back to `webhookId`, with separate prefixes.

No product title, image data, price, inventory, webhook payload, access token, or score is copied into these tables. Database contents remain Git-ignored. Shopify remains the source of truth for all catalog data and analysis.

## Processing and idempotency

Validate topic, canonical shop domain, identifiers, and optional ISO timestamp. Prefer the product GID to avoid precision loss from large JSON numeric IDs. When only a numeric ID is supplied, accept it only if it is a safe integer or canonical UInt64 string. Reject conflicting IDs and malformed required metadata with HTTP 400. Missing/null `updated_at` is accepted as unknown; malformed supplied dates are rejected.

In one short database transaction:

1. Require an existing offline session for this shop. Unknown/uninstalled shops are acknowledged without writing metadata.
2. Prune this shop's receipt keys older than seven days and check the deduplication key.
3. Ignore duplicates without advancing receipt time.
4. Insert the receipt and upsert the product metadata atomically. A failed upsert rolls back the receipt so Shopify can retry.
5. Keep the maximum product update timestamp; an older delivery cannot overwrite newer product state. Latest receipt time is distinct from product update time.

Successful, duplicate, and ignored deliveries receive HTTP 200. Database/transient failures receive a safe HTTP 503, allowing Shopify retries. A concurrent SQLite writer can also receive 503; retrying is safe. No queue is needed because processing makes no Admin API calls and stores only a few metadata fields.

Deduplication is bounded to seven days, not permanent. Pruning occurs on subsequent events for the same shop; dormant receipt keys remain until another event or uninstall. Older replayed events can advance the true receipt timestamp after expiry but cannot regress the product update timestamp. There is no event counter that repeated deliveries could inflate.

## Uninstall and shop isolation

Uninstall uses the same verified Shopify webhook boundary. It atomically deletes that shop's receipts, product metadata, and sessions, even if the SDK no longer returns a session. Repeated uninstall delivery is safe; other shops are unaffected. Late product events cannot recreate metadata once the offline session is removed. Shopify delivery ordering across uninstall/reinstall cycles is not fully resolvable without installation-generation state; this remains a documented limitation.

## Dashboard and remediation interaction

The dashboard reads the authenticated shop's latest receipt time and shows a small status line. It explicitly distinguishes event receipt from catalog analysis. The timestamp updates when the dashboard loader runs; there is no browser push, polling timer, or WebSocket. If metadata retrieval fails, catalog analysis still works and the status is labelled unavailable.

Product Analysis continues to fetch current Shopify data directly. This phase intentionally keeps synchronization UI at dashboard level. A webhook does not rescan products, compute scores, refresh an open browser, or promise complete catalog synchronization. Manual Refresh analysis remains available, and normal navigation also reloads authoritative data.

A merchant's explicit Phase 3 alt-text save may produce a product-update event. The webhook has no mutation client and never calls remediation, so it cannot create an internal mutation loop. Exact Shopify event emission depends on the operation; a receipt is evidence only of the event actually delivered.

## Limitations and verification

Only product updates are subscribed in this phase. Product create/delete, inventory-specific events, backfills, reconciliation jobs, persistent catalog caching, and production observability are future work. Product metadata remains until uninstall; it is not a catalog membership list. Delivery can be delayed, missing, duplicated, or out of order. Fresh Shopify reads remain necessary.

Automated tests use mocked authentication and a temporary SQLite database built from the real migrations. They cover valid/invalid payloads, large IDs, authentication rejection, duplicate and concurrent delivery, atomic rollback, out-of-order timestamps, shop isolation, unknown shops, retention, uninstall cleanup, safe database failures, dashboard metadata failure, and metadata-only remediation-origin events. They never change live Shopify products.

Manual review: open Store health and locate the product-update receipt line, refresh analysis, and confirm its receipt time remains distinct from the snapshot time. Open the selected demo product's analysis and confirm normal scores, evidence, and navigation. A live test should make only one harmless change, verify a real signed delivery and persisted metadata, and reread Shopify afterward. Do not repeatedly mutate products to manufacture webhook evidence.

## Development verification result

All 135 tests, typecheck, lint, build, Prisma validation/migration, Shopify app configuration validation, and Polaris dashboard validation pass. A real signed `products/update` delivery after one controlled fictional-product alt-text edit created one receipt and one product metadata row. Subsequent reads confirmed the updated Shopify value and unchanged 60/100 Product Health score (the image already had non-empty alt text). No additional product writes were made to generate events. Unsigned and invalid-HMAC requests were rejected without metadata writes.

A read-only isolated browser preview of the actual components with freshly retrieved Shopify data passed activity messaging, refresh/navigation, detail evidence, and responsive checks. Peter should still refresh StorePulse in Shopify Admin for embedded visual review.

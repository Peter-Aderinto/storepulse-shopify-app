# StorePulse remediation

StorePulse supports explicit merchant saves for image accessibility (alt text) and custom SEO (title and description). It does not automatically optimize products or generate content. Product descriptions, inventory, prices, handles, and image sources are not editable through these workflows. The following image workflow was introduced in Phase 3; SEO is detailed below.

## Read and write boundaries

**Reads:** existing catalog and product queries; `StorePulseImageFile` reads `MediaImage.id`, `alt`, and `fileStatus` before saving. Product/media/variant pagination remains unchanged.

**Write:** `StorePulseUpdateImageAlt` calls `fileUpdate(files: [{ id, alt }])` against Admin API `2026-07`. It requests only returned file identity/alt and user-error codes/fields. It does not use deprecated `productUpdateMedia`.

References: [fileUpdate](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/fileUpdate), [FileUpdateInput](https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/FileUpdateInput), [Shopify's 512-character alt-text limit](https://help.shopify.com/en/manual/products/product-media/add-alt-text).

The additional required app scope is `write_files`; the merchant must also have permission to edit files. Existing scaffold scopes remain for now; a broader scope cleanup is outside this phase. Approve any Shopify installation/permission update through Shopify Admin. A file must be `READY`. A reused Shopify file changes wherever that file is referenced; the editor discloses this before Save.

## Request path and protections

1. The image editor opens with the current alt text and retains that initial value for conflict detection. Only Save submits a write. Cancel does not write.
2. The existing `authenticate.admin(request)` boundary runs before parsing a POST action. Product identity comes from the route; shop/client come from the authenticated session. Posted shop/product authority is ignored. Shopify SDK tokens stay server-side.
3. Shared validation trims surrounding whitespace, rejects blank/invisible-only input, and rejects more than 512 Unicode characters without truncation. Product and MediaImage IDs must be canonical positive UInt64 Shopify identifiers.
4. The server fetches the product through that shop's authenticated client and requires the selected image in its fully paginated image collection. A file-state query confirms identity/readiness and checks that alt text still matches the editor's original value.
5. Save changes only `alt`. A matching already-saved value is a verified no-op. In-flight duplicate saves are blocked per shop/file in this server process. SDK `tries: 1` means one attempt, with no automatic write retries.
6. Safe authored messages handle GraphQL top-level errors, HTTP/SDK failures, and mutation `userErrors`; private upstream messages are not returned. Framework authentication responses propagate unchanged. Action and loader data are private/no-store.
7. An acknowledged mutation is followed by a fresh product query. Only that read confirms the image value. React Router then revalidates the detail loader, which runs the unchanged shared analysis engine. Returning to Store health or refreshing it reloads catalog data. No client-side score patch is used.

## Feedback and limitations

Save disables repeated submission and shows progress through revalidation. Validation/API failure retains typed input where the page remains available. A successful mutation with failed or stale reread is explicitly labelled unverified; refresh analysis before attempting another write. Network timeouts may occur after Shopify applied a change, so failure messages do not assert that nothing changed.

Conflict detection is a preflight check, not an atomic compare-and-swap: an external edit between read and write can still race. The in-memory lock is not a distributed lock. No persistent audit trail, global catalog cache, background queue, bulk operation, or automatic retry is added. The file's shared-reference effects follow Shopify's file model. Missing-alt detection checks presence, not descriptive quality; decorative images may legitimately have no alt text. Large product evidence requires the existing fully paginated reads.

## Manual acceptance in a development store

1. Reopen StorePulse in Shopify Admin and approve the added file permission if Shopify requests it.
2. Open one deliberately fictional/demo product with a missing-alt image. Record the Product Health score, Accessibility points, and missing-alt count. Check that the selected image is safe to change, including any shared uses.
3. Choose Add alt text, enter a harmless accurate image description, and click Save once. Confirm disabled/loading feedback. Do not repeatedly mutate store data for testing.
4. Confirm the saved value in Shopify Admin's product media editor. In StorePulse, confirm refreshed image evidence, missing-alt count, recommendations, Accessibility points, and Product Health score. Values depend on the existing weights and number of images.
5. Return to Store health and refresh. Check the same product's latest score and summary. Reopen analysis to verify persistence.
6. Without submitting another real write, inspect an existing-alt editor and cancel; inspect the empty-input validation. Failure/permission/throttle/duplicate scenarios are covered by mocks, not repeated live mutations.

## Automated verification

`npm test` retains the original 69 tests and adds 32 remediation tests. Coverage includes trimming/limits, malformed IDs, missing product/file, cross-product image rejection, readiness, stale edits, successful single-field writes, idempotent no-ops, concurrent saves, safe user/GraphQL/HTTP/network errors, authentication rejection/redirects, unverified rereads, route/session authority, and score/recommendation reanalysis. No test uses real store credentials or writes merchant data.

Also run `npm run typecheck`, `npm run lint`, `npm run build`, July 2026 GraphQL schema validation for both new operations, and Polaris component validation. Browser and live-store acceptance results must be reported separately from these checks.

## Custom SEO remediation (Phase 5)

### API and scope

The supported July 2026 operation is [`productUpdate`](https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/productUpdate) with [`ProductUpdateInput.seo`](https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/ProductUpdateInput). [`SEOInput`](https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/SEOInput) contains title and description strings. The existing `write_products` scope is sufficient; no permission/configuration change is added.

The mutation sends only the product ID and both custom SEO values. When editing one field, the current unchanged sibling is explicitly preserved rather than relying on nested-field omission semantics. The server verifies both existing values before writing, checks returned identity/values and `userErrors`, then rereads the product. No product title, description body, inventory, price, tag, handle, or status input is sent.

### Editing and deliberate clearing

The evidence section shows actual Shopify custom values, including Not set states, and the editor initializes from the latest loaded values. Save is explicit; Cancel does not write. Edited values are trimmed, validated and never truncated. StorePulse uses 70/320-character editor limits based on [Shopify's product SEO field documentation](https://help.shopify.com/en/manual/products/import-export/using-csv). The GraphQL SEOInput reference itself declares strings without documenting a universal numeric API cap; these limits are identified as editor limits. Unchanged legacy values, including longer ones, are preserved exactly when editing the sibling. Shopify can still return a validation error.

Removing an existing value with an ordinary blank/whitespace submission is rejected. The merchant must select the corresponding Clear checkbox, then Save SEO. Clearing submits an explicit empty string; the other field is preserved. Both may be cleared deliberately. A field that was already unset may remain unset when saving the other field. A no-change request is a read-verified no-op. Invisible-only new values are rejected.

[Shopify's product clearing guidance](https://community.shopify.dev/t/page-article-blog-s-seo-data-cannot-be-set-to-empty-or-null/19540/2) supports empty-string SEO values for products. Blank/null results are normalized as unset when verifying a clear. Storefront metadata can fall back to product/theme defaults; clearing custom SEO does not mean the page necessarily has no search metadata. StorePulse's existing completeness check still marks the custom field missing. Search rankings and search-engine display text are not guaranteed.

### Shared security and refresh flow

Both alt-text and SEO forms use the same authenticated POST dispatcher. Authentication runs before form parsing or intent selection; only explicit supported intents are dispatched. Product identity comes from the route and the GraphQL client/shop from the existing Shopify session. Unexpected posted shop/product authority is ignored, and a fresh same-shop product read must succeed before a write. Access tokens, persistence and GraphQL mutation code stay server-side.

The SEO service reuses the existing GraphQL transport, error normalization, fully paginated product reads, and analysis engine. Duplicate browser submits are blocked; a shop/product process-local lock prevents simultaneous SEO saves. Stale SEO values cause a conflict rather than overwriting another edit. SDK `tries: 1` prevents automatic mutation retries. This is not a distributed lock or atomic compare-and-swap; external edits between the preflight and mutation remain a race limitation.

Success reads Shopify again, then React Router revalidates the existing loader. No score is edited client-side. If Shopify acknowledged the mutation but a reread fails or disagrees, feedback explicitly says the result is not yet verified. Failures retain input where the page remains available, propagate authentication responses, and show safe authored messages without exposing upstream details. After uncertain network outcomes, refresh before retrying.

Webhook handlers remain metadata-only. An SEO save may cause a normal `products/update` event, but receipt processing has no mutation client and never invokes remediation. Returning to Store health or refreshing it retrieves current catalog data.

### Verification and merchant review

All 135 prior tests are retained; 37 new mocked tests cover individual/both field updates, current evidence values, trimming/limits, deliberate clearing, sibling preservation, legacy values, IDs/shop authority, no-op/stale/duplicate behavior, permissions, user/GraphQL/network errors, authentication redirects, uncertain rereads, reanalysis and webhook compatibility. No automated test writes real Shopify data.

The isolated browser harness exercises the actual dispatcher and services with mocked APIs: loaded values, blank/over-limit rejection, retained failure input, one save on double click, clearing, cancellation, alt-text regression, score refresh, and responsive layouts. Live verification is a separate single authorized fictional-product save; it does not test clearing by repeatedly changing the store.

For manual acceptance, refresh StorePulse in Shopify Admin, open the demo product, inspect Content & custom SEO evidence, and choose Edit SEO. Confirm its current values load, inspect character counts and the explicit Clear controls, then Cancel without an extra test write. If you deliberately make a further edit, click Save SEO once and verify fresh evidence, recommendations, category/overall scores and normal webhook receipt. Phase 5 remains uncommitted until Peter approves it.

### Controlled live verification — 2026-09-30

One authorized save used the actual SEO remediation service for the approved fictional VelvetBloom Rose Facial Oil product. Both custom SEO fields were previously unset. The saved title was “VelvetBloom Rose Facial Oil | Demo Skincare”; the saved description was “Explore VelvetBloom Rose Facial Oil, a fictional skincare product created for the StorePulse development demo.”

Independent Shopify detail and catalog reads confirmed these exact values: SEO points 0/20 → 20/20, Product Health 60/100 → 80/100, issue types 3 → 1, and SEO recommendations 2 → 0. Dashboard analysis also returned 80. Comparisons confirmed unchanged non-SEO fields and other products in the catalog snapshot. Exactly one mutation was attempted; clearing and other failure paths were tested with mocks, not extra live writes.

A new live webhook receipt was not observed during the verification window. The existing development tunnel hostname failed DNS resolution while the local server remained running. Live receipt handling for this particular SEO save therefore remains unverified; Phase 4's earlier live verification and Phase 5's mocked compatibility checks are separate evidence. The unchanged webhook handler only authenticates and records synchronization metadata, has no remediation call, and cannot initiate a mutation loop. No additional product mutation was made to force another event.

The development connection was restarted safely afterward. The new public tunnel serves the app (HTTP 200) and rejects an unauthenticated webhook request (HTTP 400); the Shopify CLI reports Ready for Mastersales / pressycosmetics. This connectivity check is not a signed Shopify delivery test. The server remains running for merchant review.

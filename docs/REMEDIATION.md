# Image alt-text remediation

StorePulse's first write operation is a merchant-confirmed image alt-text update. It does not automatically fix products, generate content, or modify inventory, descriptions, SEO, or image sources.

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

# StorePulse catalog health — methodology v1

These are StorePulse heuristics, not official Shopify scores, SEO rankings, accessibility certifications, or growth predictions. The dashboard distinguishes source data from calculated metrics.

## Data and retrieval

The authenticated route uses `authenticate.admin(request)` and its server-side GraphQL client. Tokens never enter loader data. Admin API version remains **2026-07**.

`StorePulseCatalog` retrieves the product count with count precision and pages products in ascending Shopify ID order. For each product it reads ID, title, handle, status, plain-text description, custom SEO title/description, media, and variants. Media selects image IDs, alt text, and image URLs using a `MediaImage` fragment; videos and other media do not satisfy the product-image check. `StorePulseMedia` and `StorePulseVariants` exhaust nested pagination independently. Variant fields are ID, title, aggregate inventory quantity, inventory policy, and the inventory item's tracked flag. No pricing, customer data, orders, or cost data is requested.

Existing scaffold scopes are retained; no additional scopes or permissions are introduced by Phase 1. The application only performs catalog queries. The previous demo mutation action has been removed. Existing authentication lifecycle webhook handlers remain unchanged; product-update synchronization is not implemented.

Source references: [Product](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/Product), [ProductVariant](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/ProductVariant), [InventoryItem](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/InventoryItem), and [Polaris App Home](https://shopify.dev/docs/api/app-home/using-polaris-components).

## Product Health Score

| Check | Weight | Credit |
| --- | ---: | --- |
| Description | 20 | 1 for non-empty plain text; otherwise 0 |
| Imagery | 20 | 1 for at least one image media record; otherwise 0 |
| Image alt text | 20 | Fraction of image media records with non-empty alt text |
| Inventory readiness | 20 | Mean variant credit over eligible variants |
| Custom SEO title | 10 | 1 for non-empty custom title; otherwise 0 |
| Custom SEO description | 10 | 1 for non-empty custom description; otherwise 0 |

Whitespace-only and zero-width-only text is treated as empty. No text-quality or length judgments are made. Image processing can temporarily make a URL unavailable; the image record still counts as present, but no broken thumbnail is rendered.

A variant is eligible for inventory scoring only when inventory is tracked, quantity is a finite number, and the selling policy is known (`DENY` or `CONTINUE`). Eligible variants receive:

- Quantity **greater than 5**: full credit (1).
- Quantity **1–5 inclusive**: half credit (0.5), labelled low stock.
- Quantity **0 or negative**, policy `DENY`: no credit (0), labelled out of stock.
- Quantity **0 or negative**, policy `CONTINUE`: half credit (0.5), labelled selling without stock, separately from out of stock. Continued selling may be intentional.

Untracked, unavailable, or unknown-policy variants are excluded from the inventory average. If no variants can be evaluated, inventory's weight is excluded. If the product has no images, the alt-text weight is excluded; only the imagery check penalizes missing images.

**Product score = round(100 × sum(weight × credit) ÷ sum(evaluated weights)).** Coverage is displayed as evaluated weight out of 100, alongside evaluated versus total variants. Scores with different coverage are not equally comprehensive.

Examples:

- Complete product with all checks passing: **100**.
- Complete product except for no description: **80**.
- Complete product with one tracked variant at 3 units: **90**.
- Complete product without images: **75** (60 points earned from 80 evaluated weight).
- Complete product with untracked inventory: **100**, with 80/100 weight evaluated, not an assertion that stock is healthy.

## Store Health Score and counts

The Store Health Score is the nearest-integer mean of the already rounded Product Health Scores, with equal weight per analyzed product. Active, draft, archived, and any other Shopify-returned statuses are included. An empty catalog displays no score, rather than 0 or 100.

A product issue count is the number of distinct failed check types (description, image, alt text, low stock, out of stock, selling without stock, custom SEO title, custom SEO description). A single type may affect multiple images or variants; that affected count appears in the issue label. Dashboard issue metrics count **products**, deduplicated within each metric. Categories can overlap and should not be summed as unique products.

- Low stock: products with at least one eligible variant at 1–5 units.
- Out of stock: products with at least one eligible variant at zero or fewer units and overselling off. This does not imply the entire product is unavailable. Only when every variant is evaluated and out of stock is the product labelled “All variants out of stock”.
- Content / SEO: products with any description, image, custom SEO title, or custom SEO description gap.
- Accessibility: products with at least one image missing alt text.
- Custom SEO: products with either custom SEO field blank. Shopify may supply fallback search metadata; StorePulse does not claim the rendered storefront metadata is missing.

Shopify supplies total product count and its precision, product fields, media, and inventory values. StorePulse derives scores, coverage, issue labels/counts, recommendations, sorting, and snapshot completion time.

## Scope and limitations

- Each synchronous refresh analyzes up to **250 products**, paging 10 at a time. Nested media and variants are fully paginated for each included product. Larger catalogs show a prominent partial-analysis banner and “Analyzed catalog health”; scores and issue counts do not describe unscanned products. Total products comes separately from Shopify; non-exact counts display a `+` suffix.
- A scan has a **45-second deadline**. HTTP, GraphQL, access, throttling, invalid-pagination, and timeout failures show safe error messages and no newly calculated results. Partial GraphQL responses are rejected. Refresh can retry; there is no background queue or persisted catalog cache yet.
- Shopify pagination is not a transactional snapshot. Concurrent catalog edits can change counts during a scan. Duplicate products, vanished products during nested pagination, or malformed cursors fail the scan rather than silently producing partial results.
- Quantity is Shopify's aggregate variant inventory across locations. It does not establish fulfillment-location availability, online-channel availability, demand, replenishment lead time, or safety-stock needs. The threshold of 5 is fixed for Phase 1.
- Image alt-text presence does not assess usefulness or a storefront's accessibility. Intentionally decorative images can have empty alt text and may warrant no action.
- Blank custom SEO fields can be deliberate. This score evaluates customization/completeness, not search performance or Shopify's effective fallback metadata.
- There are no catalog mutations, AI features, scan history, product-detail analysis pages, or product-update webhook synchronization. Product links open Shopify Admin; stable Shopify IDs provide the foundation for later StorePulse detail routes.

## Validation and manual checks

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. Tests use isolated synthetic fixtures and mocked transports only; production has no fixture fallback.

For an installed development app, run `npm run dev`, open the CLI preview link in Shopify Admin, and open Store health. Verify refresh feedback, product search, the issues-only filter, next/previous pages when applicable, product links, and narrow-screen layout. Compare a few issue labels with the real product records in Shopify Admin. Browser visual and keyboard checks complement automated domain, transport, schema, and build checks.

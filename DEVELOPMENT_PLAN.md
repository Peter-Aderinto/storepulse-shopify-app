# StorePulse Development Plan

## Scope and current baseline

StorePulse is a full-stack Shopify merchant app for understanding catalog and product health. Phases 1 and 2 implement an authenticated, read-only catalog health dashboard and individual product analysis on the official Shopify React Router TypeScript scaffold. Phase 3 implements merchant-controlled image alt-text remediation; Phases 4–8 remain planned. See [scoring methodology](docs/SCORING.md) for exact rules, data sources, scan limits, and validation.

- Development environment: WSL Ubuntu.
- Runtime: Node 24.15.0 and npm 11.12.1; no runtime upgrade required.
- Shopify CLI: 4.8.2, invoked through npx initially and installed locally by the scaffold. No root/global installation is required.
- Development preview, embedded Admin loading, and session persistence have been verified on a Shopify development store.
- Framework: React Router 7 with React, Vite, and strict TypeScript.
- Authentication: Shopify's React Router adapter, authenticated admin loaders/actions, auth routes, and App Bridge integration.
- Persistence: Prisma with SQLite for local development and the template's Session model, including token expiry/refresh fields. Local session databases and environment files must stay out of Git.
- Configuration: `shopify.app.toml` and `shopify.web.toml`. Keep actual secrets in environment variables supplied by the CLI or deployment platform.

## Intended architecture

Use React Router routes for merchant-facing pages and server loaders/actions. Authenticate every merchant request through Shopify before accessing catalog data. Keep Admin GraphQL requests, pagination, throttling/retry logic, and data normalization in server-only services. Never expose Admin access tokens to the browser.

Introduce a pure, versioned analysis layer for product and variant checks: inventory availability, SEO/content completeness, and catalog-level accessibility signals such as image alternative text. These signals are not a full storefront accessibility audit. Return explainable findings and scores, including missing or unavailable data, rather than treating unknown data as failures.

Keep shop-scoped product snapshots, findings, scan metadata, and remediation audit records in Prisma when those phases need persistence. Separate these domain models from Shopify sessions and isolate all records by shop. Use UTC timestamps and migrations for schema changes. Choose durable production storage during deployment planning; the local SQLite file is not a production persistence strategy.

Route future product webhooks through authenticated handlers with deduplication, retry-safe processing, and reconciliation. Add a background queue only when scan size or webhook processing requires it. Retain the template's uninstall and scope-update handling and plan data cleanup and compliance before public distribution.

Use Shopify's merchant UI components and App Bridge for an embedded experience. Provide keyboard access, clear score explanations, and accessible feedback. Review the template's demo scopes and resources before real merchant use; request only the scopes needed by each implemented phase.

## Development phases

### Phase 1: GraphQL product retrieval + Store Health dashboard — implemented

Implemented server-side product/media/variant pagination, normalization, issue detection, deterministic scoring, aggregation, and a Polaris dashboard. The dashboard includes coverage disclosure, partial-catalog limits, safe errors, empty states, refresh feedback, search, filters, and a sorted product-health list. Focused Node-native tests cover scoring and API transport behavior. Authentication and Prisma session storage are preserved; the template mutation demo is removed.

### Phase 2: Product Health scoring and product analysis pages — implemented

Product titles now open `/app/products/:productId`. An authenticated, variable-bound single-product query retrieves fresh data and exhausts media and variant pagination. The page explains five scoring categories using the unchanged Phase 1 engine, shows image/variant/completeness evidence, and provides deterministic prioritized recommendations. Excluded categories display “Not evaluated”. Invalid links, missing products, and API errors have safe states. Shopify Admin links remain available; Phase 2 itself introduced no write operations.

### Phase 2.5: UI/UX polish — implemented

Refined the existing Polaris experience with restrained typography, consistent spacing, neutral borders, and compact status presentation. The dashboard groups score and metrics into one overview, prioritizes attention rows, and separates StorePulse analysis links from Shopify Admin actions. The product list retains search/filter/pagination and reveals detailed findings on demand.

Product Analysis now leads with product identity, uses compact category rows with explicit status, consistent image previews, and recommendations explaining the issue, relevance, and next step. Scoring methodology and scan coverage remain available in keyboard-accessible disclosures. Responsive layouts cover wide, laptop, tablet, and mobile widths; native Polaris tables switch to lists at narrow widths. No scoring, query, authentication, persistence, recommendation rules, dependencies, or scopes were changed.

### Phase 3: Admin API mutations/remediation actions — implemented, pending merchant UI acceptance

The first write is a single image alt-text update, explicitly submitted by a merchant from Product Analysis. An authenticated server action validates product/media IDs, trims and validates up to 512 characters, verifies product-image membership and file readiness, and rejects stale edits. Shopify's supported July 2026 `fileUpdate` mutation requires `write_files`; existing scopes are retained. No AI, bulk writes, SEO edits, inventory edits, or background changes are included.

Structured feedback handles Shopify user errors, permissions, throttling, network failures, and incomplete responses. Authentication redirects are preserved. No automatic mutation retry is performed. After a save, authoritative product retrieval and loader revalidation reuse the unchanged scoring engine. Dashboard navigation/refresh retrieves fresh catalog data. Duplicate submission is guarded in the UI and by a process-local shop/file lock. Outcomes are returned to the merchant; persistent remediation history and distributed locking remain future work.

See [remediation documentation](docs/REMEDIATION.md) for reads versus writes, shared-file effects, security, limitations, and acceptance steps.

### Phase 4: Product-update webhook synchronization

Subscribe to product updates, verify webhook authenticity, and synchronize only the affected shop/product. Make processing idempotent and resilient to duplicates, delays, and out-of-order delivery. Add reconciliation for missed updates and preserve uninstall cleanup.

### Phase 5: UI/UX polish, loading, error and empty states

Refine navigation, responsive layouts, scan progress, loading feedback, recoverable errors, empty catalogs, and partial-data states. Check keyboard navigation, labels, focus management, contrast, and clear merchant-facing language.

### Phase 6: Testing and QA

Add unit tests for analysis rules, integration coverage for authenticated GraphQL and persistence, webhook validation/idempotency tests, and end-to-end merchant flows on a development store. Cover tenant isolation, session expiry, rate limits, mutation failures, and accessibility. Establish CI only when GitHub work is authorized.

### Phase 7: GitHub documentation and portfolio presentation

Prepare architecture documentation, setup instructions, screenshots from permitted development data, testing notes, and a concise case study. Scan for secrets and private merchant data before publishing. Maintain a clear commit history as each phase is implemented.

### Phase 8: Production deployment

Select hosting and durable database storage; configure secrets, HTTPS URLs, migrations, session persistence, logging, monitoring, backups, and recovery. Validate webhook delivery and required privacy/compliance behavior. Complete Shopify distribution and installation requirements before release. Deploy only with explicit authorization.

## Local workflow

From the project directory:

- `npm ci`: reinstall dependencies from the lockfile.
- `npm run setup`: generate Prisma Client and apply local database migrations.
- `npm test`: run focused analysis and catalog retrieval tests.
- `npm run typecheck`: generate React Router types and run TypeScript checks.
- `npm run lint`: run the template ESLint checks.
- `npm run build`: create the production build.
- `npm run shopify -- version`: verify the project-local Shopify CLI.
- `npm run dev`: start Shopify development using an authorized development store. Complete browser authentication and installation when prompted.

Do not commit `.env` files, access tokens, session databases, or generated build artifacts. Production deployment, mutation/remediation actions, and product-update synchronization remain outside Phases 1 and 2.

## Setup verification

The baseline uses Shopify/shopify-app-template-react-router (`main-cli`). Dependencies, Prisma generation and migration, TypeScript checks, lint, and production build passed. The embedded template loaded inside Shopify Admin and an authenticated session was persisted locally. Phase 1 now adds the StorePulse catalog health dashboard.

The SQLite setup initially required creating an empty local database file before applying the template migration. Local database contents and authentication sessions are excluded from Git.

The committed Shopify configuration contains a public app client ID, not an authentication secret. Credentials are supplied at runtime; the July 2026 API configuration is retained. Phase 3 adds only `write_files` to the existing scopes. Developers using their own app should run `npm run config:link` before starting development.

The dependency audit at setup reported 25 high-severity findings and no critical findings. Suggested direct-package fixes included major-version changes or downgrades. These findings remain documented for separate review; no forced upgrades were applied.

Shopify template-maintenance workflows and upstream contribution metadata are excluded from this app repository. The original Shopify license notice is retained.

## Phase 1 validation

- 41 Node-native tests pass for scoring, coverage, normalization, nested pagination, scan limits, and safe API/authentication errors.
- Typecheck, lint, and production build pass. Existing React Router future-flag advisories remain.
- All three GraphQL operations validate against the July 2026 schema. Polaris dashboard components pass the Shopify toolkit component checks.
- Real development-store retrieval succeeded, including nested variant pagination and correct exclusion of untracked inventory. The existing SDK refreshed an expired offline session successfully.
- Server rendering passed for real catalog data, empty catalog, and API-error states; the development tunnel responded successfully. No credentials were returned in rendered dashboard data.
- Browser visual, keyboard, filtering, refresh, and product-link checks remain part of manual acceptance; see `docs/SCORING.md`.

## Phase 2 validation

- All 69 tests pass: the original 41 plus 28 product-analysis and single-product retrieval tests.
- Typecheck, lint, and production build pass; existing React Router future-flag advisories remain.
- The new `StorePulseProduct` query validates against July 2026; it uses the same fields as the catalog query and adds no scopes. Polaris components pass toolkit validation.
- Live development-store retrieval confirms dashboard/detail score agreement and full nested pagination. Server rendering passes for the real product, invalid link, missing product, and API-error states. Rendered output contains no session credentials.
- Browser visual and keyboard acceptance remains manual. Follow the product-analysis checks in `docs/SCORING.md`.

## Phase 2.5 validation

- All 69 existing tests pass; typecheck, lint, and production build pass. All six changed Polaris components pass Shopify toolkit validation. Existing React Router future-flag advisories remain.
- An isolated Chromium preview rendered the actual React components with Polaris and synthetic test products. Dashboard, product analysis, empty catalog, dashboard error, and product error states passed overflow checks at 1440, 1024, 768, and 375 pixels (20 combinations).
- Browser interaction checks passed for search, no-results, issues-only filtering, pagination, product/Admin link destinations, keyboard disclosure activation and visible focus, refresh layout stability, image/variant expansion, and unavailable-image fallback. No browser runtime errors were observed.
- This is component-level browser validation, not authenticated Shopify Admin acceptance. Review both pages inside the installed app, including narrow embedded widths, navigation, live refresh, and keyboard use. Temporary preview fixtures and browser tooling remain outside the repository.

## Phase 3 validation

- 101 tests pass: all 69 existing tests plus 32 mocked remediation tests. No automated test calls a live Shopify mutation.
- Typecheck, lint, and production build pass. Existing React Router future-flag advisories remain. Both new GraphQL operations validate against July 2026, and affected Polaris components pass toolkit checks. The native editor is checked by TypeScript, lint, and browser interaction tests.
- An isolated Chromium preview with synthetic data passes blank validation, retained failed input, duplicate submission, refreshed image evidence, edit/cancel, stale-success feedback, and overflow checks at 1280, 768, and 375 pixels.
- Shopify development preview auto-granted `write_files`; a live read confirms the granted scope. One explicitly authorized live mutation on the fictional VelvetBloom Rose Facial Oil product succeeded: Image 1 changed from empty alt text to a descriptive value, missing-alt images fell from 2 to 1, Accessibility rose from 0/20 to 10/20, and Product Health rose from 40/100 to 50/100. Fresh product and catalog reads confirmed the result; other retrieved fields/products were unchanged. Issue types remained 4 because a second image still lacks alt text; individual issue occurrences fell from 5 to 4. Embedded Admin visual acceptance remains manual.
- No commit or push is authorized until Peter reviews the workflow in Shopify Admin.

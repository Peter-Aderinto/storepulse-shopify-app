# StorePulse

A Shopify merchant app for catalog and product health analysis, built with React Router, TypeScript, and Shopify's GraphQL Admin API.

## Project status

Phase 1 implements a read-only Store Health dashboard using real Shopify catalog data: product health scores, inventory/content/SEO/alt-text checks, attention summaries, searchable product lists, and explicit analysis coverage. Authentication and local session persistence use the official Shopify scaffold. Phase 2 adds individual Product Analysis pages with category scores, image/variant evidence, and prioritized recommendations. Phase 2.5 refines the merchant experience with compact health summaries, responsive product lists, and clearer evidence and recommendations. Phase 3 adds explicit image alt-text remediation; product-update synchronization remains future work.

See [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for the architecture and eight development phases.

## Stack

- React Router 7, React, TypeScript, and Vite
- Shopify CLI and Shopify React Router authentication
- App Bridge and Shopify merchant UI components
- Prisma with SQLite for local session persistence

## Local development

Validated with Node 24.15.0 and npm 11.12.1. A Shopify developer account and an authorized development store are required.

```bash
npm ci
npm run setup
npm run config:link
npm run dev
```

Link your own Shopify app and select your development store when prompted. Complete browser authentication and installation through Shopify. The CLI supplies runtime configuration and a development tunnel; do not commit credentials or session databases. Shopify CLI is installed locally, so a global installation is unnecessary.

The starter mutation demo has been removed. Read operations do not change merchant data. The only write operation is a merchant-triggered image alt-text save. See [score methodology and limitations](docs/SCORING.md) for weights, the 5-unit low-stock threshold, SEO fallback handling, and the 250-product scan cap.

## Product analysis

From Store health, select a product title to open `/app/products/:productId`. The page fetches fresh authenticated Shopify data and explains Content, Imagery, Accessibility, Inventory, and Custom SEO using the same score engine as the dashboard. Excluded checks are clearly labelled. Image and variant evidence supports fixed, prioritized recommendations; no AI-generated content is used. Image evidence includes an explicit alt-text editor.

Use Back to Store health to return, or Open product in Shopify Admin to inspect/edit the Shopify record. The dashboard also retains a separate Admin link. Refresh analysis retrieves a new snapshot. See [scoring documentation](docs/SCORING.md#product-analysis-pages-phase-2) for priorities, query details, limitations, and manual acceptance checks.

## Image alt-text remediation (Phase 3)

In Product Analysis → Image evidence, choose **Add alt text** or **Edit alt text**, enter a description, and explicitly select **Save alt text**. Nothing is automatically written. The server uses Shopify Admin API `2026-07` `fileUpdate`, requiring the additional `write_files` scope and the merchant's permission to edit files. Approve Shopify's requested permission update when prompted during development.

Reads retrieve catalog/product evidence and file readiness. Writes update only the selected file's `alt` field. Shopify files may be shared: the same file's alt text changes wherever it is used. The server validates ownership, input, and stale edits before saving, then rereads Shopify; React Router revalidates analysis using the existing scoring engine. Return to Store health or refresh it to retrieve updated catalog scores.

See [remediation architecture, limitations, and manual checks](docs/REMEDIATION.md).

## Validation

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The project includes 101 focused tests for scoring, category evidence, recommendation priorities, inventory uncertainty, product identifiers, missing products, pagination, API failures, and authenticated alt-text remediation. All mutation tests use mocked APIs and never change store data. Database migrations were also verified. The initial dependency audit reported 25 high-severity findings; remediation is tracked separately from feature development.

## Publication and data handling

Environment files, local databases and journals, Shopify CLI state, logs, dependencies, and build artifacts are excluded from Git. Prisma schema and migrations are included, but session data is not. The Shopify app client ID is a public identifier; API secrets and access tokens must remain outside source control.

## Attribution

Based on the official [Shopify React Router app template](https://github.com/Shopify/shopify-app-template-react-router). The upstream [license](LICENSE.md) and template changelog are retained.

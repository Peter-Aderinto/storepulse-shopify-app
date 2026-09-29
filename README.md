# StorePulse

A Shopify merchant app for catalog and product health analysis, built with React Router, TypeScript, and Shopify's GraphQL Admin API.

## Project status

The initial Shopify scaffold is complete. Development-store connectivity, embedded Admin loading, authentication, and local session persistence have been verified. Product retrieval, dashboards, scoring, and remediation are planned; they are not implemented yet.

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

The default template includes a **Generate a product** demo action that writes to the connected store. It is not a StorePulse feature.

## Validation

```bash
npm run typecheck
npm run lint
npm run build
```

All three checks passed for the scaffold. Database migrations were also verified. The initial dependency audit reported 25 high-severity findings; remediation is tracked separately from feature development.

## Publication and data handling

Environment files, local databases and journals, Shopify CLI state, logs, dependencies, and build artifacts are excluded from Git. Prisma schema and migrations are included, but session data is not. The Shopify app client ID is a public identifier; API secrets and access tokens must remain outside source control.

## Attribution

Based on the official [Shopify React Router app template](https://github.com/Shopify/shopify-app-template-react-router). The upstream [license](LICENSE.md) and template changelog are retained.

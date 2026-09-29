import { useNavigation, useRevalidator } from "react-router";
import type { CatalogHealth } from "../domain/catalog";
import { HealthOverview, NeedsAttention } from "./HealthOverview";
import { ProductHealthTable } from "./ProductHealthTable";
import { ScoreMethodology } from "./ScoreMethodology";
import "../styles/dashboard.css";

export type DashboardData =
  | {
      ok: true;
      health: CatalogHealth;
      total: { count: number; precision: string };
      limited: boolean;
      scannedAt: string;
      adminBase: string;
    }
  | { ok: false; message: string };

export function Dashboard({ result }: { result: DashboardData }) {
  const revalidator = useRevalidator();
  const navigation = useNavigation();
  const loading = revalidator.state !== "idle" || navigation.state !== "idle";
  return (
    <s-page heading="StorePulse" inlineSize="large">
      <s-button
        slot="primary-action"
        variant="primary"
        loading={loading}
        disabled={loading}
        onClick={() => revalidator.revalidate()}
      >
        Refresh analysis
      </s-button>
      <div className="health-dashboard" aria-busy={loading}>
        <div className="health-page-intro">
          <s-paragraph>Store Health &amp; Growth Dashboard</s-paragraph>
          <div role="status" aria-live="polite">
            {loading
              ? "Refreshing catalog…"
              : result.ok
                ? `Analysis complete: ${result.health.analyzedCount} products checked.`
                : "Catalog analysis unavailable."}
          </div>
        </div>
        {result.ok === false ? (
          <s-banner heading="Your catalog could not be loaded" tone="critical">
            {result.message} No health scores were calculated from incomplete
            data.
          </s-banner>
        ) : (
          <>
            {result.limited && (
              <s-banner
                heading="This is a partial catalog analysis"
                tone="warning"
              >
                Showing the first {result.health.analyzedCount} products by
                Shopify ID. Scores and issue counts cover only these products,
                not the entire store. Total products is reported separately by
                Shopify.
              </s-banner>
            )}
            <HealthOverview
              health={result.health}
              total={result.total}
              limited={result.limited}
            />
            {result.health.analyzedCount === 0 ? (
              <s-section heading="Your catalog is ready for its first product">
                <div className="health-empty">
                  <s-paragraph>
                    Add a product in Shopify, then refresh StorePulse to see
                    real catalog health insights.
                  </s-paragraph>
                  <s-button
                    href={`${result.adminBase}/products`}
                    target="_blank"
                  >
                    Open Shopify products
                  </s-button>
                </div>
              </s-section>
            ) : (
              <>
                <NeedsAttention health={result.health} />
                <ProductHealthTable
                  products={result.health.products}
                  adminBase={result.adminBase}
                />
              </>
            )}
            {result.health.analyzedCount > 0 && (
              <details className="health-disclosure">
                <summary>Analysis coverage &amp; last refresh</summary>
                <s-paragraph>
                  Inventory coverage:{" "}
                  {result.health.inventoryCoverage.evaluated} of{" "}
                  {result.health.inventoryCoverage.total} variants evaluated
                  across {result.health.inventoryCoverage.products} products.{" "}
                  {result.health.inventoryCoverage.untracked} untracked;{" "}
                  {result.health.inventoryCoverage.unknown} unavailable. These
                  skipped variants receive no inventory penalty.
                </s-paragraph>
                <s-paragraph color="subdued">
                  Snapshot completed{" "}
                  {result.scannedAt.replace("T", " ").slice(0, 19)} UTC. Refresh
                  to retrieve current Shopify data.
                </s-paragraph>
              </details>
            )}
            <ScoreMethodology />
          </>
        )}
      </div>
    </s-page>
  );
}

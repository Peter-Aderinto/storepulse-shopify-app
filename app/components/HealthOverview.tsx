import type { CatalogHealth } from "../domain/catalog";
import { HealthScore } from "./HealthScore";

export function HealthOverview({
  health,
  total,
  limited,
}: {
  health: CatalogHealth;
  total: { count: number; precision: string };
  limited: boolean;
}) {
  const metrics = [
    [
      "Total products",
      `${total.count}${total.precision !== "EXACT" ? "+" : ""}`,
      "Reported by Shopify",
    ],
    ["Low stock", health.counts.lowStock, "Variants at 1–5 units"],
    ["Out of stock", health.counts.outOfStock, "Variant selling blocked"],
    ["Content / SEO", health.counts.contentSeo, "Content gaps"],
    ["Accessibility", health.counts.alt, "Missing image alt text"],
  ];
  return (
    <div className="health-overview-grid">
      <section
        className="health-panel health-score-panel"
        aria-labelledby="store-health-heading"
      >
        <h2 id="store-health-heading" className="health-eyebrow">
          {limited ? "Analyzed catalog health" : "Store health"}
        </h2>
        <HealthScore score={health.score} label="Store Health Score" />
        <p className="health-summary">
          {health.analyzedCount
            ? `${health.productsWithIssues} of ${health.analyzedCount} products need attention`
            : "Add a product to see your health score."}
        </p>
        <p className="health-muted">
          StorePulse metric · not an official Shopify score
        </p>
      </section>
      <div className="health-metric-area">
        <div className="health-metric-grid">
          {metrics.map(([label, value, detail]) => (
            <div className="health-metric-tile" key={label}>
              <span className="sp-tile-icon" aria-hidden="true">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path
                    d={
                      String(label) === "Total products"
                        ? "M3 6l7-3 7 3v9l-7 3-7-3V6zm0 0 7 3 7-3M10 9v9"
                        : String(label) === "Low stock"
                          ? "M4 5h12M4 9h7M4 13h4M14 9v8m-3-3 3 3 3-3"
                          : String(label) === "Out of stock"
                            ? "M6 3h8l4 7-4 7H6l-4-7 4-7zm4 4v4m0 3h.01"
                            : String(label) === "Content / SEO"
                              ? "M5 2h7l3 3v13H5V2zm3 6h4m-4 4h4m-4 3h3"
                              : "M3 5h14v10H3V5zm3 7 2-4 2 4m-3-1h2m3-3v4m0-2h2"
                    }
                  />
                </svg>
              </span>
              <p className="health-eyebrow">{label}</p>
              <p
                className="metric-value"
                data-tone={
                  label === "Total products" || health.analyzedCount === 0
                    ? "neutral"
                    : Number(value) > 0
                      ? "critical"
                      : "success"
                }
              >
                {value}
              </p>
              <p className="health-muted">{detail}</p>
            </div>
          ))}
        </div>
        <p className="health-muted">
          Issue tiles count affected products in this analysis. Categories can
          overlap.
        </p>
      </div>
    </div>
  );
}
export function NeedsAttention({ health }: { health: CatalogHealth }) {
  const items = [
    {
      count: health.counts.outOfStock,
      label: "Out of stock",
      priority: "High",
      action: "Review inventory",
    },
    {
      count: health.counts.image,
      label: "Missing imagery",
      priority: "High",
      action: "Review images",
    },
    {
      count: health.counts.backorder,
      label: "Selling without stock",
      priority: "Medium",
      action: "Review inventory",
    },
    {
      count: health.counts.description,
      label: "Missing description",
      priority: "Medium",
      action: "Review content",
    },
    {
      count: health.counts.alt,
      label: "Missing alt text",
      priority: "Medium",
      action: "Review accessibility",
    },
    {
      count: health.counts.seo,
      label: "Custom SEO gaps",
      priority: "Medium",
      action: "Review SEO",
    },
    {
      count: health.counts.lowStock,
      label: "Low stock",
      priority: "Low",
      action: "Review inventory",
    },
  ].filter((item) => item.count > 0);
  return (
    <section
      className="health-panel health-attention"
      aria-labelledby="attention-heading"
    >
      <div className="health-section-header">
        <h2 id="attention-heading">Needs attention</h2>
        <span className="sp-count">{items.length} checks</span>
      </div>
      {items.length ? (
        <div className="health-attention-list">
          {items.map((item) => (
            <div
              className="health-attention-row"
              key={item.label}
              data-tone={
                item.label === "Selling without stock" ? "warning" : "critical"
              }
            >
              <strong>{item.label}</strong>
              <span className="health-muted">
                {item.count} {item.count === 1 ? "product" : "products"}
              </span>
              <s-badge tone="neutral">{item.priority} priority</s-badge>
              <a
                className="sp-text-link"
                href="#product-health"
                aria-label={`${item.action}: ${item.label}. Find affected products in Product health.`}
              >
                {item.action}
              </a>
            </div>
          ))}
        </div>
      ) : (
        <p className="health-muted">
          No issues found in the available checks. This is not a full storefront
          audit.
        </p>
      )}
    </section>
  );
}

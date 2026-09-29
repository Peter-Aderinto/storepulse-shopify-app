import type { CatalogHealth } from "../domain/catalog";

export function HealthOverview({
  health,
  total,
  limited,
}: {
  health: CatalogHealth;
  total: { count: number; precision: string };
  limited: boolean;
}) {
  const label =
    health.score === null
      ? "No products analyzed"
      : health.score >= 85
        ? "Strong foundation"
        : health.score >= 60
          ? "Room to improve"
          : "Needs attention";
  const metrics = [
    {
      title: "Total products",
      value: `${total.count}${total.precision !== "EXACT" ? "+" : ""}`,
      detail: "Reported by Shopify",
    },
    {
      title: "Low stock",
      value: health.counts.lowStock,
      detail: "Tracked variants at 1–5 units",
    },
    {
      title: "Out of stock",
      value: health.counts.outOfStock,
      detail: "Sold-out variants; selling blocked",
    },
    {
      title: "Content / SEO",
      value: health.counts.contentSeo,
      detail: "Content or custom SEO gaps",
    },
    {
      title: "Accessibility",
      value: health.counts.alt,
      detail: "Images missing alt text",
    },
  ];
  return (
    <>
      <s-section heading={limited ? "Analyzed catalog health" : "Store health"}>
        <div className="health-hero">
          <div
            className="health-score"
            aria-label={
              health.score === null
                ? "No score available"
                : `StorePulse score: ${health.score} out of 100`
            }
          >
            {health.score ?? "—"}
            <span>/ 100</span>
          </div>
          <s-stack direction="block" gap="small">
            <s-heading>{label}</s-heading>
            <s-paragraph>
              {health.productsWithIssues
                ? `${health.productsWithIssues} of ${health.analyzedCount} analyzed products need attention.`
                : health.analyzedCount
                  ? "No issues found in the checks performed."
                  : "Your health summary will appear when your catalog has products."}
            </s-paragraph>
            <s-paragraph color="subdued">
              StorePulse metric, not an official Shopify score.
            </s-paragraph>
          </s-stack>
        </div>
        <hr className="health-rule" />
        <div className="health-metrics">
          {metrics.map((metric) => (
            <div className="health-metric" key={metric.title}>
              <p className="metric-label">{metric.title}</p>
              <p className="metric-value">{metric.value}</p>
              <p className="health-muted">{metric.detail}</p>
            </div>
          ))}
        </div>
        <p className="health-muted">
          Issue counts cover {health.analyzedCount} analyzed products.
          Categories can overlap.
        </p>
      </s-section>
    </>
  );
}

export function NeedsAttention({ health }: { health: CatalogHealth }) {
  const items = [
    {
      count: health.counts.outOfStock,
      label: "products have out-of-stock variants",
      priority: "High",
      action: "Review tracked stock before promoting these variants.",
    },
    {
      count: health.counts.lowStock,
      label: "products have low inventory",
      priority: "Low",
      action: "Check replenishment for variants at 1–5 units.",
    },
    {
      count: health.counts.backorder,
      label: "products have variants selling without stock",
      priority: "Medium",
      action:
        "Confirm that continued selling and delivery expectations are intentional.",
    },
    {
      count: health.counts.description,
      label: "products need a description",
      priority: "Medium",
      action: "Explain the product, its benefits, and essential details.",
    },
    {
      count: health.counts.image,
      label: "products need an image",
      priority: "High",
      action: "Add clear imagery to help shoppers evaluate the product.",
    },
    {
      count: health.counts.alt,
      label: "products have images without alt text",
      priority: "Medium",
      action:
        "Describe meaningful product images for people using screen readers.",
    },
    {
      count: health.counts.seo,
      label: "products have custom SEO fields to review",
      priority: "Medium",
      action:
        "Consider an intentional search title and description. Shopify may already provide fallback text.",
    },
  ]
    .filter((item) => item.count > 0)
    .sort(
      (a, b) =>
        ["High", "Medium", "Low"].indexOf(a.priority) -
        ["High", "Medium", "Low"].indexOf(b.priority),
    );
  return (
    <s-section heading="Needs attention">
      {items.length ? (
        <div className="health-rows">
          {items.map((item) => (
            <div className="health-row" key={item.label}>
              <div className="health-row-copy">
                <s-paragraph>
                  <s-text type="strong">
                    {item.count}{" "}
                    {item.count === 1
                      ? item.label
                          .replace(/^products have /, "product has ")
                          .replace(/^products need /, "product needs ")
                      : item.label}
                  </s-text>
                </s-paragraph>
                <s-paragraph color="subdued">{item.action}</s-paragraph>
              </div>
              <s-badge tone={item.priority === "High" ? "warning" : "neutral"}>
                {item.priority} priority
              </s-badge>
            </div>
          ))}
        </div>
      ) : (
        <s-paragraph>
          No issues detected in the available checks. This does not assess sales
          performance or storefront accessibility.
        </s-paragraph>
      )}
    </s-section>
  );
}

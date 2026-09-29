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
      detail: "Products with a tracked variant at 1–5 units",
    },
    {
      title: "Out of stock",
      value: health.counts.outOfStock,
      detail: "Products with a sold-out variant; overselling off",
    },
    {
      title: "Content / SEO",
      value: health.counts.contentSeo,
      detail: "Products with content or custom SEO gaps",
    },
    {
      title: "Accessibility",
      value: health.counts.alt,
      detail: "Products with image alt-text gaps",
    },
  ];
  return (
    <>
      <s-section
        heading={limited ? "Analyzed catalog health" : "Store Health Score"}
      >
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
                ? `${health.productsWithIssues} of ${health.analyzedCount} analyzed products have opportunities to improve.`
                : health.analyzedCount
                  ? "No issues found in the checks performed."
                  : "Your health summary will appear when your catalog has products."}
            </s-paragraph>
            <s-paragraph color="subdued">
              A StorePulse metric, not an official Shopify score. An
              equal-weight average of analyzed product scores across all product
              statuses.
            </s-paragraph>
          </s-stack>
        </div>
      </s-section>
      <div className="health-metrics">
        {metrics.map((metric) => (
          <s-section key={metric.title} heading={metric.title}>
            <p className="metric-value">{metric.value}</p>
            <s-paragraph color="subdued">{metric.detail}</s-paragraph>
          </s-section>
        ))}
      </div>
      <s-paragraph color="subdued">
        Issue metrics are calculated by StorePulse for {health.analyzedCount}{" "}
        analyzed products. A product can appear in more than one metric.
      </s-paragraph>
    </>
  );
}

export function NeedsAttention({ health }: { health: CatalogHealth }) {
  const items = [
    {
      count: health.counts.outOfStock,
      label: "products have out-of-stock variants",
      action: "Review tracked stock before promoting these variants.",
    },
    {
      count: health.counts.lowStock,
      label: "products have low inventory",
      action: "Check replenishment for variants at 1–5 units.",
    },
    {
      count: health.counts.backorder,
      label: "products have variants selling without stock",
      action:
        "Confirm that continued selling and delivery expectations are intentional.",
    },
    {
      count: health.counts.description,
      label: "products need a description",
      action: "Explain the product, its benefits, and essential details.",
    },
    {
      count: health.counts.image,
      label: "products need an image",
      action: "Add clear imagery to help shoppers evaluate the product.",
    },
    {
      count: health.counts.alt,
      label: "products have images without alt text",
      action:
        "Describe meaningful product images for people using screen readers.",
    },
    {
      count: health.counts.seo,
      label: "products have custom SEO fields to review",
      action:
        "Consider an intentional search title and description. Shopify may already provide fallback text.",
    },
  ].filter((item) => item.count > 0);
  return (
    <s-section heading="Needs attention">
      {items.length ? (
        <s-stack direction="block" gap="base">
          {items.map((item) => (
            <s-box
              key={item.label}
              padding="base"
              background="subdued"
              borderRadius="base"
            >
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
            </s-box>
          ))}
        </s-stack>
      ) : (
        <s-paragraph>
          No issues detected in the available checks. This does not assess sales
          performance or storefront accessibility.
        </s-paragraph>
      )}
    </s-section>
  );
}

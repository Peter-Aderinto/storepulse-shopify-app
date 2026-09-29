import { useNavigation, useRevalidator } from "react-router";
import type { ProductAnalysis } from "../domain/product-analysis";
import { ProductEvidence } from "./ProductEvidence";
import "../styles/dashboard.css";

export type ProductAnalysisData =
  | { ok: true; analysis: ProductAnalysis; adminUrl: string; checkedAt: string }
  | { ok: false; heading: string; message: string; retryable: boolean };
const WHY = {
  outOfStock: "These variants cannot be purchased while stock is unavailable.",
  image: "Images help shoppers understand the product.",
  description: "Essential details help shoppers make an informed choice.",
  alt: "Meaningful alt text supports people using screen readers.",
  backorder: "Orders may need delivery expectations beyond available stock.",
  seoTitle: "A custom title gives you control over search presentation.",
  seoDescription:
    "A custom description gives you control over search presentation.",
  lowStock: "Limited stock may affect an upcoming promotion.",
};
const points = (value: number) => Number(value.toFixed(2)).toString();
export function ProductAnalysisPage({
  result,
}: {
  result: ProductAnalysisData;
}) {
  const revalidator = useRevalidator();
  const navigation = useNavigation();
  const loading = revalidator.state !== "idle" || navigation.state !== "idle";
  return (
    <s-page
      heading={
        result.ok
          ? result.analysis.health.title || "Untitled product"
          : "Product analysis"
      }
      inlineSize="large"
    >
      <s-link slot="breadcrumb-actions" href="/app">
        Back to Store health
      </s-link>
      {(result.ok === true || result.retryable) && (
        <s-button
          slot="primary-action"
          variant="primary"
          loading={loading}
          disabled={loading}
          onClick={() => revalidator.revalidate()}
        >
          Refresh analysis
        </s-button>
      )}
      <div className="health-dashboard" aria-busy={loading}>
        <div role="status" aria-live="polite">
          {loading
            ? "Reading this product from Shopify…"
            : result.ok
              ? "Product analysis complete."
              : "Product analysis unavailable."}
        </div>
        {result.ok === false ? (
          <s-banner heading={result.heading} tone="warning">
            {result.message}
          </s-banner>
        ) : (
          <>
            <s-section heading="Product health">
              <s-stack direction="block" gap="base">
                <s-heading>
                  {result.analysis.health.title || "Untitled product"}
                </s-heading>
                <div className="health-identity">
                  <s-stack direction="inline" gap="small">
                    <s-badge>
                      {result.analysis.health.status
                        .toLowerCase()
                        .replaceAll("_", " ")}
                    </s-badge>
                    <s-text color="subdued">
                      {result.analysis.health.handle}
                    </s-text>
                  </s-stack>
                  <s-link href={result.adminUrl} target="_blank">
                    Open in Shopify Admin (new tab)
                  </s-link>
                </div>
                <div className="health-hero">
                  <div
                    className="health-score"
                    aria-label={`Product Health Score: ${result.analysis.health.score} out of 100`}
                  >
                    {result.analysis.health.score}
                    <span>/ 100</span>
                  </div>
                  <s-stack direction="block" gap="small">
                    <s-heading>Product Health Score</s-heading>
                    <s-paragraph>
                      {result.analysis.health.issues.length} issue types ·
                      Coverage {result.analysis.health.evaluatedWeight}/100
                    </s-paragraph>
                    <s-paragraph color="subdued">
                      Excluded checks do not lower the score.
                    </s-paragraph>
                    <s-paragraph color="subdued">
                      StorePulse metric, not an official Shopify score.
                    </s-paragraph>
                  </s-stack>
                </div>
              </s-stack>
            </s-section>
            <s-section heading="Health breakdown">
              <div className="health-rows">
                {result.analysis.categories.map((category) => (
                  <div className="health-breakdown-row" key={category.key}>
                    <s-heading>{category.label}</s-heading>
                    <span className="health-points">
                      {category.earned === null
                        ? "Not evaluated"
                        : `${points(category.earned)} / ${category.weight} points`}
                    </span>
                    <div className="health-row-copy">
                      <s-text type="strong">
                        {category.earned === null
                          ? "Excluded from score"
                          : category.earned === category.weight
                            ? "Complete"
                            : "Needs review"}
                      </s-text>
                      <s-paragraph color="subdued">
                        {category.explanation}
                      </s-paragraph>
                    </div>
                  </div>
                ))}
              </div>
              <details className="health-disclosure">
                <summary>How category points become your score</summary>
                <s-paragraph color="subdued">
                  Overall score = earned points ÷ evaluated weight × 100,
                  rounded to a whole number. Category points are shown to two
                  decimal places; calculations use full precision. SEO combines
                  the existing 10-point title and 10-point description checks.
                </s-paragraph>
              </details>
            </s-section>
            <s-section heading="Issue summary">
              {result.analysis.health.issues.length ? (
                <s-stack direction="inline" gap="small">
                  {result.analysis.health.issues.map((issue) => (
                    <s-badge key={issue.code}>{issue.label}</s-badge>
                  ))}
                </s-stack>
              ) : (
                <s-paragraph>
                  No issues found in the evaluated checks. This is not a
                  complete storefront audit.
                </s-paragraph>
              )}
            </s-section>
            <ProductEvidence
              key={result.analysis.health.id}
              analysis={result.analysis}
            />
            <s-section heading="Prioritized recommendations">
              {result.analysis.recommendations.length ? (
                <div className="health-rows">
                  {result.analysis.recommendations.map((recommendation) => (
                    <div className="health-row" key={recommendation.code}>
                      <div className="health-row-copy">
                        <s-text type="strong">{recommendation.evidence}</s-text>
                        <s-paragraph color="subdued">
                          {WHY[recommendation.code]}
                        </s-paragraph>
                        <s-paragraph>{recommendation.action}</s-paragraph>
                      </div>
                      <s-badge
                        tone={
                          recommendation.priority === "High"
                            ? "warning"
                            : "neutral"
                        }
                      >
                        {recommendation.priority} priority
                      </s-badge>
                    </div>
                  ))}
                </div>
              ) : (
                <s-paragraph>
                  No recommendations for the available checks. Review the
                  product periodically as its catalog data changes.
                </s-paragraph>
              )}
              <s-paragraph color="subdued">
                Rule-based guidance. Review and make any changes in Shopify
                Admin.
              </s-paragraph>
            </s-section>
            <s-paragraph color="subdued">
              Checked {result.checkedAt.replace("T", " ").slice(0, 19)} UTC.
              Fresh product snapshot. Dashboard scores may differ after edits.
            </s-paragraph>
          </>
        )}
        <s-link href="/app">Back to Store health</s-link>
      </div>
    </s-page>
  );
}

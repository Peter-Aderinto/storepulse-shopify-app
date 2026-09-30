import { scoreTone, issueTone } from "./health-colors";
import { StorePulseHeader } from "./StorePulseHeader";
import { useNavigation, useRevalidator } from "react-router";
import type { ProductAnalysis } from "../domain/product-analysis";
import { HealthScore } from "./HealthScore";
import { ProductEvidence } from "./ProductEvidence";

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
    <s-page inlineSize="large">
      <div className="health-dashboard" aria-busy={loading}>
        <StorePulseHeader
          title={
            result.ok
              ? result.analysis.health.title || "Untitled product"
              : "Product analysis"
          }
          subtitle="Product health analysis"
          back
          loading={loading}
          canRefresh={result.ok === true || result.retryable}
          onRefresh={() => revalidator.revalidate()}
        />
        <div className="sp-context-bar">
          <span className="sp-current-view">Product overview</span>
          <div role="status" aria-live="polite">
            {loading
              ? "Refreshing product…"
              : result.ok
                ? "Analysis complete"
                : "Analysis unavailable"}
          </div>
        </div>
        {result.ok === false ? (
          <s-banner heading={result.heading} tone="warning">
            {result.message}
          </s-banner>
        ) : (
          <>
            <div className="health-analysis-overview">
              <section
                className="health-panel health-product-summary"
                aria-label="Product health"
              >
                <s-stack direction="block" gap="base">
                  <h2 className="health-eyebrow">Product health</h2>
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
                    <a
                      className="sp-secondary-link"
                      href={result.adminUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Shopify Admin ↗
                      <span className="sp-sr-only"> (new tab)</span>
                    </a>
                  </div>
                  <HealthScore
                    score={result.analysis.health.score}
                    label="Product Health Score"
                  />
                  <p className="health-summary">
                    {result.analysis.health.issues.length} issue types ·{" "}
                    {result.analysis.health.evaluatedWeight}/100 coverage
                  </p>
                  <p className="health-muted">
                    Excluded checks do not lower the score.
                  </p>
                  <p className="health-muted">
                    StorePulse metric · not an official Shopify score
                  </p>
                </s-stack>
              </section>
              <section
                className="health-panel health-category-panel"
                aria-labelledby="breakdown-heading"
              >
                <h2 id="breakdown-heading">Health breakdown</h2>
                <div className="health-rows">
                  {result.analysis.categories.map((category) => (
                    <div className="health-breakdown-row" key={category.key}>
                      <s-heading>{category.label}</s-heading>
                      <span
                        className="health-points"
                        data-tone={scoreTone(
                          category.earned === null
                            ? null
                            : (100 * category.earned) / category.weight,
                        )}
                      >
                        {category.earned === null
                          ? "Not evaluated"
                          : `${points(category.earned)} / ${category.weight} points`}
                      </span>
                      <details className="health-disclosure health-category-explanation">
                        <summary>
                          {category.earned === null
                            ? "Excluded"
                            : category.earned === category.weight
                              ? "Complete"
                              : "Needs review"}
                        </summary>
                        <s-paragraph color="subdued">
                          {category.explanation}
                        </s-paragraph>
                      </details>
                    </div>
                  ))}
                </div>
                <details className="health-disclosure">
                  <summary>How category points become your score</summary>
                  <s-paragraph color="subdued">
                    Overall score = earned points ÷ evaluated weight × 100,
                    rounded to a whole number. Category points are shown to two
                    decimal places; calculations use full precision. SEO
                    combines the existing 10-point title and 10-point
                    description checks.
                  </s-paragraph>
                </details>
              </section>
            </div>
            <s-section heading="Issue summary">
              {result.analysis.health.issues.length ? (
                <s-stack direction="inline" gap="small">
                  {result.analysis.health.issues.map((issue) => (
                    <s-badge key={issue.code} tone={issueTone(issue.code)}>
                      {issue.label}
                    </s-badge>
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
                    <div
                      className="health-row health-recommendation-row"
                      data-tone={issueTone(recommendation.code)}
                      key={recommendation.code}
                    >
                      <div className="health-row-copy">
                        <s-text type="strong">{recommendation.evidence}</s-text>
                        <p className="health-muted">
                          <strong>Why </strong>
                          {WHY[recommendation.code]}
                        </p>
                        <s-paragraph>
                          <s-text type="strong">Action </s-text>
                          {recommendation.action}
                        </s-paragraph>
                      </div>
                      <s-badge tone="neutral">
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
                Rule-based guidance. Edit image alt text above; make other
                changes in Shopify Admin.
              </s-paragraph>
            </s-section>
            <s-paragraph color="subdued">
              Checked {result.checkedAt.replace("T", " ").slice(0, 19)} UTC.
              Fresh product snapshot. Dashboard scores may differ after edits.
            </s-paragraph>
          </>
        )}
        <a className="sp-text-link" href="/app">
          ← Back to Store health
        </a>
      </div>
    </s-page>
  );
}

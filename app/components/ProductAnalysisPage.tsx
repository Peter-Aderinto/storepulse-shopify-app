import { useNavigation, useRevalidator } from "react-router";
import type { ProductAnalysis } from "../domain/product-analysis";
import { ProductEvidence } from "./ProductEvidence";
import "../styles/dashboard.css";

export type ProductAnalysisData =
  | { ok: true; analysis: ProductAnalysis; adminUrl: string; checkedAt: string }
  | { ok: false; heading: string; message: string; retryable: boolean };
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
    <s-page heading="Product analysis" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app">
        Back to Store health
      </s-link>
      {(result.ok === true || result.retryable) && (
        <s-button
          slot="primary-action"
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
            <s-section
              heading={result.analysis.health.title || "Untitled product"}
            >
              <s-stack direction="block" gap="base">
                <s-stack direction="inline" gap="small">
                  <s-badge>
                    {result.analysis.health.status
                      .toLowerCase()
                      .replaceAll("_", " ")}
                  </s-badge>
                  <s-text>Handle: {result.analysis.health.handle}</s-text>
                </s-stack>
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
                      {result.analysis.health.issues.length} issue types
                      detected. Evaluated weight:{" "}
                      {result.analysis.health.evaluatedWeight}/100.
                    </s-paragraph>
                    <s-paragraph color="subdued">
                      A StorePulse diagnostic score, not an official Shopify
                      score. Excluded checks do not lower the score.
                    </s-paragraph>
                    <s-link href={result.adminUrl} target="_blank">
                      Open product in Shopify Admin (new tab)
                    </s-link>
                  </s-stack>
                </div>
              </s-stack>
            </s-section>
            <s-section heading="Why this product received its score">
              <div className="health-metrics">
                {result.analysis.categories.map((category) => (
                  <s-box
                    key={category.key}
                    padding="base"
                    background="subdued"
                    borderRadius="base"
                  >
                    <s-stack direction="block" gap="small">
                      <s-heading>{category.label}</s-heading>
                      <s-text type="strong">
                        {category.earned === null
                          ? "Not evaluated"
                          : `${points(category.earned)} / ${category.weight} points`}
                      </s-text>
                      <s-paragraph>{category.explanation}</s-paragraph>
                    </s-stack>
                  </s-box>
                ))}
              </div>
              <s-paragraph color="subdued">
                Overall score = earned points ÷ evaluated weight × 100, rounded
                to a whole number. Category points are shown to two decimal
                places; calculations use full precision. SEO combines the
                existing 10-point title and 10-point description checks.
              </s-paragraph>
            </s-section>
            <s-section heading="Issue summary">
              {result.analysis.health.issues.length ? (
                <s-unordered-list>
                  {result.analysis.health.issues.map((issue) => (
                    <s-list-item key={issue.code}>{issue.label}</s-list-item>
                  ))}
                </s-unordered-list>
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
                <s-stack direction="block" gap="base">
                  {result.analysis.recommendations.map((recommendation) => (
                    <s-box
                      key={recommendation.code}
                      padding="base"
                      background="subdued"
                      borderRadius="base"
                    >
                      <s-stack direction="block" gap="small">
                        <s-badge
                          tone={
                            recommendation.priority === "High"
                              ? "critical"
                              : recommendation.priority === "Medium"
                                ? "warning"
                                : "info"
                          }
                        >
                          {recommendation.priority} priority
                        </s-badge>
                        <s-text type="strong">{recommendation.evidence}</s-text>
                        <s-paragraph>{recommendation.action}</s-paragraph>
                      </s-stack>
                    </s-box>
                  ))}
                </s-stack>
              ) : (
                <s-paragraph>
                  No recommendations for the available checks. Review the
                  product periodically as its catalog data changes.
                </s-paragraph>
              )}
              <s-paragraph color="subdued">
                Recommendations follow fixed rules, not AI. StorePulse makes no
                changes to your product. Review and apply any edits in Shopify
                Admin.
              </s-paragraph>
            </s-section>
            <s-paragraph color="subdued">
              Checked {result.checkedAt.replace("T", " ").slice(0, 19)} UTC.
              This page fetches fresh data independently of the dashboard, so
              scores can change after catalog edits.
            </s-paragraph>
          </>
        )}
        <s-link href="/app">Back to Store health</s-link>
      </div>
    </s-page>
  );
}

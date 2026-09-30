import { useState } from "react";
import type { ProductAnalysis } from "../domain/product-analysis";
import type { InventoryState } from "../domain/catalog";

const INVENTORY_LABELS: Record<InventoryState, string> = {
  healthy: "Above low-stock threshold",
  low: "Low stock (1–5 units)",
  out: "Out of stock; selling blocked",
  backorder: "Selling without stock",
  untracked: "Not evaluated: untracked",
  unknown: "Not evaluated: unavailable",
};
export function ProductEvidence({ analysis }: { analysis: ProductAnalysis }) {
  const [imageLimit, setImageLimit] = useState(12);
  const [variantLimit, setVariantLimit] = useState(25);
  return (
    <>
      <s-section heading="Content & custom SEO evidence">
        <div className="health-evidence-summary">
          {[
            ["Description", analysis.completeness.descriptionPresent],
            ["Custom SEO title", analysis.completeness.seoTitlePresent],
            [
              "Custom SEO description",
              analysis.completeness.seoDescriptionPresent,
            ],
          ].map(([label, present]) => (
            <div className="health-row-copy" key={String(label)}>
              <s-text type="strong">{label}</s-text>
              <s-badge tone={present ? "success" : "critical"}>
                {present ? "✓ Present" : "! Missing"}
              </s-badge>
            </div>
          ))}
        </div>
        <s-paragraph color="subdued">
          Presence checks only. Blank custom SEO fields may use Shopify fallback
          metadata.
        </s-paragraph>
      </s-section>
      <s-section heading="Image evidence">
        {!analysis.images.length ? (
          <s-paragraph>
            No product image media found. Alt text is not evaluated; the missing
            image is counted in Imagery.
          </s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            <s-paragraph>
              {analysis.images.filter((image) => image.missingAlt).length} of{" "}
              {analysis.images.length} product images have no alt text. Image
              numbering follows Shopify&apos;s media order.
            </s-paragraph>
            <div className="health-image-evidence">
              {analysis.images.slice(0, imageLimit).map((image) => (
                <div className="health-image-item" key={image.id}>
                  <div className="health-image-preview">
                    {image.url ? (
                      <s-thumbnail
                        src={image.url}
                        alt={`${image.label} preview`}
                        size="large"
                      />
                    ) : (
                      <span>Preview unavailable</span>
                    )}
                  </div>
                  <div className="health-image-copy">
                    <s-heading>{image.label}</s-heading>
                    <s-badge tone={image.missingAlt ? "critical" : "success"}>
                      {image.missingAlt
                        ? "Missing alt text"
                        : "Alt text present"}
                    </s-badge>
                    <s-paragraph>
                      {image.missingAlt
                        ? "No non-empty alt text was returned."
                        : image.altText}
                    </s-paragraph>
                  </div>
                </div>
              ))}
            </div>
            {imageLimit < analysis.images.length && (
              <s-button onClick={() => setImageLimit((n) => n + 12)}>
                Show more images
              </s-button>
            )}
            <s-paragraph color="subdued">
              Showing {Math.min(imageLimit, analysis.images.length)} of{" "}
              {analysis.images.length} images. Decorative images may
              intentionally have empty alt text. Previews may be unavailable
              while images process.
            </s-paragraph>
          </s-stack>
        )}
      </s-section>
      <s-section heading="Variant inventory evidence">
        {!analysis.variants.length ? (
          <s-paragraph>
            Shopify returned no variants. Inventory is not evaluated and
            receives no penalty.
          </s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Quantities are Shopify&apos;s aggregate values across locations.
              Untracked or unavailable inventory is excluded from the score.
            </s-paragraph>
            <s-table variant="auto">
              <s-table-header-row>
                <s-table-header listSlot="primary">Variant</s-table-header>
                <s-table-header listSlot="labeled">Quantity</s-table-header>
                <s-table-header listSlot="secondary">
                  StorePulse assessment
                </s-table-header>
                <s-table-header listSlot="labeled">
                  Continue selling when out of stock
                </s-table-header>
              </s-table-header-row>
              <s-table-body>
                {analysis.variants.slice(0, variantLimit).map((variant) => (
                  <s-table-row key={variant.id}>
                    <s-table-cell>
                      {variant.title || "Default variant"}
                    </s-table-cell>
                    <s-table-cell>
                      {variant.state === "untracked"
                        ? "Not tracked"
                        : (variant.quantity ?? "Unavailable")}
                    </s-table-cell>
                    <s-table-cell>
                      <s-badge
                        tone={
                          variant.state === "healthy"
                            ? "success"
                            : variant.state === "low" || variant.state === "out"
                              ? "critical"
                              : variant.state === "backorder"
                                ? "warning"
                                : "neutral"
                        }
                      >
                        {INVENTORY_LABELS[variant.state]}
                      </s-badge>
                    </s-table-cell>
                    <s-table-cell>
                      {variant.policy === "CONTINUE"
                        ? "Enabled"
                        : variant.policy === "DENY"
                          ? "Disabled"
                          : "Unavailable"}
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
            {variantLimit < analysis.variants.length && (
              <s-button onClick={() => setVariantLimit((n) => n + 25)}>
                Show more variants
              </s-button>
            )}
            <s-paragraph color="subdued">
              Showing {Math.min(variantLimit, analysis.variants.length)} of{" "}
              {analysis.variants.length} variants. Scoring includes all eligible
              variants, not just the visible rows.
            </s-paragraph>
          </s-stack>
        )}
      </s-section>
    </>
  );
}

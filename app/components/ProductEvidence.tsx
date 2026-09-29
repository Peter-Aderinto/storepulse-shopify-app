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
        <s-unordered-list>
          <s-list-item>
            Description:{" "}
            {analysis.completeness.descriptionPresent
              ? "present"
              : "missing or empty"}
            .
          </s-list-item>
          <s-list-item>
            Custom SEO title:{" "}
            {analysis.completeness.seoTitlePresent ? "present" : "blank"}.
          </s-list-item>
          <s-list-item>
            Custom SEO description:{" "}
            {analysis.completeness.seoDescriptionPresent ? "present" : "blank"}.
          </s-list-item>
        </s-unordered-list>
        <s-paragraph color="subdued">
          These checks assess presence, not writing quality or search
          performance. Blank custom SEO fields may still use Shopify fallback
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
                <s-box
                  key={image.id}
                  padding="base"
                  background="subdued"
                  borderRadius="base"
                >
                  <s-stack direction="block" gap="small">
                    <s-heading>{image.label}</s-heading>
                    {image.url ? (
                      <s-thumbnail
                        src={image.url}
                        alt={`${image.label} preview`}
                        size="large"
                      />
                    ) : (
                      <s-paragraph>
                        Preview unavailable or still processing.
                      </s-paragraph>
                    )}
                    <s-badge tone={image.missingAlt ? "warning" : "success"}>
                      {image.missingAlt
                        ? "Missing alt text"
                        : "Alt text present"}
                    </s-badge>
                    <s-paragraph>
                      {image.missingAlt
                        ? "No non-empty alt text was returned."
                        : image.altText}
                    </s-paragraph>
                  </s-stack>
                </s-box>
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
              intentionally have empty alt text.
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
                      {INVENTORY_LABELS[variant.state]}
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

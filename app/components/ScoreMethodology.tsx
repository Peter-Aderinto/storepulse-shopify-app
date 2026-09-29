export function ScoreMethodology() {
  return (
    <details className="health-disclosure">
      <summary>How your score works</summary>
      <s-stack direction="block" gap="base">
        <s-paragraph>
          StorePulse checks catalog completeness and inventory signals. It does
          not predict growth, measure SEO rankings, or certify accessibility.
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>Description: 20 points for non-empty text.</s-list-item>
          <s-list-item>
            Imagery: 20 points for at least one product image.
          </s-list-item>
          <s-list-item>
            Alt text: up to 20 points, proportional to images with text. Not
            evaluated when there are no images.
          </s-list-item>
          <s-list-item>
            Inventory: up to 20 points, averaged across tracked variants with
            known quantities and selling policy. More than 5 units earns full
            credit; 1–5 units or selling without stock earns half; zero or fewer
            units with overselling off earns none.
          </s-list-item>
          <s-list-item>
            Custom SEO title and description: 10 points each when set. Blank
            custom fields may still use Shopify fallback metadata.
          </s-list-item>
        </s-unordered-list>
        <s-paragraph>
          Product score = earned points ÷ evaluated weight × 100, rounded to the
          nearest whole number. Untracked or unavailable inventory is excluded,
          not treated as zero. The store score is the rounded average of
          analyzed product scores; no products means no score.
        </s-paragraph>
        <s-paragraph color="subdued">
          Inventory uses Shopify&apos;s aggregate variant quantity across
          locations, not location-level availability. All statuses are included.
          Alt-text presence alone does not establish quality; decorative images
          may intentionally have empty alt text. Issue counts represent failed
          check types, not every affected image or variant.
        </s-paragraph>
      </s-stack>
    </details>
  );
}

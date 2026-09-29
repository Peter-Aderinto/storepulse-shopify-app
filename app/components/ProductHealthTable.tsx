import { useState } from "react";
import type { ProductHealth } from "../domain/catalog";

const PAGE_SIZE = 25;
export function ProductHealthTable({
  products,
  adminBase,
}: {
  products: ProductHealth[];
  adminBase: string;
}) {
  const [query, setQuery] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [page, setPage] = useState(0);
  const filtered = products.filter(
    (product) =>
      (!onlyIssues || product.issues.length > 0) &&
      `${product.title} ${product.handle}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1),
  );
  const visible = filtered.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );
  return (
    <s-section heading="Product health">
      <s-stack direction="block" gap="base">
        <s-paragraph color="subdued">
          Lowest scores first. Titles and statuses come from Shopify; scores and
          issue indicators are calculated by StorePulse. Select a product to see
          its StorePulse analysis; the separate Admin link opens Shopify.
        </s-paragraph>
        <s-search-field
          label="Search analyzed products"
          placeholder="Search by product title or handle"
          value={query}
          onInput={(event) => {
            setQuery(event.currentTarget.value);
            setPage(0);
          }}
        />
        <s-checkbox
          label="Only products with issues"
          checked={onlyIssues}
          onChange={(event) => {
            setOnlyIssues(event.currentTarget.checked);
            setPage(0);
          }}
        />
        {visible.length ? (
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header listSlot="primary">Product</s-table-header>
              <s-table-header listSlot="inline">Shopify status</s-table-header>
              <s-table-header listSlot="labeled" format="numeric">
                Health score
              </s-table-header>
              <s-table-header listSlot="secondary">
                Issues &amp; coverage
              </s-table-header>
            </s-table-header-row>
            <s-table-body>
              {visible.map((product) => (
                <s-table-row key={product.id}>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small" alignItems="center">
                      {product.image?.url && (
                        <s-thumbnail
                          src={product.image.url}
                          alt=""
                          size="small"
                        />
                      )}
                      <s-link
                        href={`/app/products/${product.id.split("/").pop()}`}
                      >
                        {product.title || "Untitled product"}
                      </s-link>
                      <s-link
                        href={`${adminBase}/products/${product.id.split("/").pop()}`}
                        target="_blank"
                        accessibilityLabel={`Open ${product.title || "product"} in Shopify Admin (new tab)`}
                      >
                        Shopify Admin
                      </s-link>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge>
                      {product.status.toLowerCase().replaceAll("_", " ")}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge
                      tone={
                        product.score >= 85
                          ? "success"
                          : product.score >= 60
                            ? "warning"
                            : "critical"
                      }
                    >
                      {product.score} / 100
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack direction="block" gap="small">
                      <s-text type="strong">
                        {product.issues.length} issue{" "}
                        {product.issues.length === 1 ? "type" : "types"}
                      </s-text>
                      {product.issues.length > 0 && (
                        <s-paragraph>
                          {product.issues
                            .map((issue) => issue.label)
                            .join(" · ")}
                        </s-paragraph>
                      )}
                      <s-paragraph color="subdued">
                        Inventory checked: {product.inventory.evaluated}/
                        {product.inventory.total} variants. Score coverage:{" "}
                        {product.evaluatedWeight}/100 weight.
                      </s-paragraph>
                    </s-stack>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <s-paragraph>
            No analyzed products match your filters. Try another search or show
            all products.
          </s-paragraph>
        )}
        <div className="health-table-footer">
          <s-paragraph>
            {filtered.length
              ? `${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length} products`
              : "0 products"}
          </s-paragraph>
          <s-stack direction="inline" gap="small">
            <s-button
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </s-button>
            <s-button
              disabled={(currentPage + 1) * PAGE_SIZE >= filtered.length}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </s-button>
          </s-stack>
        </div>
      </s-stack>
    </s-section>
  );
}

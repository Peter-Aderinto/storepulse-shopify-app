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
          Lowest scores first. Select a product for its StorePulse analysis.
        </s-paragraph>
        <div className="health-controls">
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
        </div>
        {visible.length ? (
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header listSlot="primary">Product</s-table-header>
              <s-table-header listSlot="inline">Status</s-table-header>
              <s-table-header listSlot="labeled" format="numeric">
                Health
              </s-table-header>
              <s-table-header listSlot="secondary">Issues</s-table-header>
              <s-table-header listSlot="labeled">Action</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {visible.map((product) => (
                <s-table-row key={product.id}>
                  <s-table-cell>
                    <div className="health-product">
                      {product.image?.url && (
                        <s-thumbnail
                          src={product.image.url}
                          alt=""
                          size="small"
                        />
                      )}
                      <div className="health-product-copy">
                        <span className="health-product-name">
                          <s-link
                            href={`/app/products/${product.id.split("/").pop()}`}
                          >
                            {product.title || "Untitled product"}
                          </s-link>
                        </span>
                        <span className="health-muted">View analysis</span>
                      </div>
                    </div>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge>
                      {product.status.toLowerCase().replaceAll("_", " ")}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <span className="health-table-score">
                      {product.score} <span>/ 100</span>
                    </span>
                  </s-table-cell>
                  <s-table-cell>
                    <div className="health-row-copy">
                      <details className="health-disclosure">
                        <summary>
                          {product.issues.length
                            ? `${product.issues.length} issue ${product.issues.length === 1 ? "type" : "types"}`
                            : "No issues"}
                        </summary>
                        <s-paragraph>
                          {product.issues.length
                            ? product.issues
                                .map((issue) => issue.label)
                                .join(" · ")
                            : "No issues in evaluated checks."}
                        </s-paragraph>
                        <s-paragraph>
                          Inventory checked: {product.inventory.evaluated}/
                          {product.inventory.total} variants.
                        </s-paragraph>
                      </details>
                      <p className="health-muted">
                        Coverage {product.evaluatedWeight}/100
                      </p>
                    </div>
                  </s-table-cell>
                  <s-table-cell>
                    <s-link
                      href={`${adminBase}/products/${product.id.split("/").pop()}`}
                      target="_blank"
                      accessibilityLabel={`Open ${product.title || "product"} in Shopify Admin (new tab)`}
                    >
                      Shopify Admin
                    </s-link>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <div className="health-empty">
            <s-heading>No matching products</s-heading>
            <s-paragraph>
              Try a different search or turn off the issues-only filter.
            </s-paragraph>
          </div>
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

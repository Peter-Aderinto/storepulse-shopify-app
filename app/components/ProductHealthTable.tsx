import { scoreTone, issueTone } from "./health-colors";
import { useState } from "react";
import type { IssueCode, ProductHealth } from "../domain/catalog";

const ISSUE_LABELS: Record<IssueCode, string> = {
  description: "Description",
  image: "Imagery",
  alt: "Alt text",
  lowStock: "Low stock",
  outOfStock: "Out of stock",
  backorder: "Selling without stock",
  seoTitle: "SEO title",
  seoDescription: "SEO description",
};
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
    <section
      className="health-panel health-products"
      id="product-health"
      aria-labelledby="product-health-heading"
    >
      <s-stack direction="block" gap="base">
        <div className="health-product-toolbar">
          <h2 id="product-health-heading">Product health</h2>
          <s-search-field
            label="Search analyzed products"
            labelAccessibilityVisibility="exclusive"
            placeholder="Search products…"
            value={query}
            onInput={(event) => {
              setQuery(event.currentTarget.value);
              setPage(0);
            }}
          />
          <label className="sp-filter">
            <input
              type="checkbox"
              checked={onlyIssues}
              onChange={(event) => {
                setOnlyIssues(event.currentTarget.checked);
                setPage(0);
              }}
            />
            Issues only
          </label>
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
                          <a
                            className="sp-product-link"
                            href={`/app/products/${product.id.split("/").pop()}`}
                          >
                            {product.title || "Untitled product"}
                          </a>
                        </span>
                      </div>
                    </div>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge>
                      {product.status.toLowerCase().replaceAll("_", " ")}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <span
                      className="health-table-score"
                      data-tone={scoreTone(product.score)}
                    >
                      {product.score} <span>/ 100</span>
                    </span>
                  </s-table-cell>
                  <s-table-cell>
                    <div className="health-issue-tags">
                      {product.issues.length ? (
                        product.issues.slice(0, 2).map((issue) => (
                          <s-badge
                            key={issue.code}
                            tone={issueTone(issue.code)}
                          >
                            {ISSUE_LABELS[issue.code]}
                          </s-badge>
                        ))
                      ) : (
                        <span className="health-muted">No issues</span>
                      )}
                      {product.issues.length > 2 && (
                        <span className="health-muted">
                          +{product.issues.length - 2} more
                        </span>
                      )}
                    </div>
                    <details className="health-disclosure health-table-detail">
                      <summary>
                        Details · {product.evaluatedWeight}/100 coverage
                      </summary>
                      <s-paragraph>
                        {product.issues
                          .map((issue) => issue.label)
                          .join(" · ") || "No issues in evaluated checks."}
                      </s-paragraph>
                      <s-paragraph>
                        Inventory checked: {product.inventory.evaluated}/
                        {product.inventory.total} variants.
                      </s-paragraph>
                    </details>
                  </s-table-cell>
                  <s-table-cell>
                    <div className="health-table-actions">
                      <a
                        className="sp-analyze"
                        href={`/app/products/${product.id.split("/").pop()}`}
                        aria-label={`Analyze ${product.title || "product"} in StorePulse`}
                      >
                        Analyze <span aria-hidden="true">↗</span>
                      </a>
                      <a
                        className="sp-admin-link"
                        href={`${adminBase}/products/${product.id.split("/").pop()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${product.title || "product"} in Shopify Admin (new tab)`}
                      >
                        Shopify Admin ↗
                      </a>
                    </div>
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
    </section>
  );
}

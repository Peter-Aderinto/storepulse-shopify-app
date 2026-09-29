import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeProduct, type Product } from "../app/domain/catalog.ts";
import {
  analyzeProductDetail,
  toProductGid,
} from "../app/domain/product-analysis.ts";

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "gid://shopify/Product/123",
  title: "Test product",
  handle: "test",
  status: "ACTIVE",
  description: "A complete description",
  images: [
    { id: "i1", url: "https://example.com/image.png", altText: "Front view" },
  ],
  variants: [
    {
      id: "v1",
      title: "Small / Blue",
      quantity: 10,
      tracked: true,
      policy: "DENY",
    },
  ],
  seo: { title: "Custom title", description: "Custom description" },
  ...overrides,
});
function variant(
  quantity: number | null,
  tracked: boolean | null = true,
  policy = "DENY",
) {
  return product({
    variants: [{ id: "v1", title: "Small / Blue", quantity, tracked, policy }],
  });
}
const category = (p: Product, key: string) =>
  analyzeProductDetail(p).categories.find((c) => c.key === key)!;
test("healthy detail reuses Phase 1 score with full category credit and no recommendations", () => {
  const p = product(),
    detail = analyzeProductDetail(p);
  assert.deepEqual(detail.health, analyzeProduct(p));
  assert.equal(detail.health.score, 100);
  assert.equal(detail.categories.length, 5);
  assert.ok(detail.categories.every((c) => c.earned === 20));
  assert.deepEqual(detail.recommendations, []);
});
test("description and SEO description completeness remain independent", () => {
  const detail = analyzeProductDetail(product({ description: "" }));
  assert.equal(detail.completeness.descriptionPresent, false);
  assert.equal(detail.completeness.seoDescriptionPresent, true);
  assert.equal(detail.categories[0].earned, 0);
  assert.equal(detail.recommendations[0].code, "description");
  assert.equal(detail.recommendations[0].priority, "Medium");
});
test("image evidence identifies the exact images missing alt text", () => {
  const p = product();
  p.images.push({ id: "i2", url: "", altText: " \u200b" });
  const detail = analyzeProductDetail(p);
  assert.deepEqual(
    detail.images.filter((i) => i.missingAlt).map((i) => i.id),
    ["i2"],
  );
  assert.equal(detail.images[1].label, "Image 2");
  assert.equal(detail.categories[2].earned, 10);
  assert.equal(detail.recommendations[0].count, 1);
});
for (const [quantity, policy, state, code, priority] of [
  [3, "DENY", "low", "lowStock", "Low"],
  [0, "DENY", "out", "outOfStock", "High"],
  [-1, "CONTINUE", "backorder", "backorder", "Medium"],
] as const)
  test(`variant evidence and priority: ${state}`, () => {
    const detail = analyzeProductDetail(variant(quantity, true, policy));
    assert.equal(detail.variants[0].title, "Small / Blue");
    assert.equal(detail.variants[0].quantity, quantity);
    assert.equal(detail.variants[0].state, state);
    assert.equal(detail.recommendations[0].code, code);
    assert.equal(detail.recommendations[0].priority, priority);
  });
test("untracked inventory is not evaluated and produces no inventory recommendation", () => {
  const detail = analyzeProductDetail(variant(0, false));
  assert.equal(detail.health.score, 100);
  assert.equal(detail.variants[0].state, "untracked");
  assert.equal(category(variant(0, false), "inventory").earned, null);
  assert.match(
    category(variant(0, false), "inventory").explanation,
    /1 untracked/,
  );
  assert.equal(detail.recommendations.length, 0);
});
test("unknown quantities and policies stay excluded in detail", () => {
  for (const p of [
    variant(null),
    variant(0, null),
    variant(0, true, "UNKNOWN"),
  ]) {
    assert.equal(category(p, "inventory").earned, null);
    assert.equal(analyzeProductDetail(p).variants[0].state, "unknown");
  }
});
test("no variants is a factual not-evaluated state", () => {
  const p = product({ variants: [] });
  assert.equal(category(p, "inventory").earned, null);
  assert.match(category(p, "inventory").explanation, /0 variants/);
});
test("missing image fails imagery, excludes accessibility and recommends imagery at high priority", () => {
  const p = product({ images: [] }),
    d = analyzeProductDetail(p);
  assert.equal(category(p, "imagery").earned, 0);
  assert.equal(category(p, "accessibility").earned, null);
  assert.equal(d.health.score, 75);
  assert.equal(d.recommendations[0].priority, "High");
  assert.equal(d.recommendations[0].code, "image");
});
test("missing custom SEO yields separate recommendations and preserves fallback caveat", () => {
  const p = product({ seo: { title: null, description: "" } });
  const d = analyzeProductDetail(p);
  assert.equal(category(p, "seo").earned, 0);
  assert.equal(d.recommendations.length, 2);
  assert.ok(d.recommendations.every((r) => r.action.includes("fallback")));
});
test("partial SEO earns 10 out of 20, using the original checks", () => {
  const p = product({ seo: { title: "Title", description: null } });
  assert.equal(category(p, "seo").earned, 10);
  assert.equal(analyzeProductDetail(p).health.score, 90);
});
test("recommendations sort high, medium, low deterministically", () => {
  const p = variant(0);
  p.description = "";
  p.images = [];
  p.variants.push({
    id: "v2",
    title: "Other",
    quantity: 1,
    tracked: true,
    policy: "DENY",
  });
  const d = analyzeProductDetail(p);
  assert.deepEqual(
    d.recommendations.map((r) => r.priority),
    ["High", "High", "Medium", "Low"],
  );
  assert.deepEqual(analyzeProductDetail(p), d);
});
test("fractional category points retain full precision for scoring", () => {
  const p = product();
  p.images.push(
    { id: "i2", url: "", altText: null },
    { id: "i3", url: "", altText: null },
  );
  const d = analyzeProductDetail(p);
  assert.ok(Math.abs(category(p, "accessibility").earned! - 20 / 3) < 1e-12);
  assert.equal(d.health.score, analyzeProduct(p).score);
});
test("identifier conversion preserves precision above Number.MAX_SAFE_INTEGER", () => {
  assert.equal(
    toProductGid("9007199254740993"),
    "gid://shopify/Product/9007199254740993",
  );
});
test("invalid identifiers are rejected", () => {
  for (const id of [
    undefined,
    "",
    "0",
    "01",
    "-1",
    "1.5",
    "1e3",
    "abc",
    "123/456",
    "gid://shopify/Product/123",
    "18446744073709551616",
  ])
    assert.equal(toProductGid(id), null);
});

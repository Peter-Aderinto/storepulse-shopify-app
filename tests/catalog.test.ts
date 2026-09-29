import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateCatalog,
  analyzeProduct,
  type Product,
} from "../app/domain/catalog.ts";
// Synthetic unit-test fixtures only. Production reads Shopify.
function complete(overrides: Partial<Product> = {}): Product {
  return {
    id: "gid://shopify/Product/1",
    title: "Test",
    handle: "test",
    status: "ACTIVE",
    description: "Useful description",
    images: [
      { id: "i1", url: "https://example.com/image.png", altText: "Front view" },
    ],
    variants: [
      {
        id: "v1",
        title: "Default",
        quantity: 20,
        tracked: true,
        policy: "DENY",
      },
    ],
    seo: { title: "Title", description: "Description" },
    ...overrides,
  };
}
function inventory(
  quantity: number | null,
  tracked: boolean | null = true,
  policy = "DENY",
) {
  return complete({
    variants: [{ id: "v1", title: "Default", quantity, tracked, policy }],
  });
}
test("healthy product: 100, no issues", () => {
  const r = analyzeProduct(complete());
  assert.equal(r.score, 100);
  assert.equal(r.evaluatedWeight, 100);
  assert.deepEqual(r.issues, []);
});
test("empty/invisible description loses 20 points", () => {
  const r = analyzeProduct(complete({ description: " \n\u00a0\u200b" }));
  assert.equal(r.score, 80);
  assert.equal(r.issues[0].code, "description");
});
test("missing image penalizes imagery but excludes alt-text check", () => {
  const r = analyzeProduct(complete({ images: [] }));
  assert.equal(r.score, 75);
  assert.equal(r.evaluatedWeight, 80);
  assert.equal(r.issues.length, 1);
});
test("missing alt text loses 20 points", () => {
  const p = complete();
  p.images[0].altText = null;
  assert.equal(analyzeProduct(p).score, 80);
});
test("alt-text coverage is proportional", () => {
  const p = complete();
  p.images.push({ id: "i2", url: "", altText: "" });
  assert.equal(analyzeProduct(p).score, 90);
});
for (const q of [1, 5])
  test(`low stock at ${q} earns half inventory credit`, () => {
    const r = analyzeProduct(inventory(q));
    assert.equal(r.score, 90);
    assert.equal(r.inventory.low, 1);
  });
test("six units is above threshold", () =>
  assert.equal(analyzeProduct(inventory(6)).score, 100));
for (const q of [0, -2])
  test(`tracked quantity ${q} with overselling off is out of stock`, () => {
    const r = analyzeProduct(inventory(q));
    assert.equal(r.score, 80);
    assert.equal(r.inventory.entirelyOut, true);
  });
test("selling at zero is a backorder, not out of stock", () => {
  const r = analyzeProduct(inventory(0, true, "CONTINUE"));
  assert.equal(r.score, 90);
  assert.equal(r.inventory.out, 0);
  assert.equal(r.inventory.backorder, 1);
});
for (const [q, t] of [
  [null, true],
  [0, false],
  [0, null],
  [Number.NaN, true],
] as const)
  test(`unknown/untracked ${q}/${t} is excluded`, () => {
    const r = analyzeProduct(inventory(q, t));
    assert.equal(r.score, 100);
    assert.equal(r.evaluatedWeight, 80);
    assert.equal(r.issues.length, 0);
  });
test("unknown policy is excluded", () =>
  assert.equal(
    analyzeProduct(inventory(0, true, "UNKNOWN")).evaluatedWeight,
    80,
  ));
test("no variants excludes inventory", () =>
  assert.equal(analyzeProduct(complete({ variants: [] })).evaluatedWeight, 80));
test("one sold-out variant does not imply entire product unavailable", () => {
  const p = inventory(0);
  p.variants.push({
    id: "v2",
    title: "Other",
    quantity: 0,
    tracked: false,
    policy: "DENY",
  });
  const r = analyzeProduct(p);
  assert.equal(r.inventory.entirelyOut, false);
  assert.equal(r.inventory.evaluated, 1);
});
test("multiple issues are deterministic", () => {
  const p = inventory(0);
  p.description = "";
  p.images[0].altText = "";
  p.seo = { title: null, description: "" };
  const r = analyzeProduct(p);
  assert.equal(r.score, 20);
  assert.equal(r.issues.length, 5);
  assert.deepEqual(analyzeProduct(p), r);
});
test("SEO findings describe custom fields", () => {
  const r = analyzeProduct(
    complete({ seo: { title: null, description: null } }),
  );
  assert.equal(r.score, 80);
  assert.ok(r.issues.every((i) => i.label.startsWith("No custom SEO")));
});
test("store score is mean and worst products sort first", () => {
  const r = aggregateCatalog([complete(), { ...inventory(1), id: "2" }]);
  assert.equal(r.score, 95);
  assert.equal(r.products[0].score, 90);
});
test("summary deduplicates overlapping content and SEO findings", () => {
  const r = aggregateCatalog([
    complete({ description: "", seo: { title: "", description: "" } }),
  ]);
  assert.equal(r.counts.contentSeo, 1);
  assert.equal(r.counts.seo, 1);
  assert.equal(r.issueCount, 3);
});
test("empty catalog has no score", () => {
  const r = aggregateCatalog([]);
  assert.equal(r.score, null);
  assert.equal(r.analyzedCount, 0);
  assert.equal(r.counts.outOfStock, 0);
});

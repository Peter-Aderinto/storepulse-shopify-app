import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchProduct,
  CatalogError,
  type ApiProduct,
} from "../app/services/catalog.server.ts";
const connection = <T>(nodes: T[], endCursor: string | null = null) => ({
  nodes,
  pageInfo: { hasNextPage: endCursor !== null, endCursor },
});
const fixture = (): ApiProduct => ({
  id: "gid://shopify/Product/123",
  title: "Test",
  handle: "test",
  status: "ACTIVE",
  description: "",
  seo: { title: null, description: null },
  media: connection([]),
  variants: connection([]),
});
const reply = (product: unknown) =>
  Promise.resolve(Response.json({ data: { product } }));
const errorCode = (code: string) => (error: unknown) =>
  error instanceof CatalogError && error.code === code;
test("single-product query uses a variable-bound GID and no catalog scan", async () => {
  let calls = 0;
  const p = await fetchProduct((query, { variables }) => {
    calls++;
    assert.match(query, /query StorePulseProduct/);
    assert.deepEqual(variables, { id: "gid://shopify/Product/123" });
    return reply(fixture());
  }, "123");
  assert.equal(p?.id, "gid://shopify/Product/123");
  assert.equal(calls, 1);
});
test("missing/deleted product returns null", async () =>
  assert.equal(await fetchProduct(() => reply(null), "123"), null));
test("invalid identifier never calls Shopify", async () => {
  let called = false;
  await assert.rejects(
    fetchProduct(() => {
      called = true;
      return reply(null);
    }, "abc"),
    errorCode("invalid"),
  );
  assert.equal(called, false);
});
test("product missing from a malformed response is not a valid not-found", async () => {
  await assert.rejects(
    fetchProduct(async () => Response.json({ data: {} }), "123"),
    errorCode("invalid"),
  );
});
test("unexpected product ID is rejected", async () => {
  await assert.rejects(
    fetchProduct(
      () => reply({ ...fixture(), id: "gid://shopify/Product/456" }),
      "123",
    ),
    errorCode("invalid"),
  );
});
test("detail exhausts shared media and variant pagination", async () => {
  const p = fixture();
  p.media = connection(
    [{ __typename: "MediaImage", id: "i1", image: null, alt: null }],
    "media-next",
  );
  p.variants = connection(
    [
      {
        id: "v1",
        title: "One",
        inventoryQuantity: 0,
        inventoryPolicy: "DENY",
        inventoryItem: { tracked: true },
      },
    ],
    "variants-next",
  );
  const result = await fetchProduct((q, { variables }) => {
    if (q.includes("StorePulseMedia")) {
      assert.equal(variables.after, "media-next");
      return reply({
        media: connection([
          {
            __typename: "MediaImage",
            id: "i2",
            image: { url: "https://example.com/image.png" },
            alt: "Front",
          },
        ]),
      });
    }
    if (q.includes("StorePulseVariants"))
      return reply({
        variants: connection([
          {
            id: "v2",
            title: "Two",
            inventoryQuantity: 6,
            inventoryPolicy: "DENY",
            inventoryItem: { tracked: true },
          },
        ]),
      });
    return reply(p);
  }, "123");
  assert.equal(result?.images.length, 2);
  assert.equal(result?.variants.length, 2);
  assert.equal(result?.images[0].url, "");
});
test("deletion while fetching additional variants fails safely", async () => {
  const p = fixture();
  p.variants = connection(
    [
      {
        id: "v1",
        title: "One",
        inventoryQuantity: 0,
        inventoryPolicy: "DENY",
        inventoryItem: { tracked: true },
      },
    ],
    "next",
  );
  await assert.rejects(
    fetchProduct(
      (q) => reply(q.includes("StorePulseVariants") ? null : p),
      "123",
    ),
    errorCode("invalid"),
  );
});
for (const status of [401, 403, 429, 500])
  test(`detail handles HTTP ${status}`, async () => {
    await assert.rejects(
      fetchProduct(async () => new Response("", { status }), "123"),
      errorCode(
        status === 429
          ? "throttled"
          : status === 500
            ? "unavailable"
            : "permission",
      ),
    );
  });
test("detail preserves authentication redirect responses", async () => {
  const response = new Response(null, {
    status: 302,
    headers: { Location: "/auth" },
  });
  await assert.rejects(
    fetchProduct(async () => {
      throw response;
    }, "123"),
    (e) => e === response,
  );
});

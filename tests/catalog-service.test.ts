import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CatalogError,
  fetchCatalog,
  normalizeProduct,
  MAX_PRODUCTS,
  type ApiProduct,
  type GraphqlClient,
} from "../app/services/catalog.server.ts";
const connection = <T>(nodes: T[], cursor: string | null = null) => ({
  nodes,
  pageInfo: { hasNextPage: cursor !== null, endCursor: cursor },
});
const product = (id = "1"): ApiProduct => ({
  id,
  title: "Test",
  handle: "test",
  status: "ACTIVE",
  description: "",
  seo: { title: null, description: null },
  media: connection([]),
  variants: connection([]),
});
const reply = (data: unknown) => Promise.resolve(Response.json({ data }));
const isError = (code: CatalogError["code"]) => (error: unknown) =>
  error instanceof CatalogError && error.code === code;
test("normalization preserves unknown inventory", () => {
  const p = product();
  p.variants.nodes.push({
    id: "v1",
    title: "Default",
    inventoryQuantity: null,
    inventoryPolicy: "DENY",
    inventoryItem: null,
  });
  const r = normalizeProduct(p);
  assert.equal(r.variants[0].quantity, null);
  assert.equal(r.variants[0].tracked, null);
});
test("retrieves subsequent product, image, and variant pages", async () => {
  const p = product();
  p.media = connection(
    [{ __typename: "MediaImage", id: "i1", image: { url: "" }, alt: "first" }],
    "image-next",
  );
  p.variants = connection(
    [
      {
        id: "v1",
        title: "One",
        inventoryQuantity: 5,
        inventoryPolicy: "DENY",
        inventoryItem: { tracked: true },
      },
    ],
    "variant-next",
  );
  let calls = 0;
  const client: GraphqlClient = (query, { variables }) => {
    calls++;
    if (query.includes("query StorePulseMedia")) {
      assert.equal(variables.after, "image-next");
      return reply({
        product: {
          media: connection([
            {
              __typename: "MediaImage",
              id: "i2",
              image: { url: "" },
              alt: null,
            },
          ]),
        },
      });
    }
    if (query.includes("query StorePulseVariants"))
      return reply({
        product: {
          variants: connection([
            {
              id: "v2",
              title: "Two",
              inventoryQuantity: 0,
              inventoryPolicy: "DENY",
              inventoryItem: { tracked: true },
            },
          ]),
        },
      });
    return reply({
      productsCount: { count: 2, precision: "EXACT" },
      products: variables.after
        ? connection([product("2")])
        : connection([p], "product-next"),
    });
  };
  const r = await fetchCatalog(client);
  assert.equal(r.products.length, 2);
  assert.equal(r.products[0].images.length, 2);
  assert.equal(r.products[0].variants.length, 2);
  assert.equal(r.limited, false);
  assert.equal(calls, 4);
});
test("catalog cap is explicit", async () => {
  let count = 0;
  const r = await fetchCatalog((_query, { variables }) =>
    reply({
      productsCount: { count: 300, precision: "EXACT" },
      products: connection(
        Array.from({ length: variables.first as number }, () =>
          product(String(++count)),
        ),
        String(count),
      ),
    }),
  );
  assert.equal(r.products.length, MAX_PRODUCTS);
  assert.equal(r.limited, true);
  assert.equal(r.total.count, 300);
});
test("empty catalog is valid", async () => {
  const r = await fetchCatalog(() =>
    reply({
      productsCount: { count: 0, precision: "EXACT" },
      products: connection([]),
    }),
  );
  assert.deepEqual(r.products, []);
});
for (const status of [401, 403, 429, 500])
  test(`HTTP ${status} classified safely`, async () => {
    await assert.rejects(
      fetchCatalog(async () => new Response("", { status })),
      isError(
        status === 429
          ? "throttled"
          : status === 500
            ? "unavailable"
            : "permission",
      ),
    );
  });
test("partial GraphQL errors never turn into misleading scores", async () => {
  await assert.rejects(
    fetchCatalog(async () =>
      Response.json({
        data: { products: connection([]) },
        errors: [
          {
            message: "private upstream text",
            extensions: { code: "ACCESS_DENIED" },
          },
        ],
      }),
    ),
    isError("permission"),
  );
});
test("SDK-thrown throttling errors classified", async () => {
  await assert.rejects(
    fetchCatalog(async () => {
      throw {
        body: {
          errors: { graphQLErrors: [{ extensions: { code: "THROTTLED" } }] },
        },
      };
    }),
    isError("throttled"),
  );
});
test("Shopify auth redirects preserved", async () => {
  const redirect = new Response(null, {
    status: 302,
    headers: { Location: "/auth" },
  });
  await assert.rejects(
    fetchCatalog(async () => {
      throw redirect;
    }),
    (error) => error === redirect,
  );
});
test("aborted requests classified safely", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    fetchCatalog(async (_query, { signal }) => {
      signal.throwIfAborted();
      throw new Error("unreachable");
    }, controller.signal),
    isError("timeout"),
  );
});
test("malformed pagination fails instead of truncating", async () => {
  await assert.rejects(
    fetchCatalog(() =>
      reply({
        productsCount: { count: 2, precision: "EXACT" },
        products: {
          nodes: [product()],
          pageInfo: { hasNextPage: true, endCursor: null },
        },
      }),
    ),
    isError("invalid"),
  );
});
test("missing nested connections fail scan", async () => {
  await assert.rejects(
    fetchCatalog(() =>
      reply({
        productsCount: { count: 1, precision: "EXACT" },
        products: connection([{ ...product(), media: null }]),
      }),
    ),
    isError("invalid"),
  );
});
test("deleted product during pagination fails instead of scoring incomplete data", async () => {
  const p = product();
  p.variants = connection(
    [
      {
        id: "v1",
        title: "One",
        inventoryQuantity: 1,
        inventoryPolicy: "DENY",
        inventoryItem: { tracked: true },
      },
    ],
    "next",
  );
  await assert.rejects(
    fetchCatalog((query) =>
      query.includes("query StorePulseVariants")
        ? reply({ product: null })
        : reply({
            productsCount: { count: 1, precision: "EXACT" },
            products: connection([p]),
          }),
    ),
    isError("invalid"),
  );
});

test("SDK HTTP response code is classified as permission failure", async () => {
  await assert.rejects(
    fetchCatalog(async () => {
      throw { response: { code: 403 } };
    }),
    isError("permission"),
  );
});
test("video-only media does not count as product imagery", () => {
  const p = product();
  p.media.nodes.push({ __typename: "Video", id: "video-1" });
  assert.deepEqual(normalizeProduct(p).images, []);
});
test("processing image remains present even without a thumbnail URL", () => {
  const p = product();
  p.media.nodes.push({
    __typename: "MediaImage",
    id: "image-1",
    alt: "Product",
    image: null,
  });
  assert.equal(normalizeProduct(p).images.length, 1);
  assert.equal(normalizeProduct(p).images[0].url, "");
});

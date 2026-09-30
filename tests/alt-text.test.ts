import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAltText, validMediaId } from "../app/domain/alt-text.ts";
import { analyzeProductDetail } from "../app/domain/product-analysis.ts";
import {
  fetchProduct,
  type GraphqlClient,
} from "../app/services/catalog.server.ts";
import {
  updateImageAltText,
  handleAltTextAction,
} from "../app/services/alt-text.server.ts";
const mediaId = "gid://shopify/MediaImage/456";
const connection = (nodes: unknown[]) => ({
  nodes,
  pageInfo: { hasNextPage: false, endCursor: null },
});
function fixture(alt: string | null = null) {
  return {
    id: "gid://shopify/Product/123",
    title: "Demo",
    handle: "demo",
    status: "ACTIVE",
    description: "A sample product",
    seo: { title: "Demo", description: "Sample description" },
    media: connection([
      {
        __typename: "MediaImage",
        id: mediaId,
        alt,
        image: { url: "https://example.com/demo.png" },
      },
    ]),
    variants: connection([]),
  };
}
function mock(
  options: {
    alt?: string;
    product?: unknown;
    file?: unknown;
    mutation?: Response;
    readAfter?: Response;
  } = {},
) {
  let alt = options.alt ?? "";
  let writes = 0;
  const calls: { query: string; variables: Record<string, unknown> }[] = [];
  const graphql: GraphqlClient = async (query, { variables }) => {
    calls.push({ query, variables });
    if (query.includes("StorePulseUpdateImageAlt")) {
      writes++;
      if (options.mutation) return options.mutation;
      const files = variables.files as { id: string; alt: string }[];
      assert.deepEqual(Object.keys(files[0]).sort(), ["alt", "id"]);
      alt = files[0].alt;
      return Response.json({
        data: { fileUpdate: { files: [{ id: mediaId, alt }], userErrors: [] } },
      });
    }
    if (query.includes("StorePulseImageFile"))
      return Response.json({
        data: {
          node:
            "file" in options
              ? options.file
              : { id: mediaId, alt, fileStatus: "READY" },
        },
      });
    if (writes && options.readAfter) return options.readAfter;
    return Response.json({
      data: { product: "product" in options ? options.product : fixture(alt) },
    });
  };
  return {
    graphql,
    calls,
    get writes() {
      return writes;
    },
  };
}
const args = (graphql: GraphqlClient) => ({
  graphql,
  shop: "demo.myshopify.com",
  productId: "123",
  mediaId,
  altText: "  Demo bottle on white background  ",
  expectedAlt: "",
});
test("alt validation trims without truncating and counts Unicode characters", () => {
  assert.deepEqual(validateAltText("  Bottle  "), { ok: true, alt: "Bottle" });
  for (const input of ["", "  \n\t", "\u200b", null, 12])
    assert.equal(validateAltText(input).ok, false);
  assert.equal(validateAltText("😀".repeat(512)).ok, true);
  assert.equal(validateAltText("a".repeat(513)).ok, false);
});
test("media identifiers accept only canonical MediaImage UInt64 IDs", () => {
  assert.equal(validMediaId(mediaId), true);
  for (const id of [
    null,
    "456",
    "gid://shopify/Product/456",
    "gid://shopify/MediaImage/0",
    "gid://shopify/MediaImage/0456",
    "gid://shopify/MediaImage/18446744073709551616",
    `${mediaId}?shop=evil`,
  ])
    assert.equal(validMediaId(id), false);
});
test("explicit save writes only trimmed alt and authoritative reanalysis resolves the issue", async () => {
  const api = mock();
  const before = analyzeProductDetail(
    (await fetchProduct(api.graphql, "123"))!,
  );
  const result = await updateImageAltText(args(api.graphql));
  assert.equal(result.ok, true);
  assert.equal(result.verified, true);
  assert.equal(result.alt, "Demo bottle on white background");
  assert.equal(api.writes, 1);
  const after = analyzeProductDetail((await fetchProduct(api.graphql, "123"))!);
  assert.equal(before.images[0].missingAlt, true);
  assert.equal(after.images[0].missingAlt, false);
  assert.equal(before.health.checks.accessibility.earned, 0);
  assert.equal(after.health.checks.accessibility.earned, 20);
  assert.ok(after.health.score > before.health.score);
  assert.ok(before.recommendations.some((r) => r.code === "alt"));
  assert.ok(!after.recommendations.some((r) => r.code === "alt"));
});
for (const patch of [
  { productId: "invalid" },
  { mediaId: "invalid" },
  { altText: " " },
  { altText: "x".repeat(513) },
  { expectedAlt: null },
])
  test(`invalid save never queries Shopify: ${Object.keys(patch)[0]} ${String(Object.values(patch)[0]).length}`, async () => {
    const api = mock();
    assert.equal(
      (await updateImageAltText({ ...args(api.graphql), ...patch })).code,
      "invalid_input",
    );
    assert.equal(api.calls.length, 0);
  });
for (const [label, options, code] of [
  ["deleted product", { product: null }, "not_found"],
  [
    "image belongs to another product",
    { product: { ...fixture(), media: connection([]) } },
    "not_found",
  ],
  ["deleted file", { file: null }, "not_found"],
  ["wrong file type", { file: {} }, "not_found"],
  [
    "file processing",
    { file: { id: mediaId, alt: "", fileStatus: "PROCESSING" } },
    "not_ready",
  ],
  ["stale editor", { alt: "Changed elsewhere" }, "conflict"],
] as const)
  test(`${label} blocks mutation`, async () => {
    const api = mock(options);
    assert.equal((await updateImageAltText(args(api.graphql))).code, code);
    assert.equal(api.writes, 0);
  });
test("retry of already saved value is a verified no-op", async () => {
  const api = mock({ alt: "Demo bottle on white background" });
  assert.equal((await updateImageAltText(args(api.graphql))).code, "unchanged");
  assert.equal(api.writes, 0);
});
test("Shopify userErrors never expose upstream details or report success", async () => {
  const api = mock({
    mutation: Response.json({
      data: {
        fileUpdate: {
          files: [],
          userErrors: [{ code: "INVALID", message: "private upstream detail" }],
        },
      },
    }),
  });
  const result = await updateImageAltText(args(api.graphql));
  assert.equal(result.ok, false);
  assert.equal(result.code, "user_error");
  assert.doesNotMatch(JSON.stringify(result), /private upstream/);
});
for (const [status, code] of [
  [401, "permission"],
  [403, "permission"],
  [429, "throttled"],
  [500, "unavailable"],
] as const)
  test(`mutation HTTP ${status} returns safe ${code}`, async () => {
    const api = mock({ mutation: new Response("private detail", { status }) });
    const result = await updateImageAltText(args(api.graphql));
    assert.equal(result.ok, false);
    assert.equal(result.code, code);
    assert.equal(api.writes, 1);
    assert.doesNotMatch(JSON.stringify(result), /private detail/);
  });
for (const [code, expected] of [
  ["ACCESS_DENIED", "permission"],
  ["THROTTLED", "throttled"],
  ["INTERNAL_SERVER_ERROR", "unavailable"],
])
  test(`top-level GraphQL ${code} is handled`, async () => {
    const api = mock({
      mutation: Response.json({
        errors: [{ message: "private detail", extensions: { code } }],
      }),
    });
    const result = await updateImageAltText(args(api.graphql));
    assert.equal(result.code, expected);
    assert.doesNotMatch(JSON.stringify(result), /private detail/);
  });
test("network failure is not success and never retries the mutation", async () => {
  const api = mock();
  let writes = 0;
  const graphql: GraphqlClient = async (q, o) => {
    if (q.includes("StorePulseUpdateImageAlt")) {
      writes++;
      throw new Error("private detail");
    }
    return api.graphql(q, o);
  };
  const result = await updateImageAltText(args(graphql));
  assert.equal(result.code, "unavailable");
  assert.equal(writes, 1);
  assert.doesNotMatch(JSON.stringify(result), /private detail/);
});
test("malformed mutation response cannot claim a saved change", async () => {
  const api = mock({
    mutation: Response.json({
      data: { fileUpdate: { files: [], userErrors: [] } },
    }),
  });
  assert.equal((await updateImageAltText(args(api.graphql))).code, "invalid");
});
test("acknowledged write with failed reread is explicitly unverified", async () => {
  const api = mock({ readAfter: new Response("", { status: 500 }) });
  const result = await updateImageAltText(args(api.graphql));
  assert.equal(result.ok, true);
  assert.equal(result.verified, false);
  assert.match(result.message, /could not refresh/);
  assert.equal(api.writes, 1);
});
test("acknowledged write with stale reread never claims the issue is resolved", async () => {
  const api = mock({
    readAfter: Response.json({ data: { product: fixture() } }),
  });
  const result = await updateImageAltText(args(api.graphql));
  assert.equal(result.verified, false);
  assert.match(result.message, /does not confirm/);
});
test("authentication redirects propagate through the mutation boundary", async () => {
  const redirect = new Response(null, {
    status: 302,
    headers: { Location: "/auth" },
  });
  const api = mock();
  await assert.rejects(
    updateImageAltText(
      args(async (q, o) => {
        if (q.includes("StorePulseUpdateImageAlt")) throw redirect;
        return api.graphql(q, o);
      }),
    ),
    (e) => e === redirect,
  );
});
test("concurrent same-shop image saves are blocked and lock releases", async () => {
  const api = mock();
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = updateImageAltText(
    args(async (q, o) => {
      await wait;
      return api.graphql(q, o);
    }),
  );
  const duplicate = await updateImageAltText(args(api.graphql));
  assert.equal(duplicate.code, "busy");
  release();
  assert.equal((await first).ok, true);
  assert.equal(api.writes, 1);
  assert.equal((await updateImageAltText(args(api.graphql))).code, "unchanged");
});
function request(extra: Record<string, string> = {}) {
  return new Request("https://app.example/app/products/123", {
    method: "POST",
    body: new URLSearchParams({
      intent: "save-alt-text",
      mediaId,
      altText: "Bottle",
      expectedAlt: "",
      ...extra,
    }),
  });
}
test("unauthenticated action rejects before parsing or querying", async () => {
  const denied = new Response(null, { status: 401 });
  await assert.rejects(
    handleAltTextAction(request(), "123", async () => {
      throw denied;
    }),
    (e) => e === denied,
  );
});
test("action uses authenticated shop and route product rather than posted authority", async () => {
  const api = mock();
  let authenticated = false;
  const response = await handleAltTextAction(
    request({ productId: "999", shop: "evil.myshopify.com" }),
    "123",
    async () => {
      authenticated = true;
      return { shop: "demo.myshopify.com", graphql: api.graphql };
    },
  );
  assert.equal(authenticated, true);
  assert.equal((await response.json()).ok, true);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(api.calls[0].variables, { id: "gid://shopify/Product/123" });
});
test("action rejects unsupported intents and methods without querying", async () => {
  const api = mock();
  const auth = async () => ({
    shop: "demo.myshopify.com",
    graphql: api.graphql,
  });
  assert.equal(
    (await handleAltTextAction(request({ intent: "bulk-edit" }), "123", auth))
      .status,
    400,
  );
  assert.equal(
    (await handleAltTextAction(new Request("https://app.example"), "123", auth))
      .status,
    405,
  );
  assert.equal(api.calls.length, 0);
});

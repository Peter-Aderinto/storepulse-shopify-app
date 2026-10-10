import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSeo, type SeoDraft } from "../app/domain/seo.ts";
import { analyzeProductDetail } from "../app/domain/product-analysis.ts";
import {
  fetchProduct,
  type GraphqlClient,
} from "../app/services/catalog.server.ts";
import {
  updateProductSeo,
  saveSeoFromForm,
} from "../app/services/seo.server.ts";
import { handleRemediationAction } from "../app/services/remediation-action.server.ts";
import { handleProductUpdate } from "../app/services/product-webhook.server.ts";
const gid = "gid://shopify/Product/123";
const connection = (nodes: unknown[]) => ({
  nodes,
  pageInfo: { hasNextPage: false, endCursor: null },
});
function fixture(seo: { title: string | null; description: string | null }) {
  return {
    id: gid,
    title: "Fictional oil",
    handle: "fictional",
    status: "ACTIVE",
    description: "Sample product",
    seo,
    media: connection([
      {
        __typename: "MediaImage",
        id: "gid://shopify/MediaImage/456",
        alt: "Bottle",
        image: { url: "https://example.com/bottle.png" },
      },
    ]),
    variants: connection([]),
  };
}
function mock(
  options: {
    seo?: { title: string; description: string };
    product?: unknown;
    mutation?: Response;
    readAfter?: Response;
  } = {},
) {
  let seo = options.seo ?? { title: "", description: "" };
  let writes = 0;
  const calls: { query: string; variables: Record<string, unknown> }[] = [];
  const graphql: GraphqlClient = async (query, { variables }) => {
    calls.push({ query, variables });
    if (query.includes("StorePulseUpdateSeo")) {
      writes++;
      if (options.mutation) return options.mutation;
      const input = variables.product as { id: string; seo: typeof seo };
      assert.deepEqual(Object.keys(input).sort(), ["id", "seo"]);
      assert.equal(input.id, gid);
      assert.deepEqual(Object.keys(input.seo).sort(), ["description", "title"]);
      seo = input.seo;
      return Response.json({
        data: {
          productUpdate: {
            product: {
              id: gid,
              seo: {
                title: seo.title || null,
                description: seo.description || null,
              },
            },
            userErrors: [],
          },
        },
      });
    }
    if (writes && options.readAfter) return options.readAfter;
    return Response.json({
      data: { product: "product" in options ? options.product : fixture(seo) },
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
const draft = (patch: Partial<SeoDraft> = {}): SeoDraft => ({
  title: "Demo oil",
  description: "A fictional product for development.",
  expectedTitle: "",
  expectedDescription: "",
  clearTitle: false,
  clearDescription: false,
  ...patch,
});
const args = (graphql: GraphqlClient, edit = draft()) => ({
  graphql,
  shop: "demo.myshopify.com",
  productId: "123",
  draft: edit,
});
test("SEO trims edited values and rejects missing input types", () => {
  const result = validateSeo(
    draft({ title: "  Demo  ", description: "  Description  " }),
  );
  assert.ok(result.ok);
  assert.deepEqual(result.seo, { title: "Demo", description: "Description" });
  for (const value of [null, undefined, 123, new Blob()])
    assert.equal(validateSeo(draft({ title: value })).ok, false);
  assert.equal(validateSeo(draft({ expectedDescription: null })).ok, false);
});
test("title and description editor limits are enforced without truncation", () => {
  assert.equal(
    validateSeo(draft({ title: "😀".repeat(70), description: "x".repeat(320) }))
      .ok,
    true,
  );
  assert.equal(validateSeo(draft({ title: "x".repeat(71) })).ok, false);
  assert.equal(validateSeo(draft({ description: "x".repeat(321) })).ok, false);
});
test("accidental empty and invisible-only replacements do not clear existing SEO", () => {
  for (const title of ["", "  \n ", "\u200b"])
    assert.equal(
      validateSeo(draft({ title, expectedTitle: "Existing title" })).ok,
      false,
    );
  assert.equal(validateSeo(draft({ title: "\u200b" })).ok, false);
});
test("explicit clear produces an empty string and rejects a conflicting value", () => {
  const result = validateSeo(
    draft({ title: "", expectedTitle: "Existing", clearTitle: true }),
  );
  assert.ok(result.ok);
  assert.equal(result.seo.title, "");
  assert.equal(validateSeo(draft({ clearTitle: true })).ok, false);
});
test("untouched blank and legacy long sibling values are preserved", () => {
  const long = "x".repeat(400);
  const result = validateSeo(
    draft({ description: long, expectedDescription: long }),
  );
  assert.ok(result.ok);
  assert.equal(result.seo.description, long);
  const blank = validateSeo(draft({ description: "" }));
  assert.ok(blank.ok);
  assert.equal(blank.seo.description, "");
});
for (const field of ["title", "description"] as const)
  test(`save only ${field} preserves the sibling`, async () => {
    const existing = {
      title: "Existing title",
      description: "Existing description",
    };
    const api = mock({ seo: existing });
    const edit = draft({
      ...existing,
      expectedTitle: existing.title,
      expectedDescription: existing.description,
      [field]: "New value",
    });
    const result = await updateProductSeo(args(api.graphql, edit));
    assert.equal(result.ok, true);
    assert.equal(result.verified, true);
    assert.equal(api.writes, 1);
    const fresh = await fetchProduct(api.graphql, "123");
    assert.deepEqual(fresh?.seo, { ...existing, [field]: "New value" });
  });
test("save both fields rereads authoritative data and removes SEO findings with shared scoring", async () => {
  const api = mock();
  const before = analyzeProductDetail(
    (await fetchProduct(api.graphql, "123"))!,
  );
  const result = await updateProductSeo(args(api.graphql));
  assert.equal(result.ok, true);
  assert.equal(result.verified, true);
  const after = analyzeProductDetail((await fetchProduct(api.graphql, "123"))!);
  assert.equal(before.categories.find((c) => c.key === "seo")?.earned, 0);
  assert.equal(after.categories.find((c) => c.key === "seo")?.earned, 20);
  assert.equal(
    after.recommendations.filter(
      (r) => r.code === "seoTitle" || r.code === "seoDescription",
    ).length,
    0,
  );
  assert.ok(after.health.score > before.health.score);
  assert.deepEqual(after.seo, {
    title: "Demo oil",
    description: "A fictional product for development.",
  });
  assert.equal(api.writes, 1);
  assert.ok(
    api.calls.filter((c) => c.query.includes("StorePulseProduct")).length >= 3,
  );
});
test("existing current values are included in analysis for editor initialization", async () => {
  const api = mock({
    seo: { title: "Current title", description: "Current description" },
  });
  assert.deepEqual(
    analyzeProductDetail((await fetchProduct(api.graphql, "123"))!).seo,
    { title: "Current title", description: "Current description" },
  );
});
for (const field of ["title", "description"] as const)
  test(`explicit ${field} clear preserves sibling and reintroduces only the cleared finding`, async () => {
    const existing = {
      title: "Existing title",
      description: "Existing description",
    };
    const api = mock({ seo: existing });
    const result = await updateProductSeo(
      args(
        api.graphql,
        draft({
          ...existing,
          expectedTitle: existing.title,
          expectedDescription: existing.description,
          [field]: "",
          [field === "title" ? "clearTitle" : "clearDescription"]: true,
        }),
      ),
    );
    assert.equal(result.verified, true);
    const after = analyzeProductDetail(
      (await fetchProduct(api.graphql, "123"))!,
    );
    assert.equal(after.categories.find((c) => c.key === "seo")?.earned, 10);
    assert.equal(after.health.issues.length, 1);
  });
for (const patch of [
  { productId: "bad" },
  { productId: "gid://shopify/Product/123" },
  { draft: draft({ title: "x".repeat(71) }) },
  { draft: draft({ title: "", expectedTitle: "Existing" }) },
])
  test(`invalid SEO request makes no API calls: ${JSON.stringify(patch).slice(0, 55)}`, async () => {
    const api = mock();
    assert.equal(
      (await updateProductSeo({ ...args(api.graphql), ...patch })).code,
      "invalid_input",
    );
    assert.equal(api.calls.length, 0);
  });
test("missing product cannot mutate any resource", async () => {
  const api = mock({ product: null });
  assert.equal((await updateProductSeo(args(api.graphql))).code, "not_found");
  assert.equal(api.writes, 0);
});
test("unexpected cross-shop product ID is rejected before mutation", async () => {
  const api = mock({
    product: {
      ...fixture({ title: null, description: null }),
      id: "gid://shopify/Product/999",
    },
  });
  assert.equal((await updateProductSeo(args(api.graphql))).code, "invalid");
  assert.equal(api.writes, 0);
});
test("stale edit is rejected rather than overwriting changed SEO", async () => {
  const api = mock({ seo: { title: "Changed elsewhere", description: "" } });
  assert.equal((await updateProductSeo(args(api.graphql))).code, "conflict");
  assert.equal(api.writes, 0);
});
test("already-saved values return a verified no-op with no mutation", async () => {
  const api = mock({
    seo: {
      title: "Demo oil",
      description: "A fictional product for development.",
    },
  });
  assert.equal((await updateProductSeo(args(api.graphql))).code, "unchanged");
  assert.equal(api.writes, 0);
});
test("userErrors are safe and cannot claim success", async () => {
  const api = mock({
    mutation: Response.json({
      data: {
        productUpdate: {
          product: null,
          userErrors: [{ field: ["seo"], message: "private detail" }],
        },
      },
    }),
  });
  const result = await updateProductSeo(args(api.graphql));
  assert.equal(result.code, "user_error");
  assert.doesNotMatch(JSON.stringify(result), /private detail/);
});
for (const [status, code] of [
  [401, "permission"],
  [403, "permission"],
  [429, "throttled"],
  [500, "unavailable"],
] as const)
  test(`SEO handles HTTP ${status}`, async () => {
    const api = mock({ mutation: new Response("private detail", { status }) });
    const result = await updateProductSeo(args(api.graphql));
    assert.equal(result.code, code);
    assert.equal(result.ok, false);
    assert.equal(api.writes, 1);
    assert.doesNotMatch(JSON.stringify(result), /private detail/);
  });
for (const [code, expected] of [
  ["ACCESS_DENIED", "permission"],
  ["THROTTLED", "throttled"],
  ["INTERNAL_SERVER_ERROR", "unavailable"],
])
  test(`SEO handles GraphQL ${code}`, async () => {
    const api = mock({
      mutation: Response.json({
        errors: [{ message: "private detail", extensions: { code } }],
      }),
    });
    assert.equal((await updateProductSeo(args(api.graphql))).code, expected);
  });
test("network failure never triggers an automatic mutation retry", async () => {
  const api = mock();
  let writes = 0;
  const graphql: GraphqlClient = async (q, o) => {
    if (q.includes("StorePulseUpdateSeo")) {
      writes++;
      throw new Error("private detail");
    }
    return api.graphql(q, o);
  };
  const result = await updateProductSeo(args(graphql));
  assert.equal(result.code, "unavailable");
  assert.equal(writes, 1);
  assert.doesNotMatch(JSON.stringify(result), /private detail/);
});
test("authentication redirects propagate through the SEO service", async () => {
  const redirect = new Response(null, {
    status: 302,
    headers: { Location: "/auth" },
  });
  await assert.rejects(
    updateProductSeo(
      args(async () => {
        throw redirect;
      }),
    ),
    (e) => e === redirect,
  );
});
test("mutation response with wrong product or missing fields cannot claim a save", async () => {
  const api = mock({
    mutation: Response.json({
      data: {
        productUpdate: {
          product: { id: "gid://shopify/Product/999" },
          userErrors: [],
        },
      },
    }),
  });
  assert.equal((await updateProductSeo(args(api.graphql))).code, "invalid");
});
for (const [label, readAfter] of [
  ["failed", new Response("", { status: 500 })],
  [
    "stale",
    Response.json({
      data: { product: fixture({ title: null, description: null }) },
    }),
  ],
] as const)
  test(`acknowledged SEO with ${label} reread is explicitly unverified`, async () => {
    const api = mock({ readAfter });
    const result = await updateProductSeo(args(api.graphql));
    assert.equal(result.ok, true);
    assert.equal(result.verified, false);
    assert.match(result.message, /Refresh analysis/);
    assert.equal(api.writes, 1);
  });
test("duplicate concurrent SEO submission is blocked and the lock is released", async () => {
  const api = mock();
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = updateProductSeo(
    args(async (q, o) => {
      await wait;
      return api.graphql(q, o);
    }),
  );
  assert.equal((await updateProductSeo(args(api.graphql))).code, "busy");
  release();
  assert.equal((await first).ok, true);
  assert.equal(api.writes, 1);
  assert.equal((await updateProductSeo(args(api.graphql))).code, "unchanged");
});
function request(extra: Record<string, string> = {}) {
  return new Request("https://app.example/app/products/123", {
    method: "POST",
    body: new URLSearchParams({
      intent: "save-seo",
      seoTitle: "Demo oil",
      seoDescription: "A fictional product for development.",
      expectedTitle: "",
      expectedDescription: "",
      clearTitle: "false",
      clearDescription: "false",
      ...extra,
    }),
  });
}
test("shared dispatcher authenticates first and uses route/session authority", async () => {
  const api = mock();
  let auth = false;
  const response = await handleRemediationAction(
    request({ shop: "evil.myshopify.com", productId: "999" }),
    "123",
    async () => {
      auth = true;
      return { shop: "demo.myshopify.com", graphql: api.graphql };
    },
    {
      "save-seo": async (context) => {
        assert.equal(auth, true);
        assert.equal(context.shop, "demo.myshopify.com");
        return saveSeoFromForm(context);
      },
    },
  );
  assert.equal((await response.json()).ok, true);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(api.calls[0].variables, { id: gid });
});
test("unauthenticated SEO action is rejected before any handler", async () => {
  const denied = new Response(null, { status: 401 });
  await assert.rejects(
    handleRemediationAction(
      request(),
      "123",
      async () => {
        throw denied;
      },
      { "save-seo": async () => assert.fail("must not write") },
    ),
    (e) => e === denied,
  );
});
test("unknown and prototype intents cannot invoke a handler", async () => {
  const api = mock();
  for (const intent of ["delete-product", "__proto__", "constructor"])
    assert.equal(
      (
        await handleRemediationAction(
          request({ intent }),
          "123",
          async () => ({ shop: "demo.myshopify.com", graphql: api.graphql }),
          { "save-seo": saveSeoFromForm },
        )
      ).status,
      400,
    );
  assert.equal(api.calls.length, 0);
});
test("SEO-origin webhook goes through metadata processing without another mutation", async () => {
  const api = mock();
  assert.equal((await updateProductSeo(args(api.graphql))).ok, true);
  let recorded = 0;
  const result = await handleProductUpdate(
    new Request("https://app.example/webhooks/products/update", {
      method: "POST",
    }),
    async () => ({
      shop: "demo.myshopify.com",
      topic: "PRODUCTS_UPDATE",
      webhookId: "seo-delivery",
      eventId: "seo-event",
      payload: { id: 123, updated_at: "2026-09-30T12:00:00Z" },
    }),
    async (event) => {
      assert.equal(event.productId, gid);
      recorded++;
    },
  );
  assert.equal(result.status, 200);
  assert.equal(recorded, 1);
  assert.equal(api.writes, 1);
});

import type { GraphqlClient } from "./catalog.server.ts";

export type RemediationContext = {
  shop: string;
  graphql: GraphqlClient;
  productId: string | undefined;
  form: FormData;
  signal: AbortSignal;
};
export type RemediationAuthenticator = (
  request: Request,
) => Promise<{ shop: string; graphql: GraphqlClient }>;
type Result = { ok: boolean; code: string; message: string };
export async function handleRemediationAction(
  request: Request,
  productId: string | undefined,
  authenticate: RemediationAuthenticator,
  handlers: Record<string, (context: RemediationContext) => Promise<Result>>,
) {
  const { shop, graphql } = await authenticate(request);
  const headers = { "Cache-Control": "private, no-store" };
  const fail = (status: number, code: string, message: string) =>
    Response.json({ ok: false, code, message }, { status, headers });
  if (request.method !== "POST")
    return fail(
      405,
      "method",
      "Use an explicit Save action to update this product.",
    );
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(
      400,
      "invalid_input",
      "The save request could not be read. Please try again.",
    );
  }
  const intent = form.get("intent");
  if (typeof intent !== "string" || !Object.hasOwn(handlers, intent))
    return fail(400, "invalid_input", "Unknown product action.");
  const result = await handlers[intent]({
    shop,
    graphql,
    productId,
    form,
    signal: request.signal,
  });
  // Expected failures stay action data so the existing authoritative loader revalidates.
  return Response.json(result, { headers });
}

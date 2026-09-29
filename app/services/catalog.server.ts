import type { Product } from "../domain/catalog.ts";

export const MAX_PRODUCTS = 250;
const PAGE_SIZE = 10;
const TIMEOUT_MS = 45_000;
const MEDIA_FIELDS = "__typename ... on MediaImage { id alt image { url } }";
const VARIANT_FIELDS =
  "id title inventoryQuantity inventoryPolicy inventoryItem { tracked }";
export const CATALOG_QUERY = `#graphql
  query StorePulseCatalog($first: Int!, $after: String, $includeCount: Boolean!) {
    productsCount @include(if: $includeCount) { count precision }
    products(first: $first, after: $after, sortKey: ID) {
      nodes {
        id title handle status description
        seo { title description }
        media(first: 10) { nodes { ${MEDIA_FIELDS} } pageInfo { hasNextPage endCursor } }
        variants(first: 10) { nodes { ${VARIANT_FIELDS} } pageInfo { hasNextPage endCursor } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;
export const MEDIA_QUERY = `#graphql
  query StorePulseMedia($id: ID!, $after: String!) {
    product(id: $id) { media(first: 100, after: $after) { nodes { ${MEDIA_FIELDS} } pageInfo { hasNextPage endCursor } } }
  }`;
export const VARIANTS_QUERY = `#graphql
  query StorePulseVariants($id: ID!, $after: String!) {
    product(id: $id) { variants(first: 100, after: $after) { nodes { ${VARIANT_FIELDS} } pageInfo { hasNextPage endCursor } } }
  }`;
export type GraphqlClient = (
  query: string,
  options: { variables: Record<string, unknown>; signal: AbortSignal },
) => Promise<Response>;
type Connection<T> = {
  nodes: T[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};
type Media = {
  __typename: string;
  id?: string;
  alt?: string | null;
  image?: { url: string } | null;
};
type Variant = {
  id: string;
  title: string;
  inventoryQuantity: number | null;
  inventoryPolicy: string;
  inventoryItem: { tracked: boolean } | null;
};
export interface ApiProduct {
  id: string;
  title: string;
  handle: string;
  status: string;
  description: string;
  seo: Product["seo"];
  media: Connection<Media>;
  variants: Connection<Variant>;
}
export class CatalogError extends Error {
  code: "permission" | "throttled" | "timeout" | "unavailable" | "invalid";
  constructor(code: CatalogError["code"]) {
    super(code);
    this.name = "CatalogError";
    this.code = code;
  }
}
export function normalizeProduct(product: ApiProduct): Product {
  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    status: product.status,
    description: product.description,
    images: product.media.nodes
      .filter((m) => m.__typename === "MediaImage")
      .map((m) => ({
        id: m.id!,
        url: m.image?.url ?? "",
        altText: m.alt ?? null,
      })),
    seo: product.seo,
    variants: product.variants.nodes.map((v) => ({
      id: v.id,
      title: v.title,
      quantity: v.inventoryQuantity,
      policy: v.inventoryPolicy,
      tracked: v.inventoryItem?.tracked ?? null,
    })),
  };
}
function validateConnection<T>(connection: Connection<T>) {
  if (
    !connection ||
    !Array.isArray(connection.nodes) ||
    typeof connection.pageInfo?.hasNextPage !== "boolean"
  )
    throw new CatalogError("invalid");
  return connection;
}
function nextCursor<T>(connection: Connection<T>, previous: string | null) {
  if (!connection.pageInfo.hasNextPage) return null;
  const cursor = connection.pageInfo.endCursor;
  if (!cursor || cursor === previous || !connection.nodes.length)
    throw new CatalogError("invalid");
  return cursor;
}

export async function fetchCatalog(
  graphql: GraphqlClient,
  requestSignal?: AbortSignal,
) {
  const signal = requestSignal
    ? AbortSignal.any([requestSignal, AbortSignal.timeout(TIMEOUT_MS)])
    : AbortSignal.timeout(TIMEOUT_MS);
  async function query<T>(
    document: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    try {
      const response = await graphql(document, { variables, signal });
      if (response.status === 401 || response.status === 403)
        throw new CatalogError("permission");
      if (response.status === 429) throw new CatalogError("throttled");
      if (!response.ok) throw new CatalogError("unavailable");
      const body = await response.json();
      if (body.errors?.length) {
        const codes = body.errors.map(
          (e: { extensions?: { code?: string } }) => e.extensions?.code,
        );
        throw new CatalogError(
          codes.includes("ACCESS_DENIED")
            ? "permission"
            : codes.includes("THROTTLED")
              ? "throttled"
              : "unavailable",
        );
      }
      if (!body.data) throw new CatalogError("invalid");
      return body.data as T;
    } catch (error) {
      if (error instanceof Response || error instanceof CatalogError)
        throw error;
      if (signal.aborted) throw new CatalogError("timeout");
      // Shopify's client throws on GraphQL failures; inspect only error codes, never return raw errors/tokens.
      const failure = error as {
        response?: { status?: number; code?: number };
        body?: {
          errors?: { graphQLErrors?: { extensions?: { code?: string } }[] };
        };
      };
      const codes =
        failure.body?.errors?.graphQLErrors?.map((e) => e.extensions?.code) ??
        [];
      if (
        [401, 403].includes(
          failure.response?.status ?? failure.response?.code ?? 0,
        ) ||
        codes.includes("ACCESS_DENIED")
      )
        throw new CatalogError("permission");
      if (
        (failure.response?.status ?? failure.response?.code) === 429 ||
        codes.includes("THROTTLED")
      )
        throw new CatalogError("throttled");
      throw new CatalogError("unavailable");
    }
  }
  const products: Product[] = [];
  let after: string | null = null;
  let total: { count: number; precision: string } | null = null;
  let hasMore = false;
  const seen = new Set<string>();
  do {
    const data: {
      products: Connection<ApiProduct>;
      productsCount?: { count: number; precision: string };
    } = await query(CATALOG_QUERY, {
      first: Math.min(PAGE_SIZE, MAX_PRODUCTS - products.length),
      after,
      includeCount: total === null,
    });
    validateConnection(data.products);
    if (!total) {
      if (!data.productsCount || !Number.isFinite(data.productsCount.count))
        throw new CatalogError("invalid");
      total = data.productsCount;
    }
    for (const product of data.products.nodes) {
      if (seen.has(product.id)) throw new CatalogError("invalid");
      seen.add(product.id);
      validateConnection(product.media);
      validateConnection(product.variants);
      let mediaAfter = nextCursor(product.media, null);
      const mediaCursors = new Set<string>();
      while (mediaAfter) {
        if (mediaCursors.has(mediaAfter)) throw new CatalogError("invalid");
        mediaCursors.add(mediaAfter);
        const more: { product: { media: Connection<Media> } | null } =
          await query(MEDIA_QUERY, { id: product.id, after: mediaAfter });
        if (!more.product) throw new CatalogError("invalid");
        const connection = validateConnection(more.product.media);
        product.media.nodes.push(...connection.nodes);
        mediaAfter = nextCursor(connection, mediaAfter);
      }
      let variantAfter = nextCursor(product.variants, null);
      const variantCursors = new Set<string>();
      while (variantAfter) {
        if (variantCursors.has(variantAfter)) throw new CatalogError("invalid");
        variantCursors.add(variantAfter);
        const more: { product: { variants: Connection<Variant> } | null } =
          await query(VARIANTS_QUERY, { id: product.id, after: variantAfter });
        if (!more.product) throw new CatalogError("invalid");
        const connection = validateConnection(more.product.variants);
        product.variants.nodes.push(...connection.nodes);
        variantAfter = nextCursor(connection, variantAfter);
      }
      products.push(normalizeProduct(product));
    }
    after = nextCursor(data.products, after);
    hasMore = after !== null;
  } while (hasMore && products.length < MAX_PRODUCTS);
  return {
    products,
    total: total!,
    limited: hasMore,
    scannedAt: new Date().toISOString(),
  };
}

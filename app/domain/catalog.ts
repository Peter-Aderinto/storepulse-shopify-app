export const LOW_STOCK_THRESHOLD = 5;
export const SCORE_WEIGHTS = {
  description: 20,
  imagery: 20,
  accessibility: 20,
  inventory: 20,
  seoTitle: 10,
  seoDescription: 10,
} as const;
export type Category = "content" | "accessibility" | "inventory" | "seo";
export type IssueCode =
  | "description"
  | "image"
  | "alt"
  | "lowStock"
  | "outOfStock"
  | "backorder"
  | "seoTitle"
  | "seoDescription";
export interface Product {
  id: string;
  title: string;
  handle: string;
  status: string;
  description: string;
  images: { id: string; url: string; altText: string | null }[];
  variants: {
    id: string;
    title: string;
    quantity: number | null;
    tracked: boolean | null;
    policy: string;
  }[];
  seo: { title: string | null; description: string | null };
}
export interface Issue {
  code: IssueCode;
  category: Category;
  label: string;
  count: number;
}
export interface ProductHealth {
  id: string;
  title: string;
  handle: string;
  status: string;
  image: Product["images"][number] | null;
  score: number;
  evaluatedWeight: number;
  issues: Issue[];
  inventory: {
    evaluated: number;
    total: number;
    untracked: number;
    unknown: number;
    out: number;
    low: number;
    backorder: number;
    entirelyOut: boolean;
  };
}
export const hasText = (text: string | null | undefined) =>
  Boolean(text?.replace(/[\s\u200B-\u200D\uFEFF]/g, ""));

export function analyzeProduct(product: Product): ProductHealth {
  const issues: Issue[] = [];
  const add = (code: IssueCode, category: Category, label: string, count = 1) =>
    issues.push({ code, category, label, count });
  const description = hasText(product.description);
  if (!description) add("description", "content", "Missing description");
  const imagery = product.images.length > 0;
  if (!imagery) add("image", "content", "Missing product image");
  const missingAlt = product.images.filter(
    (image) => !hasText(image.altText),
  ).length;
  if (missingAlt)
    add(
      "alt",
      "accessibility",
      `${missingAlt} image${missingAlt === 1 ? "" : "s"} missing alt text`,
      missingAlt,
    );
  if (!hasText(product.seo.title))
    add("seoTitle", "seo", "No custom SEO title");
  if (!hasText(product.seo.description))
    add("seoDescription", "seo", "No custom SEO description");

  const inventory = {
    evaluated: 0,
    total: product.variants.length,
    untracked: 0,
    unknown: 0,
    out: 0,
    low: 0,
    backorder: 0,
    entirelyOut: false,
  };
  let inventoryPoints = 0;
  for (const variant of product.variants) {
    if (variant.tracked === false) {
      inventory.untracked++;
      continue;
    }
    if (
      variant.tracked !== true ||
      variant.quantity === null ||
      !Number.isFinite(variant.quantity) ||
      !["DENY", "CONTINUE"].includes(variant.policy)
    ) {
      inventory.unknown++;
      continue;
    }
    inventory.evaluated++;
    if (variant.quantity <= 0) {
      if (variant.policy === "CONTINUE") {
        inventory.backorder++;
        inventoryPoints += 0.5;
      } else inventory.out++;
    } else if (variant.quantity <= LOW_STOCK_THRESHOLD) {
      inventory.low++;
      inventoryPoints += 0.5;
    } else inventoryPoints++;
  }
  inventory.entirelyOut =
    inventory.total > 0 && inventory.out === inventory.total;
  if (inventory.out)
    add(
      "outOfStock",
      "inventory",
      inventory.entirelyOut
        ? "All variants out of stock"
        : `${inventory.out} variant${inventory.out === 1 ? "" : "s"} out of stock`,
      inventory.out,
    );
  if (inventory.low)
    add(
      "lowStock",
      "inventory",
      `${inventory.low} low-stock variant${inventory.low === 1 ? "" : "s"}`,
      inventory.low,
    );
  if (inventory.backorder)
    add(
      "backorder",
      "inventory",
      `${inventory.backorder} variant${inventory.backorder === 1 ? "" : "s"} selling without stock`,
      inventory.backorder,
    );

  // A null result is not evaluated and its weight leaves the denominator.
  const checks: Record<keyof typeof SCORE_WEIGHTS, number | null> = {
    description: Number(description),
    imagery: Number(imagery),
    accessibility: imagery
      ? (product.images.length - missingAlt) / product.images.length
      : null,
    inventory: inventory.evaluated
      ? inventoryPoints / inventory.evaluated
      : null,
    seoTitle: Number(hasText(product.seo.title)),
    seoDescription: Number(hasText(product.seo.description)),
  };
  let earned = 0,
    evaluatedWeight = 0;
  for (const key of Object.keys(
    SCORE_WEIGHTS,
  ) as (keyof typeof SCORE_WEIGHTS)[]) {
    const value = checks[key];
    if (value !== null) {
      earned += value * SCORE_WEIGHTS[key];
      evaluatedWeight += SCORE_WEIGHTS[key];
    }
  }
  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    status: product.status,
    image: product.images[0] ?? null,
    score: Math.round((100 * earned) / evaluatedWeight),
    evaluatedWeight,
    issues,
    inventory,
  };
}

export function aggregateCatalog(products: Product[]) {
  const analyzed = products
    .map(analyzeProduct)
    .sort(
      (a, b) =>
        a.score - b.score ||
        b.issues.length - a.issues.length ||
        a.id.localeCompare(b.id),
    );
  const count = (code: IssueCode) =>
    analyzed.filter((p) => p.issues.some((i) => i.code === code)).length;
  return {
    products: analyzed,
    score: analyzed.length
      ? Math.round(
          analyzed.reduce((sum, product) => sum + product.score, 0) /
            analyzed.length,
        )
      : null,
    analyzedCount: analyzed.length,
    issueCount: analyzed.reduce(
      (sum, product) => sum + product.issues.length,
      0,
    ),
    productsWithIssues: analyzed.filter((p) => p.issues.length > 0).length,
    counts: {
      description: count("description"),
      image: count("image"),
      alt: count("alt"),
      lowStock: count("lowStock"),
      outOfStock: count("outOfStock"),
      backorder: count("backorder"),
      seo: analyzed.filter((p) => p.issues.some((i) => i.category === "seo"))
        .length,
      contentSeo: analyzed.filter((p) =>
        p.issues.some((i) => i.category === "content" || i.category === "seo"),
      ).length,
    },
    inventoryCoverage: {
      products: analyzed.filter((p) => p.inventory.evaluated > 0).length,
      evaluated: analyzed.reduce((sum, p) => sum + p.inventory.evaluated, 0),
      total: analyzed.reduce((sum, p) => sum + p.inventory.total, 0),
      unknown: analyzed.reduce((sum, p) => sum + p.inventory.unknown, 0),
      untracked: analyzed.reduce((sum, p) => sum + p.inventory.untracked, 0),
    },
  };
}
export type CatalogHealth = ReturnType<typeof aggregateCatalog>;

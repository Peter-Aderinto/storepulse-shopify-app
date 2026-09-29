import {
  analyzeProduct,
  evaluateVariant,
  hasText,
  type Issue,
  type IssueCode,
  type Product,
} from "./catalog.ts";

export function toProductGid(id: string | undefined): string | null {
  if (!id || !/^[1-9]\d{0,19}$/.test(id) || BigInt(id) > 18446744073709551615n)
    return null;
  return `gid://shopify/Product/${id}`;
}
export type Priority = "High" | "Medium" | "Low";
const RULES: Record<IssueCode, { priority: Priority; action: string }> = {
  outOfStock: {
    priority: "High",
    action: "Restock or review sold-out variants that cannot continue selling.",
  },
  image: {
    priority: "High",
    action: "Add clear product imagery so shoppers can evaluate this product.",
  },
  description: {
    priority: "Medium",
    action:
      "Add a description explaining the product and its essential details.",
  },
  alt: {
    priority: "Medium",
    action:
      "Add useful alt text to the affected images. Decorative images may intentionally have empty alt text.",
  },
  backorder: {
    priority: "Medium",
    action:
      "Review variants selling without stock and confirm delivery expectations. Continued selling may be intentional.",
  },
  seoTitle: {
    priority: "Medium",
    action:
      "Consider a custom SEO title. Shopify may already supply fallback metadata.",
  },
  seoDescription: {
    priority: "Medium",
    action:
      "Consider a custom SEO description. Shopify may already supply fallback metadata.",
  },
  lowStock: {
    priority: "Low",
    action:
      "Review low-stock variants before promotion; the fixed threshold is 1–5 units.",
  },
};
export function recommendationsFor(issues: Issue[]) {
  const rank = { High: 0, Medium: 1, Low: 2 };
  return issues
    .map((issue) => ({
      code: issue.code,
      evidence: issue.label,
      count: issue.count,
      ...RULES[issue.code],
    }))
    .sort(
      (a, b) =>
        rank[a.priority] - rank[b.priority] || a.code.localeCompare(b.code),
    );
}
export function analyzeProductDetail(product: Product) {
  const health = analyzeProduct(product);
  const images = product.images.map((image, index) => ({
    ...image,
    label: `Image ${index + 1}`,
    missingAlt: !hasText(image.altText),
  }));
  const variants = product.variants.map((variant) => ({
    id: variant.id,
    title: variant.title,
    quantity:
      variant.quantity !== null && Number.isFinite(variant.quantity)
        ? variant.quantity
        : null,
    policy: variant.policy,
    ...evaluateVariant(variant),
  }));
  const descriptionPresent = hasText(product.description);
  const seo = {
    titlePresent: hasText(product.seo.title),
    descriptionPresent: hasText(product.seo.description),
  };
  const checks = health.checks;
  const missingAlt = images.filter((image) => image.missingAlt).length;
  const categories = [
    {
      key: "content",
      label: "Content",
      earned: checks.description.earned,
      weight: checks.description.weight,
      explanation: descriptionPresent
        ? "Product description is present."
        : "Product description is empty or contains only whitespace.",
    },
    {
      key: "imagery",
      label: "Imagery",
      earned: checks.imagery.earned,
      weight: checks.imagery.weight,
      explanation: images.length
        ? `${images.length} product image${images.length === 1 ? "" : "s"} present.`
        : "No product image media found. Videos do not replace the image check.",
    },
    {
      key: "accessibility",
      label: "Accessibility",
      earned: checks.accessibility.earned,
      weight: checks.accessibility.weight,
      explanation: images.length
        ? `${missingAlt} of ${images.length} images are missing alt text. Presence alone does not assess quality.`
        : "Not evaluated because there are no product images. Missing imagery is counted only in Imagery.",
    },
    {
      key: "inventory",
      label: "Inventory",
      earned: checks.inventory.earned,
      weight: checks.inventory.weight,
      explanation: health.inventory.evaluated
        ? `${health.inventory.evaluated} of ${health.inventory.total} variants evaluated. ${health.inventory.out} out of stock; ${health.inventory.low} low stock; ${health.inventory.backorder} selling without stock. ${health.inventory.untracked} untracked and ${health.inventory.unknown} unavailable excluded.`
        : `Not evaluated: ${health.inventory.untracked} untracked and ${health.inventory.unknown} unavailable variants; ${health.inventory.total} variants in total. No inventory penalty applies.`,
    },
    {
      key: "seo",
      label: "Custom SEO",
      earned:
        (checks.seoTitle.earned ?? 0) + (checks.seoDescription.earned ?? 0),
      weight: checks.seoTitle.weight + checks.seoDescription.weight,
      explanation: `Custom title ${seo.titlePresent ? "present" : "blank"} (10 points); custom description ${seo.descriptionPresent ? "present" : "blank"} (10 points). Blank custom fields may use Shopify fallback metadata.`,
    },
  ];
  return {
    health,
    categories,
    images,
    variants,
    completeness: {
      descriptionPresent,
      seoTitlePresent: seo.titlePresent,
      seoDescriptionPresent: seo.descriptionPresent,
    },
    recommendations: recommendationsFor(health.issues),
  };
}
export type ProductAnalysis = ReturnType<typeof analyzeProductDetail>;

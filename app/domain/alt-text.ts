import { hasText } from "./catalog.ts";
import { toProductGid } from "./product-analysis.ts";

export const ALT_TEXT_LIMIT = 512;
export function validateAltText(value: unknown) {
  if (typeof value !== "string" || !hasText(value))
    return {
      ok: false as const,
      message: "Enter descriptive alt text before saving.",
    };
  const alt = value.trim();
  if (Array.from(alt).length > ALT_TEXT_LIMIT)
    return {
      ok: false as const,
      message:
        "Alt text must be 512 characters or fewer. Your text has not been shortened.",
    };
  return { ok: true as const, alt };
}
export function validMediaId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^gid:\/\/shopify\/MediaImage\/([1-9]\d{0,19})$/.exec(value);
  return Boolean(match && toProductGid(match[1]));
}
export type AltTextResult = {
  ok: boolean;
  code: string;
  message: string;
  mediaId?: string;
  alt?: string;
  verified?: boolean;
};

import type { IssueCode } from "../domain/catalog";

// Presentation only: retain the existing 60/85 health display bands.
export function scoreTone(score: number | null) {
  return score === null
    ? "neutral"
    : score < 60
      ? "critical"
      : score < 85
        ? "warning"
        : "success";
}
export function issueTone(code: IssueCode) {
  return code === "backorder" ? "warning" : "critical";
}

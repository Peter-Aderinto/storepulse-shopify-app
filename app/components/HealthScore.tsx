import { scoreTone } from "./health-colors";
export function HealthScore({
  score,
  label,
}: {
  score: number | null;
  label: string;
}) {
  const status =
    score === null
      ? "Not evaluated"
      : score >= 85
        ? "Strong foundation"
        : score >= 60
          ? "Room to improve"
          : "Needs attention";
  return (
    <div className="health-score-component" data-tone={scoreTone(score)}>
      <div className="health-score-line">
        <div
          className="health-score"
          aria-label={`${label}: ${score === null ? "not evaluated" : `${score} out of 100`}`}
        >
          {score ?? "—"}
          <span>/ 100</span>
        </div>
        <s-badge tone={scoreTone(score)}>{status}</s-badge>
      </div>
      {score !== null && (
        <meter
          className="health-score-bar"
          min={0}
          max={100}
          value={score}
          aria-label={label}
        >
          {score} out of 100
        </meter>
      )}
    </div>
  );
}

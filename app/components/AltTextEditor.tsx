import { useEffect, useId, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { validateAltText, type AltTextResult } from "../domain/alt-text";

export function AltTextEditor({
  productId,
  mediaId,
  currentAlt,
  imageLabel,
}: {
  productId: string;
  mediaId: string;
  currentAlt: string | null;
  imageLabel: string;
}) {
  const fetcher = useFetcher<AltTextResult>();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentAlt ?? "");
  const [expectedAlt, setExpectedAlt] = useState(currentAlt ?? "");
  const [error, setError] = useState("");
  const submitted = useRef(false);
  const fieldId = useId();
  const saving = fetcher.state !== "idle";
  useEffect(() => {
    if (fetcher.state !== "idle") return;
    submitted.current = false;
    if (fetcher.data?.ok) setEditing(false);
  }, [fetcher.state, fetcher.data]);
  const result =
    fetcher.data?.mediaId === mediaId || !fetcher.data?.mediaId
      ? fetcher.data
      : undefined;
  return (
    <div className="sp-alt-editor">
      {!editing ? (
        <button
          type="button"
          className="sp-analyze"
          onClick={() => {
            setDraft(currentAlt ?? "");
            setExpectedAlt(currentAlt ?? "");
            setError("");
            setEditing(true);
          }}
        >
          {currentAlt?.trim() ? "Edit alt text" : "Add alt text"}
        </button>
      ) : (
        <fetcher.Form
          method="post"
          action={`/app/products/${productId.split("/").pop()}`}
          onSubmit={(event) => {
            if (submitted.current || saving) {
              event.preventDefault();
              return;
            }
            const validated = validateAltText(draft);
            if (!validated.ok) {
              event.preventDefault();
              setError(validated.message);
              return;
            }
            setError("");
            submitted.current = true;
          }}
        >
          <input type="hidden" name="intent" value="save-alt-text" />
          <input type="hidden" name="mediaId" value={mediaId} />
          <input type="hidden" name="expectedAlt" value={expectedAlt} />
          <label htmlFor={fieldId}>Alt text for {imageLabel}</label>
          <textarea
            id={fieldId}
            name="altText"
            value={draft}
            rows={3}
            disabled={saving}
            aria-invalid={Boolean(error || (result && !result.ok))}
            aria-describedby={`${fieldId}-help ${fieldId}-feedback`}
            onChange={(event) => {
              setDraft(event.currentTarget.value);
              setError("");
            }}
          />
          <p id={`${fieldId}-help`} className="health-muted">
            Up to 512 characters. Save changes this Shopify file&apos;s alt text
            wherever it is reused. No other field is changed.
          </p>
          <div className="sp-alt-actions">
            <button
              type="submit"
              className="sp-button sp-button-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save alt text"}
            </button>
            <button
              type="button"
              className="sp-analyze"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setError("");
              }}
            >
              Cancel
            </button>
          </div>
        </fetcher.Form>
      )}
      <div
        id={`${fieldId}-feedback`}
        role={error || (result && !result.ok) ? "alert" : "status"}
        aria-live="polite"
        className="sp-alt-feedback"
      >
        {saving
          ? "Saving to Shopify and refreshing analysis…"
          : error || (!editing || !result?.ok ? result?.message : "")}
      </div>
    </div>
  );
}

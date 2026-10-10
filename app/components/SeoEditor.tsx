import { useEffect, useId, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { hasText } from "../domain/catalog";
import { SEO_LIMITS, validateSeo, type SeoResult } from "../domain/seo";

export function SeoEditor({
  productId,
  seo,
}: {
  productId: string;
  seo: { title: string | null; description: string | null };
}) {
  const fetcher = useFetcher<SeoResult>();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: seo.title ?? "",
    description: seo.description ?? "",
  });
  const [original, setOriginal] = useState(draft);
  const [clear, setClear] = useState({ title: false, description: false });
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const submitted = useRef(false);
  const id = useId();
  const saving = fetcher.state !== "idle";
  useEffect(() => {
    if (fetcher.state !== "idle") return;
    submitted.current = false;
    if (fetcher.data?.ok) setEditing(false);
  }, [fetcher.state, fetcher.data]);
  const result =
    attempted &&
    (!fetcher.data?.productId || fetcher.data.productId === productId)
      ? fetcher.data
      : undefined;
  const open = () => {
    const current = {
      title: seo.title ?? "",
      description: seo.description ?? "",
    };
    setDraft(current);
    setOriginal(current);
    setClear({ title: false, description: false });
    setError("");
    setAttempted(false);
    setEditing(true);
  };
  return (
    <div className="sp-alt-editor sp-seo-editor">
      <dl className="sp-seo-values">
        <div>
          <dt>Custom SEO title</dt>
          <dd>{hasText(seo.title) ? seo.title : "Not set"}</dd>
        </div>
        <div>
          <dt>Custom SEO description</dt>
          <dd>{hasText(seo.description) ? seo.description : "Not set"}</dd>
        </div>
      </dl>
      {!editing ? (
        <button type="button" className="sp-analyze" onClick={open}>
          Edit SEO
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
            const validated = validateSeo({
              title: clear.title ? "" : draft.title,
              description: clear.description ? "" : draft.description,
              expectedTitle: original.title,
              expectedDescription: original.description,
              clearTitle: clear.title,
              clearDescription: clear.description,
            });
            if (!validated.ok) {
              event.preventDefault();
              setError(validated.message);
              return;
            }
            setError("");
            setAttempted(true);
            submitted.current = true;
          }}
        >
          <input type="hidden" name="intent" value="save-seo" />
          <input type="hidden" name="expectedTitle" value={original.title} />
          <input
            type="hidden"
            name="expectedDescription"
            value={original.description}
          />
          <input type="hidden" name="clearTitle" value={String(clear.title)} />
          <input
            type="hidden"
            name="clearDescription"
            value={String(clear.description)}
          />
          {(["title", "description"] as const).map((field) => (
            <div className="sp-seo-field" key={field}>
              <label htmlFor={`${id}-${field}`}>SEO {field}</label>
              {clear[field] && (
                <input
                  type="hidden"
                  name={field === "title" ? "seoTitle" : "seoDescription"}
                  value=""
                />
              )}
              {field === "title" ? (
                <input
                  type="text"
                  id={`${id}-${field}`}
                  name="seoTitle"
                  value={clear.title ? "" : draft.title}
                  disabled={saving || clear.title}
                  aria-invalid={Boolean(error || (result && !result.ok))}
                  aria-describedby={`${id}-${field}-count ${id}-help ${id}-feedback`}
                  onChange={(e) => {
                    setDraft({ ...draft, title: e.currentTarget.value });
                    setError("");
                  }}
                />
              ) : (
                <textarea
                  id={`${id}-${field}`}
                  name="seoDescription"
                  value={clear.description ? "" : draft.description}
                  rows={3}
                  disabled={saving || clear.description}
                  aria-invalid={Boolean(error || (result && !result.ok))}
                  aria-describedby={`${id}-${field}-count ${id}-help ${id}-feedback`}
                  onChange={(e) => {
                    setDraft({ ...draft, description: e.currentTarget.value });
                    setError("");
                  }}
                />
              )}
              <p id={`${id}-${field}-count`} className="health-muted">
                {clear[field] ? 0 : Array.from(draft[field].trim()).length}{" "}
                characters · editor limit {SEO_LIMITS[field]}
              </p>
              <label className="sp-seo-clear">
                <input
                  type="checkbox"
                  checked={clear[field]}
                  disabled={saving}
                  onChange={(e) => {
                    setClear({ ...clear, [field]: e.currentTarget.checked });
                    setError("");
                  }}
                />{" "}
                Clear custom SEO {field}
              </label>
            </div>
          ))}
          <p id={`${id}-help`} className="health-muted">
            Save changes only custom SEO. Select Clear deliberately to remove a
            value; Shopify may use fallback metadata and StorePulse will mark
            the custom field as missing. Character counts do not change scoring.
          </p>
          <div className="sp-alt-actions">
            <button
              type="submit"
              className="sp-button sp-button-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save SEO"}
            </button>
            <button
              type="button"
              className="sp-analyze"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setError("");
                setAttempted(false);
              }}
            >
              Cancel
            </button>
          </div>
        </fetcher.Form>
      )}
      <div
        id={`${id}-feedback`}
        className="sp-alt-feedback"
        role={error || (result && !result.ok) ? "alert" : "status"}
        aria-live="polite"
      >
        {saving
          ? "Saving SEO to Shopify and refreshing analysis…"
          : error || result?.message}
      </div>
    </div>
  );
}

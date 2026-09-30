export function StorePulseHeader({
  title,
  subtitle,
  loading,
  onRefresh,
  back = false,
  canRefresh = true,
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  onRefresh: () => void;
  back?: boolean;
  canRefresh?: boolean;
}) {
  return (
    <header className="sp-header">
      <div className="sp-brand-lockup">
        <img
          className="sp-brand-mark"
          src="/brand/storepulse-mark.svg"
          alt=""
          width="44"
          height="44"
        />
        <div>
          {back && (
            <a className="sp-breadcrumb" href="/app">
              StorePulse / Store health
            </a>
          )}
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      {canRefresh && (
        <button
          type="button"
          className="sp-button sp-button-primary"
          disabled={loading}
          onClick={onRefresh}
        >
          <svg
            viewBox="0 0 20 20"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path
              d="M16 8a6 6 0 1 0-1 6M16 3v5h-5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {loading ? "Refreshing…" : "Refresh analysis"}
        </button>
      )}
    </header>
  );
}

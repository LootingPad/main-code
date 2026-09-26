export function PageSkeleton({
  variant = "default",
}: {
  variant?: "default" | "table" | "detail" | "form";
}) {
  if (variant === "table") {
    return (
      <div className="page-skeleton" aria-busy="true" aria-live="polite">
        <div className="page-skeleton-head">
          <span className="sk sk-title" />
          <span className="sk sk-chip" />
        </div>
        <div className="page-skeleton-toolbar">
          <span className="sk sk-pill" />
          <span className="sk sk-pill" />
          <span className="sk sk-pill" />
          <span className="sk sk-pill wide" />
        </div>
        <div className="sheet page-skeleton-table">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="page-skeleton-row">
              <span className="sk sk-avatar" />
              <span className="sk sk-line grow" />
              <span className="sk sk-line short" />
              <span className="sk sk-line short" />
              <span className="sk sk-line mid" />
            </div>
          ))}
        </div>
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className="page-skeleton" aria-busy="true" aria-live="polite">
        <div className="page-skeleton-detail">
          <div className="sheet page-skeleton-panel">
            <div className="page-skeleton-detail-head">
              <span className="sk sk-avatar lg" />
              <div className="page-skeleton-stack grow">
                <span className="sk sk-line mid" />
                <span className="sk sk-line short" />
              </div>
              <span className="sk sk-pill" />
            </div>
            <span className="sk sk-chart" />
            <div className="page-skeleton-metrics">
              <span className="sk sk-card" />
              <span className="sk sk-card" />
              <span className="sk sk-card" />
              <span className="sk sk-card" />
            </div>
          </div>
          <div className="sheet page-skeleton-panel">
            <span className="sk sk-line mid" />
            <span className="sk sk-block" />
            <span className="sk sk-block" />
            <span className="sk sk-cta" />
          </div>
        </div>
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div className="page-skeleton" aria-busy="true" aria-live="polite">
        <div className="page-skeleton-head">
          <span className="sk sk-title" />
          <span className="sk sk-line mid" />
        </div>
        <div className="sheet page-skeleton-form">
          <span className="sk sk-line short" />
          <span className="sk sk-field" />
          <span className="sk sk-line short" />
          <span className="sk sk-field" />
          <span className="sk sk-line short" />
          <span className="sk sk-field tall" />
          <span className="sk sk-cta" />
        </div>
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  return (
    <div className="page-skeleton" aria-busy="true" aria-live="polite">
      <div className="sheet page-skeleton-hero">
        <div className="page-skeleton-stack grow">
          <span className="sk sk-chip" />
          <span className="sk sk-title" />
          <span className="sk sk-line" />
          <span className="sk sk-line mid" />
          <div className="page-skeleton-actions">
            <span className="sk sk-cta" />
            <span className="sk sk-pill" />
          </div>
        </div>
        <span className="sk sk-hero-mark" />
      </div>
      <div className="page-skeleton-metrics">
        <span className="sk sk-card" />
        <span className="sk sk-card" />
        <span className="sk sk-card" />
        <span className="sk sk-card" />
      </div>
      <div className="sheet page-skeleton-panel">
        <span className="sk sk-line mid" />
        <span className="sk sk-chart" />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

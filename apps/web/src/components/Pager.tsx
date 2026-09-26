"use client";

function PagerChevron({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d={dir === "prev" ? "M8.5 3.5 5 7l3.5 3.5" : "M5.5 3.5 9 7l-3.5 3.5"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Pager({
  page,
  pages,
  onChange,
  className,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (pages <= 1) return null;

  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(pages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const nums = Array.from({ length: end - start + 1 }, (_, index) => start + index);

  return (
    <div className={`explore-pager${className ? ` ${className}` : ""}`} role="navigation" aria-label="Pagination">
      <button
        type="button"
        className="explore-pager-nav"
        disabled={page === 1}
        aria-label="Previous page"
        onClick={() => onChange(page - 1)}
      >
        <PagerChevron dir="prev" />
      </button>
      <div className="explore-pager-pages">
        {start > 1 ? (
          <>
            <button type="button" className={page === 1 ? "on" : ""} onClick={() => onChange(1)}>
              1
            </button>
            {start > 2 ? <span className="explore-pager-gap">…</span> : null}
          </>
        ) : null}
        {nums.map((num) => (
          <button
            key={num}
            type="button"
            className={page === num ? "on" : ""}
            aria-current={page === num ? "page" : undefined}
            onClick={() => onChange(num)}
          >
            {num}
          </button>
        ))}
        {end < pages ? (
          <>
            {end < pages - 1 ? <span className="explore-pager-gap">…</span> : null}
            <button type="button" className={page === pages ? "on" : ""} onClick={() => onChange(pages)}>
              {pages}
            </button>
          </>
        ) : null}
      </div>
      <button
        type="button"
        className="explore-pager-nav"
        disabled={page === pages}
        aria-label="Next page"
        onClick={() => onChange(page + 1)}
      >
        <PagerChevron dir="next" />
      </button>
    </div>
  );
}

"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export function SlidingTabs<T extends string>({
  items,
  value,
  onChange,
  tone = "accent",
  ariaLabel,
}: {
  items: readonly { id: T; label: string; icon?: ReactNode }[];
  value: T | null;
  onChange: (id: T) => void;
  tone?: "accent" | "quiet";
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ x: 0, w: 0, ready: false });

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;

    const measure = () => {
      const button = value ? root.querySelector<HTMLButtonElement>(`[data-tab="${value}"]`) : null;
      if (!button) {
        setBox((current) => ({ ...current, ready: false }));
        return;
      }
      setBox({ x: button.offsetLeft, w: button.offsetWidth, ready: true });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [value, items]);

  return (
    <div ref={ref} className={`seg-track ${tone}`} role="tablist" aria-label={ariaLabel}>
      <span
        className="seg-pill"
        style={{
          width: box.w,
          transform: `translate3d(${box.x}px, 0, 0)`,
          opacity: box.ready ? 1 : 0,
        }}
      />
      {items.map((item) => {
        const selected = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            data-tab={item.id}
            aria-selected={selected}
            className={selected ? "on" : ""}
            onClick={() => onChange(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { InfoIcon } from "@/components/Icons";

/** Compact circle+exclamation tip — keeps page heads clean. */
export function PageInfo({ tip, label = "About this page" }: { tip: string; label?: string }) {
  const id = useId();
  const rootRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function onPointer(event: PointerEvent) {
      const root = rootRef.current;
      if (!root?.open) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      root.open = false;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && rootRef.current?.open) rootRef.current.open = false;
    }
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={rootRef} className="page-info">
      <summary className="page-info-btn" aria-label={label} title={tip}>
        <InfoIcon size={15} />
      </summary>
      <p className="page-info-tip" id={id} role="note">
        {tip}
      </p>
    </details>
  );
}

/** Title + optional info icon in one row. */
export function PageTitle({
  children,
  tip,
}: {
  children: ReactNode;
  tip?: string;
}) {
  return (
    <div className="page-title-row">
      <h1 className="explore-title">{children}</h1>
      {tip ? <PageInfo tip={tip} /> : null}
    </div>
  );
}

/**
 * Top-center toast — drops in from above, themed, auto-hides after 5s.
 */
export function PageFlash({
  note,
  onClear,
  ttlMs = 5000,
}: {
  note: string;
  onClear?: () => void;
  ttlMs?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"in" | "out" | "gone">("gone");
  const [text, setText] = useState(note);
  const clearRef = useRef(onClear);
  clearRef.current = onClear;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!note) {
      setPhase((prev) => (prev === "gone" ? prev : "out"));
      return;
    }
    setText(note);
    setPhase("in");
    const hide = window.setTimeout(() => setPhase("out"), ttlMs);
    return () => window.clearTimeout(hide);
  }, [note, ttlMs]);

  useEffect(() => {
    if (phase !== "out") return;
    const done = window.setTimeout(() => {
      setPhase("gone");
      clearRef.current?.();
    }, 280);
    return () => window.clearTimeout(done);
  }, [phase]);

  function dismiss() {
    setPhase("out");
  }

  if (!mounted || phase === "gone" || !text) return null;

  return createPortal(
    <div className="toast-layer" aria-live="polite">
      <div className={`toast-note${phase === "out" ? " is-out" : " is-in"}`} role="status">
        <span className="toast-note-icon" aria-hidden>
          <InfoIcon size={15} />
        </span>
        <p>{text}</p>
        <button type="button" className="toast-note-close" aria-label="Dismiss" onClick={dismiss}>
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
}

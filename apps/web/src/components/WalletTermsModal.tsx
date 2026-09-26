"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

function HandshakeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden>
      <path
        d="M8.2 11.2 6.4 9.4a2.1 2.1 0 0 1 0-3l1.3-1.3a2.1 2.1 0 0 1 3 0l1.1 1.1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m15.8 12.8 1.8 1.8a2.1 2.1 0 0 1 0 3l-1.3 1.3a2.1 2.1 0 0 1-3 0l-1.1-1.1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 14.2 14 9.4M10.6 15.6l2.2-2.2M8.4 12.2l2.2-2.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.2 16.4 4.8 14a2 2 0 0 1 0-2.8l.7-.7M16.8 7.6 19.2 10a2 2 0 0 1 0 2.8l-.7.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WalletTermsModal({
  open,
  onAccept,
  onDisconnect,
}: {
  open: boolean;
  onAccept: () => void;
  onDisconnect: () => void;
}) {
  const titleId = useId();
  const termsId = useId();
  const privacyId = useId();
  const [mounted, setMounted] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const canAccept = terms && privacy;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setTerms(false);
      setPrivacy(false);
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="wallet-terms-overlay" role="presentation">
      <div
        className="wallet-terms-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="wallet-terms-glow" aria-hidden />
        <div className="wallet-terms-mark" aria-hidden>
          <HandshakeIcon />
        </div>

        <div className="wallet-terms-title-row">
          <h2 id={titleId}>Review and accept</h2>
          <span className="wallet-terms-required">Required</span>
        </div>

        <p className="wallet-terms-copy">
          Before using LOOTING with this wallet, you must review and accept the current Terms of Use and
          Privacy Policy. You also confirm that you are not located in a restricted jurisdiction.
        </p>

        <div className="wallet-terms-checks">
          <label htmlFor={termsId} className={`wallet-terms-check ${terms ? "on" : ""}`}>
            <input
              id={termsId}
              type="checkbox"
              checked={terms}
              onChange={(event) => setTerms(event.target.checked)}
            />
            <span className="wallet-terms-box" aria-hidden />
            <span>
              I have read and accept the{" "}
              <Link href="/docs" target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                Terms of Use
              </Link>
              .
            </span>
          </label>

          <label htmlFor={privacyId} className={`wallet-terms-check ${privacy ? "on" : ""}`}>
            <input
              id={privacyId}
              type="checkbox"
              checked={privacy}
              onChange={(event) => setPrivacy(event.target.checked)}
            />
            <span className="wallet-terms-box" aria-hidden />
            <span>
              I have read and accept the{" "}
              <Link href="/docs" target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        </div>

        <div className="wallet-terms-actions">
          <button
            type="button"
            className="wallet-terms-accept"
            disabled={!canAccept}
            onClick={onAccept}
          >
            Accept and continue
          </button>
          <button type="button" className="wallet-terms-disconnect" onClick={onDisconnect}>
            Disconnect wallet
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

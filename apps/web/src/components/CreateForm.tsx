"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useWallet } from "@/components/Wallet";
import { DRAFT_KEY, type CoinDraft } from "@/lib/draft";
import { PONS_LAUNCH_WINDOW } from "@/lib/launch-window";
import { formatCount, shortAddress } from "@/lib/format";
import { TokenLogo } from "./TokenLogo";

const stockPairs = ["NVDA", "AAPL", "TSLA", "SPY", "AMZN", "META", "GOOGL", "MSFT", "COIN"] as const;
const taxPresets = [1, 2, 3] as const;

const pairLogos: Record<string, string> = {
  ETH: "/pairs/eth.svg",
  NVDA: "/pairs/nvda.png",
  AAPL: "/pairs/aapl.svg",
  TSLA: "/pairs/tsla.png",
  SPY: "/pairs/spy.png",
  AMZN: "/pairs/amzn.png",
  META: "/pairs/meta.png",
  GOOGL: "/pairs/googl.svg",
  MSFT: "/pairs/msft.svg",
  COIN: "/pairs/coin.png",
};

function PairMark({ symbol }: { symbol: string }) {
  const src = pairLogos[symbol];
  if (!src) return null;
  return <img className="pair-mark" src={src} alt="" decoding="async" />;
}

function FieldTip({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <span className={`field-tip${open ? " is-open" : ""}`} ref={ref}>
      <button
        type="button"
        className="field-tip-btn"
        aria-label="Show field details"
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
          <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 7.2V11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="5.1" r="0.8" fill="currentColor" />
        </svg>
      </button>
      <span className="field-tip-copy">{children}</span>
    </span>
  );
}

export function CreateForm() {
  const router = useRouter();
  const { connected, connect } = useWallet();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [imageOk, setImageOk] = useState(false);
  const [creatorFee, setCreatorFee] = useState(1);
  const [taxMode, setTaxMode] = useState<"preset" | "custom">("preset");
  const [boxCut, setBoxCut] = useState(0.5);
  const [initialBuy, setInitialBuy] = useState("");
  const [pair, setPair] = useState("ETH");
  const [pairOpen, setPairOpen] = useState(false);
  const [pairUp, setPairUp] = useState(false);
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [holderShare, setHolderShare] = useState(false);
  const [creatorWallet, setCreatorWallet] = useState("");
  const [exemptions, setExemptions] = useState<string[]>([]);
  const [exemptDraft, setExemptDraft] = useState("");
  const [exemptError, setExemptError] = useState("");
  const pairRef = useRef<HTMLDivElement>(null);

  const ticker = symbol.trim().toUpperCase();
  const kept = Math.max(0, creatorFee - boxCut);
  const luckyShare = creatorFee > 0 ? Math.round((boxCut / creatorFee) * 100) : 0;
  const estimate = useMemo(() => Math.round(100_000 * (boxCut / 100)), [boxCut]);
  const splitFill = `${((boxCut - 0.5) / Math.max(creatorFee - 0.5, 0.1)) * 100}%`;

  useEffect(() => {
    if (!pairOpen) return;
    const close = (event: MouseEvent) => {
      if (pairRef.current && !pairRef.current.contains(event.target as Node)) setPairOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [pairOpen]);

  function togglePair() {
    if (pairOpen) {
      setPairOpen(false);
      return;
    }
    const rect = pairRef.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      setPairUp(below < 280 && above > below);
    }
    setPairOpen(true);
  }

  function choosePair(next: string) {
    setPair(next);
    setPairOpen(false);
  }

  function applyFee(next: number) {
    const fee = Math.min(5, Math.max(0.5, Math.round(next * 10) / 10));
    setCreatorFee(fee);
    setBoxCut((current) => Math.min(fee, Math.max(0.5, current)));
  }

  function addExempt() {
    const next = exemptDraft.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(next)) {
      setExemptError("Use a full 0x wallet address.");
      return;
    }
    if (exemptions.some((item) => item.toLowerCase() === next.toLowerCase())) {
      setExemptError("That wallet is already listed.");
      return;
    }
    if (exemptions.length >= 8) {
      setExemptError("Up to 8 wallets.");
      return;
    }
    setExemptions((items) => [...items, next.toLowerCase()]);
    setExemptDraft("");
    setExemptError("");
  }

  function onImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Logo needs to be an image.");
      return;
    }
    if (file.size > 1_500_000) {
      setError("Logo needs to be under 1.5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(typeof reader.result === "string" ? reader.result : "");
      setError("");
    };
    reader.readAsDataURL(file);
  }

  function launch() {
    const cleanName = name.trim();
    const cleanSymbol = ticker.replace(/[^A-Z0-9]/g, "");
    if (cleanName.length < 2) {
      setError("Name needs at least 2 characters.");
      return;
    }
    if (cleanSymbol.length < 2 || cleanSymbol.length > 10) {
      setError("Ticker needs 2–10 letters or numbers.");
      return;
    }
    if (/https?:\/\/|www\./i.test(description)) {
      setError("Description can't include links.");
      return;
    }
    const wallet = creatorWallet.trim();
    if (wallet && !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      setAdvancedOpen(true);
      setError("Creator wallet needs a full 0x address.");
      return;
    }
    if (!connected) {
      connect();
      return;
    }

    const draft: CoinDraft = {
      name: cleanName,
      symbol: cleanSymbol,
      description: description.trim(),
      website: "",
      twitter: twitter.trim().replace(/^@/, ""),
      telegram: telegram.trim().replace(/^@/, ""),
      discord: "",
      farcaster: "",
      creatorFee,
      luckyShare,
      initialBuy: initialBuy.trim(),
      pair,
      image,
      holderShare,
      creatorWallet: wallet.toLowerCase(),
      exemptions,
    };
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));

    const params = new URLSearchParams({
      name: draft.name,
      symbol: draft.symbol,
      description: draft.description,
      lucky: String(draft.luckyShare),
      fee: String(draft.creatorFee),
      website: draft.website,
      twitter: draft.twitter,
      telegram: draft.telegram,
      discord: draft.discord,
      farcaster: draft.farcaster,
      buy: draft.initialBuy,
      pair: draft.pair,
      holders: draft.holderShare ? "1" : "0",
      wallet: draft.creatorWallet,
      exempt: draft.exemptions.join(","),
    });
    router.push(`/token/preview?${params.toString()}`);
  }

  return (
    <div className="create-page">
      <div className="page-head">
        <div>
          <h1 className="explore-title">Create coin</h1>
          <p className="page-note">Set the coin, its links, and how much of the creator fee funds Lucky Boxes.</p>
        </div>
      </div>

      <form
        className="create-layout"
        onSubmit={(event) => {
          event.preventDefault();
          launch();
        }}
      >
        <section className="sheet create-card create-main">
          <div className="create-split">
            <div className="create-pane">
          <p className="col-title">Coin</p>
          <div className="coin-row">
            <label className="coin-field">
              <span className="field-head">Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Token name" maxLength={32} className="field tight" />
              <FieldTip>
                32 characters max.
                <br />
                Letters, numbers, and spaces.
              </FieldTip>
            </label>
            <label className="coin-field">
              <span className="field-head">Ticker</span>
              <input
                value={symbol}
                onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                placeholder="symbol"
                maxLength={10}
                className="field tight"
              />
              <FieldTip>
                10 characters max.
                <br />
                Letters and numbers.
              </FieldTip>
            </label>
          </div>
          <label className="coin-field">
            <span className="field-head">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              maxLength={256}
              placeholder="A short description of the token"
              className="field tight resize-none"
            />
            <FieldTip>No links. 256 characters max.</FieldTip>
          </label>
          <div className="coin-image">
            <p className="coin-field">Token image</p>
            <label className="coin-check">
              <input
                type="checkbox"
                checked={imageOk}
                onChange={(event) => {
                  const next = event.target.checked;
                  setImageOk(next);
                  if (!next) setImage("");
                }}
              />
              <FieldTip>Selected artwork will be moderated and uploaded to public IPFS.</FieldTip>
              <span className="coin-check-short">Public IPFS</span>
            </label>
            <label className={`upload upload-wide${imageOk ? "" : " is-locked"}`}>
              {image ? (
                <img src={image} alt="" decoding="async" />
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
                    <circle cx="5.5" cy="6.5" r="1.2" fill="currentColor" />
                    <path d="M2.5 11.5 6 8.2l2.2 2.1 1.6-1.5 3.7 3.2" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                  <span>{imageOk ? "Choose image" : "Confirm public upload first"}</span>
                </>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                disabled={!imageOk}
                onChange={(event) => onImage(event.target.files?.[0])}
              />
            </label>
          </div>
          <div className="coin-row">
            <label className="coin-field">
              X profile
              <span className="prefix-field">
                <span>x.com/</span>
                <input value={twitter} onChange={(event) => setTwitter(event.target.value.replace(/^@/, ""))} placeholder="handle" />
              </span>
            </label>
            <label className="coin-field">
              Telegram
              <span className="prefix-field">
                <span>t.me/</span>
                <input value={telegram} onChange={(event) => setTelegram(event.target.value.replace(/^@/, ""))} placeholder="community" />
              </span>
            </label>
          </div>
            </div>

            <div className="create-pane">
          <p className="col-title">Launch</p>
          <div className="launch-block">
            <p className="lbl">Creator tax</p>
            <div className="fee-presets">
              {taxPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={taxMode === "preset" && creatorFee === preset ? "on" : ""}
                  onClick={() => {
                    setTaxMode("preset");
                    applyFee(preset);
                  }}
                >
                  {preset}%
                </button>
              ))}
              <button type="button" className={taxMode === "custom" ? "on" : ""} onClick={() => setTaxMode("custom")}>
                Custom
              </button>
            </div>
            {taxMode === "custom" && (
              <label className="lbl">
                Custom tax
                <input
                  type="number"
                  min={0.5}
                  max={5}
                  step={0.1}
                  value={creatorFee}
                  onChange={(event) => applyFee(Number(event.target.value))}
                  className="field tight"
                  aria-label="Custom creator tax"
                />
              </label>
            )}
          </div>

          <div className="launch-block split-block">
            <div className="split-grid">
              <div>
                <p className="text-xs text-[var(--muted)]">{holderShare ? "Holders" : "You keep"}</p>
                <p className="split-value">{kept.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-xs text-[var(--gold)]">Lucky Boxes</p>
                <p className="split-value">{boxCut.toFixed(2)}%</p>
              </div>
            </div>
            <input
              type="range"
              min={0.5}
              max={creatorFee}
              step={0.1}
              value={boxCut}
              onChange={(event) => setBoxCut(Math.max(0.5, Math.min(creatorFee, Number(event.target.value))))}
              className="split-range"
              style={{ ["--fill" as string]: splitFill }}
              aria-label="Lucky Box share"
            />
            <p className="hint-slot">
              <FieldTip>Minimum 0.5% of creator tax for Lucky Boxes · ~${formatCount(estimate)} per $100k volume to boxes.</FieldTip>
            </p>
          </div>

          <div className="launch-block">
            <div className="coin-row">
              <div className="pair-field">
                <p className="lbl" id="pair-label">Pair</p>
                <div className={`pair-select${pairOpen ? " is-open" : ""}${pairUp ? " is-up" : ""}`} ref={pairRef}>
                  <button type="button" className="pair-trigger" aria-labelledby="pair-label" aria-haspopup="listbox" aria-expanded={pairOpen} onClick={togglePair}>
                    <span className="pair-value">
                      <PairMark symbol={pair} />
                      {pair}
                    </span>
                    <svg className="pair-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M6 9.5 12 15.5 18 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {pairOpen ? (
                    <div className="pair-menu" role="listbox" aria-labelledby="pair-label">
                      <button type="button" role="option" aria-selected={pair === "ETH"} className={pair === "ETH" ? "on" : ""} onClick={() => choosePair("ETH")}>
                        <PairMark symbol="ETH" />
                        ETH
                      </button>
                      <p>Stocks</p>
                      {stockPairs.map((stock) => (
                        <button key={stock} type="button" role="option" aria-selected={pair === stock} className={pair === stock ? "on" : ""} onClick={() => choosePair(stock)}>
                          <PairMark symbol={stock} />
                          {stock}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <label className="lbl">
                Initial buy
                <input
                  value={initialBuy}
                  onChange={(event) => setInitialBuy(event.target.value)}
                  inputMode="decimal"
                  placeholder={`0.0 ${pair}, optional`}
                  className="field tight"
                />
              </label>
            </div>
            <p className="hint-slot">
              <FieldTip>Quote asset on Pons V2. Buyers spend this, and the curve graduates in it.</FieldTip>
            </p>
          </div>

          <div className="launch-block">
            <button type="button" className="advanced-toggle" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)}>
              Advanced
              <svg className={`advanced-chevron${advancedOpen ? " is-open" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M6 9.5 12 15.5 18 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {advancedOpen ? (
              <div className="advanced-panel">
                <div className="share-row">
                  <div>
                    <p className="lbl">Holder fee sharing</p>
                    <FieldTip>{holderShare ? "Holders claim this share from their profile. Lucky Boxes still take their cut." : "Creator fees go to the creator wallet. Lucky Boxes still take their cut."}</FieldTip>
                  </div>
                  <button
                    type="button"
                    className={`fee-switch${holderShare ? "" : " is-on"}`}
                    role="switch"
                    aria-checked={!holderShare}
                    aria-label="Creator fees go to the creator wallet"
                    onClick={() => setHolderShare((on) => !on)}
                  >
                    <i />
                  </button>
                </div>
                <div className="exempt-block">
                  <label className="lbl">
                    Creator wallet
                    <input
                      value={creatorWallet}
                      onChange={(event) => setCreatorWallet(event.target.value)}
                      placeholder="Connected wallet"
                      disabled={holderShare}
                      spellCheck={false}
                      className="field tight"
                    />
                  </label>
                  <FieldTip>{holderShare ? "Holders claim this share." : "Receives the creator share. Leave blank to use your connected wallet."}</FieldTip>
                </div>
                <div className="exempt-block">
                  <p className="lbl">Snipe tax exemptions</p>
                  <div className="exempt-row">
                    <input
                      value={exemptDraft}
                      onChange={(event) => {
                        setExemptDraft(event.target.value);
                        setExemptError("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addExempt();
                        }
                      }}
                      placeholder="0x wallet address"
                      spellCheck={false}
                      className="field tight"
                      aria-label="Snipe tax exemptions"
                    />
                    <button type="button" className="exempt-add" onClick={addExempt} aria-label="Add wallet to the exemption list">
                      +
                    </button>
                  </div>
                  <FieldTip>Buys in the launch second pay 99%, decaying to zero across 3s.</FieldTip>
                  {exemptError ? <p className="text-sm text-[var(--down)]">{exemptError}</p> : null}
                  {exemptions.length > 0 ? (
                    <ul className="exempt-list">
                      {exemptions.map((item) => (
                        <li key={item}>
                          <span className="num">{shortAddress(item)}</span>
                          <button type="button" aria-label={`Remove ${shortAddress(item)}`} onClick={() => setExemptions((items) => items.filter((wallet) => wallet !== item))}>
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {error && <p className="text-sm text-[var(--down)]">{error}</p>}
          <button type="submit" className="btn compact create-submit w-full">
            {connected ? "Create coin" : "Connect to create"}
          </button>
            </div>
          </div>
        </section>

        <section className="sheet create-card token-preview" aria-label="Token preview">
          <p className="col-title">Preview</p>
          <div className="preview-hero">
            {image ? <img src={image} alt="" className="preview-logo" decoding="async" /> : <TokenLogo symbol={ticker || "NEW"} size={64} />}
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{name.trim() || "Coin name"}</p>
              <p className="ticker text-sm text-[var(--muted)]">${ticker || "TICKER"}</p>
            </div>
          </div>
          <p className="preview-copy">{description.trim() || "Description shows up here."}</p>
          <ul className="preview-meta">
            <li>
              <span>X</span>
              <b>{twitter.trim() || "—"}</b>
            </li>
            <li>
              <span>Telegram</span>
              <b>{telegram.trim() || "—"}</b>
            </li>
            <li>
              <span>Tax</span>
              <b className="num">{creatorFee.toFixed(2)}%</b>
            </li>
            <li>
              <span>Boxes</span>
              <b className="num">{boxCut.toFixed(2)}%</b>
            </li>
            <li>
              <span>{holderShare ? "Holders" : "You keep"}</span>
              <b className="num">{kept.toFixed(2)}%</b>
            </li>
            <li>
              <span>Fees to</span>
              <b>{holderShare ? "Holders" : "Creator"}</b>
            </li>
            <li>
              <span>Wallet</span>
              <b className="num">{holderShare ? "—" : creatorWallet.trim() ? shortAddress(creatorWallet.trim()) : "Connected"}</b>
            </li>
            <li>
              <span>Launch fee</span>
              <b className="num">0.00085 ETH</b>
            </li>
            <li className="preview-meta-stack">
              <div className="preview-meta-row">
                <span>{PONS_LAUNCH_WINDOW.label}</span>
                <b className="num">{PONS_LAUNCH_WINDOW.shortValue}</b>
              </div>
              <p className="preview-meta-detail">{PONS_LAUNCH_WINDOW.detail}</p>
            </li>
            <li>
              <span>Graduation</span>
              <b className="num">{pair === "ETH" ? "4.2 ETH" : `In ${pair}`}</b>
            </li>
            <li>
              <span>Liquidity</span>
              <b>Locked</b>
            </li>
            <li>
              <span>Pair</span>
              <b className="pair-chosen">
                <PairMark symbol={pair} />
                {pair}
              </b>
            </li>
            <li>
              <span>First buy</span>
              <b className="num">{initialBuy.trim() ? `${initialBuy.trim()} ${pair}` : "—"}</b>
            </li>
          </ul>
        </section>
      </form>
    </div>
  );
}

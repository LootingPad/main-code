"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { emptyStats, getFees, getLaunchHolders, getLaunchTrades } from "@/lib/api";
import { DRAFT_KEY } from "@/lib/draft";
import { ETH_USD } from "@/lib/fees";
import { formatPrice, formatUsd, shortAddress } from "@/lib/format";
import { PONS_LAUNCH_WINDOW } from "@/lib/launch-window";
import type { Holder, Launch, LaunchWithStats, MarketStats, TokenTrade } from "@/lib/types";
import { useAsyncData } from "@/lib/use-async-data";
import { GiftIcon, WalletIcon } from "./Icons";
import { Pager } from "./Pager";
import { SlidingTabs } from "./SlidingTabs";
import { Sparkline } from "./Sparkline";
import { TokenLogo } from "./TokenLogo";
import { useWallet } from "./Wallet";

function resolveStats(launch: Launch | LaunchWithStats, initialStats?: MarketStats): MarketStats {
  if (initialStats) return initialStats;
  if ("stats" in launch && launch.stats) return launch.stats;
  return emptyStats();
}

export function Terminal({
  launch,
  meta,
  initialStats,
}: {
  launch: Launch | LaunchWithStats;
  initialStats?: MarketStats;
  meta?: {
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
    farcaster?: string;
    initialBuy?: string;
    pair?: string;
    holders?: string;
    wallet?: string;
    exempt?: string;
  };
}) {
  const { connected, address, connect } = useWallet();
  const quoteAsset = meta?.pair || "ETH";
  const stats = resolveStats(launch, initialStats);
  const { data: fees } = useAsyncData(() => getFees(), [], {
    initial: null as Awaited<ReturnType<typeof getFees>> | null,
  });
  const ethUsd = fees?.ETH_USD ?? ETH_USD;
  const { data: holders } = useAsyncData(
    () => getLaunchHolders(launch.address),
    [launch.address],
    { initial: [] as Holder[], enabled: !launch.draft },
  );
  const { data: trades } = useAsyncData(
    () => getLaunchTrades(launch.address, { limit: 50 }),
    [launch.address],
    { initial: [] as TokenTrade[], enabled: !launch.draft },
  );
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [dockOpen, setDockOpen] = useState(false);
  const [slippage, setSlippage] = useState("10");
  const [gwei, setGwei] = useState("30.05");
  const [setup, setSetup] = useState<"slip" | "gwei" | "tpsl" | null>(null);
  const [orderMode, setOrderMode] = useState<"instant" | "market" | "limit">("instant");
  const [priority, setPriority] = useState<"P1" | "P2" | "P3">("P1");
  const [autoSlip, setAutoSlip] = useState(true);
  const [mevOn, setMevOn] = useState(true);
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [amount, setAmount] = useState(meta?.initialBuy || "0.1");
  const [photo, setPhoto] = useState("");
  const [claimed, setClaimed] = useState({ creator: false, pool: false });
  const [dataTab, setDataTab] = useState<"holders" | "tx">("holders");
  const [page, setPage] = useState(1);
  const quote = useMemo(() => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || launch.priceUsd <= 0) return 0;
    return side === "buy" ? (value * ethUsd) / launch.priceUsd : (value * launch.priceUsd) / ethUsd;
  }, [amount, ethUsd, launch.priceUsd, side]);

  const up = launch.change1h >= 0;
  const creatorShare = 100 - launch.luckyShare;

  useEffect(() => {
    if (!launch.draft) return;
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      const parsed = raw ? (JSON.parse(raw) as { symbol?: string; image?: string }) : null;
      if (parsed?.symbol === launch.symbol && parsed.image) setPhoto(parsed.image);
    } catch {
      setPhoto("");
    }
  }, [launch.draft, launch.symbol]);

  const links = socials(launch, meta);

  const [presets, setPresets] = useState(["0.1", "0.25", "0.5", "1"]);
  const [sellPercents, setSellPercents] = useState([25, 50, 75, 100]);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetDraft, setPresetDraft] = useState(["0.1", "0.25", "0.5", "1"]);
  const [presetError, setPresetError] = useState("");
  const presetRef = useRef<HTMLDivElement>(null);
  const accruedEth = (launch.marketCap / ethUsd) * (launch.creatorTax / 100) * (0.35 + launch.progress / 200);
  const creatorEth = (accruedEth * creatorShare) / 100;
  const poolEth = (accruedEth * launch.luckyShare) / 100;
  const pageSize = 10;
  const dataRows = dataTab === "holders" ? holders : trades;
  const pages = Math.max(1, Math.ceil(dataRows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleHolders = holders.slice(pageStart, pageStart + pageSize);
  const visibleTrades = trades.slice(pageStart, pageStart + pageSize);
  const mine = connected ? holders.find((row) => row.address.toLowerCase() === address.toLowerCase()) : undefined;
  const runningPnl = mine && mine.entry > 0 ? ((launch.priceUsd - mine.entry) / mine.entry) * 100 : null;
  const runningDelta = mine ? mine.amount * (launch.priceUsd - mine.entry) : null;
  const balance = mine?.amount ?? 0;
  const tokensFor = (percent: number) => {
    const tokens = (balance * percent) / 100;
    if (!Number.isFinite(tokens) || tokens <= 0) return "0";
    if (tokens >= 100) return String(Math.round(tokens * 100) / 100);
    return String(Number(tokens.toPrecision(6)));
  };
  const sellActive = (percent: number) => {
    const target = Number(tokensFor(percent));
    const current = Number(amount);
    return target > 0 && Number.isFinite(current) && Math.abs(current - target) / target < 0.0005;
  };
  const isCreator = connected && address.toLowerCase() === launch.creator.toLowerCase();
  const canClaimCreator = isCreator && creatorEth > 0 && !claimed.creator;
  const canClaimPool = Boolean(mine) && poolEth > 0 && !claimed.pool;

  useEffect(() => {
    setClaimed({ creator: false, pool: false });
  }, [launch.address]);

  function applySlippage(next: string) {
    const clean = next.replace(/[^\d.]/g, "");
    setSlippage(clean);
    const value = Math.round(Number(clean) * 10) / 10;
    if (value > 0 && value <= 50) window.localStorage.setItem("looting-slippage", String(value));
  }

  function applyGwei(next: string) {
    const clean = next.replace(/[^\d.]/g, "");
    setGwei(clean);
    const value = Number(clean);
    if (value > 0) window.localStorage.setItem("looting-gwei", clean);
  }

  useEffect(() => {
    const storedSlip = window.localStorage.getItem("looting-slippage");
    const storedGwei = window.localStorage.getItem("looting-gwei");
    if (storedSlip && Number(storedSlip) > 0 && Number(storedSlip) <= 50) setSlippage(storedSlip);
    if (storedGwei && Number(storedGwei) > 0) setGwei(storedGwei);
  }, []);

  useEffect(() => {
    try {
      const buy = window.localStorage.getItem("looting-buy-presets");
      const sell = window.localStorage.getItem("looting-sell-presets");
      const buyParsed = buy ? (JSON.parse(buy) as unknown) : null;
      const sellParsed = sell ? (JSON.parse(sell) as unknown) : null;
      if (Array.isArray(buyParsed) && buyParsed.length === 4 && buyParsed.every((value) => Number(value) > 0)) {
        setPresets(buyParsed.map(String));
      }
      if (Array.isArray(sellParsed) && sellParsed.length === 4 && sellParsed.every((value) => Number(value) > 0 && Number(value) <= 100)) {
        setSellPercents(sellParsed.map(Number));
      }
    } catch {
      /* keep defaults */
    }
  }, []);

  useEffect(() => {
    if (!presetOpen) return;
    function close(event: MouseEvent) {
      if (presetRef.current && !presetRef.current.contains(event.target as Node)) {
        setPresetOpen(false);
        setPresetError("");
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [presetOpen]);

  function editLane(next: "buy" | "sell") {
    setSide(next);
    setPresetDraft(next === "buy" ? [...presets] : sellPercents.map(String));
    setPresetError("");
    setPresetOpen(true);
    setSetup(null);
  }

  function cyclePriority() {
    const order = ["P1", "P2", "P3"] as const;
    const next = order[(order.indexOf(priority) + 1) % order.length];
    const fees = { P1: "5", P2: "15", P3: "30.05" };
    setPriority(next);
    applyGwei(fees[next]);
  }

  function openDock(next: "buy" | "sell") {
    setPresetOpen(false);
    setPresetError("");
    setSide(next);
    setAmount(next === "buy" ? presets[0] || meta?.initialBuy || "0.1" : tokensFor(sellPercents[0] ?? 25));
    setDockOpen(true);
  }

  function openPresets() {
    setPresetDraft(side === "buy" ? [...presets] : sellPercents.map(String));
    setPresetError("");
    setPresetOpen(true);
  }

  function savePresets() {
    const next = presetDraft.map((value) => value.trim());
    if (side === "buy") {
      if (next.some((value) => !(Number(value) > 0))) {
        setPresetError("Use amounts above 0");
        return;
      }
      setPresets(next);
      window.localStorage.setItem("looting-buy-presets", JSON.stringify(next));
    } else {
      const percents = next.map(Number);
      if (percents.some((value) => !(value > 0) || value > 100)) {
        setPresetError("Use 1 to 100");
        return;
      }
      setSellPercents(percents);
      window.localStorage.setItem("looting-sell-presets", JSON.stringify(percents));
    }
    setPresetOpen(false);
  }

  return (
    <div className={`token-page${dockOpen ? " trade-open" : ""}`}>
      <div className="token-stack">
        {!launch.draft ? (
        <div className="fee-pair">
          <article className="sheet fee-card">
            <span className="fee-icon">
              <WalletIcon />
            </span>
            <span className="fee-title">Creator Fee</span>
            <strong>{formatEth(creatorEth)}</strong>
            <p>Kept by the token creator</p>
            <button type="button" className="fee-claim" disabled={!canClaimCreator} onClick={() => setClaimed((current) => ({ ...current, creator: true }))}>
              {claimed.creator ? "Claimed" : "Claim"}
            </button>
          </article>
          <article className="sheet fee-card">
            <span className="fee-icon">
              <GiftIcon />
            </span>
            <span className="fee-title">Lucky Box Pool</span>
            <strong>{formatEth(poolEth)}</strong>
            <p>Funds Lucky Box rewards</p>
            <button type="button" className="fee-claim" disabled={!canClaimPool} onClick={() => setClaimed((current) => ({ ...current, pool: true }))}>
              {claimed.pool ? "Claimed" : "Claim"}
            </button>
          </article>
        </div>
        ) : null}
      <section className="sheet token-main">
        <header className="token-head">
          {photo ? (
            <img src={photo} alt="" className="token-mark object-cover" width={64} height={64} decoding="async" />
          ) : (
            <TokenLogo symbol={launch.symbol} size={64} />
          )}
          <div className="token-id">
            <div className="token-title">
              <h1>{launch.name}</h1>
              <span>${launch.symbol}</span>
            </div>
            <p>{launch.description}</p>
          </div>
          <div className="token-head-actions">
            {(launch.locked || launch.socialUpdated || (launch.dexBoost ?? 0) > 0) && (
              <div className="token-badges" aria-label="Token signals">
                {launch.locked ? (
                  <span className="token-badge is-lock" data-tip="Token Locked" aria-label="Token Locked">
                    <LockBadgeIcon />
                  </span>
                ) : null}
                {launch.socialUpdated ? (
                  <a
                    className="token-badge is-social"
                    href={`https://dexscreener.com/search?q=${encodeURIComponent(launch.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    data-tip="Dex profile updated"
                    aria-label="Dex profile updated"
                  >
                    <DexscreenerBadgeIcon />
                  </a>
                ) : null}
                {(launch.dexBoost ?? 0) > 0 ? (
                  <a
                    className="token-badge is-boost"
                    href={`https://dexscreener.com/search?q=${encodeURIComponent(launch.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    data-tip={`DexBoost ${launch.dexBoost}x`}
                    aria-label={`DexBoost ${launch.dexBoost}x`}
                  >
                    <BoostBadgeIcon />
                  </a>
                ) : null}
              </div>
            )}
            {links.length > 0 && (
              <div className="token-link-card">
                {links.map((item) => (
                  <a key={item.label} href={item.href} target="_blank" rel="noreferrer" aria-label={item.label} title={item.label}>
                    <LinkGlyph label={item.label} />
                  </a>
                ))}
              </div>
            )}
            {launch.draft && <span className="token-pill is-draft">Draft</span>}
          </div>
        </header>

        {launch.draft ? (
          <ul className="preview-meta token-draft-meta">
            <li>
              <span>Creator tax</span>
              <b className="num">{launch.creatorTax.toFixed(2)}%</b>
            </li>
            <li>
              <span>Lucky Boxes</span>
              <b className="num">{launch.luckyShare}%</b>
            </li>
            <li className="preview-meta-stack">
              <div className="preview-meta-row">
                <span>{PONS_LAUNCH_WINDOW.label}</span>
                <b className="num">{PONS_LAUNCH_WINDOW.shortValue}</b>
              </div>
              <p className="preview-meta-detail">{PONS_LAUNCH_WINDOW.detail}</p>
            </li>
          </ul>
        ) : null}

        <div className="token-metrics">
          <div className="token-metric hero">
            <span>Price</span>
            <strong>{formatPrice(launch.priceUsd)}</strong>
          </div>
          <div className="token-metric">
            <span>Market cap</span>
            <strong>{formatUsd(launch.marketCap)}</strong>
          </div>
          <div className="token-metric">
            <span>1h</span>
            <strong className={up ? "is-up" : "is-down"}>
              {up ? "+" : ""}
              {launch.change1h.toFixed(1)}%
            </strong>
          </div>
        </div>

        <div className="token-chart">
          <Sparkline seed={launch.symbol} width={640} height={210} fill up={up} />
        </div>

        <div className="token-progress">
          <div>
            <span>{launch.phase === "graduated" ? "Graduated" : "To graduation"}</span>
            <b>{launch.progress}%</b>
          </div>
          <div className="token-bar">
            <i style={{ width: `${launch.progress}%` }} />
          </div>
        </div>

        <dl className="token-facts">
          <Fact label="Creator" value={shortAddress(launch.creator)} />
          <Fact label="Creator tax" value={`${launch.creatorTax.toFixed(2)}%`} />
          <Fact label="Creator keeps" value={`${creatorShare}%`} />
          <Fact label="Lucky Boxes" value={`${launch.luckyShare}%`} />
          {meta?.pair ? <Fact label="Pair" value={meta.pair} /> : null}
          {meta?.holders === "1" || meta?.holders === "0" ? <Fact label="Fees to" value={meta.holders === "1" ? "Holders" : "Creator"} /> : null}
          {meta?.wallet ? <Fact label="Creator wallet" value={shortAddress(meta.wallet)} /> : null}
          {launch.draft ? <Fact label="Launch fee" value="0.00085 ETH" /> : null}
          {launch.draft ? (
            <Fact
              label={PONS_LAUNCH_WINDOW.label}
              value={`${PONS_LAUNCH_WINDOW.shortValue} · snipe decay`}
            />
          ) : null}
          {launch.draft ? <Fact label="Graduation" value={!meta?.pair || meta.pair === "ETH" ? "4.2 ETH" : `In ${meta.pair}`} /> : null}
          {launch.draft ? <Fact label="Liquidity" value="Locked" /> : null}
        </dl>
      </section>

      <section className="sheet holder-card">
        <header className="data-head">
          <h2>Data</h2>
          <SlidingTabs
            ariaLabel="Token data"
            tone="quiet"
            value={dataTab}
            onChange={(tab) => {
              setDataTab(tab);
              setPage(1);
            }}
            items={[
              { id: "holders", label: "Top Holder" },
              { id: "tx", label: "Transaction" },
            ]}
          />
        </header>
        {dataTab === "holders" ? (
          holders.length === 0 ? (
            <p className="holder-empty">No holders yet.</p>
          ) : (
            <table className="holders">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Wallet</th>
                  <th>Amount</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {visibleHolders.map((row) => {
                  const yours = mine?.address === row.address;
                  return (
                    <tr key={row.rank} className={yours ? "is-you" : ""}>
                      <td>{row.rank}</td>
                      <td>{yours ? "You" : shortAddress(row.address)}</td>
                      <td>{formatAmount(row.amount)}</td>
                      <td>{row.share.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : trades.length === 0 ? (
          <p className="holder-empty">No transactions yet.</p>
        ) : (
          <table className="holders">
            <thead>
              <tr>
                <th>Type</th>
                <th>Wallet</th>
                <th>Amount</th>
                <th>ETH</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {visibleTrades.map((row) => {
                const yours = connected && row.address.toLowerCase() === address.toLowerCase();
                return (
                  <tr key={row.id}>
                    <td className={row.side === "Buy" ? "is-buy" : "is-sell"}>{row.side}</td>
                    <td>{yours ? "You" : shortAddress(row.address)}</td>
                    <td>
                      {formatAmount(row.amount)} {launch.symbol}
                    </td>
                    <td>{row.eth.toFixed(3)}</td>
                    <td>{row.time}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {pages > 1 ? <Pager page={currentPage} pages={pages} onChange={setPage} /> : null}
      </section>
      </div>

      <div className="trade-stack">
      <aside className={`sheet token-trade${dockOpen ? " is-open" : ""}`}>
        <div className="trade-launch">
          <button type="button" className="dock-buy" onClick={() => openDock("buy")}>
            Buy
          </button>
          <button type="button" className="dock-sell" onClick={() => openDock("sell")}>
            Sell
          </button>
        </div>
        <div className="trade-board">
          <header className="trade-board-bar">
            <button type="button" className="trade-close" aria-label="Close trade" onClick={() => { setDockOpen(false); setSetup(null); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M6 9.5 12 15.5 18 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="trade-modes" role="tablist" aria-label="Order type">
              {(["instant", "market", "limit"] as const).map((mode) => (
                <button key={mode} type="button" role="tab" aria-selected={orderMode === mode} className={orderMode === mode ? "on" : ""} onClick={() => setOrderMode(mode)}>
                  {mode === "instant" ? "Instant" : mode === "market" ? "Market" : "Limit"}
                </button>
              ))}
            </div>
            <button type="button" className="trade-pill" onClick={() => { if (!connected) connect(); }}>
              {connected ? shortAddress(address) : "Wallet"}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M6 9.5 12 15.5 18 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <button type="button" className="trade-pill" onClick={cyclePriority}>
              {priority}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M6 9.5 12 15.5 18 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <button type="button" className={`trade-gear${setup === "slip" ? " on" : ""}`} aria-label="Slippage settings" onClick={() => setSetup((current) => (current === "slip" ? null : "slip"))}>
              <GearIcon />
            </button>
          </header>
          {setup === "slip" ? (
            <div className="trade-setup-edit">
              {["5", "10", "15", "20"].map((value) => (
                <button key={value} type="button" className={slippage === value ? "on" : ""} onClick={() => { applySlippage(value); setAutoSlip(false); }}>
                  {value}%
                </button>
              ))}
              <input value={slippage} inputMode="decimal" aria-label="Slippage percent" onChange={(event) => { applySlippage(event.target.value); setAutoSlip(false); }} />
            </div>
          ) : null}
          {setup === "gwei" ? (
            <label className="trade-setup-edit">
              <span>Gwei</span>
              <input value={gwei} inputMode="decimal" aria-label="Gas gwei" onChange={(event) => applyGwei(event.target.value)} />
            </label>
          ) : null}
          {setup === "tpsl" ? (
            <div className="trade-setup-edit">
              <label>
                <span>TP %</span>
                <input value={tp} inputMode="decimal" aria-label="Take profit percent" onChange={(event) => setTp(event.target.value.replace(/[^\d.]/g, ""))} />
              </label>
              <label>
                <span>SL %</span>
                <input value={sl} inputMode="decimal" aria-label="Stop loss percent" onChange={(event) => setSl(event.target.value.replace(/[^\d.]/g, ""))} />
              </label>
            </div>
          ) : null}
          {orderMode !== "instant" ? (
            <div className="trade-mode-fields">
              {orderMode === "limit" ? (
                <label>
                  <span>Limit</span>
                  <input value={limitPrice} inputMode="decimal" aria-label="Limit price" placeholder="0.00" onChange={(event) => setLimitPrice(event.target.value.replace(/[^\d.]/g, ""))} />
                </label>
              ) : null}
              <label>
                <span>{side === "buy" ? quoteAsset : launch.symbol}</span>
                <input value={amount} inputMode="decimal" aria-label="Order amount" onChange={(event) => setAmount(event.target.value)} />
              </label>
            </div>
          ) : null}
          <div className="trade-lane buy">
            <div className="lane-head">
              <button type="button" className="lane-name" onClick={() => editLane("buy")}>
                Buy
                <PencilIcon />
              </button>
              {runningPnl !== null ? (
                <span className={`lane-delta${runningPnl >= 0 ? " is-up" : " is-down"}`}>
                  <i className="trade-pnl-dot" />
                  PnL {runningPnl >= 0 ? "+" : ""}
                  {runningPnl.toFixed(1)}%
                  {runningDelta !== null ? (
                    <em>
                      {runningDelta >= 0 ? "+" : "−"}
                      {formatUsd(Math.abs(runningDelta))}
                    </em>
                  ) : null}
                </span>
              ) : null}
              <span className="lane-balance">
                Balance ($) {connected ? "—" : "0"}
                <button type="button" className="lane-plus" aria-label={connected ? "Connected wallet" : "Connect wallet"} onClick={() => { if (!connected) connect(); }}>
                  +
                </button>
              </span>
            </div>
            <div className="token-chips">
              {presetOpen && side === "buy"
                ? presetDraft.map((value, index) => (
                    <input key={index} value={value} inputMode="decimal" aria-label={`Buy amount ${index + 1}`} onChange={(event) => setPresetDraft((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))} />
                  ))
                : presets.map((preset) => (
                    <button key={preset} type="button" className={side === "buy" && amount === preset ? "on" : ""} onClick={() => { setSide("buy"); setAmount(preset); }}>
                      {preset}
                    </button>
                  ))}
            </div>
            <div className="lane-meta">
              <button type="button" className={autoSlip ? "on" : ""} onClick={() => setAutoSlip((value) => !value)}>
                <ZapIcon />
                {autoSlip ? "Auto" : `${slippage || "0"}%`}
              </button>
              <button type="button" className={setup === "gwei" ? "on" : ""} onClick={() => setSetup((current) => (current === "gwei" ? null : "gwei"))}>
                <FuelIcon />
                {gwei || "0"}
              </button>
              <button type="button" className={mevOn ? "on" : ""} onClick={() => setMevOn((value) => !value)}>
                <ShieldIcon />
                {mevOn ? "ON" : "OFF"}
              </button>
              <button type="button" className="lane-extra" onClick={() => setSetup((current) => (current === "tpsl" ? null : "tpsl"))}>
                {tp || sl ? `TP ${tp || "—"} / SL ${sl || "—"}` : "TP/SL Not Set"}
              </button>
            </div>
          </div>
          <div className="trade-lane sell">
            <div className="lane-head">
              <button type="button" className="lane-name" onClick={() => editLane("sell")}>
                Sell
                <PencilIcon />
              </button>
              <span className="lane-balance">
                Balance {formatAmount(balance)} {launch.symbol} (($) {formatUsd(balance * launch.priceUsd).replace("$", "")})
              </span>
            </div>
            <div className="token-chips">
              {presetOpen && side === "sell"
                ? presetDraft.map((value, index) => (
                    <input key={index} value={value} inputMode="decimal" aria-label={`Sell percent ${index + 1}`} onChange={(event) => setPresetDraft((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))} />
                  ))
                : sellPercents.map((percent) => (
                    <button key={percent} type="button" className={side === "sell" && sellActive(percent) ? "on" : ""} onClick={() => { setSide("sell"); setAmount(tokensFor(percent)); }}>
                      {percent}%
                    </button>
                  ))}
            </div>
            <div className="lane-meta">
              <button type="button" className={autoSlip ? "on" : ""} onClick={() => setAutoSlip((value) => !value)}>
                <ZapIcon />
                {autoSlip ? "Auto" : `${slippage || "0"}%`}
              </button>
              <button type="button" className={setup === "gwei" ? "on" : ""} onClick={() => setSetup((current) => (current === "gwei" ? null : "gwei"))}>
                <FuelIcon />
                {gwei || "0"}
              </button>
              <button type="button" className={mevOn ? "on" : ""} onClick={() => setMevOn((value) => !value)}>
                <ShieldIcon />
                {mevOn ? "ON" : "OFF"}
              </button>
            </div>
          </div>
          {presetOpen ? (
            <button type="button" className="lane-save" onClick={savePresets}>
              Save amounts
            </button>
          ) : null}
        </div>
        <div className="trade-setup">
          <div className="trade-setup-row">
            <button type="button" className={setup === "slip" ? "on" : ""} onClick={() => setSetup((current) => (current === "slip" ? null : "slip"))}>
              Slip {slippage || "0"}%
            </button>
            <button type="button" className={setup === "gwei" ? "on" : ""} onClick={() => setSetup((current) => (current === "gwei" ? null : "gwei"))}>
              {gwei || "0"} gwei
            </button>
            <span className={`trade-pnl${runningPnl === null ? "" : runningPnl >= 0 ? " is-up" : " is-down"}`}>
              {runningPnl !== null ? <i className="trade-pnl-dot" /> : null}
              PnL {runningPnl === null ? "—" : `${runningPnl >= 0 ? "+" : ""}${runningPnl.toFixed(1)}%`}
              {runningDelta !== null ? <em>{`${runningDelta >= 0 ? "+" : "−"}${formatUsd(Math.abs(runningDelta))}`}</em> : null}
            </span>
          </div>
          {setup === "slip" ? (
            <div className="trade-setup-edit">
              {["5", "10", "15", "20"].map((value) => (
                <button key={value} type="button" className={slippage === value ? "on" : ""} onClick={() => applySlippage(value)}>
                  {value}%
                </button>
              ))}
              <input value={slippage} inputMode="decimal" aria-label="Slippage percent" onChange={(event) => applySlippage(event.target.value)} />
            </div>
          ) : null}
          {setup === "gwei" ? (
            <label className="trade-setup-edit">
              <span>Priority gwei</span>
              <input value={gwei} inputMode="decimal" aria-label="Gas gwei" onChange={(event) => applyGwei(event.target.value)} />
            </label>
          ) : null}
        </div>
        <div className={`seg trade${side === "sell" ? " is-sell" : ""}`}>
          {(["buy", "sell"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={side === item ? "on" : ""}
              onClick={() => {
                setPresetOpen(false);
                setPresetError("");
                setSide(item);
                setAmount(item === "buy" ? meta?.initialBuy || "0.1" : tokensFor(100));
              }}
            >
              {item === "buy" ? "Buy" : "Sell"}
            </button>
          ))}
        </div>
        <div className={`trade-amount${presetOpen ? " is-editing" : ""}`} ref={presetRef}>
          <div className="token-amount">
            <div className="amount-head">
              <span>{side === "buy" ? `${quoteAsset} to spend` : `${launch.symbol} to sell`}</span>
              <button type="button" className={`chip-settings${presetOpen ? " on" : ""}`} aria-label={presetOpen ? "Save quick amounts" : "Edit quick amounts"} aria-expanded={presetOpen} onClick={() => (presetOpen ? savePresets() : openPresets())}>
                {presetOpen ? <CheckIcon /> : <GearIcon />}
              </button>
            </div>
            <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" className="field" aria-label={side === "buy" ? `${quoteAsset} to spend` : `${launch.symbol} to sell`} />
          </div>
          <div className="token-chips">
            {presetOpen
              ? presetDraft.map((value, index) => (
                  <input
                    key={index}
                    value={value}
                    inputMode="decimal"
                    aria-label={side === "buy" ? `Amount ${index + 1}` : `Percent ${index + 1}`}
                    onChange={(event) => setPresetDraft((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))}
                  />
                ))
              : side === "buy"
                ? presets.map((preset) => (
                    <button key={preset} type="button" className={amount === preset ? "on" : ""} onClick={() => setAmount(preset)}>
                      {preset}
                    </button>
                  ))
                : sellPercents.map((percent) => (
                    <button key={percent} type="button" className={sellActive(percent) ? "on" : ""} onClick={() => setAmount(tokensFor(percent))}>
                      {percent}%
                    </button>
                  ))}
          </div>
          {presetError ? <p className="preset-error">{presetError}</p> : null}
        </div>
        <div className="token-quote">
          <span>You receive</span>
          <b>{quote === 0 ? "—" : side === "buy" ? `${formatAmount(quote)} ${launch.symbol}` : `${quote.toFixed(6)} ${quoteAsset}`}</b>
        </div>
        <button type="button" className={`btn${side === "sell" ? " sell" : ""}`}>
          {side === "buy" ? `Buy ${launch.symbol}` : `Sell ${launch.symbol}`}
        </button>
      </aside>
      {mine ? (
        <Position
          symbol={launch.symbol}
          price={launch.priceUsd}
          marketCap={launch.marketCap}
          ath={stats.ath}
          ethUsd={ethUsd}
          amount={mine.amount}
          entry={mine.entry}
          wallet={address}
        />
      ) : null}
      </div>
    </div>
  );
}

const pnlScenes = ["/pnlcard.png", "/pnlcard2.png", "/pnlcard3.png", "/pnlcard4.png", "/pnlcard5.png"];

const pnlFields = [
  ["symbol", "Ticker"],
  ["pnl", "PnL"],
  ["value", "Value"],
  ["multiple", "Multiple"],
  ["wallet", "Wallet"],
  ["entry", "Entry"],
  ["ath", "ATH"],
] as const;

type PnlField = (typeof pnlFields)[number][0];

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12.5 9.2 17 19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M13 3 5 14h7l-1 7 8-11h-7l1-7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function FuelIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 20V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v14M4 20h13M15 10h2.5a2 2 0 0 1 2 2v3.5a1.5 1.5 0 0 0 3 0V9l-3-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3 5 6v6c0 4.2 2.8 7.2 7 8.8 4.2-1.6 7-4.6 7-8.8V6l-7-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function dottedAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function Position({
  symbol,
  price,
  marketCap,
  ath,
  ethUsd,
  amount,
  entry,
  wallet,
}: {
  symbol: string;
  price: number;
  marketCap: number;
  ath: number;
  ethUsd: number;
  amount: number;
  entry: number;
  wallet: string;
}) {
  const value = amount * price;
  const cost = amount * entry;
  const delta = value - cost;
  const pnl = entry > 0 ? ((price - entry) / entry) * 100 : 0;
  const entryMcap = price > 0 ? marketCap * (entry / price) : 0;
  const multiple = entry > 0 ? price / entry : 0;
  const up = pnl >= 0;
  const [unit, setUnit] = useState<"usd" | "eth">("usd");
  const [shareOpen, setShareOpen] = useState(false);
  const [shown, setShown] = useState<Record<PnlField, boolean>>({
    symbol: true,
    pnl: true,
    value: true,
    multiple: true,
    wallet: true,
    entry: true,
    ath: true,
  });
  const scene = useMemo(() => pnlScenes[Math.floor(Math.random() * pnlScenes.length)], [symbol]);
  const money = (usd: number) => (unit === "usd" ? formatUsd(usd) : formatEth(usd / ethUsd));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [portalReady, setPortalReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const multipleLabel = multiple >= 10 ? `${multiple.toFixed(1)}x` : `${multiple.toFixed(2)}x`;
  const pnlLabel = `${up ? "+" : ""}${pnl.toFixed(1)}%`;
  const valueLabel = money(value);
  const shareText = `$${symbol} ${pnlLabel} · ${valueLabel} on LOOTING`;
  const sharePayload = useMemo(
    () => ({
      scene,
      symbol,
      pnlLabel,
      up,
      valueLabel,
      multipleLabel,
      walletLabel: dottedAddress(wallet),
      entryLabel: `Entry ${formatUsd(entryMcap)}`,
      athLabel: `ATH ${formatUsd(ath)}`,
      shown,
    }),
    [ath, entryMcap, multipleLabel, pnlLabel, scene, shown, symbol, up, valueLabel, wallet],
  );

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!shareOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancel = false;
    void paintPnlShareCard(sharePayload, canvas).then(() => {
      if (cancel) return;
    });
    return () => {
      cancel = true;
    };
  }, [shareOpen, sharePayload]);

  useEffect(() => {
    if (!shareOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [shareOpen]);

  async function makeShareBlob() {
    const canvas = canvasRef.current;
    if (!canvas) return paintPnlShareCard(sharePayload);
    await paintPnlShareCard(sharePayload, canvas);
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  async function saveImage() {
    if (busy) return;
    setBusy(true);
    setNote("");
    try {
      const blob = await makeShareBlob();
      if (!blob) return;
      downloadBlob(blob, `looting-${symbol.toLowerCase()}-pnl.png`);
      setNote("Image saved");
    } finally {
      setBusy(false);
    }
  }

  async function shareTwitter() {
    if (busy) return;
    setBusy(true);
    setNote("");
    try {
      const blob = await makeShareBlob();
      if (!blob) return;
      const file = new File([blob], `looting-${symbol.toLowerCase()}-pnl.png`, { type: "image/png" });
      const payload = { files: [file], title: "LOOTING position", text: shareText };
      if (navigator.canShare?.(payload)) {
        try {
          await navigator.share(payload);
          setNote("Shared");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      downloadBlob(blob, file.name);
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
        "_blank",
        "noopener,noreferrer",
      );
      setNote("Image saved — attach it on X");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="sheet position-card">
        <div className="position-head">
          <h2>Open position</h2>
          <span className={`position-pill${up ? " is-up" : " is-down"}`}>
            {up ? "+" : ""}
            {pnl.toFixed(1)}%
          </span>
        </div>
        <strong className="position-value">{formatUsd(value)}</strong>
        <p className="position-balance">
          {formatAmount(amount)} {symbol}
        </p>
        <dl>
          <div>
            <dt>Entry</dt>
            <dd>{formatPrice(entry)}</dd>
          </div>
          <div>
            <dt>Cost</dt>
            <dd>{formatUsd(cost)}</dd>
          </div>
          <div>
            <dt>PnL</dt>
            <dd className={up ? "is-up" : "is-down"}>
              {up ? "+" : "−"}
              {formatUsd(Math.abs(delta))}
            </dd>
          </div>
        </dl>
        <button
          type="button"
          className="position-share"
          onClick={() => {
            setShareOpen(true);
            setNote("");
          }}
        >
          Share
        </button>
      </section>

      {shareOpen && portalReady
        ? createPortal(
            <div
              className="position-share-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Share position"
              onClick={() => setShareOpen(false)}
            >
              <div className="position-share-pop" onClick={(event) => event.stopPropagation()}>
                <header className="position-share-head">
                  <span>Share card</span>
                  <button type="button" className="position-share-close" onClick={() => setShareOpen(false)} aria-label="Close">
                    Close
                  </button>
                </header>
                <canvas
                  ref={canvasRef}
                  className="pnl-card pnl-share-canvas"
                  aria-label={`Share card for $${symbol}`}
                />
                <div className="pnl-controls">
                  <div className="pnl-setting">
                    <span>Show in</span>
                    <div className="seg pnl-unit">
                      <button type="button" className={unit === "usd" ? "on" : ""} onClick={() => setUnit("usd")}>
                        $
                      </button>
                      <button type="button" className={unit === "eth" ? "on" : ""} onClick={() => setUnit("eth")}>
                        ETH
                      </button>
                    </div>
                  </div>
                  <div className="pnl-flags">
                    {pnlFields.map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={shown[key] ? "on" : ""}
                        aria-pressed={shown[key]}
                        onClick={() => setShown((current) => ({ ...current, [key]: !current[key] }))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="position-share-actions">
                  <button type="button" className="position-share-x" disabled={busy} onClick={shareTwitter}>
                    Share on X
                  </button>
                  <button type="button" className="position-share-save" disabled={busy} onClick={saveImage}>
                    Save image
                  </button>
                </div>
                {note ? <p className="position-share-note">{note}</p> : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

type PnlSharePaint = {
  scene: string;
  symbol: string;
  pnlLabel: string;
  up: boolean;
  valueLabel: string;
  multipleLabel: string;
  walletLabel: string;
  entryLabel: string;
  athLabel: string;
  shown: Record<PnlField, boolean>;
};

async function paintPnlShareCard(input: PnlSharePaint, target?: HTMLCanvasElement) {
  const [sceneImg, mark] = await Promise.all([loadImage(input.scene), loadImage("/logo-wordmark.png")]);
  const width = 1920;
  const height = 1080;
  // Match CSS preview proportions (card ~388px wide in popup).
  const s = width / 388;
  const canvas = target ?? document.createElement("canvas");
  const pixel = Math.max(2, Math.min(3, Math.round(window.devicePixelRatio || 2)));
  canvas.width = width * pixel;
  canvas.height = height * pixel;
  if (target) {
    canvas.style.width = "100%";
    canvas.style.height = "auto";
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(pixel, 0, 0, pixel, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, width, height);

  // object-fit: cover; object-position: left center
  const cover = Math.max(width / sceneImg.naturalWidth, height / sceneImg.naturalHeight);
  const drawW = sceneImg.naturalWidth * cover;
  const drawH = sceneImg.naturalHeight * cover;
  ctx.drawImage(sceneImg, 0, (height - drawH) / 2, drawW, drawH);

  const fade = ctx.createLinearGradient(width * 0.06, 0, width * 0.82, 0);
  fade.addColorStop(0, "rgba(9, 9, 11, 0)");
  fade.addColorStop(0.22, "rgba(9, 9, 11, 0.08)");
  fade.addColorStop(0.46, "rgba(9, 9, 11, 0.28)");
  fade.addColorStop(0.68, "rgba(9, 9, 11, 0.58)");
  fade.addColorStop(0.86, "rgba(9, 9, 11, 0.86)");
  fade.addColorStop(1, "#09090b");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, width, height);

  const floorH = 36 * s;
  const floor = ctx.createLinearGradient(0, height - floorH, 0, height);
  floor.addColorStop(0, "rgba(9, 9, 11, 0)");
  floor.addColorStop(0.62, "rgba(9, 9, 11, 0.78)");
  floor.addColorStop(1, "#09090b");
  ctx.fillStyle = floor;
  ctx.fillRect(0, height - floorH, width, floorH);

  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  const logoH = 12 * s;
  const logoW = mark.naturalWidth > 0 ? (mark.naturalWidth / mark.naturalHeight) * logoH : 0;
  if (logoW > 0) {
    const padX = 8 * s;
    const wrapH = 22 * s;
    const boxW = logoW + padX * 2;
    const boxX = 16 * s;
    const boxY = 8 * s;
    ctx.fillStyle = "rgba(9, 9, 11, 0.72)";
    roundRectPath(ctx, boxX, boxY, boxW, wrapH, wrapH / 2);
    ctx.fill();
    ctx.drawImage(mark, boxX + padX, boxY + (wrapH - logoH) / 2, logoW, logoH);
  }

  const inset = 16 * s;
  const right = width - inset;
  const copyTop = 16 * s;
  const copyBottom = 30 * s;
  const lines: { text: string; size: number; weight: string; color: string; gap: number }[] = [];
  if (input.shown.symbol) lines.push({ text: `$${input.symbol}`, size: 12 * s, weight: "600", color: "#fff", gap: 2 * s });
  if (input.shown.pnl) {
    lines.push({
      text: input.pnlLabel,
      size: 30 * s,
      weight: "700",
      color: input.up ? "#ccff00" : "#ff4d4d",
      gap: 4 * s,
    });
  }
  if (input.shown.value) lines.push({ text: input.valueLabel, size: 13 * s, weight: "600", color: "#fff", gap: 3 * s });
  if (input.shown.multiple) lines.push({ text: input.multipleLabel, size: 12 * s, weight: "600", color: "#fff", gap: 0 });

  const blockH = lines.reduce((sum, line, index) => sum + line.size + (index < lines.length - 1 ? line.gap : 0), 0);
  const areaH = height - copyTop - copyBottom;
  let y = copyTop + Math.max(0, (areaH - blockH) / 2);
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  for (const line of lines) {
    ctx.fillStyle = line.color;
    ctx.font = `${line.weight} ${line.size}px ${family}`;
    ctx.fillText(line.text, right, y);
    y += line.size + line.gap;
  }

  if (input.shown.wallet || input.shown.entry || input.shown.ath) {
    ctx.fillStyle = "#fff";
    ctx.font = `300 ${8 * s}px ${family}`;
    ctx.textBaseline = "bottom";
    const footY = height - 12 * s;
    if (input.shown.wallet) {
      ctx.textAlign = "left";
      ctx.fillText(input.walletLabel, inset, footY);
    }
    if (input.shown.entry) {
      ctx.textAlign = "center";
      ctx.fillText(input.entryLabel, width / 2, footY);
    }
    if (input.shown.ath) {
      ctx.textAlign = "right";
      ctx.fillText(input.athLabel, width - inset, footY);
    }
  }

  if (target) return null;
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function socials(launch: Launch, meta?: { website?: string; twitter?: string; telegram?: string; discord?: string; farcaster?: string }) {
  const provided = [
    linkChip("Website", meta?.website),
    linkChip("X", meta?.twitter),
    linkChip("Telegram", meta?.telegram),
    linkChip("Discord", meta?.discord),
    linkChip("Farcaster", meta?.farcaster),
  ].filter((item): item is { label: string; href: string } => Boolean(item));
  if (provided.length > 0 || launch.draft) return provided;
  const slug = launch.symbol.toLowerCase();
  return [
    { label: "Website", href: `https://${slug}.lootingpad.com` },
    { label: "X", href: `https://x.com/${slug}` },
    { label: "Telegram", href: `https://t.me/${slug}` },
    { label: "Discord", href: `https://discord.gg/${slug}` },
  ];
}

function linkChip(label: string, value?: string) {
  const clean = value?.trim();
  if (!clean) return null;
  if (clean.startsWith("http")) return { label, href: clean };
  const handle = clean.replace(/^@/, "");
  const host =
    label === "X"
      ? "https://x.com/"
      : label === "Telegram"
        ? "https://t.me/"
        : label === "Discord"
          ? "https://discord.gg/"
          : label === "Farcaster"
            ? "https://warpcast.com/"
            : "https://";
  return { label, href: `${host}${handle}` };
}

function LinkGlyph({ label }: { label: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
      {label === "Website" && (
        <>
          <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <ellipse cx="12" cy="12" rx="3.4" ry="8.25" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M3.75 12h16.5M5.1 8.1h13.8M5.1 15.9h13.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </>
      )}
      {label === "X" && (
        <path
          fill="currentColor"
          d="M14.23 10.16 20.57 3h-1.5l-5.51 6.21L8.92 3H3.5l6.64 9.38L3.5 21h1.5l5.8-6.55L14.7 21h5.42l-6.89-10.84Zm-2.05 2.32-.67-.93-5.35-7.42h2.3l4.31 5.99.67.93 5.61 7.8h-2.3l-4.57-6.37Z"
        />
      )}
      {label === "Telegram" && (
        <path
          fill="currentColor"
          d="M21.2 4.6 2.9 11.7c-1.25.49-1.24 1.17-.23 1.48l4.7 1.47 10.87-6.86c.51-.31.98-.14.6.2l-8.8 7.94-.34 4.55c.46 0 .66-.21.92-.46l2.2-2.14 4.58 3.38c.84.46 1.45.22 1.66-.78l3-14.55c.31-1.24-.47-1.8-1.26-1.43Z"
        />
      )}
      {label === "Discord" && (
        <path
          fill="currentColor"
          d="M18.59 5.67A16.3 16.3 0 0 0 14.9 4.4l-.3.6a15 15 0 0 0-4.2 0l-.3-.6a16.2 16.2 0 0 0-3.7 1.27C3.7 9.5 3.1 13.2 3.4 16.86a16.6 16.6 0 0 0 4.95 2.5l.6-1c-.9-.34-1.75-.76-2.55-1.28l.32-.24c3.3 1.53 6.86 1.53 10.1 0l.33.24c-.8.52-1.66.94-2.56 1.28l.6 1a16.5 16.5 0 0 0 4.96-2.5c.4-4.2-.68-7.86-2.86-11.19ZM9.18 14.7c-.86 0-1.57-.8-1.57-1.77s.7-1.77 1.57-1.77 1.58.8 1.57 1.77-.7 1.77-1.57 1.77Zm5.64 0c-.86 0-1.57-.8-1.57-1.77s.7-1.77 1.57-1.77 1.58.8 1.57 1.77-.7 1.77-1.57 1.77Z"
        />
      )}
      {label === "Farcaster" && (
        <path
          fill="currentColor"
          d="M17.2 6.2h-2.1V4.4H8.9v1.8H6.8v8.2c0 1.7.7 2.6 2.1 2.6h.7v2.6h4.8v-2.6h.7c1.4 0 2.1-.9 2.1-2.6V6.2Zm-7.5 0h4.6V5.6H9.7v.6Z"
        />
      )}
    </svg>
  );
}

function LockBadgeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="10" width="14" height="11" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8 10V8.2A4 4 0 0 1 12 4a4 4 0 0 1 4 4.2V10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="15" r="1.35" fill="currentColor" />
    </svg>
  );
}

function DexscreenerBadgeIcon() {
  return <img src="/dexscreener.png" alt="" width={16} height={16} className="token-badge-img" decoding="async" />;
}

function BoostBadgeIcon() {
  // DexScreener Boost bolt (filled yellow lightning used on DS badges)
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M13.05 2.1 5.7 13.28c-.22.34.02.82.43.82h4.62l-1.1 7.66c-.08.55.6.9.97.5l8.05-11.18c.25-.35 0-.88-.43-.88h-4.9l1.28-7.6c.1-.55-.58-.92-.97-.5Z"
      />
    </svg>
  );
}

function formatEth(value: number) {
  if (value >= 100) return `${value.toFixed(1)} ETH`;
  if (value >= 1) return `${value.toFixed(2)} ETH`;
  return `${value.toFixed(4)} ETH`;
}

function formatAmount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(2);
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

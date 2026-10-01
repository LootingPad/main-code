"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getLootingTokenConfig } from "@/lib/api";
import { formatCount, formatPrice, formatUsd, shortAddress } from "@/lib/format";
import type { TrenchTick } from "@/lib/trenches";
import { CandleChart } from "./CandleChart";
import { TokenLogo } from "./TokenLogo";

const POLL_MS = 12_000;

type LiveMarket = {
  priceUsd: number | null;
  marketCap: number | null;
  fdv: number | null;
  volume24h: number | null;
  liquidity: number | null;
  change24h: number | null;
  holders: number | null;
  circulating: number | null;
  totalSupply: number | null;
  burned: number | null;
  burnedUsd: number | null;
  locked?: number | null;
  staked?: number | null;
  boxes?: number | null;
  asOf: string;
};

type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

type Socials = {
  twitter: string;
  telegram: string;
  discord: string;
  website: string;
  farcaster: string;
};

type SocialLink = { label: string; href: string };

function formatTokens(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString("en-US");
}

function CopyIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10.5 5.5V4.2A1.7 1.7 0 0 0 8.8 2.5H4.2A1.7 1.7 0 0 0 2.5 4.2v4.6A1.7 1.7 0 0 0 4.2 10.5H5.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function LinkGlyph({ label }: { label: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      {label === "Website" && (
        <>
          <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <ellipse cx="12" cy="12" rx="3.4" ry="8.25" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M3.75 12h16.5M5.1 8.1h13.8M5.1 15.9h13.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
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

function isAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

function MetricValue({ value, loading }: { value: string | null | undefined; loading: boolean }) {
  if (value != null && value !== "") return <>{value}</>;
  if (loading) return <span className="sk looting-sk-value" aria-hidden />;
  return <>—</>;
}

function socialHref(label: string, value?: string): string | null {
  const clean = value?.trim();
  if (!clean) return null;
  if (/^https?:\/\//i.test(clean)) return clean;
  const handle = clean.replace(/^@/, "");
  if (label === "X") return `https://x.com/${handle}`;
  if (label === "Telegram") return `https://t.me/${handle}`;
  if (label === "Discord") return `https://discord.gg/${handle}`;
  if (label === "Farcaster") return `https://warpcast.com/${handle}`;
  if (label === "Website") return `https://${handle.replace(/^https?:\/\//i, "")}`;
  return null;
}

function buildSocialLinks(socials: Socials): SocialLink[] {
  const rows = [
    { label: "Website", href: socialHref("Website", socials.website) },
    { label: "X", href: socialHref("X", socials.twitter) },
    { label: "Telegram", href: socialHref("Telegram", socials.telegram) },
    { label: "Discord", href: socialHref("Discord", socials.discord) },
    { label: "Farcaster", href: socialHref("Farcaster", socials.farcaster) },
  ];
  const seen = new Set<string>();
  const out: SocialLink[] = [];
  for (const row of rows) {
    if (!row.href) continue;
    const key = row.href.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label: row.label, href: row.href });
  }
  return out;
}

export function LootingToken() {
  const [copied, setCopied] = useState(false);
  const [address, setAddress] = useState("");
  const [symbol, setSymbol] = useState("LOOTING");
  const [name, setName] = useState("LOOTING");
  const [logo, setLogo] = useState("");
  const [description, setDescription] = useState("");
  const [tagline, setTagline] = useState("$LOOTING powers the Robinhood Chain launchpad");
  const [blurb, setBlurb] = useState(
    "Protocol burn share from LOOTING launches is tracked here once the token CA and fee routing are live.",
  );
  const [asOf, setAsOf] = useState<string | null>(null);
  const [market, setMarket] = useState<LiveMarket | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [socials, setSocials] = useState<Socials>({
    twitter: "",
    telegram: "",
    discord: "",
    website: "",
    farcaster: "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stop = false;
    const pull = async () => {
      try {
        const config = await getLootingTokenConfig();
        if (stop) return;
        setAddress(config.address || "");
        if (config.symbol) setSymbol(config.symbol);
        if (config.name) setName(config.name);
        setLogo(config.logo || "");
        setDescription(config.description || "");
        if (config.tagline) setTagline(config.tagline);
        if (config.blurb) setBlurb(config.blurb);
        if (config.asOf) setAsOf(config.asOf);
        else if (config.market?.asOf) setAsOf(new Date(config.market.asOf).toLocaleString());
        setMarket(config.market);
        setCandles(Array.isArray(config.candles) ? config.candles : []);
        if (config.socials) {
          setSocials({
            twitter: config.socials.twitter || "",
            telegram: config.socials.telegram || "",
            discord: config.socials.discord || "",
            website: config.socials.website || "",
            farcaster: config.socials.farcaster || "",
          });
        }
      } catch {
        /* keep last good snapshot */
      } finally {
        if (!stop) setLoading(false);
      }
    };
    void pull();
    const id = window.setInterval(pull, POLL_MS);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  const hasCa = isAddress(address);
  const links = useMemo(() => buildSocialLinks(socials), [socials]);
  const ticks = useMemo<TrenchTick[]>(
    () =>
      candles
        .filter((row) => Number.isFinite(row.t) && Number.isFinite(row.c))
        .map((row) => ({
          t: row.t > 1_000_000_000_000 ? row.t : row.t * 1000,
          p: row.c,
          v: Number.isFinite(row.v) ? row.v : 0,
        })),
    [candles],
  );

  const priceLabel = market?.priceUsd != null ? formatPrice(market.priceUsd) : null;
  const mcapLabel = market?.marketCap != null ? formatUsd(market.marketCap) : null;
  const volumeLabel = market?.volume24h != null ? formatUsd(market.volume24h) : null;
  const fdvLabel = market?.fdv != null ? formatUsd(market.fdv) : null;
  const liquidityLabel = market?.liquidity != null ? formatUsd(market.liquidity) : null;
  const changeLabel =
    market?.change24h != null
      ? `${market.change24h >= 0 ? "+" : ""}${market.change24h.toFixed(2)}%`
      : null;
  const changeDown = market?.change24h != null && market.change24h < 0;

  const showSkeleton = loading || !hasCa;

  const boardCells = [
    {
      label: "Lock",
      value: market?.locked != null ? formatTokens(market.locked) : null,
    },
    {
      label: "Stake",
      value: market?.staked != null ? formatTokens(market.staked) : null,
    },
    {
      label: "Boxes",
      value: market?.boxes != null ? formatCount(market.boxes) : null,
    },
    { label: "Price", value: priceLabel },
    { label: "Market cap", value: mcapLabel },
    { label: "FDV", value: fdvLabel },
    { label: "24h volume", value: volumeLabel },
    { label: "Liquidity", value: liquidityLabel },
    {
      label: "Holders",
      value: market?.holders != null ? formatCount(market.holders) : null,
    },
    {
      label: "Circulating",
      value: market?.circulating != null ? formatTokens(market.circulating) : null,
    },
    {
      label: "Total supply",
      value: market?.totalSupply != null ? formatTokens(market.totalSupply) : null,
    },
    {
      label: "Burned",
      value: market?.burned != null ? formatTokens(market.burned) : null,
    },
  ];

  async function copyCa() {
    if (!hasCa) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  const summary = description?.trim() || blurb;

  return (
    <div className="looting-token-page">
      <section className="sheet looting-token-hero">
        <div className="looting-token-hero-main">
          {showSkeleton && !logo ? (
            <span className="sk looting-sk-logo" aria-hidden />
          ) : (
            <TokenLogo
              symbol={symbol}
              size={56}
              src={logo || null}
              address={hasCa ? address : undefined}
              priority
            />
          )}
          <div className="looting-token-hero-copy">
            <div className="looting-token-hero-title-row">
              <h1>
                <span className="looting-token-kicker">${symbol}</span>
                {name.toUpperCase() !== symbol.toUpperCase() ? <strong>{name}</strong> : null}
              </h1>
              {hasCa ? (
                <button
                  type="button"
                  className={`looting-ca-badge ${copied ? "is-copied" : ""}`}
                  onClick={copyCa}
                  title={address}
                  aria-label={`Copy contract address ${address}`}
                >
                  <em>CA</em>
                  <code>{shortAddress(address)}</code>
                  <CopyIcon />
                </button>
              ) : showSkeleton ? (
                <span className="sk looting-sk-chip" aria-hidden />
              ) : null}
              {links.length > 0 ? (
                <div className="looting-token-socials" aria-label="Token links">
                  {links.map((link) => (
                    <a
                      key={`${link.label}-${link.href}`}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="looting-social-chip"
                      title={link.label}
                      aria-label={link.label}
                    >
                      <LinkGlyph label={link.label} />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
            {showSkeleton && !description && !blurb ? (
              <div className="looting-sk-desc" aria-hidden>
                <span className="sk sk-line" />
                <span className="sk sk-line mid" />
              </div>
            ) : (
              <p className="looting-token-hero-desc">
                {summary}
                {tagline && summary !== tagline ? (
                  <span className="looting-token-hero-tag"> · {tagline}</span>
                ) : null}
              </p>
            )}
          </div>
          <div className="looting-token-hero-side">
            <div className="looting-token-hero-spot">
              <strong>
                <MetricValue value={priceLabel} loading={showSkeleton} />
              </strong>
              <em className={changeDown ? "is-down" : "is-up"}>
                <MetricValue value={changeLabel} loading={showSkeleton} />
              </em>
            </div>
            <div className="looting-token-hero-actions">
              {hasCa ? (
                <Link href={`/token/${address}`} className="claim-btn claim-all">
                  Buy ${symbol}
                </Link>
              ) : (
                <span className="claim-btn claim-all is-soon" aria-disabled>
                  Buy ${symbol}
                </span>
              )}
              <Link href="/" className="looting-hero-secondary">
                Explore
              </Link>
            </div>
          </div>
        </div>

        <div className="looting-token-board" role="group" aria-label={`Live ${symbol} market`}>
          {boardCells.map((card) => (
            <div key={card.label} className="looting-board-cell">
              <span>{card.label}</span>
              <strong>
                <MetricValue value={card.value} loading={showSkeleton} />
              </strong>
            </div>
          ))}
        </div>
      </section>

      <section className="sheet looting-live-chart">
        <header className="looting-live-chart-head">
          <div>
            <h2>Chart</h2>
            <p>
              {showSkeleton
                ? "Loading on-chain feed…"
                : `On-chain · launch → now${asOf ? ` · as of ${asOf}` : ""}`}
            </p>
          </div>
        </header>
        {ticks.length > 0 ? (
          <CandleChart symbol={symbol} ticks={ticks} spot={market?.priceUsd ?? undefined} />
        ) : showSkeleton ? (
          <div className="looting-chart-skeleton" aria-hidden>
            <span className="sk looting-sk-chart" />
          </div>
        ) : (
          <p className="page-note looting-chart-empty">No on-chain history yet for this CA.</p>
        )}
      </section>
    </div>
  );
}

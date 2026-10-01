"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/** Same priority as backend — public ipfs.io / pinata often 429 for anon traffic. */
const IPFS_GATEWAYS = [
  "https://ipfs.filebase.io/ipfs/",
  "https://4everland.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://w3s.link/ipfs/",
  "https://dweb.link/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
];

/** Browsers cannot load ipfs:// directly. Try public gateways, then the letter mark. */
function logoSources(src: string): string[] {
  const value = src.trim();
  if (!value) return [];
  const ipfs = value.match(/^ipfs:\/\/(?:ipfs\/)?(.+)$/i);
  if (ipfs) {
    const cid = ipfs[1].replace(/^\/+/, "");
    return [
      ...IPFS_GATEWAYS.map((gateway) => `${gateway}${cid}`),
      `https://${cid}.ipfs.dweb.link`,
      `https://${cid}.ipfs.nftstorage.link`,
    ];
  }
  const ar = value.match(/^ar:\/\/(.+)$/i);
  if (ar) return [`https://arweave.net/${ar[1]}`];
  const viaIpfs = value.match(/\/ipfs\/([^/?#]+)/i);
  if (viaIpfs) {
    const cid = viaIpfs[1];
    return [value, ...IPFS_GATEWAYS.map((gateway) => `${gateway}${cid}`)];
  }
  return [value];
}

function proxyUrl(address: string, attempt: number) {
  const base = `/backend-api/trenches/image/${address}`;
  return attempt <= 0 ? base : `${base}?r=${attempt}`;
}

export function TokenLogo({
  symbol,
  size = 32,
  src,
  address,
  priority = false,
}: {
  symbol: string;
  size?: number;
  src?: string | null;
  /** Loads the image through the API so ipfs and blocked CDNs still render. */
  address?: string;
  /** Eager-load for above-the-fold marks (token page). */
  priority?: boolean;
}) {
  const tokenKey = (address || symbol || "").toLowerCase();
  const sources = useMemo(() => {
    const list = [
      ...(address ? [proxyUrl(address, 0)] : []),
      ...(src ? logoSources(src) : []),
    ];
    return [...new Set(list.filter(Boolean))];
  }, [address, src]);

  const [index, setIndex] = useState(0);
  const [lockedUrl, setLockedUrl] = useState<string | null>(null);
  const [proxyAttempt, setProxyAttempt] = useState(0);
  const [tick, setTick] = useState(0);
  const tokenRef = useRef(tokenKey);

  useEffect(() => {
    if (tokenRef.current === tokenKey) return;
    tokenRef.current = tokenKey;
    setLockedUrl(null);
    setIndex(0);
    setProxyAttempt(0);
    setTick(0);
  }, [tokenKey]);

  // Soft retry after gateway flaps — backend may have warmed the cache.
  useEffect(() => {
    if (lockedUrl || !address) return;
    if (index < sources.length) return;
    if (proxyAttempt >= 3) return;
    const wait = 1200 * (proxyAttempt + 1);
    const id = window.setTimeout(() => {
      setProxyAttempt((n) => n + 1);
      setIndex(0);
      setTick((n) => n + 1);
    }, wait);
    return () => window.clearTimeout(id);
  }, [address, index, lockedUrl, proxyAttempt, sources.length]);

  const activeSources = useMemo(() => {
    if (!address || proxyAttempt <= 0) return sources;
    return [proxyUrl(address, proxyAttempt), ...sources.filter((url) => !url.includes("/trenches/image/"))];
  }, [address, proxyAttempt, sources]);

  const showUrl = lockedUrl ?? (index < activeSources.length ? activeSources[index] : null);

  if (showUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={`${showUrl}:${proxyAttempt}:${tick}`}
        src={showUrl}
        alt=""
        width={size}
        height={size}
        className="token-mark shrink-0"
        style={{
          width: size,
          height: size,
          aspectRatio: "1 / 1",
          borderRadius: 8,
          objectFit: "cover",
          objectPosition: "center",
          background: "#111",
          display: "block",
          overflow: "hidden",
        }}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        referrerPolicy="no-referrer"
        onLoad={() => setLockedUrl(showUrl)}
        onError={() => {
          if (lockedUrl) return;
          setIndex((current) => current + 1);
        }}
      />
    );
  }

  // Missing token art → LOOTING mark on a dark tile (never invent a fake coin image).
  const pad = Math.max(4, Math.round(size * 0.18));
  return (
    <span
      className="token-mark shrink-0"
      aria-hidden
      title={symbol}
      style={{
        width: size,
        height: size,
        aspectRatio: "1 / 1",
        borderRadius: 8,
        background: "#141414",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        padding: pad,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt=""
        width={size - pad * 2}
        height={size - pad * 2}
        style={{ width: "100%", height: "100%", objectFit: "contain", opacity: 0.92 }}
        decoding="async"
      />
    </span>
  );
}

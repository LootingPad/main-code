"use client";

import { useEffect, useState } from "react";

const IPFS_GATEWAYS = ["https://ipfs.io/ipfs/", "https://dweb.link/ipfs/", "https://gateway.pinata.cloud/ipfs/"];

/** Browsers cannot load ipfs:// directly. Try public gateways, then the letter mark. */
function logoSources(src: string): string[] {
  const value = src.trim();
  if (!value) return [];
  const ipfs = value.match(/^ipfs:\/\/(?:ipfs\/)?(.+)$/i);
  if (ipfs) {
    const cid = ipfs[1].replace(/^\/+/, "");
    return IPFS_GATEWAYS.map((gateway) => `${gateway}${cid}`);
  }
  const ar = value.match(/^ar:\/\/(.+)$/i);
  if (ar) return [`https://arweave.net/${ar[1]}`];
  return [value];
}

export function TokenLogo({
  symbol,
  size = 32,
  src,
  address,
}: {
  symbol: string;
  size?: number;
  src?: string | null;
  /** Loads the image through the API so ipfs and blocked CDNs still render. */
  address?: string;
}) {
  const sources = [
    ...(address ? [`/backend-api/trenches/image/${address}`] : []),
    ...(src ? logoSources(src) : []),
  ];
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [src, address]);
  const url = sources[index] ?? null;

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className="token-mark shrink-0"
        style={{ width: size, height: size, borderRadius: 8, objectFit: "cover", background: "#111" }}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setIndex((current) => current + 1)}
      />
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="token-mark shrink-0">
      <rect width="40" height="40" rx="8" fill={ground(symbol)} />
      <Mark symbol={symbol} />
    </svg>
  );
}

function ground(symbol: string) {
  if (symbol === "LOOTING") return "#111111";
  if (symbol === "HARBOR" || symbol === "QUIET") return "#111111";
  if (symbol === "THREAD" || symbol === "KEY") return "#f4f4f4";
  return "#ccff00";
}

function ink(symbol: string) {
  return symbol === "HARBOR" || symbol === "QUIET" || symbol === "LOOTING" ? "#ccff00" : "#111111";
}

function Mark({ symbol }: { symbol: string }) {
  const stroke = ink(symbol);
  if (symbol === "LOOTING") {
    return (
      <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="20" cy="20" r="10" />
        <path d="M20 12.5c2.2 2.5 3.8 4.8 3.8 7.1a3.8 3.8 0 0 1-7.6 0c0-2.3 1.6-4.6 3.8-7.1Z" />
      </g>
    );
  }
  return (
    <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
      <path d="M12 22c2-6 14-6 16 0" />
      <path d="M15 18c1.5-3 8.5-3 10 0" />
      <text x="20" y="28" textAnchor="middle" fill={stroke} stroke="none" fontSize="9" fontWeight="700">
        {(symbol || "?").slice(0, 3)}
      </text>
    </g>
  );
}

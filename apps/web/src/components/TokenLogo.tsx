export function TokenLogo({ symbol, size = 32 }: { symbol: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="token-mark shrink-0">
      <rect width="40" height="40" rx="8" fill={ground(symbol)} />
      <Mark symbol={symbol} />
    </svg>
  );
}

function ground(symbol: string) {
  if (symbol === "HARBOR" || symbol === "QUIET") return "#111111";
  if (symbol === "THREAD" || symbol === "KEY") return "#f4f4f4";
  return "#ccff00";
}

function ink(symbol: string) {
  return symbol === "HARBOR" || symbol === "QUIET" ? "#ccff00" : "#111111";
}

function Mark({ symbol }: { symbol: string }) {
  const stroke = ink(symbol);
  if (symbol === "VAULT") {
    return (
      <g fill="none" stroke={stroke} strokeWidth="2">
        <rect x="12" y="16" width="16" height="12" rx="2" />
        <path d="M16 16v-3a4 4 0 0 1 8 0v3" />
      </g>
    );
  }
  if (symbol === "THREAD") {
    return <path d="M10 24c6-10 14-10 20 0M10 16c6 10 14 10 20 0" fill="none" stroke={stroke} strokeWidth="2" />;
  }
  if (symbol === "HARBOR") {
    return (
      <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
        <path d="M20 10v16" />
        <path d="M14 28h12" />
        <circle cx="20" cy="14" r="3" />
      </g>
    );
  }
  if (symbol === "LANTERN") {
    return (
      <g fill={stroke}>
        <rect x="16" y="14" width="8" height="12" rx="3" />
        <rect x="18" y="11" width="4" height="3" />
      </g>
    );
  }
  if (symbol === "KEY") {
    return (
      <g fill="none" stroke={stroke} strokeWidth="2">
        <circle cx="16" cy="18" r="4" />
        <path d="M20 18h10M26 18v4M30 18v3" />
      </g>
    );
  }
  return (
    <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
      <path d="M12 22c2-6 14-6 16 0" />
      <path d="M15 18c1.5-3 8.5-3 10 0" />
    </g>
  );
}

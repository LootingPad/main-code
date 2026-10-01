const avatarColors = ["#8eb6ff", "#7d6bff", "#5ee0b5", "#f0c36a", "#ff8fab", "#67d4ff"];

export function tokenColor(symbol: string) {
  const index = [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0) % avatarColors.length;
  return avatarColors[index];
}

export function shortAddress(address: string) {
  if (!address || address.length < 10) return address || "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatCount(value: number) {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatUsd(value: number) {
  const raw = Number.isFinite(value) ? value : 0;
  const amount = Math.abs(raw);
  const sign = raw < 0 ? "-" : "";
  if (amount >= 1_000_000_000_000) return `${sign}$${(amount / 1_000_000_000_000).toFixed(2)}T`;
  if (amount >= 1_000_000_000) return `${sign}$${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `${sign}$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${sign}$${(amount / 1_000).toFixed(1)}k`;
  return `${sign}$${amount.toFixed(2)}`;
}

export function formatPrice(value: number) {
  if (!Number.isFinite(value) || value === 0) return "$0";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 0.01) return `${sign}$${abs.toFixed(4)}`;
  if (abs >= 0.001) return `${sign}$${abs.toFixed(6)}`;
  return `${sign}$${formatCompactDecimal(abs)}`;
}

const SUPER_DIGITS = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

function toSuperscript(n: number): string {
  return String(Math.max(0, Math.trunc(n)))
    .split("")
    .map((d) => SUPER_DIGITS[Number(d)] ?? d)
    .join("");
}

/**
 * Tiny decimals as meme-style compact form: `0.0000205` → `0.0⁴2`
 * (superscript = count of zeros after the decimal before the first non-zero digit).
 * Only compresses when there are 3+ leading zeros; keeps 1 significant digit so it stays short.
 */
export function formatCompactDecimal(value: number, maxSigDigits = 1): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 0.001) {
    const fixed = abs >= 1 ? abs.toFixed(4) : abs.toFixed(6);
    return `${sign}${fixed.replace(/\.?0+$/, "")}`;
  }
  const digits = Math.min(18, Math.max(6, Math.ceil(-Math.log10(abs)) + Math.max(1, maxSigDigits) + 2));
  const afterDot = abs.toFixed(digits).split(".")[1] ?? "";
  let zeros = 0;
  while (zeros < afterDot.length && afterDot[zeros] === "0") zeros += 1;
  const sig = afterDot.slice(zeros).replace(/0+$/, "");
  if (!sig) return `${sign}0`;
  if (zeros < 3) return `${sign}0.${afterDot.slice(0, zeros + Math.min(sig.length, Math.max(1, maxSigDigits)))}`;
  return `${sign}0.0${toSuperscript(zeros)}\u200A${sig.slice(0, Math.max(1, maxSigDigits))}`;
}

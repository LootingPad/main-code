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
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(6)}`;
}

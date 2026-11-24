/**
 * Clean number formatting for pool stats: zero shows as "$0" / "0%",
 * and extra decimals only appear when a value actually needs them.
 */

/** $0, $0.0042, $12.50, $4.5K, $1.25M */
export function formatUsdCompact(v: number): string {
  if (!Number.isFinite(v) || v === 0) return "$0";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`;
  if (abs < 0.0001) return `${sign}<$0.0001`;
  // Under $1: up to 4 decimals, trailing zeros trimmed, at least 2 decimals
  const trimmed = abs.toFixed(4).replace(/0+$/, "");
  const decimals = trimmed.split(".")[1]?.length ?? 0;
  return `${sign}$${decimals < 2 ? abs.toFixed(2) : trimmed}`;
}

/** 0%, <0.01%, 12.34% */
export function formatPct(v: number): string {
  if (!Number.isFinite(v) || v === 0) return "0%";
  if (Math.abs(v) < 0.01) return v > 0 ? "<0.01%" : ">-0.01%";
  return `${v.toFixed(2)}%`;
}

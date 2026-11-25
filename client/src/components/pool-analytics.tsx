import { useState } from "react";
import { formatUnits } from "viem";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { formatUsdCompact, formatPct } from "@/lib/format-stats";
import { feesBetween, type PairSnapshot } from "@/lib/pool-math";
import { RANGES, usePairHistory, type RangeKey } from "@/hooks/use-pair-history";

/**
 * Pool performance charts built from on-chain history.
 *
 * Every point is a snapshot of the pair at a past block (one multicall per point):
 * reserves, LP supply and the pair's cumulative fee counters (feeGrowthGlobal0/1X128).
 * Fees earned between two snapshots give exact fee income, implied volume
 * (fees / swap fee rate) and fee APR, without needing an indexer or event logs.
 */

interface PoolToken {
  symbol: string;
  decimals: number;
  logo: string;
}

interface PoolAnalyticsProps {
  pairAddress: `0x${string}`;
  token0: PoolToken; // the pair's token0 (contract order)
  token1: PoolToken;
  price0Usd: number; // current USD price of one token0 (0 if unknown)
  price1Usd: number;
  lpBalance: bigint; // connected wallet's LP tokens
}


interface ChartPoint {
  label: string;
  liquidityUsd: number;
  price: number; // token1 per token0
  volumeUsd: number | null;
  feesUsd: number | null;
  apr: number | null;
}

function buildPoints(snaps: PairSnapshot[], p: PoolAnalyticsProps, range: RangeKey): ChartPoint[] {
  const { price0Usd, price1Usd, token0, token1 } = p;
  const fmtLabel = (t: number) => {
    const d = new Date(t * 1000);
    return range === "7D"
      ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric" })
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  const liq = (s: PairSnapshot) =>
    parseFloat(formatUnits(s.reserve0, token0.decimals)) * price0Usd +
    parseFloat(formatUnits(s.reserve1, token1.decimals)) * price1Usd;

  return snaps.map((s, i) => {
    const r0 = parseFloat(formatUnits(s.reserve0, token0.decimals));
    const r1 = parseFloat(formatUnits(s.reserve1, token1.decimals));
    const liquidityUsd = liq(s);
    const price = r0 > 0 ? r1 / r0 : 0;
    const prev = snaps[i - 1];

    let feesUsd: number | null = null;
    let volumeUsd: number | null = null;
    let apr: number | null = null;
    const fees = feesBetween(prev, s);
    if (fees && s.feeBps) {
      feesUsd = parseFloat(formatUnits(fees.fees0, token0.decimals)) * price0Usd +
                parseFloat(formatUnits(fees.fees1, token1.decimals)) * price1Usd;
      volumeUsd = feesUsd / (s.feeBps / 10_000);
      const years = (s.time - prev.time) / (365 * 86_400);
      const avgLiquidity = (liquidityUsd + liq(prev)) / 2;
      apr = avgLiquidity > 0 && years > 0 ? (feesUsd / avgLiquidity / years) * 100 : null;
    }
    return { label: fmtLabel(s.time), liquidityUsd, price, volumeUsd, feesUsd, apr };
  });
}

const usd = formatUsdCompact;
const num = (v: number) =>
  v >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 })
  : v >= 1 ? v.toFixed(4) : v.toPrecision(4);

type ChartKey = "liquidity" | "volume" | "apr" | "price";
const EXPANDED_KEY = "eloqura:pool-analytics-expanded";

export function PoolAnalytics(props: PoolAnalyticsProps) {
  const { token0, token1, price0Usd, price1Usd, lpBalance } = props;
  const [range, setRange] = useState<RangeKey>("30D");
  const [chart, setChart] = useState<ChartKey>("liquidity");
  // Remember open/closed across visits; storage can be unavailable, so guard it
  const [expanded, setExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem(EXPANDED_KEY) !== "false"; } catch { return true; }
  });
  const toggleExpanded = () => {
    setExpanded((prev) => {
      try { localStorage.setItem(EXPANDED_KEY, String(!prev)); } catch { /* ignore */ }
      return !prev;
    });
  };
  // Only read chain history while the card is open
  const { data: snaps, isLoading, isError } = usePairHistory(props.pairAddress, range, expanded);

  const points = snaps ? buildPoints(snaps, props, range) : [];
  const last = snaps?.[snaps.length - 1];
  const hasFeeData = points.some((pt) => pt.feesUsd !== null);
  const hasPrices = price0Usd > 0 || price1Usd > 0;

  const totalFees = points.reduce((s, pt) => s + (pt.feesUsd ?? 0), 0);
  const totalVolume = points.reduce((s, pt) => s + (pt.volumeUsd ?? 0), 0);
  const liquidityNow = points[points.length - 1]?.liquidityUsd ?? 0;
  const avgLiquidity = points.length ? points.reduce((s, pt) => s + pt.liquidityUsd, 0) / points.length : 0;
  const periodYears = snaps && snaps.length > 1 ? (snaps[snaps.length - 1].time - snaps[0].time) / (365 * 86_400) : 0;
  const periodApr = avgLiquidity > 0 && periodYears > 0 ? (totalFees / avgLiquidity / periodYears) * 100 : null;
  const share = last && last.supply > 0n ? Number((lpBalance * 1_000_000n) / last.supply) / 10_000 : 0;

  const stats = [
    { label: "Liquidity", value: hasPrices ? usd(liquidityNow) : "-" },
    { label: `Volume (${range})`, value: hasFeeData && hasPrices ? usd(totalVolume) : "-" },
    { label: `Fees (${range})`, value: hasFeeData && hasPrices ? usd(totalFees) : "-" },
    { label: `Fee APR (${range})`, value: periodApr !== null && hasFeeData ? formatPct(periodApr) : "-" },
    { label: "Your share", value: share > 0 ? `${share < 0.01 ? "<0.01" : share.toFixed(2)}%` : "-" },
  ];

  const charts: { key: ChartKey; label: string; disabled?: boolean }[] = [
    { key: "liquidity", label: "Liquidity", disabled: !hasPrices },
    { key: "volume", label: "Volume", disabled: !hasFeeData || !hasPrices },
    { key: "apr", label: "Fee APR", disabled: !hasFeeData },
    { key: "price", label: "Price" },
  ];
  const activeChart = charts.find((c) => c.key === chart && !c.disabled)?.key ?? "price";

  const axis = { stroke: "#9CA3AF", fontSize: 11, tickLine: false, axisLine: false } as const;
  const tooltipStyle = {
    contentStyle: { backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 },
    labelStyle: { color: "#9CA3AF" },
  };

  return (
    <Card className="crypto-card border">
      <CardHeader className={expanded ? "pb-3" : undefined}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={expanded}
            className="flex items-center gap-3 text-left group"
          >
          <CardTitle className="text-white flex items-center gap-3">
            <span className="flex -space-x-2">
              <img src={token0.logo} alt={token0.symbol} className="w-7 h-7 rounded-full" />
              <img src={token1.logo} alt={token1.symbol} className="w-7 h-7 rounded-full" />
            </span>
            {token0.symbol}/{token1.symbol} Pool Performance
          </CardTitle>
            <span
              className="flex items-center justify-center w-9 h-9 rounded-full bg-black/25 border border-white/5
                shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition-colors duration-200
                group-hover:bg-black/40 group-hover:border-white/10"
            >
              <ChevronDown
                className={`w-5 h-5 text-gray-300 group-hover:text-white transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              />
            </span>
          </button>
          {expanded && (
          <div className="flex gap-1">
            {(Object.keys(RANGES) as RangeKey[]).map((r) => (
              <Button key={r} size="sm" variant={r === range ? "default" : "ghost"}
                className={r === range ? "bg-[#5c69c2] hover:bg-[#5c69c2]/90" : "text-gray-400"}
                onClick={() => setRange(r)}>
                {r}
              </Button>
            ))}
          </div>
          )}
        </div>
      </CardHeader>
      {expanded && (
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg bg-[var(--crypto-dark)] border border-[var(--crypto-border)] p-3">
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="text-lg font-semibold text-white">{isLoading ? "..." : s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1">
          {charts.map((c) => (
            <Button key={c.key} size="sm" disabled={c.disabled}
              variant={c.key === activeChart ? "default" : "outline"}
              className={c.key === activeChart
                ? "bg-[#5c69c2] hover:bg-[#5c69c2]/90"
                : "bg-transparent border-[var(--crypto-border)] text-gray-300"}
              onClick={() => setChart(c.key)}>
              {c.label}
            </Button>
          ))}
        </div>

        <div className="h-64">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">Loading pool history...</div>
          ) : isError || points.length < 2 ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              Not enough history for this pool yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {activeChart === "liquidity" ? (
                <AreaChart data={points}>
                  <defs>
                    <linearGradient id="liqFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5c69c2" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#5c69c2" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis dataKey="label" {...axis} minTickGap={24} />
                  <YAxis {...axis} tickFormatter={usd} width={70} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [usd(v), "Liquidity"]} />
                  <Area type="monotone" dataKey="liquidityUsd" stroke="#5c69c2" strokeWidth={2} fill="url(#liqFill)" />
                </AreaChart>
              ) : activeChart === "volume" ? (
                <BarChart data={points.slice(1)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis dataKey="label" {...axis} minTickGap={24} />
                  <YAxis {...axis} tickFormatter={usd} width={70} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [usd(v), "Volume"]} />
                  <Bar dataKey="volumeUsd" fill="#22c55e" radius={[3, 3, 0, 0]} />
                </BarChart>
              ) : activeChart === "apr" ? (
                <LineChart data={points.slice(1)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis dataKey="label" {...axis} minTickGap={24} />
                  <YAxis {...axis} tickFormatter={(v: number) => `${v.toFixed(0)}%`} width={50} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [formatPct(v), "Fee APR"]} />
                  <Line type="monotone" dataKey="apr" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              ) : (
                <LineChart data={points}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis dataKey="label" {...axis} minTickGap={24} />
                  <YAxis {...axis} tickFormatter={num} width={70} domain={["auto", "auto"]} />
                  <Tooltip {...tooltipStyle}
                    formatter={(v: number) => [`${num(v)} ${token1.symbol}`, `1 ${token0.symbol}`]} />
                  <Line type="monotone" dataKey="price" stroke="#38bdf8" strokeWidth={2} dot={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>

        <p className="text-xs text-gray-500">
          Read directly from the pool contract on Sepolia. Volume and APR come from fees the pool
          actually earned. USD values use current token prices. APR covers trading fees only.
        </p>
      </CardContent>
      )}
    </Card>
  );
}

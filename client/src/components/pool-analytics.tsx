import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { formatUnits } from "viem";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

const RANGES = {
  "7D": { days: 7, points: 28 },
  "30D": { days: 30, points: 30 },
  "90D": { days: 90, points: 30 },
} as const;
type RangeKey = keyof typeof RANGES;

const SEPOLIA_BLOCKS_PER_DAY = 7200; // 12s slots
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;
const Q128 = 2n ** 128n;

const SNAPSHOT_ABI = [
  { name: "getReserves", type: "function", stateMutability: "view", inputs: [],
    outputs: [{ type: "uint112" }, { type: "uint112" }, { type: "uint32" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "feeGrowthGlobal0X128", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "feeGrowthGlobal1X128", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "swapFeeBps", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const MULTICALL_TS_ABI = [
  { name: "getCurrentBlockTimestamp", type: "function", stateMutability: "view", inputs: [],
    outputs: [{ type: "uint256" }] },
] as const;

interface Snapshot {
  time: number; // unix seconds
  reserve0: number;
  reserve1: number;
  supply: bigint;
  fg0: bigint | null;
  fg1: bigint | null;
  feeBps: number | null;
}

interface ChartPoint {
  label: string;
  liquidityUsd: number;
  price: number; // token1 per token0
  volumeUsd: number | null;
  feesUsd: number | null;
  apr: number | null;
}

function useSnapshots(pairAddress: `0x${string}`, range: RangeKey, d0: number, d1: number) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["pool-history", pairAddress, range],
    enabled: !!publicClient,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Snapshot[]> => {
      if (!publicClient) return [];
      const latest = await publicClient.getBlockNumber();
      const { days, points } = RANGES[range];
      const step = BigInt(Math.floor((days * SEPOLIA_BLOCKS_PER_DAY) / points));
      const blocks = Array.from({ length: points + 1 }, (_, i) => latest - step * BigInt(points - i))
        .filter((b) => b > 0n);

      const contract = { address: pairAddress, abi: SNAPSHOT_ABI } as const;
      const results = await Promise.all(
        blocks.map((blockNumber) =>
          publicClient
            .multicall({
              allowFailure: true,
              blockNumber,
              multicallAddress: MULTICALL3,
              contracts: [
                { ...contract, functionName: "getReserves" },
                { ...contract, functionName: "totalSupply" },
                { ...contract, functionName: "feeGrowthGlobal0X128" },
                { ...contract, functionName: "feeGrowthGlobal1X128" },
                { ...contract, functionName: "swapFeeBps" },
                { address: MULTICALL3, abi: MULTICALL_TS_ABI, functionName: "getCurrentBlockTimestamp" },
              ],
            })
            .catch(() => null)
        )
      );

      const snaps: Snapshot[] = [];
      for (const r of results) {
        // Pair didn't exist yet at this block, or the read failed: skip the point.
        if (!r || r[0].status !== "success" || r[1].status !== "success" || r[5].status !== "success") continue;
        const [res0, res1] = r[0].result as readonly [bigint, bigint, number];
        snaps.push({
          time: Number(r[5].result as bigint),
          reserve0: parseFloat(formatUnits(res0, d0)),
          reserve1: parseFloat(formatUnits(res1, d1)),
          supply: r[1].result as bigint,
          fg0: r[2].status === "success" ? (r[2].result as bigint) : null,
          fg1: r[3].status === "success" ? (r[3].result as bigint) : null,
          feeBps: r[4].status === "success" ? Number(r[4].result as bigint) : null,
        });
      }
      return snaps;
    },
  });
}

function buildPoints(snaps: Snapshot[], p: PoolAnalyticsProps, range: RangeKey): ChartPoint[] {
  const { price0Usd, price1Usd, token0, token1 } = p;
  const fmtLabel = (t: number) => {
    const d = new Date(t * 1000);
    return range === "7D"
      ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric" })
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return snaps.map((s, i) => {
    const liquidityUsd = s.reserve0 * price0Usd + s.reserve1 * price1Usd;
    const price = s.reserve0 > 0 ? s.reserve1 / s.reserve0 : 0;
    const prev = snaps[i - 1];

    let feesUsd: number | null = null;
    let volumeUsd: number | null = null;
    let apr: number | null = null;
    if (prev && s.fg0 !== null && s.fg1 !== null && prev.fg0 !== null && prev.fg1 !== null && s.feeBps) {
      // feeGrowth is fees per LP token (scaled by 2^128). Times supply = pool-wide fees.
      const avgSupply = (s.supply + prev.supply) / 2n;
      const fees0 = parseFloat(formatUnits(((s.fg0 - prev.fg0) * avgSupply) / Q128, token0.decimals));
      const fees1 = parseFloat(formatUnits(((s.fg1 - prev.fg1) * avgSupply) / Q128, token1.decimals));
      feesUsd = fees0 * price0Usd + fees1 * price1Usd;
      volumeUsd = feesUsd / (s.feeBps / 10_000);
      const years = (s.time - prev.time) / (365 * 86_400);
      const avgLiquidity = (liquidityUsd + prev.reserve0 * price0Usd + prev.reserve1 * price1Usd) / 2;
      apr = avgLiquidity > 0 && years > 0 ? (feesUsd / avgLiquidity / years) * 100 : null;
    }
    return { label: fmtLabel(s.time), liquidityUsd, price, volumeUsd, feesUsd, apr };
  });
}

const usd = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
};
const num = (v: number) =>
  v >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 })
  : v >= 1 ? v.toFixed(4) : v.toPrecision(4);

type ChartKey = "liquidity" | "volume" | "apr" | "price";

export function PoolAnalytics(props: PoolAnalyticsProps) {
  const { token0, token1, price0Usd, price1Usd, lpBalance } = props;
  const [range, setRange] = useState<RangeKey>("30D");
  const [chart, setChart] = useState<ChartKey>("liquidity");
  const { data: snaps, isLoading, isError } = useSnapshots(
    props.pairAddress, range, token0.decimals, token1.decimals
  );

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
    { label: `Fee APR (${range})`, value: periodApr !== null && hasFeeData ? `${periodApr.toFixed(2)}%` : "-" },
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
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-white flex items-center gap-3">
            <span className="flex -space-x-2">
              <img src={token0.logo} alt={token0.symbol} className="w-7 h-7 rounded-full" />
              <img src={token1.logo} alt={token1.symbol} className="w-7 h-7 rounded-full" />
            </span>
            {token0.symbol}/{token1.symbol} Pool Performance
          </CardTitle>
          <div className="flex gap-1">
            {(Object.keys(RANGES) as RangeKey[]).map((r) => (
              <Button key={r} size="sm" variant={r === range ? "default" : "ghost"}
                className={r === range ? "bg-[#5c69c2] hover:bg-[#5c69c2]/90" : "text-gray-400"}
                onClick={() => setRange(r)}>
                {r}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
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
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(2)}%`, "Fee APR"]} />
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
    </Card>
  );
}

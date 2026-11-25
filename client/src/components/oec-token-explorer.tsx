import { Fragment, useState } from "react";
import { formatUnits } from "viem";
import { ChevronDown, ExternalLink } from "lucide-react";
import {
  LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatUsdCompact } from "@/lib/format-stats";
import { RANGES, usePairHistory, type RangeKey } from "@/hooks/use-pair-history";
import { useTokensHolders, type HoldersResponse } from "@/hooks/use-token-holders";

/**
 * OEC Tokens view: Oeconomia's own tokens with real on-chain data.
 * Click a token to expand its detail in place: stats, price chart from its deepest
 * Eloqura pool, holder distribution, top holders and the pools that trade it.
 */

export interface ExplorerToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logo: string;
}

export interface ExplorerPool {
  pairAddress: string;
  token0Address: string;
  token1Address: string;
  tokenA: { symbol: string; logo: string };
  tokenB: { symbol: string; logo: string };
  tvlValue: number;
  volume24hValue: number;
  apr: string;
}

interface Props {
  tokens: ExplorerToken[];
  pools: ExplorerPool[];
  priceUsd: (token: ExplorerToken) => number;
  tokenInfo: (address: string) => ExplorerToken;
  onOpenPool: (token0Address: string, token1Address: string) => void;
  search: string;
}

const SHOW_HOLDERS = 25;
const PIE_COLORS = ["#5c69c2", "#22c55e", "#38bdf8", "#f59e0b", "#a855f7", "#ef4444", "#14b8a6", "#eab308", "#ec4899", "#64748b"];
const OTHERS_COLOR = "#4b5563";

const shortAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;
const amount = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M`
  : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K`
  : v.toLocaleString(undefined, { maximumFractionDigits: 4 });
const pct = (v: number) => (v === 0 ? "0%" : v < 0.01 ? "<0.01%" : `${v.toFixed(2)}%`);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function OecTokenExplorer({ tokens, pools, priceUsd, tokenInfo, onOpenPool, search }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const holders = useTokensHolders(tokens.map((t) => t.address));
  const term = search.trim().toLowerCase();
  const visible = tokens
    .map((t, i) => ({ t, q: holders[i] }))
    .filter(({ t }) => !term || t.symbol.toLowerCase().includes(term) || t.name.toLowerCase().includes(term));

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-white text-lg font-semibold">
          OEC Tokens <span className="text-gray-500 text-sm font-normal">Sepolia</span>
        </h2>
        <p className="text-xs text-gray-500 italic">Click a token for its details</p>
      </div>
      <div className="border rounded-lg relative bg-[#1a1b23]">
        <table className="w-full">
          <thead className="border-b border-crypto-border">
            <tr className="text-left text-gray-400 text-sm">
              <th className="py-3 px-3 sm:px-6 font-medium">Token</th>
              <th className="py-3 px-3 sm:px-6 font-medium">Price</th>
              <th className="py-3 px-3 sm:px-6 font-medium">Holders</th>
              <th className="py-3 px-3 sm:px-6 font-medium hidden sm:table-cell">Market Cap</th>
              <th className="py-3 px-3 sm:px-6 font-medium hidden md:table-cell">Total Supply</th>
              <th className="py-3 px-3 sm:px-6 w-10" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">No tokens match your search</td></tr>
            )}
            {visible.map(({ t, q }) => {
              const isOpen = open === t.address;
              const price = priceUsd(t);
              const data = q.data;
              return (
                <Fragment key={t.address}>
                  <tr
                    className={`border-b border-crypto-border/50 cursor-pointer transition-colors ${isOpen ? "bg-[var(--crypto-dark)]" : "hover:bg-[var(--crypto-dark)]"}`}
                    onClick={() => setOpen(isOpen ? null : t.address)}
                  >
                    <td className="py-3 px-3 sm:px-6">
                      <div className="flex items-center gap-3">
                        <img src={t.logo} alt={t.symbol} className="w-8 h-8 rounded-full" />
                        <div>
                          <div className="text-white font-medium">{t.symbol}</div>
                          <div className="text-xs text-gray-400">{t.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 sm:px-6 font-mono">{price > 0 ? formatUsdCompact(price) : "-"}</td>
                    <td className="py-3 px-3 sm:px-6 font-mono">
                      {q.isLoading ? "..." : data ? data.holderCount.toLocaleString() : "-"}
                    </td>
                    <td className="py-3 px-3 sm:px-6 font-mono hidden sm:table-cell">
                      {data && price > 0 ? formatUsdCompact(data.totalSupply * price) : q.isLoading ? "..." : "-"}
                    </td>
                    <td className="py-3 px-3 sm:px-6 font-mono hidden md:table-cell">
                      {data ? amount(data.totalSupply) : q.isLoading ? "..." : "-"}
                    </td>
                    <td className="py-3 px-3 sm:px-6">
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-crypto-border/50">
                      <td colSpan={6} className="p-3 sm:p-6 bg-[var(--crypto-dark)]/60">
                        <TokenDetail
                          token={t}
                          price={price}
                          holders={data}
                          holdersLoading={q.isLoading}
                          pools={pools.filter((p) => same(p.token0Address, t.address) || same(p.token1Address, t.address))}
                          tokenInfo={tokenInfo}
                          priceUsd={priceUsd}
                          onOpenPool={onOpenPool}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-center text-sm text-gray-500">
        Holders and supply read from Sepolia (refreshed every 2 minutes) • Prices from Eloqura pools
      </p>
    </div>
  );
}

interface DetailProps {
  token: ExplorerToken;
  price: number;
  holders: HoldersResponse | undefined;
  holdersLoading: boolean;
  pools: ExplorerPool[];
  tokenInfo: (address: string) => ExplorerToken;
  priceUsd: (token: ExplorerToken) => number;
  onOpenPool: (token0Address: string, token1Address: string) => void;
}

function TokenDetail({ token, price, holders, holdersLoading, pools, tokenInfo, priceUsd, onOpenPool }: DetailProps) {
  const sortedPools = [...pools].sort((a, b) => b.tvlValue - a.tvlValue);
  // Each pool's TVL is split evenly between its two tokens, so this token's side is half
  const liquidity = pools.reduce((s, p) => s + p.tvlValue / 2, 0);
  const volume24h = pools.reduce((s, p) => s + p.volume24hValue, 0);

  const stats = [
    { label: "Price", value: price > 0 ? formatUsdCompact(price) : "-" },
    { label: "Market Cap", value: holders && price > 0 ? formatUsdCompact(holders.totalSupply * price) : "-" },
    { label: "Holders", value: holders ? holders.holderCount.toLocaleString() : holdersLoading ? "..." : "-" },
    { label: "Total Supply", value: holders ? amount(holders.totalSupply) : holdersLoading ? "..." : "-" },
    { label: "In Eloqura Pools", value: formatUsdCompact(liquidity) },
    { label: "24h Volume", value: formatUsdCompact(volume24h) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-[#1a1b23] border border-[var(--crypto-border)] p-3">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className="text-base sm:text-lg font-semibold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PriceChart token={token} pool={sortedPools[0]} tokenInfo={tokenInfo} priceUsd={priceUsd} />
        <HolderDistribution token={token} holders={holders} loading={holdersLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopHolders token={token} holders={holders} loading={holdersLoading} />
        <Card className="crypto-card border p-4">
          <h4 className="text-white font-semibold mb-3">Pools trading {token.symbol}</h4>
          {sortedPools.length === 0 ? (
            <p className="text-gray-400 text-sm">No Eloqura pools with liquidity yet.</p>
          ) : (
            <div className="space-y-1">
              {sortedPools.map((p) => (
                <button
                  key={p.pairAddress}
                  type="button"
                  onClick={() => onOpenPool(p.token0Address, p.token1Address)}
                  className="w-full flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-[var(--crypto-dark)] text-left"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="flex -space-x-2 shrink-0">
                      <img src={p.tokenA.logo} alt="" className="w-6 h-6 rounded-full" />
                      <img src={p.tokenB.logo} alt="" className="w-6 h-6 rounded-full" />
                    </span>
                    <span className="text-white text-sm truncate">{p.tokenA.symbol}/{p.tokenB.symbol}</span>
                  </span>
                  <span className="flex items-center gap-4 font-mono text-sm shrink-0">
                    <span className="text-gray-300">{formatUsdCompact(p.tvlValue)} <span className="text-gray-500 text-xs">TVL</span></span>
                    <span className="text-gray-400 hidden sm:inline">{formatUsdCompact(p.volume24hValue)} <span className="text-gray-500 text-xs">24h</span></span>
                  </span>
                </button>
              ))}
              <p className="text-xs text-gray-500 pt-1">Click a pool to add liquidity</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function PriceChart({ token, pool, tokenInfo, priceUsd }: {
  token: ExplorerToken;
  pool: ExplorerPool | undefined;
  tokenInfo: (address: string) => ExplorerToken;
  priceUsd: (token: ExplorerToken) => number;
}) {
  const [range, setRange] = useState<RangeKey>("30D");
  const { data: snaps, isLoading } = usePairHistory(
    (pool?.pairAddress ?? "0x0000000000000000000000000000000000000000") as `0x${string}`, range, !!pool
  );

  // Price of this token in USD = (quote reserve / token reserve) x quote token's USD price
  const isToken0 = pool ? same(pool.token0Address, token.address) : true;
  const quote = pool ? tokenInfo(isToken0 ? pool.token1Address : pool.token0Address) : null;
  const quoteUsd = quote ? priceUsd(quote) : 0;
  const points = (snaps ?? []).map((s) => {
    const r0 = parseFloat(formatUnits(s.reserve0, isToken0 ? token.decimals : quote!.decimals));
    const r1 = parseFloat(formatUnits(s.reserve1, isToken0 ? quote!.decimals : token.decimals));
    const inQuote = isToken0 ? (r0 > 0 ? r1 / r0 : 0) : (r1 > 0 ? r0 / r1 : 0);
    const d = new Date(s.time * 1000);
    return {
      label: range === "7D"
        ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric" })
        : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      price: quoteUsd > 0 ? inQuote * quoteUsd : inQuote,
    };
  });
  const inUsd = quoteUsd > 0;
  const fmt = (v: number) => (inUsd ? formatUsdCompact(v) : `${amount(v)} ${quote?.symbol ?? ""}`);

  return (
    <Card className="crypto-card border p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <h4 className="text-white font-semibold">{token.symbol} Price</h4>
          {pool && quote && <p className="text-xs text-gray-500">From the {token.symbol}/{quote.symbol} pool</p>}
        </div>
        <div className="flex gap-1">
          {(Object.keys(RANGES) as RangeKey[]).map((r) => (
            <Button key={r} size="sm" variant={r === range ? "default" : "ghost"}
              className={`h-7 px-2 ${r === range ? "bg-[#5c69c2] hover:bg-[#5c69c2]/90" : "text-gray-400"}`}
              onClick={() => setRange(r)}>
              {r}
            </Button>
          ))}
        </div>
      </div>
      <div className="h-52">
        {!pool ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">No pool to price {token.symbol} yet.</div>
        ) : isLoading ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">Loading price history...</div>
        ) : points.length < 2 ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">Not enough history yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="label" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} width={64}
                tickFormatter={fmt} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                labelStyle={{ color: "#9CA3AF" }}
                formatter={(v: number) => [fmt(v), token.symbol]} />
              <Line type="monotone" dataKey="price" stroke="#38bdf8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

function HolderDistribution({ token, holders, loading }: {
  token: ExplorerToken; holders: HoldersResponse | undefined; loading: boolean;
}) {
  const top = holders?.holders.slice(0, 10) ?? [];
  const topShare = top.reduce((s, h) => s + h.percentage, 0);
  const slices = [
    ...top.map((h, i) => ({
      name: `#${h.rank} ${shortAddr(h.address)}${h.isContract ? " (contract)" : ""}`,
      value: h.percentage,
      color: PIE_COLORS[i % PIE_COLORS.length],
    })),
    ...(topShare < 100 ? [{ name: "All other holders", value: Math.max(0, 100 - topShare), color: OTHERS_COLOR }] : []),
  ].filter((s) => s.value > 0);

  return (
    <Card className="crypto-card border p-4">
      <h4 className="text-white font-semibold">Holder Distribution</h4>
      <p className="text-xs text-gray-500 mb-2">
        {holders ? `Top 10 hold ${pct(topShare)} of ${token.symbol} supply` : "Share of supply held by the top 10"}
      </p>
      <div className="min-h-52 sm:h-52">
        {loading ? (
          <div className="h-52 flex items-center justify-center text-gray-400 text-sm">Loading holders...</div>
        ) : !holders || slices.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-gray-400 text-sm">No holder data yet.</div>
        ) : (
          <div className="h-full flex flex-col sm:flex-row items-center gap-4">
            <div className="h-40 sm:h-full w-full sm:w-1/2 sm:min-w-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="90%" stroke="none">
                    {slices.map((s) => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                    itemStyle={{ color: "#e5e7eb" }}
                    formatter={(v: number, name: string) => [pct(v), name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full sm:flex-1 space-y-1 text-xs overflow-hidden">
              {slices.slice(0, 6).map((s) => (
                <li key={s.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-gray-300 truncate font-mono">{s.name.replace(" (contract)", "")}</span>
                  </span>
                  <span className="text-gray-400 font-mono">{pct(s.value)}</span>
                </li>
              ))}
              {slices.length > 6 && <li className="text-gray-500">+{slices.length - 6} more in chart</li>}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

function TopHolders({ token, holders, loading }: {
  token: ExplorerToken; holders: HoldersResponse | undefined; loading: boolean;
}) {
  return (
    <Card className="crypto-card border p-4">
      <h4 className="text-white font-semibold mb-3">
        Top Holders {holders && <span className="text-gray-500 text-sm font-normal">
          ({Math.min(SHOW_HOLDERS, holders.holders.length)} of {holders.holderCount.toLocaleString()})
        </span>}
      </h4>
      {loading ? (
        <p className="text-gray-400 text-sm">Loading holders...</p>
      ) : !holders ? (
        <p className="text-gray-400 text-sm">Couldn't load holders right now. Try again in a minute.</p>
      ) : holders.holders.length === 0 ? (
        <p className="text-gray-400 text-sm">No holders yet.</p>
      ) : (
        <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
          {holders.holders.slice(0, SHOW_HOLDERS).map((h) => (
            <div key={h.address} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-1">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-7 text-gray-500 text-sm font-mono">#{h.rank}</span>
                <a
                  href={`https://sepolia.etherscan.io/address/${h.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-gray-200 hover:text-white inline-flex items-center gap-1"
                >
                  {shortAddr(h.address)}
                  <ExternalLink className="w-3 h-3 text-gray-500" />
                </a>
                {h.isContract && (
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#5c69c2]/20 text-[#8b95e0]">
                    Contract
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 font-mono text-sm ml-10 sm:ml-0">
                <span className="text-white">{amount(h.balance)} {token.symbol}</span>
                <span className="text-gray-400 w-14 text-right">{pct(h.percentage)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

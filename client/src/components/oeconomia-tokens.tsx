import { Fragment, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { ChevronDown, ExternalLink } from "lucide-react";
import { formatUsdCompact } from "@/lib/format-stats";

/** Real holder data for Oeconomia's own Sepolia tokens, from the holders Netlify function. */

interface OecToken {
  symbol: string;
  name: string;
  address: string;
  logo: string;
}

interface HolderRow {
  rank: number;
  address: string;
  balance: number;
  percentage: number;
  isContract: boolean | null;
}

interface HoldersResponse {
  totalSupply: number;
  holderCount: number;
  holders: HolderRow[];
  updatedAt: string;
}

interface Props {
  tokens: OecToken[];
  priceUsd: (token: OecToken) => number;
}

const SHOW_HOLDERS = 25;

async function fetchHolders(address: string): Promise<HoldersResponse> {
  const res = await fetch(`/.netlify/functions/holders?contract=${address}`);
  if (!res.ok) throw new Error(`holders ${res.status}`);
  return res.json();
}

const shortAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;
const amount = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M`
  : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K`
  : v.toLocaleString(undefined, { maximumFractionDigits: 4 });
const pct = (v: number) => (v === 0 ? "0%" : v < 0.01 ? "<0.01%" : `${v.toFixed(2)}%`);

export function OeconomiaTokens({ tokens, priceUsd }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const results = useQueries({
    queries: tokens.map((t) => ({
      queryKey: ["holders", t.address.toLowerCase()],
      queryFn: () => fetchHolders(t.address),
      staleTime: 60_000,
      refetchInterval: 120_000,
      retry: 1,
    })),
  });

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-white font-semibold">Oeconomia Tokens <span className="text-gray-500 text-sm font-normal">Sepolia</span></h3>
        <p className="text-xs text-gray-500 italic">Click a token to see its top holders</p>
      </div>
      <div className="border rounded-lg relative overflow-auto scrollbar-hide bg-[#1a1b23]">
        <table className="w-full">
          <thead className="border-b border-crypto-border">
            <tr className="text-left text-gray-400 text-sm">
              <th className="py-3 px-3 sm:px-6 font-medium">Token</th>
              <th className="py-3 px-3 sm:px-6 font-medium">Price</th>
              <th className="py-3 px-3 sm:px-6 font-medium">Holders</th>
              <th className="py-3 px-3 sm:px-6 font-medium hidden sm:table-cell">Total Supply</th>
              <th className="py-3 px-3 sm:px-6 w-10" />
            </tr>
          </thead>
          <tbody>
            {tokens.map((t, i) => {
              const q = results[i];
              const data = q.data;
              const isOpen = open === t.address;
              const price = priceUsd(t);
              return (
                <Fragment key={t.address}>
                  <tr
                    className="border-b border-crypto-border/50 hover:bg-[var(--crypto-dark)] cursor-pointer transition-colors"
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
                      {q.isLoading ? "..." : q.isError ? "-" : data!.holderCount.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 sm:px-6 font-mono hidden sm:table-cell">
                      {q.isLoading ? "..." : q.isError ? "-" : amount(data!.totalSupply)}
                    </td>
                    <td className="py-3 px-3 sm:px-6">
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-crypto-border/50 bg-[var(--crypto-dark)]/60">
                      <td colSpan={5} className="px-3 sm:px-6 py-4">
                        {q.isLoading ? (
                          <p className="text-gray-400 text-sm">Loading holders...</p>
                        ) : q.isError || !data ? (
                          <p className="text-gray-400 text-sm">Couldn't load holders right now. Try again in a minute.</p>
                        ) : data.holders.length === 0 ? (
                          <p className="text-gray-400 text-sm">No holders yet.</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm text-gray-400">
                              Top {Math.min(SHOW_HOLDERS, data.holders.length)} of {data.holderCount.toLocaleString()} holders
                            </p>
                            {data.holders.slice(0, SHOW_HOLDERS).map((h) => (
                              <div key={h.address} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-1.5">
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="w-7 text-gray-500 text-sm font-mono">#{h.rank}</span>
                                  <a
                                    href={`https://sepolia.etherscan.io/address/${h.address}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
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
                                  <span className="text-white">{amount(h.balance)} {t.symbol}</span>
                                  <span className="text-gray-400 w-14 text-right">{pct(h.percentage)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

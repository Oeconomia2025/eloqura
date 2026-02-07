import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OECLoader } from "@/components/oec-loader";
import {
  TrendingUp,
  Wallet,
  BarChart3,
  DollarSign,
  Activity,
  Zap,
  ArrowUpRight,
  Eye,
  Users,
  Target,
  ExternalLink
} from "lucide-react";
import { useAccount, usePublicClient } from "wagmi";
import { formatUnits, formatEther, parseUnits } from "viem";
import { ELOQURA_CONTRACTS, UNISWAP_CONTRACTS, UNISWAP_QUOTER_ABI, UNISWAP_FEE_TIERS, ERC20_ABI, FACTORY_ABI, PAIR_ABI } from "@/lib/contracts";
import { useLocation } from "wouter";

// Known tokens on Sepolia
const TOKENS = [
  {
    symbol: "OEC",
    name: "Oeconomia",
    address: "0x2b2fb8df4ac5d394f0d5674d7a54802e42a06aba",
    decimals: 18,
    logo: "https://pub-37d61a7eb7ae45898b46702664710cb2.r2.dev/images/OEC%20Logo%20Square.png",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    address: "0x0000000000000000000000000000000000000000",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: ELOQURA_CONTRACTS.sepolia.WETH,
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    decimals: 6,
    logo: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
  },
  {
    symbol: "LINK",
    name: "Chainlink",
    address: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    address: "0x3e622317f8c93f7328350cf0b56d9ed4c620c5d6",
    decimals: 18,
    logo: "https://assets.coingecko.com/coins/images/9956/small/dai-multi-collateral-mcd.png",
  },
];

const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const OEC_ADDRESS = "0x2b2fb8df4ac5d394f0d5674d7a54802e42a06aba";

interface TokenBalance {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logo: string;
  balance: number;
  usdValue: number;
}

interface RecentSwap {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  timestamp: number;
  txHash: string;
}

interface LPPosition {
  pairAddress: string;
  token0Symbol: string;
  token1Symbol: string;
  lpBalance: number;
  reserve0: number;
  reserve1: number;
  totalSupply: number;
  usdValue: number;
}

export default function Dashboard() {
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();
  const [, navigate] = useLocation();

  const [loading, setLoading] = useState(true);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [lpPositions, setLPPositions] = useState<LPPosition[]>([]);
  const [recentSwaps, setRecentSwaps] = useState<RecentSwap[]>([]);
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});

  // Fetch token prices via Uniswap V3 quoter + Eloqura pools fallback
  useEffect(() => {
    const fetchPrices = async () => {
      if (!publicClient) return;
      const usdcAddress = USDC_ADDRESS as `0x${string}`;
      const usdcDecimals = 6;
      const prices: Record<string, number> = {};
      const feeTiers = [UNISWAP_FEE_TIERS.MEDIUM, UNISWAP_FEE_TIERS.LOW, UNISWAP_FEE_TIERS.HIGH];

      for (const token of TOKENS) {
        if (token.address.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
          prices[token.symbol] = 1;
          continue;
        }
        if (token.symbol === "DAI") {
          prices[token.symbol] = 1;
          continue;
        }

        // Use Uniswap WETH address for ETH/WETH tokens when querying the quoter
        const quoterAddress = (token.symbol === "ETH" || token.symbol === "WETH")
          ? UNISWAP_CONTRACTS.sepolia.WETH
          : token.address;

        let priceFound = false;

        // Try direct: token → USDC via Uniswap V3
        for (const fee of feeTiers) {
          try {
            const amountIn = parseUnits("1", token.decimals);
            const result = await publicClient.simulateContract({
              address: UNISWAP_CONTRACTS.sepolia.QuoterV2 as `0x${string}`,
              abi: UNISWAP_QUOTER_ABI,
              functionName: "quoteExactInputSingle",
              args: [{
                tokenIn: quoterAddress as `0x${string}`,
                tokenOut: usdcAddress,
                amountIn,
                fee,
                sqrtPriceLimitX96: 0n,
              }],
            });
            const usdPrice = parseFloat(formatUnits(result.result[0], usdcDecimals));
            if (usdPrice > 0) {
              prices[token.symbol] = usdPrice;
              priceFound = true;
              break;
            }
          } catch { continue; }
        }

        // Fallback: token → WETH → USDC via Uniswap V3
        if (!priceFound && token.symbol !== "WETH" && token.symbol !== "ETH") {
          for (const fee of feeTiers) {
            try {
              const amountIn = parseUnits("1", token.decimals);
              const result = await publicClient.simulateContract({
                address: UNISWAP_CONTRACTS.sepolia.QuoterV2 as `0x${string}`,
                abi: UNISWAP_QUOTER_ABI,
                functionName: "quoteExactInputSingle",
                args: [{
                  tokenIn: quoterAddress as `0x${string}`,
                  tokenOut: UNISWAP_CONTRACTS.sepolia.WETH as `0x${string}`,
                  amountIn,
                  fee,
                  sqrtPriceLimitX96: 0n,
                }],
              });
              const wethAmount = parseFloat(formatUnits(result.result[0], 18));
              if (wethAmount > 0 && prices["ETH"]) {
                prices[token.symbol] = wethAmount * prices["ETH"];
                priceFound = true;
                break;
              } else if (wethAmount > 0) {
                // Get WETH → USDC price
                for (const wethFee of feeTiers) {
                  try {
                    const wethResult = await publicClient.simulateContract({
                      address: UNISWAP_CONTRACTS.sepolia.QuoterV2 as `0x${string}`,
                      abi: UNISWAP_QUOTER_ABI,
                      functionName: "quoteExactInputSingle",
                      args: [{
                        tokenIn: UNISWAP_CONTRACTS.sepolia.WETH as `0x${string}`,
                        tokenOut: usdcAddress,
                        amountIn: parseUnits("1", 18),
                        fee: wethFee,
                        sqrtPriceLimitX96: 0n,
                      }],
                    });
                    const wethUsd = parseFloat(formatUnits(wethResult.result[0], usdcDecimals));
                    if (wethUsd > 0) {
                      prices[token.symbol] = wethAmount * wethUsd;
                      priceFound = true;
                      break;
                    }
                  } catch { continue; }
                }
                if (priceFound) break;
              }
            } catch { continue; }
          }
        }

        // Fallback: Eloqura DEX pool (for OEC and other Eloqura-only tokens)
        if (!priceFound) {
          try {
            // Try token/USDC pair on Eloqura
            const pairAddress = await publicClient.readContract({
              address: ELOQURA_CONTRACTS.sepolia.Factory as `0x${string}`,
              abi: FACTORY_ABI,
              functionName: "getPair",
              args: [token.address as `0x${string}`, usdcAddress],
            }) as `0x${string}`;

            if (pairAddress && pairAddress !== "0x0000000000000000000000000000000000000000") {
              const [reserves, token0] = await Promise.all([
                publicClient.readContract({ address: pairAddress, abi: PAIR_ABI, functionName: "getReserves" }) as Promise<[bigint, bigint, number]>,
                publicClient.readContract({ address: pairAddress, abi: PAIR_ABI, functionName: "token0" }) as Promise<`0x${string}`>,
              ]);
              const isToken0 = token0.toLowerCase() === token.address.toLowerCase();
              const tokenReserve = parseFloat(formatUnits(isToken0 ? reserves[0] : reserves[1], token.decimals));
              const usdcReserve = parseFloat(formatUnits(isToken0 ? reserves[1] : reserves[0], usdcDecimals));
              if (tokenReserve > 0) {
                prices[token.symbol] = usdcReserve / tokenReserve;
                priceFound = true;
              }
            }
          } catch {}
        }

        // ETH and WETH share price
        if (token.symbol === "ETH" && prices["ETH"] && !prices["WETH"]) {
          prices["WETH"] = prices["ETH"];
        }
        if (token.symbol === "WETH" && prices["WETH"] && !prices["ETH"]) {
          prices["ETH"] = prices["WETH"];
        }
      }

      setTokenPrices(prices);
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [publicClient]);

  // Get USD price for a token
  const getTokenPrice = (symbol: string) => {
    return tokenPrices[symbol] || 0;
  };

  // Convenience accessors
  const oecPrice = tokenPrices["OEC"] || 0;
  const ethPrice = tokenPrices["ETH"] || 0;

  // Fetch token balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!publicClient || !address) {
        setTokenBalances([]);
        setLoading(false);
        return;
      }
      try {
        const balances: TokenBalance[] = [];

        for (const token of TOKENS) {
          let balance = 0n;
          if (token.symbol === "ETH") {
            balance = await publicClient.getBalance({ address });
          } else {
            balance = await publicClient.readContract({
              address: token.address as `0x${string}`,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [address],
            }) as bigint;
          }

          const numBalance = parseFloat(formatUnits(balance, token.decimals));
          const price = getTokenPrice(token.symbol);

          balances.push({
            ...token,
            balance: numBalance,
            usdValue: numBalance * price,
          });
        }

        // Sort by USD value descending, then by balance
        balances.sort((a, b) => b.usdValue - a.usdValue || b.balance - a.balance);
        setTokenBalances(balances);
      } catch (error) {
        console.error("Error fetching balances:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBalances();
    const interval = setInterval(fetchBalances, 30000);
    return () => clearInterval(interval);
  }, [publicClient, address, tokenPrices]);

  // Fetch LP positions
  useEffect(() => {
    const fetchPositions = async () => {
      if (!publicClient || !address) { setLPPositions([]); return; }
      try {
        const pairCount = await publicClient.readContract({
          address: ELOQURA_CONTRACTS.sepolia.Factory as `0x${string}`,
          abi: FACTORY_ABI,
          functionName: "allPairsLength",
        }) as bigint;

        const positions: LPPosition[] = [];
        for (let i = 0; i < Math.min(Number(pairCount), 20); i++) {
          const pairAddress = await publicClient.readContract({
            address: ELOQURA_CONTRACTS.sepolia.Factory as `0x${string}`,
            abi: FACTORY_ABI,
            functionName: "allPairs",
            args: [BigInt(i)],
          }) as `0x${string}`;

          const lpBalance = await publicClient.readContract({
            address: pairAddress,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [address],
          }) as bigint;

          if (lpBalance === 0n) continue;

          const [token0Addr, token1Addr, reserves, totalSupply] = await Promise.all([
            publicClient.readContract({ address: pairAddress, abi: PAIR_ABI, functionName: "token0" }) as Promise<`0x${string}`>,
            publicClient.readContract({ address: pairAddress, abi: PAIR_ABI, functionName: "token1" }) as Promise<`0x${string}`>,
            publicClient.readContract({ address: pairAddress, abi: PAIR_ABI, functionName: "getReserves" }) as Promise<[bigint, bigint, number]>,
            publicClient.readContract({ address: pairAddress, abi: ERC20_ABI, functionName: "totalSupply" }) as Promise<bigint>,
          ]);

          const [symbol0, symbol1, decimals0, decimals1] = await Promise.all([
            publicClient.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>,
            publicClient.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>,
            publicClient.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
            publicClient.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
          ]);

          const share = Number(lpBalance) / Number(totalSupply);
          const r0 = parseFloat(formatUnits(reserves[0], decimals0)) * share;
          const r1 = parseFloat(formatUnits(reserves[1], decimals1)) * share;
          const price0 = getTokenPrice(symbol0);
          const price1 = getTokenPrice(symbol1);
          let usd0 = r0 * price0;
          let usd1 = r1 * price1;
          // V2 AMM: both sides equal value
          if (usd0 > 0 && usd1 === 0) usd1 = usd0;
          else if (usd1 > 0 && usd0 === 0) usd0 = usd1;

          positions.push({
            pairAddress,
            token0Symbol: symbol0,
            token1Symbol: symbol1,
            lpBalance: parseFloat(formatEther(lpBalance)),
            reserve0: r0,
            reserve1: r1,
            totalSupply: parseFloat(formatEther(totalSupply)),
            usdValue: usd0 + usd1,
          });
        }
        setLPPositions(positions);
      } catch (error) {
        console.error("Error fetching LP positions:", error);
      }
    };
    fetchPositions();
    const interval = setInterval(fetchPositions, 60000);
    return () => clearInterval(interval);
  }, [publicClient, address, tokenPrices]);

  // Fetch recent swaps
  useEffect(() => {
    const fetchRecentSwaps = async () => {
      if (!publicClient) return;
      try {
        const pairCount = await publicClient.readContract({
          address: ELOQURA_CONTRACTS.sepolia.Factory as `0x${string}`,
          abi: FACTORY_ABI,
          functionName: "allPairsLength",
        }) as bigint;

        const count = Number(pairCount);
        if (count === 0) return;

        const allSwaps: RecentSwap[] = [];
        const currentBlock = await publicClient.getBlockNumber();
        // Look back ~50000 blocks (~7 days on Sepolia) to catch older swaps
        const fromBlock = currentBlock > 50000n ? currentBlock - 50000n : 0n;

        for (let i = 0; i < Math.min(count, 10); i++) {
          const pairAddr = await publicClient.readContract({
            address: ELOQURA_CONTRACTS.sepolia.Factory as `0x${string}`,
            abi: FACTORY_ABI,
            functionName: "allPairs",
            args: [BigInt(i)],
          }) as `0x${string}`;

          try {
            const [token0Addr, token1Addr] = await Promise.all([
              publicClient.readContract({ address: pairAddr, abi: PAIR_ABI, functionName: "token0" }) as Promise<`0x${string}`>,
              publicClient.readContract({ address: pairAddr, abi: PAIR_ABI, functionName: "token1" }) as Promise<`0x${string}`>,
            ]);

            const [symbol0, symbol1, decimals0, decimals1] = await Promise.all([
              publicClient.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>,
              publicClient.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>,
              publicClient.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
              publicClient.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
            ]);

            const swapEvent = {
              type: "event" as const,
              name: "Swap" as const,
              inputs: [
                { name: "sender", type: "address" as const, indexed: true },
                { name: "amount0In", type: "uint256" as const, indexed: false },
                { name: "amount1In", type: "uint256" as const, indexed: false },
                { name: "amount0Out", type: "uint256" as const, indexed: false },
                { name: "amount1Out", type: "uint256" as const, indexed: false },
                { name: "to", type: "address" as const, indexed: true },
              ],
            };

            // Fetch logs in chunks to handle RPC block range limits
            let logs: any[] = [];
            const chunkSize = 5000n;
            for (let start = fromBlock; start <= currentBlock; start += chunkSize) {
              const end = start + chunkSize - 1n > currentBlock ? currentBlock : start + chunkSize - 1n;
              try {
                const chunk = await publicClient.getLogs({
                  address: pairAddr,
                  event: swapEvent,
                  fromBlock: start,
                  toBlock: end,
                });
                logs = logs.concat(chunk);
              } catch {
                // If chunk fails, skip it and continue
              }
            }

            for (const log of logs.slice(-10)) {
              const args = log.args as any;
              const a0In = args.amount0In ?? 0n;
              const a1In = args.amount1In ?? 0n;
              const a0Out = args.amount0Out ?? 0n;
              const a1Out = args.amount1Out ?? 0n;
              const isToken0In = a0In > 0n;

              let timestamp = Date.now() / 1000;
              try {
                const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
                timestamp = Number(block.timestamp);
              } catch {}

              allSwaps.push({
                tokenIn: isToken0In ? symbol0 : symbol1,
                tokenOut: isToken0In ? symbol1 : symbol0,
                amountIn: parseFloat(formatUnits(isToken0In ? a0In : a1In, isToken0In ? decimals0 : decimals1)).toFixed(4),
                amountOut: parseFloat(formatUnits(isToken0In ? a1Out : a0Out, isToken0In ? decimals1 : decimals0)).toFixed(4),
                timestamp,
                txHash: log.transactionHash,
              });
            }
          } catch {}
        }

        allSwaps.sort((a, b) => b.timestamp - a.timestamp);
        setRecentSwaps(allSwaps.slice(0, 10));
      } catch (error) {
        console.error("Error fetching recent swaps:", error);
      }
    };
    fetchRecentSwaps();
  }, [publicClient]);

  // Calculate totals
  const totalTokenValue = tokenBalances.reduce((sum, t) => sum + t.usdValue, 0);
  const totalLPValue = lpPositions.reduce((sum, p) => sum + p.usdValue, 0);
  const totalPortfolioValue = totalTokenValue + totalLPValue;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatAmount = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + "M";
    if (num >= 1000) return (num / 1000).toFixed(2) + "K";
    if (num >= 1) return num.toFixed(2);
    if (num > 0) return num.toFixed(6);
    return "0";
  };

  const timeAgo = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (loading && isConnected) {
    return (
      <Layout>
        <div className="p-8 flex items-center justify-center min-h-[50vh]">
          <OECLoader size="lg" text="Loading dashboard..." />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 sm:p-8">
        <div className="max-w-7xl mx-auto">

          {/* Portfolio Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-gradient-to-r from-cyan-500 to-blue-500 border border-cyan-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-sm mb-1 font-bold">Total Portfolio Value</p>
                    <p className="text-2xl font-bold text-white">
                      {isConnected ? formatPrice(totalPortfolioValue) : "$0.00"}
                    </p>
                    <p className="text-sm text-white/80 mt-2">
                      {isConnected ? "Tokens + LP" : "Connect wallet"}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-violet-500 to-purple-500 border border-violet-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-sm mb-1 font-bold">LP Positions</p>
                    <p className="text-2xl font-bold text-white">
                      {isConnected ? lpPositions.length : "0"}
                    </p>
                    <p className="text-sm text-white/80 mt-2">
                      {isConnected && totalLPValue > 0
                        ? formatPrice(totalLPValue)
                        : isConnected ? "No positions" : "Connect wallet"}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-yellow-500 to-orange-500 border border-yellow-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-sm mb-1 font-bold">OEC Price</p>
                    <p className="text-2xl font-bold text-white">
                      {oecPrice > 0 ? `$${oecPrice >= 0.01 ? oecPrice.toFixed(4) : oecPrice.toFixed(6)}` : "$0.00"}
                    </p>
                    <div className="flex items-center mt-2">
                      <Zap className="w-4 h-4 text-white mr-1" />
                      <span className="text-sm text-white font-medium">
                        From Eloqura DEX
                      </span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-green-500 to-emerald-500 border border-green-500">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-sm mb-1 font-bold">Recent Swaps</p>
                    <p className="text-2xl font-bold text-white">{recentSwaps.length}</p>
                    <div className="flex items-center mt-2">
                      <Activity className="w-4 h-4 text-white mr-1" />
                      <span className="text-sm text-white font-medium">
                        Last ~7 days
                      </span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Token Holdings */}
            <Card className="crypto-card border">
              <CardHeader>
                <CardTitle className="text-xl text-white flex items-center">
                  <Eye className="w-5 h-5 mr-2" />
                  Token Holdings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!isConnected ? (
                  <div className="p-6 text-center text-gray-400">
                    Connect your wallet to see holdings
                  </div>
                ) : tokenBalances.filter(t => t.balance > 0).length === 0 ? (
                  <div className="p-6 text-center text-gray-400">
                    No token balances found
                  </div>
                ) : (
                  <div className="divide-y divide-gray-700">
                    {tokenBalances
                      .filter(t => t.balance > 0)
                      .map((token) => (
                        <div key={token.symbol} className="py-2 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <img
                                src={token.logo}
                                alt={token.symbol}
                                className="w-7 h-7 rounded-full"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "/oec-logo.png";
                                }}
                              />
                              <div>
                                <h3 className="font-semibold text-white text-sm">{token.symbol}</h3>
                                <p className="text-xs text-gray-400">{token.name}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-white text-sm">{formatAmount(token.balance)}</p>
                              {token.usdValue > 0 && (
                                <p className="text-xs text-cyan-400">{formatPrice(token.usdValue)}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="crypto-card border">
              <CardHeader>
                <CardTitle className="text-xl text-white flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  Recent Swaps
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {recentSwaps.length === 0 ? (
                  <div className="p-6 text-center text-gray-400">
                    No recent swaps found
                  </div>
                ) : (
                  <div className="divide-y divide-gray-700">
                    {recentSwaps.map((swap, idx) => (
                      <div key={`${swap.txHash}-${idx}`} className="py-2 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-500/20">
                              <ArrowUpRight className="w-4 h-4 text-blue-400" />
                            </div>
                            <div>
                              <p className="text-white font-medium text-sm">
                                {formatAmount(parseFloat(swap.amountIn))} {swap.tokenIn} → {formatAmount(parseFloat(swap.amountOut))} {swap.tokenOut}
                              </p>
                              <p className="text-xs text-gray-400">{timeAgo(swap.timestamp)}</p>
                            </div>
                          </div>
                          <a
                            href={`https://sepolia.etherscan.io/tx/${swap.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* LP Positions */}
          {isConnected && lpPositions.length > 0 && (
            <Card className="crypto-card border mt-8">
              <CardHeader>
                <CardTitle className="text-xl text-white flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Your Liquidity Positions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {lpPositions.map((pos) => (
                    <div
                      key={pos.pairAddress}
                      className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-800"
                    >
                      <div>
                        <h4 className="font-medium text-white">
                          {pos.token0Symbol}/{pos.token1Symbol}
                        </h4>
                        <p className="text-xs text-gray-400">
                          {formatAmount(pos.reserve0)} {pos.token0Symbol} + {formatAmount(pos.reserve1)} {pos.token1Symbol}
                        </p>
                      </div>
                      <div className="text-right">
                        {pos.usdValue > 0 && (
                          <p className="font-bold text-white">{formatPrice(pos.usdValue)}</p>
                        )}
                        <a
                          href={`https://sepolia.etherscan.io/address/${pos.pairAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center justify-end gap-1"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <div className="mt-8">
            <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button
                onClick={() => navigate("/swap")}
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white h-16"
              >
                <div className="text-center">
                  <ArrowUpRight className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-sm font-medium">Trade</div>
                </div>
              </Button>
              <Button
                onClick={() => navigate("/liquidity")}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white h-16"
              >
                <div className="text-center">
                  <Users className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-sm font-medium">Add Liquidity</div>
                </div>
              </Button>
              <Button
                onClick={() => window.open("https://staking.oeconomia.io", "_blank")}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white h-16"
              >
                <div className="text-center">
                  <Target className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-sm font-medium">Stake</div>
                </div>
              </Button>
              <Button
                onClick={() => navigate("/swap")}
                className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white h-16"
              >
                <div className="text-center">
                  <BarChart3 className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-sm font-medium">Analytics</div>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

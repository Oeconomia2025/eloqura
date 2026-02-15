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
  ExternalLink,
  Settings,
  X,
} from "lucide-react";
import { useAccount, usePublicClient } from "wagmi";
import { formatUnits, formatEther, parseUnits } from "viem";
import { ELOQURA_CONTRACTS, UNISWAP_CONTRACTS, UNISWAP_QUOTER_ABI, UNISWAP_FEE_TIERS, ERC20_ABI, FACTORY_ABI, PAIR_ABI } from "@/lib/contracts";
import { useLocation } from "wouter";

// Known token metadata for logos and friendly names (keyed by lowercase address)
const KNOWN_TOKEN_META: Record<string, { symbol: string; name: string; logo: string }> = {
  "0x2b2fb8df4ac5d394f0d5674d7a54802e42a06aba": {
    symbol: "OEC", name: "Oeconomia",
    logo: "https://pub-37d61a7eb7ae45898b46702664710cb2.r2.dev/images/OEC%20Logo%20Square.png",
  },
  [ELOQURA_CONTRACTS.sepolia.WETH.toLowerCase()]: {
    symbol: "WETH", name: "Wrapped Ether",
    logo: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
  },
  "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238": {
    symbol: "USDC", name: "USD Coin",
    logo: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
  },
  "0x779877a7b0d9e8603169ddbd7836e478b4624789": {
    symbol: "LINK", name: "Chainlink",
    logo: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
  },
  "0x3e622317f8c93f7328350cf0b56d9ed4c620c5d6": {
    symbol: "DAI", name: "Dai Stablecoin",
    logo: "https://assets.coingecko.com/coins/images/9956/small/dai-multi-collateral-mcd.png",
  },
  "0x5bb220afc6e2e008cb2302a83536a019ed245aa2": {
    symbol: "AAVE", name: "Aave",
    logo: "https://assets.coingecko.com/coins/images/12645/small/AAVE.png",
  },
  // Uniswap WETH (different from Eloqura WETH)
  "0xfff9976782d46cc05630d1f6ebab18b2324d6b14": {
    symbol: "WETH", name: "Wrapped Ether (Uniswap)",
    logo: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
  },
};

// ETH metadata (native token, not returned by Alchemy token discovery)
const ETH_META = {
  symbol: "ETH",
  name: "Ethereum",
  address: "0x0000000000000000000000000000000000000000",
  decimals: 18,
  logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
};

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
  // Discovered tokens from Alchemy (address → { symbol, name, decimals, balance hex })
  const [discoveredTokens, setDiscoveredTokens] = useState<Array<{
    address: string; symbol: string; name: string; decimals: number; logo: string | null; balance: string;
  }>>([]);
  // Token visibility — hidden token addresses stored in localStorage
  const [hiddenTokens, setHiddenTokens] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("eloqura-hidden-tokens");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [showTokenSettings, setShowTokenSettings] = useState(false);

  const toggleTokenVisibility = (addr: string) => {
    setHiddenTokens(prev => {
      const next = new Set(prev);
      const key = addr.toLowerCase();
      if (next.has(key)) next.delete(key); else next.add(key);
      localStorage.setItem("eloqura-hidden-tokens", JSON.stringify([...next]));
      return next;
    });
  };

  // Helper: get USD price for a token by address (lowercase)
  const getPrice = (addr: string) => tokenPrices[addr.toLowerCase()] || 0;

  // Convenience accessors
  const oecPrice = tokenPrices[OEC_ADDRESS.toLowerCase()] || 0;
  const ethPrice = tokenPrices["eth"] || 0;

  // Step 1: Discover all tokens in wallet via Alchemy serverless function
  useEffect(() => {
    const discover = async () => {
      if (!address) { setDiscoveredTokens([]); return; }
      try {
        const res = await fetch(`/.netlify/functions/wallet-tokens?address=${address}`);
        if (res.ok) {
          const data = await res.json();
          setDiscoveredTokens(data.tokens || []);
        }
      } catch (err) {
        console.error("Token discovery failed:", err);
      }
    };
    discover();
    const interval = setInterval(discover, 60000);
    return () => clearInterval(interval);
  }, [address]);

  // Step 2: Fetch prices for discovered tokens + ETH
  useEffect(() => {
    const fetchPrices = async () => {
      if (!publicClient) return;
      const usdcAddress = USDC_ADDRESS as `0x${string}`;
      const usdcDecimals = 6;
      const prices: Record<string, number> = {};
      const feeTiers = [UNISWAP_FEE_TIERS.MEDIUM, UNISWAP_FEE_TIERS.LOW, UNISWAP_FEE_TIERS.HIGH];

      // Build list of unique token addresses to price (from discovered tokens + ETH)
      const toPriceList: { address: string; symbol: string; decimals: number }[] = [
        { address: "eth", symbol: "ETH", decimals: 18 },
      ];
      for (const dt of discoveredTokens) {
        const addr = dt.address.toLowerCase();
        if (!toPriceList.find(t => t.address === addr)) {
          const meta = KNOWN_TOKEN_META[addr];
          toPriceList.push({ address: addr, symbol: meta?.symbol || dt.symbol, decimals: dt.decimals });
        }
      }

      for (const token of toPriceList) {
        const addr = token.address.toLowerCase();
        // Stablecoins
        if (addr === USDC_ADDRESS.toLowerCase()) { prices[addr] = 1; continue; }
        if (token.symbol === "DAI") { prices[addr] = 1; continue; }

        // For ETH/WETH, use Uniswap WETH address to query quoter
        const isEthLike = token.symbol === "ETH" || token.symbol === "WETH" || addr === UNISWAP_CONTRACTS.sepolia.WETH.toLowerCase() || addr === ELOQURA_CONTRACTS.sepolia.WETH.toLowerCase();
        const quoterAddr = isEthLike
          ? UNISWAP_CONTRACTS.sepolia.WETH
          : token.address;

        let priceFound = false;

        // Try direct: token → USDC via Uniswap V3
        if (addr !== "eth") {
          for (const fee of feeTiers) {
            try {
              const amountIn = parseUnits("1", token.decimals);
              const result = await publicClient.simulateContract({
                address: UNISWAP_CONTRACTS.sepolia.QuoterV2 as `0x${string}`,
                abi: UNISWAP_QUOTER_ABI,
                functionName: "quoteExactInputSingle",
                args: [{ tokenIn: quoterAddr as `0x${string}`, tokenOut: usdcAddress, amountIn, fee, sqrtPriceLimitX96: 0n }],
              });
              const usdPrice = parseFloat(formatUnits(result.result[0], usdcDecimals));
              if (usdPrice > 0) { prices[addr] = usdPrice; priceFound = true; break; }
            } catch { continue; }
          }
        } else {
          // ETH: price via WETH → USDC
          for (const fee of feeTiers) {
            try {
              const result = await publicClient.simulateContract({
                address: UNISWAP_CONTRACTS.sepolia.QuoterV2 as `0x${string}`,
                abi: UNISWAP_QUOTER_ABI,
                functionName: "quoteExactInputSingle",
                args: [{ tokenIn: UNISWAP_CONTRACTS.sepolia.WETH as `0x${string}`, tokenOut: usdcAddress, amountIn: parseUnits("1", 18), fee, sqrtPriceLimitX96: 0n }],
              });
              const usdPrice = parseFloat(formatUnits(result.result[0], usdcDecimals));
              if (usdPrice > 0) { prices["eth"] = usdPrice; priceFound = true; break; }
            } catch { continue; }
          }
        }

        // Fallback: token → WETH → USDC
        if (!priceFound && !isEthLike && addr !== "eth") {
          for (const fee of feeTiers) {
            try {
              const amountIn = parseUnits("1", token.decimals);
              const result = await publicClient.simulateContract({
                address: UNISWAP_CONTRACTS.sepolia.QuoterV2 as `0x${string}`,
                abi: UNISWAP_QUOTER_ABI,
                functionName: "quoteExactInputSingle",
                args: [{ tokenIn: quoterAddr as `0x${string}`, tokenOut: UNISWAP_CONTRACTS.sepolia.WETH as `0x${string}`, amountIn, fee, sqrtPriceLimitX96: 0n }],
              });
              const wethAmount = parseFloat(formatUnits(result.result[0], 18));
              if (wethAmount > 0) {
                const ethP = prices["eth"] || 0;
                if (ethP > 0) { prices[addr] = wethAmount * ethP; priceFound = true; break; }
                // Get WETH → USDC
                for (const wethFee of feeTiers) {
                  try {
                    const wr = await publicClient.simulateContract({
                      address: UNISWAP_CONTRACTS.sepolia.QuoterV2 as `0x${string}`,
                      abi: UNISWAP_QUOTER_ABI,
                      functionName: "quoteExactInputSingle",
                      args: [{ tokenIn: UNISWAP_CONTRACTS.sepolia.WETH as `0x${string}`, tokenOut: usdcAddress, amountIn: parseUnits("1", 18), fee: wethFee, sqrtPriceLimitX96: 0n }],
                    });
                    const wethUsd = parseFloat(formatUnits(wr.result[0], usdcDecimals));
                    if (wethUsd > 0) { prices[addr] = wethAmount * wethUsd; priceFound = true; break; }
                  } catch { continue; }
                }
                if (priceFound) break;
              }
            } catch { continue; }
          }
        }

        // Fallback: Eloqura DEX pool
        if (!priceFound && addr !== "eth") {
          try {
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
              const isToken0 = token0.toLowerCase() === addr;
              const tokenReserve = parseFloat(formatUnits(isToken0 ? reserves[0] : reserves[1], token.decimals));
              const usdcReserve = parseFloat(formatUnits(isToken0 ? reserves[1] : reserves[0], usdcDecimals));
              if (tokenReserve > 0) { prices[addr] = usdcReserve / tokenReserve; }
            }
          } catch {}
        }

        // WETH addresses share ETH price
        if (isEthLike && addr !== "eth" && !prices[addr] && prices["eth"]) {
          prices[addr] = prices["eth"];
        }
      }

      // Sync ETH/WETH prices
      if (prices["eth"] && !prices[ELOQURA_CONTRACTS.sepolia.WETH.toLowerCase()]) {
        prices[ELOQURA_CONTRACTS.sepolia.WETH.toLowerCase()] = prices["eth"];
      }
      if (prices["eth"] && !prices[UNISWAP_CONTRACTS.sepolia.WETH.toLowerCase()]) {
        prices[UNISWAP_CONTRACTS.sepolia.WETH.toLowerCase()] = prices["eth"];
      }

      setTokenPrices(prices);
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [publicClient, discoveredTokens]);

  // Step 3: Build final token balances from discovered tokens + ETH
  useEffect(() => {
    const buildBalances = async () => {
      if (!publicClient || !address) {
        setTokenBalances([]);
        setLoading(false);
        return;
      }
      try {
        const balances: TokenBalance[] = [];

        // Add native ETH
        const ethBalance = await publicClient.getBalance({ address });
        const ethBal = parseFloat(formatUnits(ethBalance, 18));
        balances.push({
          ...ETH_META,
          balance: ethBal,
          usdValue: ethBal * (tokenPrices["eth"] || 0),
        });

        // Add discovered ERC-20 tokens
        for (const dt of discoveredTokens) {
          const addr = dt.address.toLowerCase();
          const meta = KNOWN_TOKEN_META[addr];
          const rawBal = BigInt(dt.balance);
          const numBal = parseFloat(formatUnits(rawBal, dt.decimals));

          balances.push({
            symbol: meta?.symbol || dt.symbol,
            name: meta?.name || dt.name,
            address: dt.address,
            decimals: dt.decimals,
            logo: meta?.logo || dt.logo || "/oec-logo.png",
            balance: numBal,
            usdValue: numBal * (tokenPrices[addr] || 0),
          });
        }

        balances.sort((a, b) => b.usdValue - a.usdValue || b.balance - a.balance);
        setTokenBalances(balances);
      } catch (error) {
        console.error("Error building balances:", error);
      } finally {
        setLoading(false);
      }
    };
    buildBalances();
  }, [publicClient, address, discoveredTokens, tokenPrices]);

  // Fetch LP positions (batched with multicall)
  useEffect(() => {
    const fetchPositions = async () => {
      if (!publicClient || !address) { setLPPositions([]); return; }
      try {
        const pairCount = await publicClient.readContract({
          address: ELOQURA_CONTRACTS.sepolia.Factory as `0x${string}`,
          abi: FACTORY_ABI,
          functionName: "allPairsLength",
        }) as bigint;

        const count = Math.min(Number(pairCount), 20);
        if (count === 0) { setLPPositions([]); return; }

        // Batch: get all pair addresses in one multicall
        const pairAddressResults = await publicClient.multicall({
          contracts: Array.from({ length: count }, (_, i) => ({
            address: ELOQURA_CONTRACTS.sepolia.Factory as `0x${string}`,
            abi: FACTORY_ABI,
            functionName: "allPairs" as const,
            args: [BigInt(i)],
          })),
        });
        const pairAddresses = pairAddressResults
          .filter(r => r.status === "success")
          .map(r => r.result as `0x${string}`);

        // Batch: get LP balances for all pairs in one multicall
        const lpBalanceResults = await publicClient.multicall({
          contracts: pairAddresses.map(addr => ({
            address: addr,
            abi: ERC20_ABI,
            functionName: "balanceOf" as const,
            args: [address],
          })),
        });

        // Filter to only pairs where user has LP tokens
        const activePairs: { address: `0x${string}`; lpBalance: bigint }[] = [];
        pairAddresses.forEach((addr, i) => {
          const bal = lpBalanceResults[i].status === "success" ? (lpBalanceResults[i].result as bigint) : 0n;
          if (bal > 0n) activePairs.push({ address: addr, lpBalance: bal });
        });

        if (activePairs.length === 0) { setLPPositions([]); return; }

        // Batch: get token0, token1, reserves, totalSupply for active pairs
        const detailCalls = activePairs.flatMap(pair => [
          { address: pair.address, abi: PAIR_ABI, functionName: "token0" as const, args: [] as const },
          { address: pair.address, abi: PAIR_ABI, functionName: "token1" as const, args: [] as const },
          { address: pair.address, abi: PAIR_ABI, functionName: "getReserves" as const, args: [] as const },
          { address: pair.address, abi: ERC20_ABI, functionName: "totalSupply" as const, args: [] as const },
        ]);
        const detailResults = await publicClient.multicall({ contracts: detailCalls });

        // Batch: get symbol and decimals for all unique token addresses
        const tokenAddrs: `0x${string}`[] = [];
        activePairs.forEach((_, i) => {
          const t0 = detailResults[i * 4].status === "success" ? detailResults[i * 4].result as `0x${string}` : null;
          const t1 = detailResults[i * 4 + 1].status === "success" ? detailResults[i * 4 + 1].result as `0x${string}` : null;
          if (t0) tokenAddrs.push(t0);
          if (t1) tokenAddrs.push(t1);
        });
        const uniqueTokenAddrs = [...new Set(tokenAddrs.map(a => a.toLowerCase()))].map(a => a as `0x${string}`);

        const tokenInfoCalls = uniqueTokenAddrs.flatMap(addr => [
          { address: addr, abi: ERC20_ABI, functionName: "symbol" as const, args: [] as const },
          { address: addr, abi: ERC20_ABI, functionName: "decimals" as const, args: [] as const },
        ]);
        const tokenInfoResults = await publicClient.multicall({ contracts: tokenInfoCalls });
        const tokenInfoMap: Record<string, { symbol: string; decimals: number }> = {};
        uniqueTokenAddrs.forEach((addr, i) => {
          const symbol = tokenInfoResults[i * 2].status === "success" ? tokenInfoResults[i * 2].result as string : "???";
          const decimals = tokenInfoResults[i * 2 + 1].status === "success" ? Number(tokenInfoResults[i * 2 + 1].result) : 18;
          tokenInfoMap[addr.toLowerCase()] = { symbol, decimals };
        });

        const positions: LPPosition[] = [];
        activePairs.forEach((pair, i) => {
          const token0Addr = detailResults[i * 4].status === "success" ? (detailResults[i * 4].result as string).toLowerCase() : null;
          const token1Addr = detailResults[i * 4 + 1].status === "success" ? (detailResults[i * 4 + 1].result as string).toLowerCase() : null;
          const reserves = detailResults[i * 4 + 2].status === "success" ? detailResults[i * 4 + 2].result as [bigint, bigint, number] : null;
          const totalSupply = detailResults[i * 4 + 3].status === "success" ? detailResults[i * 4 + 3].result as bigint : 0n;

          if (!token0Addr || !token1Addr || !reserves || totalSupply === 0n) return;

          const info0 = tokenInfoMap[token0Addr] || { symbol: "???", decimals: 18 };
          const info1 = tokenInfoMap[token1Addr] || { symbol: "???", decimals: 18 };

          const share = Number(pair.lpBalance) / Number(totalSupply);
          const r0 = parseFloat(formatUnits(reserves[0], info0.decimals)) * share;
          const r1 = parseFloat(formatUnits(reserves[1], info1.decimals)) * share;
          let usd0 = r0 * getPrice(token0Addr);
          let usd1 = r1 * getPrice(token1Addr);
          if (usd0 > 0 && usd1 === 0) usd1 = usd0;
          else if (usd1 > 0 && usd0 === 0) usd0 = usd1;

          positions.push({
            pairAddress: pair.address,
            token0Symbol: info0.symbol,
            token1Symbol: info1.symbol,
            lpBalance: parseFloat(formatEther(pair.lpBalance)),
            reserve0: r0,
            reserve1: r1,
            totalSupply: parseFloat(formatEther(totalSupply)),
            usdValue: usd0 + usd1,
          });
        });
        setLPPositions(positions);
      } catch (error) {
        console.error("Error fetching LP positions:", error);
      }
    };
    fetchPositions();
    const interval = setInterval(fetchPositions, 60000);
    return () => clearInterval(interval);
  }, [publicClient, address, tokenPrices]);

  // Load recent swaps from localStorage (saved when user completes swaps on swap page)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("eloqura-recent-swaps") || "[]") as RecentSwap[];
      setRecentSwaps(saved.slice(0, 10));
    } catch {
      setRecentSwaps([]);
    }
  }, []);

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
                    <p className="text-white/80 text-sm mb-1 font-bold">Portfolio Value</p>
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

            <Card className="bg-gradient-to-r from-green-500 to-emerald-500 border border-green-500">
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

            <Card className="bg-gradient-to-r from-violet-500 to-purple-500 border border-violet-500">
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
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl text-white flex items-center">
                    <Eye className="w-5 h-5 mr-2" />
                    Token Holdings
                  </CardTitle>
                  {isConnected && tokenBalances.length > 0 && (
                    <button
                      onClick={() => setShowTokenSettings(true)}
                      className="p-1.5 rounded-lg hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-white"
                      title="Manage visible tokens"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!isConnected ? (
                  <div className="p-6 text-center text-gray-400">
                    Connect your wallet to see holdings
                  </div>
                ) : tokenBalances.filter(t => t.balance > 0 && !hiddenTokens.has(t.address.toLowerCase())).length === 0 ? (
                  <div className="p-6 text-center text-gray-400">
                    No token balances found
                  </div>
                ) : (
                  <div className="divide-y divide-gray-700">
                    {tokenBalances
                      .filter(t => t.balance > 0 && !hiddenTokens.has(t.address.toLowerCase()))
                      .map((token) => (
                        <div key={token.address} className="py-2 px-4">
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

            {/* Token Visibility Modal */}
            {showTokenSettings && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowTokenSettings(false)}>
                <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h3 className="text-lg font-bold text-white">Manage Tokens</h3>
                    <button onClick={() => setShowTokenSettings(false)} className="p-1 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="overflow-y-auto flex-1 p-2">
                    {tokenBalances.filter(t => t.balance > 0).map((token) => {
                      const addr = token.address.toLowerCase();
                      const isVisible = !hiddenTokens.has(addr);
                      return (
                        <button
                          key={token.address}
                          onClick={() => toggleTokenVisibility(token.address)}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-800/60 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <img
                              src={token.logo}
                              alt={token.symbol}
                              className="w-7 h-7 rounded-full"
                              onError={(e) => { (e.target as HTMLImageElement).src = "/oec-logo.png"; }}
                            />
                            <div className="text-left">
                              <p className="text-sm font-medium text-white">{token.symbol}</p>
                              <p className="text-xs text-gray-400">{formatAmount(token.balance)}</p>
                            </div>
                          </div>
                          <div className={`w-10 h-5 rounded-full relative transition-colors ${isVisible ? 'bg-cyan-500' : 'bg-gray-600'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isVisible ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="p-3 border-t border-gray-700 flex gap-2">
                    <button
                      onClick={() => { setHiddenTokens(new Set()); localStorage.removeItem("eloqura-hidden-tokens"); }}
                      className="flex-1 py-2 text-sm rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                      Show All
                    </button>
                    <button
                      onClick={() => setShowTokenSettings(false)}
                      className="flex-1 py-2 text-sm rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                  <div className="text-sm font-medium">Stake OEC</div>
                </div>
              </Button>
              <Button
                onClick={() => window.open("https://oeconomia.io/analytics", "_blank")}
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

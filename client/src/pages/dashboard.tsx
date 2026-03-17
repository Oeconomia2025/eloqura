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
import { ELOQURA_CONTRACTS, ERC20_ABI, FACTORY_ABI, PAIR_ABI } from "@/lib/contracts";
import { useLocation } from "wouter";

// Known token metadata for logos and friendly names (keyed by lowercase address)
const KNOWN_TOKEN_META: Record<string, { symbol: string; name: string; logo: string }> = {
  "0x00904218319a045a96d776ec6a970f54741208e6": {
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

const OEC_ADDRESS = '0x00904218319a045a96d776ec6a970f54741208e6'

// ── Pricing constants (copied from DAO Hub portfolio.tsx) ──
const ELOQURA_FACTORY = '0x1a4C7849Dd8f62AefA082360b3A8D857952B3b8e' as `0x${string}`
const ELOQURA_WETH = '0x34b11f6b8f78fa010bbca71bc7fe79daa811b89f' as `0x${string}`
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`
const UNISWAP_QUOTER_V2 = '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3' as `0x${string}`
const UNISWAP_WETH = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as `0x${string}`
const FEE_TIERS = [3000, 500, 10000] as const

// Uniswap V3 QuoterV2 ABI (local definition with as const, same as DAO Hub)
const QUOTER_ABI = [
  {
    name: 'quoteExactInputSingle', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'params', type: 'tuple', components: [
      { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' }, { name: 'fee', type: 'uint24' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' },
    ]}],
    outputs: [
      { name: 'amountOut', type: 'uint256' }, { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' }, { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const

// Tokens not on Uniswap V3 — skip quoter to avoid slow timeout RPC calls
const SKIP_QUOTER = new Set([
  '0x00904218319a045a96d776ec6a970f54741208e6', // OEC
  '0x5cdbed8ed63554fde6653f02ae1c4d6d5ae71ad3', // ALUR
  '0x41b07704b9d671615a3e9f83c06d85cb38bbf4d9', // ALUD
  '0x4feb15d0644e5c7bb64dcd85744f0f2ab5f7a253', // ELOQ
])

// Tokens to always price (for staking/LP calculations even if not in wallet)
const PRICING_TOKENS = [
  { address: '0x00904218319a045a96d776ec6a970f54741208e6', symbol: 'OEC', decimals: 18 },
  { address: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238', symbol: 'USDC', decimals: 6 },
  { address: '0x779877a7b0d9e8603169ddbd7836e478b4624789', symbol: 'LINK', decimals: 18 },
  { address: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14', symbol: 'WETH', decimals: 18 },
  { address: '0x34b11f6b8f78fa010bbca71bc7fe79daa811b89f', symbol: 'WETH', decimals: 18 },
  { address: '0x5cdbed8ed63554fde6653f02ae1c4d6d5ae71ad3', symbol: 'ALUR', decimals: 18 },
  { address: '0x41b07704b9d671615a3e9f83c06d85cb38bbf4d9', symbol: 'ALUD', decimals: 18 },
  { address: '0x4feb15d0644e5c7bb64dcd85744f0f2ab5f7a253', symbol: 'ELOQ', decimals: 18 },
]

// Known token address → symbol/name map for resolution
const TOKEN_MAP: Record<string, { symbol: string; name: string; decimals: number }> = {
  '0x00904218319a045a96d776ec6a970f54741208e6': { symbol: 'OEC', name: 'Oeconomia', decimals: 18 },
  '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  '0x779877a7b0d9e8603169ddbd7836e478b4624789': { symbol: 'LINK', name: 'Chainlink', decimals: 18 },
  '0xfff9976782d46cc05630d1f6ebab18b2324d6b14': { symbol: 'WETH', name: 'Wrapped Ether (Uniswap)', decimals: 18 },
  '0x34b11f6b8f78fa010bbca71bc7fe79daa811b89f': { symbol: 'WETH', name: 'Wrapped Ether (Eloqura)', decimals: 18 },
  '0x5cdbed8ed63554fde6653f02ae1c4d6d5ae71ad3': { symbol: 'ALUR', name: 'Alluria Reward', decimals: 18 },
  '0x41b07704b9d671615a3e9f83c06d85cb38bbf4d9': { symbol: 'ALUD', name: 'Alluria Dollar', decimals: 18 },
  '0x4feb15d0644e5c7bb64dcd85744f0f2ab5f7a253': { symbol: 'ELOQ', name: 'Eloqura', decimals: 18 },
  '0x3e622317f8c93f7328350cf0b56d9ed4c620c5d6': { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
}

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
  const [lpPairAddresses, setLPPairAddresses] = useState<Set<string>>(new Set());
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

  // Step 2: Fetch token prices via Uniswap V3 QuoterV2 + Eloqura DEX fallback (parallel)
  // This is the EXACT same approach as the DAO Hub portfolio page
  useEffect(() => {
    const fetchPrices = async () => {
      if (!publicClient) return
      const prices: Record<string, number> = {}

      // Helper: race a simulateContract call against a 4s timeout
      const quoterCallWithTimeout = async (args: any, timeoutMs = 4000) => {
        const call = publicClient.simulateContract(args)
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs)
        )
        return Promise.race([call, timeout])
      }

      // Merge discovered tokens + baseline pricing tokens (deduplicated)
      const seen = new Set<string>()
      const pricingTokens: Array<{ symbol: string; address: string; decimals: number }> = [
        { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
      ]
      seen.add('0x0000000000000000000000000000000000000000')
      for (const t of discoveredTokens) {
        const addr = t.address.toLowerCase()
        // Skip LP tokens — they're pair contracts, not tradeable tokens
        if (t.symbol.includes('LP') || t.symbol.includes('ELQ-')) continue
        if (!seen.has(addr)) { pricingTokens.push({ symbol: t.symbol, address: addr, decimals: t.decimals }); seen.add(addr) }
      }
      for (const t of PRICING_TOKENS) {
        const addr = t.address.toLowerCase()
        if (!seen.has(addr)) { pricingTokens.push({ symbol: t.symbol, address: addr, decimals: t.decimals }); seen.add(addr) }
      }
      // Add TOKEN_MAP entries not yet seen
      for (const [addr, meta] of Object.entries(TOKEN_MAP)) {
        if (!seen.has(addr)) { pricingTokens.push({ symbol: meta.symbol, address: addr, decimals: meta.decimals }); seen.add(addr) }
      }

      // Helper: fetch price for a single token
      const fetchSinglePrice = async (token: typeof pricingTokens[0]): Promise<{ symbol: string; addr: string; price: number }> => {
        const addr = token.address.toLowerCase()
        if (token.symbol === 'USDC') return { symbol: 'USDC', addr, price: 1 }
        if (token.symbol === 'ALUD') return { symbol: 'ALUD', addr, price: 1 } // stablecoin pegged to $1
        if (token.symbol === 'DAI') return { symbol: 'DAI', addr, price: 1 }

        // Skip Uniswap quoter for Oeconomia-native tokens
        if (SKIP_QUOTER.has(addr)) return { symbol: token.symbol, addr, price: 0 }

        const quoterAddress = (token.symbol === 'ETH' || token.symbol === 'WETH')
          ? UNISWAP_WETH : token.address as `0x${string}`

        // Tier 1: Direct token → USDC via Uniswap V3 (all fee tiers parallel)
        const directResults = await Promise.allSettled(
          FEE_TIERS.map(fee =>
            quoterCallWithTimeout({
              address: UNISWAP_QUOTER_V2,
              abi: QUOTER_ABI,
              functionName: 'quoteExactInputSingle',
              args: [{ tokenIn: quoterAddress, tokenOut: USDC_ADDRESS, amountIn: parseUnits('1', token.decimals), fee, sqrtPriceLimitX96: 0n }],
            })
          )
        )
        for (const r of directResults) {
          if (r.status === 'fulfilled') {
            const usdPrice = parseFloat(formatUnits(r.value.result[0], 6))
            if (usdPrice > 0) return { symbol: token.symbol, addr, price: usdPrice }
          }
        }

        // Tier 2: token → WETH → USDC (parallel fee tiers)
        if (token.symbol !== 'WETH' && token.symbol !== 'ETH') {
          const hopResults = await Promise.allSettled(
            FEE_TIERS.map(fee =>
              quoterCallWithTimeout({
                address: UNISWAP_QUOTER_V2,
                abi: QUOTER_ABI,
                functionName: 'quoteExactInputSingle',
                args: [{ tokenIn: quoterAddress, tokenOut: UNISWAP_WETH, amountIn: parseUnits('1', token.decimals), fee, sqrtPriceLimitX96: 0n }],
              })
            )
          )
          for (const r of hopResults) {
            if (r.status === 'fulfilled') {
              const wethAmount = parseFloat(formatUnits(r.value.result[0], 18))
              if (wethAmount > 0) {
                const wethResults = await Promise.allSettled(
                  FEE_TIERS.map(wethFee =>
                    quoterCallWithTimeout({
                      address: UNISWAP_QUOTER_V2,
                      abi: QUOTER_ABI,
                      functionName: 'quoteExactInputSingle',
                      args: [{ tokenIn: UNISWAP_WETH, tokenOut: USDC_ADDRESS, amountIn: parseUnits('1', 18), fee: wethFee, sqrtPriceLimitX96: 0n }],
                    })
                  )
                )
                for (const wr of wethResults) {
                  if (wr.status === 'fulfilled') {
                    const wethUsd = parseFloat(formatUnits(wr.value.result[0], 6))
                    if (wethUsd > 0) return { symbol: token.symbol, addr, price: wethAmount * wethUsd }
                  }
                }
              }
            }
          }
        }

        return { symbol: token.symbol, addr, price: 0 }
      }

      // Fetch all Uniswap prices in parallel
      const results = await Promise.all(pricingTokens.map(fetchSinglePrice))
      for (const { symbol, addr, price } of results) {
        if (price > 0) { prices[symbol] = price; prices[addr] = price }
      }

      // Sync ETH <-> WETH
      if (prices['ETH'] && !prices['WETH']) prices['WETH'] = prices['ETH']
      if (prices['WETH'] && !prices['ETH']) prices['ETH'] = prices['WETH']
      const ethPriceVal = prices['ETH'] || 0
      prices['eth'] = ethPriceVal
      prices['WETH_ELOQURA'] = ethPriceVal
      prices['0xfff9976782d46cc05630d1f6ebab18b2324d6b14'] = ethPriceVal
      prices['0x34b11f6b8f78fa010bbca71bc7fe79daa811b89f'] = ethPriceVal

      // Tier 3: Eloqura DEX pool reserves for unpriced tokens (parallel)
      const unpricedTokens = pricingTokens.filter(t => !prices[t.address.toLowerCase()] && t.symbol !== 'ETH')
      if (unpricedTokens.length > 0) {
        const eloquraResults = await Promise.allSettled(
          unpricedTokens.map(async (token) => {
            // Try USDC pair first
            let pairAddress = await publicClient.readContract({
              address: ELOQURA_FACTORY,
              abi: FACTORY_ABI,
              functionName: 'getPair',
              args: [token.address as `0x${string}`, USDC_ADDRESS],
            }) as `0x${string}`

            if (pairAddress && pairAddress !== '0x0000000000000000000000000000000000000000') {
              const [reserves, token0] = await Promise.all([
                publicClient.readContract({ address: pairAddress, abi: PAIR_ABI, functionName: 'getReserves' }) as Promise<[bigint, bigint, number]>,
                publicClient.readContract({ address: pairAddress, abi: PAIR_ABI, functionName: 'token0' }) as Promise<`0x${string}`>,
              ])
              const isToken0 = token0.toLowerCase() === token.address.toLowerCase()
              const tokenReserve = parseFloat(formatUnits(isToken0 ? reserves[0] : reserves[1], token.decimals))
              const usdcReserve = parseFloat(formatUnits(isToken0 ? reserves[1] : reserves[0], 6))
              if (tokenReserve > 0 && usdcReserve > 0) {
                return { symbol: token.symbol, addr: token.address.toLowerCase(), price: usdcReserve / tokenReserve }
              }
            }

            // Try WETH pair as fallback
            if (ethPriceVal > 0) {
              pairAddress = await publicClient.readContract({
                address: ELOQURA_FACTORY,
                abi: FACTORY_ABI,
                functionName: 'getPair',
                args: [token.address as `0x${string}`, ELOQURA_WETH],
              }) as `0x${string}`

              if (pairAddress && pairAddress !== '0x0000000000000000000000000000000000000000') {
                const [reserves, token0] = await Promise.all([
                  publicClient.readContract({ address: pairAddress, abi: PAIR_ABI, functionName: 'getReserves' }) as Promise<[bigint, bigint, number]>,
                  publicClient.readContract({ address: pairAddress, abi: PAIR_ABI, functionName: 'token0' }) as Promise<`0x${string}`>,
                ])
                const isToken0 = token0.toLowerCase() === token.address.toLowerCase()
                const tokenReserve = parseFloat(formatUnits(isToken0 ? reserves[0] : reserves[1], token.decimals))
                const wethReserve = parseFloat(formatUnits(isToken0 ? reserves[1] : reserves[0], 18))
                if (tokenReserve > 0 && wethReserve > 0) {
                  return { symbol: token.symbol, addr: token.address.toLowerCase(), price: (wethReserve / tokenReserve) * ethPriceVal }
                }
              }
            }

            return null
          })
        )
        for (const r of eloquraResults) {
          if (r.status === 'fulfilled' && r.value) {
            prices[r.value.symbol] = r.value.price
            prices[r.value.addr] = r.value.price
          }
        }
      }

      setTokenPrices(prices)
    }
    fetchPrices()
    const interval = setInterval(fetchPrices, 60000)
    return () => clearInterval(interval)
  }, [publicClient, discoveredTokens])

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

        // Add discovered ERC-20 tokens (skip LP tokens — their value is in LP Positions)
        for (const dt of discoveredTokens) {
          const addr = dt.address.toLowerCase();
          if (lpPairAddresses.has(addr)) continue; // skip LP tokens
          if (dt.symbol.includes('LP') || dt.symbol.includes('ELQ-')) continue; // skip LP tokens by symbol
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
  }, [publicClient, address, discoveredTokens, tokenPrices, lpPairAddresses]);

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

        // Track pair addresses so holdings can exclude LP tokens
        setLPPairAddresses(new Set(pairAddresses.map(a => a.toLowerCase())));

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

  // Calculate totals (exclude LP tokens)
  const totalTokenValue = tokenBalances.reduce((sum, t) => {
    const addr = t.address.toLowerCase();
    if (lpPairAddresses.has(addr)) return sum;
    if (t.symbol.includes('LP') || t.symbol.includes('ELQ-')) return sum;
    return sum + t.usdValue;
  }, 0);
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
            <Card className="bg-[#5c69c2] border border-[#5c69c2]">
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

            <Card className="bg-[#5c69c2] border border-[#5c69c2]">
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
                ) : tokenBalances.filter(t => t.balance > 0 && !hiddenTokens.has(t.address.toLowerCase()) && !lpPairAddresses.has(t.address.toLowerCase())).length === 0 ? (
                  <div className="p-6 text-center text-gray-400">
                    No token balances found
                  </div>
                ) : (
                  <div className="divide-y divide-gray-700">
                    {tokenBalances
                      .filter(t => t.balance > 0 && !hiddenTokens.has(t.address.toLowerCase()) && !lpPairAddresses.has(t.address.toLowerCase()))
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
                                <p className="text-xs text-[#5c69c2]">{formatPrice(token.usdValue)}</p>
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
                          <div className={`w-10 h-5 rounded-full relative transition-colors ${isVisible ? 'bg-[#5c69c2]' : 'bg-gray-600'}`}>
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
                      className="flex-1 py-2 text-sm rounded-lg bg-[#5c69c2] text-white hover:bg-[#5c69c2]/80 transition-colors"
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
                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#5c69c2]/20">
                              <ArrowUpRight className="w-4 h-4 text-[#5c69c2]" />
                            </div>
                            <div>
                              <p className="text-white font-medium text-sm">
                                {formatAmount(parseFloat(swap.amountIn))} {swap.tokenIn} → {formatAmount(parseFloat(swap.amountOut))} {swap.tokenOut}
                              </p>
                              <p className="text-xs text-gray-400">{timeAgo(swap.timestamp)}</p>
                            </div>
                          </div>
                          <a
                            href={`https://oecsplorer.oeconomia.io/tx/${swap.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#5c69c2] hover:text-[#5c69c2]/80"
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
                          className="text-xs text-[#5c69c2] hover:text-[#5c69c2]/80 flex items-center justify-end gap-1"
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
                className="bg-[#5c69c2] hover:bg-[#5c69c2]/80 text-white h-16"
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
                className="bg-[#5c69c2] hover:bg-[#5c69c2]/80 text-white h-16"
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

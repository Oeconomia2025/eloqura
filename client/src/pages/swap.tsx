import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTokenData } from "@/hooks/use-token-data";
import { useAccount, usePublicClient, useWalletClient, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, parseUnits, parseEther } from "viem";
import { ELOQURA_CONTRACTS, UNISWAP_CONTRACTS, UNISWAP_ROUTER_ABI, UNISWAP_QUOTER_ABI, UNISWAP_FEE_TIERS, ERC20_ABI, PAIR_ABI, FACTORY_ABI, ROUTER_ABI } from "@/lib/contracts";
import { trackTransaction } from "@/lib/explorer";

// WETH ABI for deposit/withdraw
const WETH_ABI = [
  {
    name: "deposit",
    type: "function",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    name: "withdraw",
    type: "function",
    inputs: [{ name: "wad", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

import {
  ArrowUpDown,
  Settings,
  Info,
  Clock,
  TrendingUp,
  TrendingDown,
  Zap,
  Shield,
  AlertTriangle,
  BarChart3,
  Wallet
} from "lucide-react";
import { useLocation } from "wouter";

interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logo: string;
  price: number;
  balance?: number;
}

interface SwapQuote {
  inputAmount: string;
  outputAmount: string;
  exchangeRate: number;
  priceImpact: number;
  minimumReceived: string;
  fee: number;
  route: string[];
  feeTier?: number;
}

interface LimitOrder {
  triggerPrice: string;
  expiry: string;
  priceAdjustment: number;
}

function SwapContent() {
  const [, setLocation] = useLocation();
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [lastEditedField, setLastEditedField] = useState<'from' | 'to'>('from');
  const [slippage, setSlippage] = useState(0.5);
  const [customSlippage, setCustomSlippage] = useState("");
  const [isSlippageCustom, setIsSlippageCustom] = useState(false);
  const [txDeadline, setTxDeadline] = useState(20); // minutes
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [highImpactConfirmed, setHighImpactConfirmed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [chartTimeframe, setChartTimeframe] = useState("1D");
  const [hideSidebar, setHideSidebar] = useState(false);
  const [activeTab, setActiveTab] = useState("Trade");
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [tokenSelectionFor, setTokenSelectionFor] = useState<'from' | 'to' | 'priceCondition'>('from');
  const [tokenSearchQuery, setTokenSearchQuery] = useState("");
  const [customTokens, setCustomTokens] = useState<Token[]>(() => {
    try {
      const saved = localStorage.getItem("eloqura-custom-tokens");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<Token | null>(null);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [networkSelectionFor, setNetworkSelectionFor] = useState<'from' | 'to'>('from');

  // Limit order specific state
  const [limitOrder, setLimitOrder] = useState<LimitOrder>({
    triggerPrice: "",
    expiry: "1 day",
    priceAdjustment: 0
  });
  const [limitOrderType, setLimitOrderType] = useState<'sell' | 'buy'>('sell');
  const [useNegativePercentages, setUseNegativePercentages] = useState(false);

  // Track the original price condition tokens (for stablecoin behavior)
  const [priceConditionTokens, setPriceConditionTokens] = useState<{from: Token | null, to: Token | null}>({
    from: null,
    to: null
  });

  // Buy mode specific state
  const [fiatAmount, setFiatAmount] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("USD");

  // Sell mode specific state
  const [sellPercentage, setSellPercentage] = useState<number | null>(null);
  const [swapPercentage, setSwapPercentage] = useState<number | null>(null);

  // Force chart re-creation when tokens change
  const [chartKey, setChartKey] = useState(0);
  const [chartVisible, setChartVisible] = useState(false);

  // Quote management refs
  const quoteVersionRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Per-unit token prices in USD (via Uniswap quoter)
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({});

  // Gas price in wei for network cost estimation
  const [gasPriceWei, setGasPriceWei] = useState<bigint>(0n);

  // Eloqura DEX market stats (on-chain)
  const [eloquraStats, setEloquraStats] = useState<{
    activePairs: number;
    totalLiquidityUsd: number;
    volume24hUsd: number;
  }>({ activePairs: 0, totalLiquidityUsd: 0, volume24hUsd: 0 });

  // Recent swaps from on-chain events
  interface RecentSwap {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    timestamp: number;
    txHash: string;
  }
  const [recentSwaps, setRecentSwaps] = useState<RecentSwap[]>([]);
  const [recentSwapsLoading, setRecentSwapsLoading] = useState(false);

  // Helper functions for token selection
  const openTokenModal = (type?: 'from' | 'to' | 'priceCondition') => {
    if (type) {
      setTokenSelectionFor(type);
    }
    setTokenSearchQuery(""); // Clear search when opening modal
    setIsTokenModalOpen(true);
  };

  // Helper functions for network selection
  const openNetworkModal = (type: 'from' | 'to') => {
    setNetworkSelectionFor(type);
    setIsNetworkModalOpen(true);
  };

  const selectToken = (token: Token) => {
    // Force chart recreation by incrementing key
    setChartVisible(false);
    setTimeout(() => {
      setChartKey(prev => prev + 1);
      setChartVisible(true);
    }, 50);

    if (tokenSelectionFor === 'from') {
      setFromToken(token);

      // Check if all three sections would have the same token
      const currentPriceCondition = getPriceConditionTokens();
      const priceConditionFrom = currentPriceCondition.from || token; // Default to new token if not set
      const priceConditionTo = currentPriceCondition.to || toToken;

      if (token.symbol === priceConditionFrom?.symbol && token.symbol === priceConditionTo?.symbol) {
        // All three would be the same, default the other two
        const defaultToken = token.symbol === 'OEC' ? 
          tokensWithBalances.find(t => t.symbol === 'WETH') || tokensWithBalances[1] : 
          tokensWithBalances.find(t => t.symbol === 'ETH') || tokensWithBalances[0];

        setToToken(defaultToken);
        setPriceConditionTokens({
          from: token,
          to: defaultToken
        });
      } else {
        // Update price condition from token if not set
        setPriceConditionTokens(prev => ({
          from: prev.from || token,
          to: prev.to || toToken
        }));
      }
    } else if (tokenSelectionFor === 'to') {
      setToToken(token);

      // Check if all three sections would have the same token
      const priceConditionFrom = getPriceConditionTokens().from || fromToken;
      const priceConditionTo = getPriceConditionTokens().to;

      if (token.symbol === fromToken?.symbol && token.symbol === priceConditionFrom?.symbol) {
        // All three would be the same, default the other two
        const defaultToken = token.symbol === 'OEC' ? 
          tokensWithBalances.find(t => t.symbol === 'WETH') || tokensWithBalances[1] : 
          tokensWithBalances.find(t => t.symbol === 'ETH') || tokensWithBalances[0];

        setFromToken(defaultToken);
        setPriceConditionTokens(prev => ({
          from: defaultToken,
          to: prev.to || token
        }));
      } else {
        // Update price condition tokens if they haven't been set
        setPriceConditionTokens(prev => ({
          from: prev.from || fromToken,
          to: token
        }));
      }
    } else if (tokenSelectionFor === 'priceCondition') {
      // Get current price condition state first
      const currentPriceCondition = getPriceConditionTokens();
      const priceConditionFrom = currentPriceCondition.from || fromToken;

      // Update price condition tokens and sync the "For" section
      setPriceConditionTokens({
        from: priceConditionFrom,
        to: token
      });
      setToToken(token);

      // Check if all three sections would have the same token
      if (token.symbol === fromToken?.symbol && token.symbol === priceConditionFrom?.symbol) {
        // All three would be the same, default the other two
        const defaultToken = token.symbol === 'OEC' ? 
          tokensWithBalances.find(t => t.symbol === 'WETH') || tokensWithBalances[1] : 
          tokensWithBalances.find(t => t.symbol === 'ETH') || tokensWithBalances[0];

        setFromToken(defaultToken);
        setPriceConditionTokens({
          from: defaultToken,
          to: token
        });
      }
    }
    setIsTokenModalOpen(false);
  };

  // Get wallet connection status
  const { address, isConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Add token to wallet (MetaMask wallet_watchAsset)
  const addTokenToWallet = async (token: Token, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger token selection
    if (!walletClient) return;
    // Skip native ETH - can't add it via wallet_watchAsset
    if (token.address === "0x0000000000000000000000000000000000000000") return;
    try {
      await walletClient.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: token.address as `0x${string}`,
            symbol: token.symbol,
            decimals: token.decimals,
            image: token.logo,
          },
        },
      });
    } catch (err) {
      console.error('Failed to add token to wallet:', err);
    }
  };

  // Sepolia testnet tokens - official testnet contract addresses
  const sepoliaTokens: Token[] = [
    {
      symbol: "OEC",
      name: "Oeconomia",
      address: "0x2b2fb8df4ac5d394f0d5674d7a54802e42a06aba",
      decimals: 18,
      logo: "https://pub-37d61a7eb7ae45898b46702664710cb2.r2.dev/images/OEC%20Logo%20Square.png",
      price: 0,
    },
    {
      symbol: "ETH",
      name: "Ethereum",
      address: "0x0000000000000000000000000000000000000000", // Native ETH
      decimals: 18,
      logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
      price: 0,
    },
    {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: ELOQURA_CONTRACTS.sepolia.WETH,
      decimals: 18,
      logo: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
      price: 0,
    },
    {
      symbol: "LINK",
      name: "Chainlink",
      address: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
      decimals: 18,
      logo: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
      price: 0,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
      decimals: 6,
      logo: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
      price: 0,
    },
    {
      symbol: "AAVE",
      name: "Aave",
      address: "0x5bB220Afc6E2e008CB2302a83536A019ED245AA2",
      decimals: 18,
      logo: "https://assets.coingecko.com/coins/images/12645/small/aave-token-round.png",
      price: 0,
    },
    {
      symbol: "DAI",
      name: "Dai Stablecoin",
      address: "0x3e622317f8c93f7328350cf0b56d9ed4c620c5d6",
      decimals: 18,
      logo: "https://assets.coingecko.com/coins/images/9956/small/dai-multi-collateral-mcd.png",
      price: 0,
    },
  ];

  const tokens = [...sepoliaTokens, ...customTokens];
  const publicClient = usePublicClient();

  // Store all token balances in a single state object (address -> balance)
  const [tokenBalances, setTokenBalances] = useState<Record<string, bigint>>({});

  // Fetch all token balances directly from blockchain
  const fetchBalances = async () => {
    if (!publicClient || !address) return;

    try {
      const balances: Record<string, bigint> = {};

      // Fetch ETH balance (native)
      const ethBal = await publicClient.getBalance({ address });
      balances["0x0000000000000000000000000000000000000000"] = ethBal;

      // Fetch all ERC20 token balances
      for (const token of tokens) {
        if (token.address === "0x0000000000000000000000000000000000000000") continue; // Skip native ETH

        try {
          const bal = await publicClient.readContract({
            address: token.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address],
          }) as bigint;
          balances[token.address] = bal;
        } catch (err) {
          console.warn(`Failed to fetch balance for ${token.symbol}:`, err);
          balances[token.address] = 0n;
        }
      }

      setTokenBalances(balances);
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  };

  // Fetch on mount and when address/publicClient changes
  useEffect(() => {
    fetchBalances();
  }, [publicClient, address]);

  // Fetch per-unit token prices via Uniswap quoter (quote 1 token -> USDC)
  useEffect(() => {
    const fetchPrices = async () => {
      if (!publicClient) return;
      const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as `0x${string}`;
      const usdcDecimals = 6;
      const prices: Record<string, number> = {};
      const feeTiers = [UNISWAP_FEE_TIERS.MEDIUM, UNISWAP_FEE_TIERS.LOW, UNISWAP_FEE_TIERS.HIGH];

      for (const token of tokens) {
        if (token.address.toLowerCase() === usdcAddress.toLowerCase()) {
          prices[token.address.toLowerCase()] = 1;
          continue;
        }

        // For ETH and Eloqura WETH, use Uniswap's WETH address for the quoter
        const quoterAddress = (token.symbol === 'ETH' || token.symbol === 'WETH')
          ? UNISWAP_CONTRACTS.sepolia.WETH
          : token.address;

        let priceFound = false;
        for (const fee of feeTiers) {
          try {
            const amountIn = parseUnits("1", token.decimals);
            const result = await publicClient.simulateContract({
              address: UNISWAP_CONTRACTS.sepolia.QuoterV2 as `0x${string}`,
              abi: UNISWAP_QUOTER_ABI,
              functionName: 'quoteExactInputSingle',
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
              prices[token.address.toLowerCase()] = usdPrice;
              priceFound = true;
              break;
            }
          } catch { continue; }
        }

        // Fallback: token -> WETH -> USDC
        if (!priceFound && token.symbol !== 'WETH' && token.symbol !== 'ETH') {
          for (const fee of feeTiers) {
            try {
              const amountIn = parseUnits("1", token.decimals);
              const result = await publicClient.simulateContract({
                address: UNISWAP_CONTRACTS.sepolia.QuoterV2 as `0x${string}`,
                abi: UNISWAP_QUOTER_ABI,
                functionName: 'quoteExactInputSingle',
                args: [{
                  tokenIn: quoterAddress as `0x${string}`,
                  tokenOut: UNISWAP_CONTRACTS.sepolia.WETH as `0x${string}`,
                  amountIn,
                  fee,
                  sqrtPriceLimitX96: 0n,
                }],
              });
              const wethAmount = parseFloat(formatUnits(result.result[0], 18));
              if (wethAmount > 0) {
                // Get WETH -> USDC price
                for (const wethFee of feeTiers) {
                  try {
                    const wethResult = await publicClient.simulateContract({
                      address: UNISWAP_CONTRACTS.sepolia.QuoterV2 as `0x${string}`,
                      abi: UNISWAP_QUOTER_ABI,
                      functionName: 'quoteExactInputSingle',
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
                      prices[token.address.toLowerCase()] = wethAmount * wethUsd;
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

        // ETH and WETH share the same price (bidirectional)
        if (token.symbol === 'WETH' && prices[token.address.toLowerCase()]) {
          prices["0x0000000000000000000000000000000000000000"] = prices[token.address.toLowerCase()];
        }
        if (token.symbol === 'ETH' && prices["0x0000000000000000000000000000000000000000"]) {
          const wethToken = tokens.find(t => t.symbol === 'WETH');
          if (wethToken) {
            prices[wethToken.address.toLowerCase()] = prices["0x0000000000000000000000000000000000000000"];
          }
        }

        // Fallback: try Eloqura DEX pairs for tokens not priced via Uniswap (e.g. OEC)
        if (!priceFound) {
          try {
            const factory = ELOQURA_CONTRACTS.sepolia.Factory;
            const eloquraWeth = ELOQURA_CONTRACTS.sepolia.WETH;
            const pairAddress = await publicClient.readContract({
              address: factory as `0x${string}`,
              abi: FACTORY_ABI,
              functionName: 'getPair',
              args: [token.address as `0x${string}`, eloquraWeth as `0x${string}`],
            }) as `0x${string}`;
            if (pairAddress && pairAddress !== '0x0000000000000000000000000000000000000000') {
              const [reserves, token0] = await Promise.all([
                publicClient.readContract({
                  address: pairAddress,
                  abi: PAIR_ABI,
                  functionName: 'getReserves',
                }) as Promise<[bigint, bigint, number]>,
                publicClient.readContract({
                  address: pairAddress,
                  abi: PAIR_ABI,
                  functionName: 'token0',
                }) as Promise<`0x${string}`>,
              ]);
              const isToken0 = token0.toLowerCase() === token.address.toLowerCase();
              const tokenReserve = parseFloat(formatUnits(isToken0 ? reserves[0] : reserves[1], token.decimals));
              const wethReserve = parseFloat(formatUnits(isToken0 ? reserves[1] : reserves[0], 18));
              if (tokenReserve > 0 && wethReserve > 0) {
                const tokenPriceInWeth = wethReserve / tokenReserve;
                // Get ETH/WETH USD price (already fetched)
                const ethPrice = prices["0x0000000000000000000000000000000000000000"] || 0;
                if (ethPrice > 0) {
                  prices[token.address.toLowerCase()] = tokenPriceInWeth * ethPrice;
                  priceFound = true;
                }
              }
            }
          } catch { /* no Eloqura pair exists */ }
        }
      }

      setTokenPrices(prices);
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [publicClient]);

  // Fetch gas price for network cost estimation
  useEffect(() => {
    const fetchGasPrice = async () => {
      if (!publicClient) return;
      try {
        const price = await publicClient.getGasPrice();
        setGasPriceWei(price);
      } catch {}
    };
    fetchGasPrice();
    const interval = setInterval(fetchGasPrice, 30000);
    return () => clearInterval(interval);
  }, [publicClient]);

  // Fetch Eloqura DEX market stats directly from on-chain pool reserves
  useEffect(() => {
    const fetchEloquraStats = async () => {
      if (!publicClient) return;
      try {
        const factory = ELOQURA_CONTRACTS.sepolia.Factory as `0x${string}`;

        // Get total number of pairs
        const pairCount = await publicClient.readContract({
          address: factory,
          abi: FACTORY_ABI,
          functionName: 'allPairsLength',
        }) as bigint;
        const activePairs = Number(pairCount);

        // Build a decimals lookup from known tokens
        const decimalsMap: Record<string, number> = {};
        for (const t of tokens) {
          decimalsMap[t.address.toLowerCase()] = t.decimals;
        }

        // Read reserves from each pair and sum up TVL
        let totalTvl = 0;
        for (let i = 0; i < activePairs; i++) {
          try {
            const pairAddress = await publicClient.readContract({
              address: factory,
              abi: FACTORY_ABI,
              functionName: 'allPairs',
              args: [BigInt(i)],
            }) as `0x${string}`;

            const [reserves, token0Addr, token1Addr] = await Promise.all([
              publicClient.readContract({
                address: pairAddress,
                abi: PAIR_ABI,
                functionName: 'getReserves',
              }) as Promise<[bigint, bigint, number]>,
              publicClient.readContract({
                address: pairAddress,
                abi: PAIR_ABI,
                functionName: 'token0',
              }) as Promise<`0x${string}`>,
              publicClient.readContract({
                address: pairAddress,
                abi: PAIR_ABI,
                functionName: 'token1',
              }) as Promise<`0x${string}`>,
            ]);

            const dec0 = decimalsMap[token0Addr.toLowerCase()] ?? 18;
            const dec1 = decimalsMap[token1Addr.toLowerCase()] ?? 18;
            const reserve0 = parseFloat(formatUnits(reserves[0], dec0));
            const reserve1 = parseFloat(formatUnits(reserves[1], dec1));

            const price0 = tokenPrices[token0Addr.toLowerCase()] ?? 0;
            const price1 = tokenPrices[token1Addr.toLowerCase()] ?? 0;

            const side0 = reserve0 * price0;
            const side1 = reserve1 * price1;

            // In a constant-product AMM both sides are equal in USD value.
            // If only one side has a known price, double it for the full pool TVL.
            if (price0 > 0 && price1 > 0) {
              totalTvl += side0 + side1;
            } else if (price0 > 0) {
              totalTvl += side0 * 2;
            } else if (price1 > 0) {
              totalTvl += side1 * 2;
            }
          } catch { /* skip unreadable pair */ }
        }

        setEloquraStats({
          activePairs,
          totalLiquidityUsd: totalTvl,
          volume24hUsd: 0, // Volume requires an indexer; not available on-chain
        });
      } catch (error) {
        console.warn('Error fetching Eloqura stats:', error);
      }
    };

    fetchEloquraStats();
    const interval = setInterval(fetchEloquraStats, 60000);
    return () => clearInterval(interval);
  }, [publicClient, tokenPrices]);

  // Fetch recent swap events from Eloqura pair contracts
  useEffect(() => {
    const fetchRecentSwaps = async () => {
      setRecentSwapsLoading(true);
      try {
        // Load swaps from localStorage (saved when user completes swaps)
        const saved = JSON.parse(localStorage.getItem("eloqura-recent-swaps") || "[]") as RecentSwap[];
        setRecentSwaps(saved.slice(0, 10));
      } catch {
        setRecentSwaps([]);
      }
      setRecentSwapsLoading(false);
    };

    fetchRecentSwaps();
  }, [publicClient]);

  // Update token balances dynamically
  const tokensWithBalances = tokens.map(token => {
    const balance = tokenBalances[token.address] ?? 0n;
    const price = tokenPrices[token.address.toLowerCase()] ?? token.price;
    return { ...token, balance: parseFloat(formatUnits(balance, token.decimals)), price };
  });

  // Set and sync tokens with balances
  useEffect(() => {
    const ethToken = tokensWithBalances.find(t => t.symbol === "ETH");
    const wethToken = tokensWithBalances.find(t => t.symbol === "WETH");

    // Set defaults if not set, or sync existing selections with updated balances
    if (!fromToken && !toToken) {
      // Initial setup
      if (ethToken) setFromToken(ethToken);
      if (wethToken) setToToken(wethToken);
    } else {
      // Sync existing selections with latest balance data
      if (fromToken) {
        const updated = tokensWithBalances.find(t => t.symbol === fromToken.symbol);
        if (updated) setFromToken(updated);
      }
      if (toToken) {
        const updated = tokensWithBalances.find(t => t.symbol === toToken.symbol);
        if (updated) setToToken(updated);
      }
    }
  }, [tokenBalances]);

  // Contract write hooks for swap execution
  const { writeContract, data: txHash, isPending: isWritePending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Reset form and refetch balances after successful transaction
  useEffect(() => {
    if (isConfirmed) {
      // Track in OECsplorer
      if (txHash) trackTransaction(txHash);

      // Check if this was an approval tx (form still has values)
      const wasApproval = isApproving;
      setIsApproving(false);

      if (wasApproval) {
        // After approval, re-check approval status
        setTimeout(() => {
          checkApproval();
        }, 1000);
      } else {
        // Save completed swap to localStorage for recent swaps display
        if (fromToken && toToken && fromAmount && toAmount && txHash) {
          try {
            const saved = JSON.parse(localStorage.getItem("eloqura-recent-swaps") || "[]");
            saved.unshift({
              tokenIn: fromToken.symbol,
              tokenOut: toToken.symbol,
              amountIn: parseFloat(fromAmount).toFixed(4),
              amountOut: parseFloat(toAmount).toFixed(4),
              timestamp: Math.floor(Date.now() / 1000),
              txHash,
            });
            // Keep last 50 swaps
            localStorage.setItem("eloqura-recent-swaps", JSON.stringify(saved.slice(0, 50)));
          } catch {}
        }
        // After swap, reset form
        setFromAmount("");
        setToAmount("");
        setQuote(null);
      }

      // Refetch balances after any successful transaction
      setTimeout(() => {
        fetchBalances();
      }, 1000);
    }
  }, [isConfirmed]);

  // Filter tokens based on search query
  const filteredTokens = tokensWithBalances.filter(token =>
    token.symbol.toLowerCase().includes(tokenSearchQuery.toLowerCase()) ||
    token.name.toLowerCase().includes(tokenSearchQuery.toLowerCase()) ||
    token.address.toLowerCase().includes(tokenSearchQuery.toLowerCase())
  );

  // Look up unknown token by contract address
  const isAddress = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s.trim());

  useEffect(() => {
    const query = tokenSearchQuery.trim();
    if (!isAddress(query) || !publicClient) {
      setLookupResult(null);
      return;
    }

    // Check if token already exists in the list
    const exists = tokens.some(t => t.address.toLowerCase() === query.toLowerCase());
    if (exists) {
      setLookupResult(null);
      return;
    }

    const lookupToken = async () => {
      setLookupLoading(true);
      setLookupResult(null);
      try {
        const addr = query as `0x${string}`;
        const [symbol, name, decimals] = await Promise.all([
          publicClient.readContract({ address: addr, abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>,
          publicClient.readContract({ address: addr, abi: ERC20_ABI, functionName: "name" }) as Promise<string>,
          publicClient.readContract({ address: addr, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
        ]);

        // Fetch balance if connected
        let balance = 0;
        if (address) {
          try {
            const bal = await publicClient.readContract({ address: addr, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }) as bigint;
            balance = parseFloat(formatUnits(bal, Number(decimals)));
          } catch {}
        }

        setLookupResult({
          symbol,
          name,
          address: query,
          decimals: Number(decimals),
          logo: "",
          price: 0,
          balance,
        });
      } catch {
        setLookupResult(null);
      }
      setLookupLoading(false);
    };

    lookupToken();
  }, [tokenSearchQuery, publicClient, address]);

  const importCustomToken = (token: Token) => {
    const newCustomTokens = [...customTokens, { ...token, balance: undefined }];
    setCustomTokens(newCustomTokens);
    localStorage.setItem("eloqura-custom-tokens", JSON.stringify(newCustomTokens));
    setLookupResult(null);
    setTokenSearchQuery("");
    // Refresh balances to pick up the new token
    setTimeout(() => fetchBalances(), 500);
  };

  // Format number with commas and smart decimals
  const formatNumber = (num: number, decimals = 2): string => {
    if (num === 0) return '0';
    if (num < 0.01) return num.toFixed(6).replace(/\.?0+$/, '');
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: decimals 
    });
  };

  // Get swap quote - handles ETH/WETH wrapping, Eloqura pools, and Uniswap
  const getSwapQuote = async (from: Token, to: Token, amount: string, direction: 'from' | 'to' = 'from') => {
    if (!amount || parseFloat(amount) === 0 || !publicClient) return null;

    const version = ++quoteVersionRef.current;
    setIsLoading(true);

    const inputAmount = parseFloat(amount);
    let outputAmount: number = 0;
    let fee: number = 0;
    let minimumReceived: number = 0;
    let exchangeRate: number = 0;
    let priceImpact: number = 0;
    let routeSource: string = 'none';
    let bestFeeTier: number = UNISWAP_FEE_TIERS.MEDIUM;

    // ETH <-> WETH is always 1:1 (wrapping/unwrapping)
    const isWrapUnwrap =
      (from.symbol === 'ETH' && to.symbol === 'WETH') ||
      (from.symbol === 'WETH' && to.symbol === 'ETH');

    if (isWrapUnwrap) {
      exchangeRate = 1;
      outputAmount = inputAmount;
      fee = 0;
      priceImpact = 0;
      routeSource = 'wrap';
    } else {
      // For direction='to', reverse the quote: query to→from to find how much 'from' is needed
      const quoteFrom = direction === 'from' ? from : to;
      const quoteTo = direction === 'from' ? to : from;

      // Run ALL quote sources in PARALLEL for speed
      const tokenInAddress = (quoteFrom.symbol === 'ETH' ? UNISWAP_CONTRACTS.sepolia.WETH : quoteFrom.address) as `0x${string}`;
      const tokenOutAddress = (quoteTo.symbol === 'ETH' ? UNISWAP_CONTRACTS.sepolia.WETH : quoteTo.address) as `0x${string}`;
      const eloquraTokenIn = (quoteFrom.symbol === 'ETH' ? ELOQURA_CONTRACTS.sepolia.WETH : quoteFrom.address) as `0x${string}`;
      const eloquraTokenOut = (quoteTo.symbol === 'ETH' ? ELOQURA_CONTRACTS.sepolia.WETH : quoteTo.address) as `0x${string}`;
      const amountIn = parseUnits(parseFloat(amount).toFixed(quoteFrom.decimals), quoteFrom.decimals);

      // Fire all Uniswap fee tier quotes + Eloqura quotes simultaneously
      const feeTiers = [UNISWAP_FEE_TIERS.LOW, UNISWAP_FEE_TIERS.MEDIUM, UNISWAP_FEE_TIERS.HIGH];

      const uniswapQuotePromises = feeTiers.map(feeTier =>
        publicClient.simulateContract({
          address: UNISWAP_CONTRACTS.sepolia.QuoterV2 as `0x${string}`,
          abi: UNISWAP_QUOTER_ABI,
          functionName: 'quoteExactInputSingle',
          args: [{
            tokenIn: tokenInAddress,
            tokenOut: tokenOutAddress,
            amountIn,
            fee: feeTier,
            sqrtPriceLimitX96: 0n,
          }],
        }).then(result => ({ feeTier, amount: result.result[0] as bigint }))
          .catch(() => null)
      );

      const eloquraDirectPromise = publicClient.readContract({
        address: ELOQURA_CONTRACTS.sepolia.Router as `0x${string}`,
        abi: ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [amountIn, [eloquraTokenIn, eloquraTokenOut]],
      }).then(result => ({ type: 'eloqura-direct' as const, amounts: result as bigint[] }))
        .catch(() => null);

      const weth = ELOQURA_CONTRACTS.sepolia.WETH as `0x${string}`;
      const canTryWethRoute = quoteFrom.symbol !== 'WETH' && quoteFrom.symbol !== 'ETH' && quoteTo.symbol !== 'WETH' && quoteTo.symbol !== 'ETH';
      const eloquraWethPromise = canTryWethRoute
        ? publicClient.readContract({
            address: ELOQURA_CONTRACTS.sepolia.Router as `0x${string}`,
            abi: ROUTER_ABI,
            functionName: 'getAmountsOut',
            args: [amountIn, [eloquraTokenIn, weth, eloquraTokenOut]],
          }).then(result => ({ type: 'eloqura-weth' as const, amounts: result as bigint[] }))
            .catch(() => null)
        : Promise.resolve(null);

      // Wait for ALL quotes at once
      const [uniResults, eloquraDirect, eloquraWeth] = await Promise.all([
        Promise.all(uniswapQuotePromises),
        eloquraDirectPromise,
        eloquraWethPromise,
      ]);

      // Discard stale result if a newer quote was requested
      if (version !== quoteVersionRef.current) return;

      // Find best Uniswap quote
      let bestUniQuote: bigint | null = null;
      for (const result of uniResults) {
        if (result && (!bestUniQuote || result.amount > bestUniQuote)) {
          bestUniQuote = result.amount;
          bestFeeTier = result.feeTier;
        }
      }

      // Compare all results and pick the best
      type QuoteCandidate = { output: number; source: string; feeTier?: number; impact: number; fee: number };
      const candidates: QuoteCandidate[] = [];

      if (bestUniQuote) {
        const out = parseFloat(formatUnits(bestUniQuote, quoteTo.decimals));
        if (out > 0) candidates.push({ output: out, source: 'uniswap', feeTier: bestFeeTier, impact: 0, fee: inputAmount * (bestFeeTier / 1000000) });
      }

      if (eloquraDirect) {
        const out = parseFloat(formatUnits(eloquraDirect.amounts[1], quoteTo.decimals));
        if (out > 0) candidates.push({ output: out, source: 'eloqura', impact: 0, fee: inputAmount * 0.003 });
      }

      if (eloquraWeth) {
        const out = parseFloat(formatUnits(eloquraWeth.amounts[2], quoteTo.decimals));
        if (out > 0) candidates.push({ output: out, source: 'eloqura-bridge', impact: 0, fee: inputAmount * 0.006 });
      }

      // Pick best quote by output amount
      if (candidates.length > 0) {
        const best = candidates.reduce((a, b) => a.output > b.output ? a : b);
        outputAmount = best.output;
        // Exchange rate is always in from→to terms
        if (direction === 'from') {
          exchangeRate = outputAmount / inputAmount;
        } else {
          // inputAmount is 'to' token, outputAmount is 'from' token
          exchangeRate = inputAmount / outputAmount;
        }
        fee = best.fee;
        priceImpact = best.impact;
        routeSource = best.source;
        if (best.feeTier) bestFeeTier = best.feeTier;
      }
    }

    // Discard stale result
    if (version !== quoteVersionRef.current) return;

    if (direction === 'from') {
      minimumReceived = outputAmount * (1 - slippage / 100);
      setToAmount(outputAmount > 0 ? outputAmount.toFixed(6) : '0');
    } else {
      minimumReceived = outputAmount * (1 - slippage / 100);
      setFromAmount(outputAmount > 0 ? outputAmount.toFixed(6) : '0');
    }

    const swapQuote: SwapQuote = {
      inputAmount: direction === 'from' ? amount : (outputAmount > 0 ? outputAmount.toFixed(6) : '0'),
      outputAmount: direction === 'from' ? outputAmount.toString() : amount,
      exchangeRate,
      priceImpact,
      minimumReceived: minimumReceived.toString(),
      fee,
      route: routeSource === 'uniswap' ? [from.symbol, 'Uniswap', to.symbol]
           : routeSource === 'eloqura' ? [from.symbol, 'Eloqura', to.symbol]
           : routeSource === 'eloqura-bridge' ? [from.symbol, 'Eloqura', 'WETH', to.symbol]
           : [from.symbol, to.symbol],
      feeTier: routeSource === 'uniswap' ? bestFeeTier : undefined,
    };

    setQuote(swapQuote);
    setIsLoading(false);
  };

  // Debounced quote request — called from input onChange handlers
  const requestQuote = (amount: string, direction: 'from' | 'to') => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setHighImpactConfirmed(false);

    if (!amount || parseFloat(amount) <= 0) {
      quoteVersionRef.current++;
      if (direction === 'from') setToAmount('');
      else setFromAmount('');
      setQuote(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceTimerRef.current = setTimeout(() => {
      if (fromToken && toToken) {
        getSwapQuote(fromToken, toToken, amount, direction);
      }
    }, 300);
  };

  // Handle token swap
  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    const tempAmount = fromAmount;
    setFromAmount(toAmount);
    setToAmount(tempAmount);
    setQuote(null);
  };

  // State for token approval
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Check if token needs approval for the swap router
  const checkApproval = async () => {
    if (!fromToken || !address || !publicClient || fromToken.symbol === 'ETH') {
      setNeedsApproval(false);
      return;
    }

    try {
      // Check approval for both routers, use the one matching the current quote route
      const spender = quote?.route.includes('Eloqura')
        ? ELOQURA_CONTRACTS.sepolia.Router
        : UNISWAP_CONTRACTS.sepolia.SwapRouter02;

      const allowance = await publicClient.readContract({
        address: fromToken.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, spender as `0x${string}`],
      }) as bigint;

      const amount = parseUnits(fromAmount || '0', fromToken.decimals);
      setNeedsApproval(allowance < amount);
    } catch (error) {
      console.warn('Error checking approval:', error);
      setNeedsApproval(false);
    }
  };

  // Check approval when fromToken, fromAmount, or quote changes
  useEffect(() => {
    if (fromToken && fromAmount && parseFloat(fromAmount) > 0) {
      checkApproval();
    }
  }, [fromToken, fromAmount, address, quote]);

  const handleApprove = async () => {
    if (!fromToken || fromToken.symbol === 'ETH') return;

    const spender = quote?.route.includes('Eloqura')
      ? ELOQURA_CONTRACTS.sepolia.Router
      : UNISWAP_CONTRACTS.sepolia.SwapRouter02;

    setIsApproving(true);
    try {
      writeContract({
        address: fromToken.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender as `0x${string}`, parseUnits('1000000000', fromToken.decimals)],
      });
    } catch (error) {
      console.error('Approval error:', error);
      setIsApproving(false);
    }
  };

  const handleSwapExecution = async () => {
    if (!fromToken || !toToken || !fromAmount || !isConnected || !address) return;

    try {
      // ETH -> WETH (Wrap)
      if (fromToken.symbol === 'ETH' && toToken.symbol === 'WETH') {
        const amount = parseEther(fromAmount);
        writeContract({
          address: ELOQURA_CONTRACTS.sepolia.WETH as `0x${string}`,
          abi: WETH_ABI,
          functionName: 'deposit',
          value: amount,
        });
      }
      // WETH -> ETH (Unwrap)
      else if (fromToken.symbol === 'WETH' && toToken.symbol === 'ETH') {
        const amount = parseEther(fromAmount);
        writeContract({
          address: ELOQURA_CONTRACTS.sepolia.WETH as `0x${string}`,
          abi: WETH_ABI,
          functionName: 'withdraw',
          args: [amount],
        });
      }
      // Eloqura DEX swap
      else if (quote?.route.includes('Eloqura')) {
        const amountIn = parseUnits(fromAmount, fromToken.decimals);
        // Truncate minimumReceived to token's decimal precision to avoid parseUnits overflow
        const minReceivedStr = quote ? parseFloat(quote.minimumReceived).toFixed(toToken.decimals) : '0';
        const amountOutMin = quote
          ? parseUnits(minReceivedStr, toToken.decimals)
          : 0n;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + txDeadline * 60);

        const eloquraTokenIn = fromToken.symbol === 'ETH'
          ? ELOQURA_CONTRACTS.sepolia.WETH
          : fromToken.address;
        const eloquraTokenOut = toToken.symbol === 'ETH'
          ? ELOQURA_CONTRACTS.sepolia.WETH
          : toToken.address;
        // Use 3-hop path via WETH if the quote used bridge routing
        const isBridge = quote.route.length === 4 && quote.route.includes('WETH');
        const path = isBridge
          ? [eloquraTokenIn as `0x${string}`, ELOQURA_CONTRACTS.sepolia.WETH as `0x${string}`, eloquraTokenOut as `0x${string}`]
          : [eloquraTokenIn as `0x${string}`, eloquraTokenOut as `0x${string}`];

        if (fromToken.symbol === 'ETH') {
          // ETH -> Token via Eloqura: swapExactETHForTokens
          writeContract({
            address: ELOQURA_CONTRACTS.sepolia.Router as `0x${string}`,
            abi: ROUTER_ABI,
            functionName: 'swapExactETHForTokens',
            args: [amountOutMin, path, address, deadline],
            value: amountIn,
          });
        } else if (toToken.symbol === 'ETH') {
          // Token -> ETH via Eloqura: swapExactTokensForETH
          writeContract({
            address: ELOQURA_CONTRACTS.sepolia.Router as `0x${string}`,
            abi: ROUTER_ABI,
            functionName: 'swapExactTokensForETH',
            args: [amountIn, amountOutMin, path, address, deadline],
          });
        } else {
          // Token -> Token via Eloqura: swapExactTokensForTokens
          writeContract({
            address: ELOQURA_CONTRACTS.sepolia.Router as `0x${string}`,
            abi: ROUTER_ABI,
            functionName: 'swapExactTokensForTokens',
            args: [amountIn, amountOutMin, path, address, deadline],
          });
        }
      }
      // Uniswap V3 swap
      else {
        const amountIn = parseUnits(fromAmount, fromToken.decimals);
        // Truncate minimumReceived to token's decimal precision to avoid parseUnits overflow
        const minReceivedStr = quote ? parseFloat(quote.minimumReceived).toFixed(toToken.decimals) : '0';
        const amountOutMin = quote
          ? parseUnits(minReceivedStr, toToken.decimals)
          : 0n;

        // Use Uniswap WETH for ETH swaps
        const tokenIn = fromToken.symbol === 'ETH'
          ? UNISWAP_CONTRACTS.sepolia.WETH
          : fromToken.address;
        const tokenOut = toToken.symbol === 'ETH'
          ? UNISWAP_CONTRACTS.sepolia.WETH
          : toToken.address;

        // Use the fee tier from the quote (matched during quoting) instead of hardcoded MEDIUM
        const swapFeeTier = quote?.feeTier ?? UNISWAP_FEE_TIERS.MEDIUM;

        if (fromToken.symbol === 'ETH') {
          // ETH -> Token: send ETH value with the swap
          writeContract({
            address: UNISWAP_CONTRACTS.sepolia.SwapRouter02 as `0x${string}`,
            abi: UNISWAP_ROUTER_ABI,
            functionName: 'exactInputSingle',
            args: [{
              tokenIn: tokenIn as `0x${string}`,
              tokenOut: tokenOut as `0x${string}`,
              fee: swapFeeTier,
              recipient: address,
              amountIn: amountIn,
              amountOutMinimum: amountOutMin,
              sqrtPriceLimitX96: 0n,
            }],
            value: amountIn,
          });
        } else {
          // Token -> Token or Token -> ETH
          writeContract({
            address: UNISWAP_CONTRACTS.sepolia.SwapRouter02 as `0x${string}`,
            abi: UNISWAP_ROUTER_ABI,
            functionName: 'exactInputSingle',
            args: [{
              tokenIn: tokenIn as `0x${string}`,
              tokenOut: tokenOut as `0x${string}`,
              fee: swapFeeTier,
              recipient: address,
              amountIn: amountIn,
              amountOutMinimum: amountOutMin,
              sqrtPriceLimitX96: 0n,
            }],
          });
        }
      }
    } catch (error) {
      console.error('Swap execution error:', error);
    }
  };

  // Re-quote when tokens or slippage change (not on amount changes — those are handled by requestQuote)
  useEffect(() => {
    if (fromToken && toToken) {
      if (lastEditedField === 'from' && fromAmount && parseFloat(fromAmount) > 0) {
        getSwapQuote(fromToken, toToken, fromAmount, 'from');
      } else if (lastEditedField === 'to' && toAmount && parseFloat(toAmount) > 0) {
        getSwapQuote(fromToken, toToken, toAmount, 'to');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromToken?.symbol, toToken?.symbol, slippage]);

  // Get price history for the selected token pair
  const chartContractAddress = fromToken?.address || "0x55d398326f99059fF775485246999027B3197955"; // Default to USDT
  const { data: tokenData } = useTokenData(chartContractAddress);

  // Generate price chart data for any token pair
  const generatePairPriceHistory = (token: Token | null, timeframe: string) => {
    if (!token || token.price <= 0) return [];
    const now = Date.now();
    const currentPrice = token.price;

    // Use a deterministic seed from token symbol so chart doesn't re-randomize on every render
    const seed = token.symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const seededRandom = (i: number) => {
      const x = Math.sin(seed * 9301 + i * 49297) * 49297;
      return x - Math.floor(x);
    };

    const getTimeframeConfig = (tf: string) => {
      switch (tf) {
        case "1H":
          return { points: 60, intervalMs: 60 * 1000, volatility: 0.003 };
        case "1D":
          return { points: 48, intervalMs: 30 * 60 * 1000, volatility: 0.008 };
        case "7D":
          return { points: 84, intervalMs: 2 * 60 * 60 * 1000, volatility: 0.02 };
        case "30D":
          return { points: 120, intervalMs: 6 * 60 * 60 * 1000, volatility: 0.04 };
        default:
          return { points: 48, intervalMs: 30 * 60 * 1000, volatility: 0.008 };
      }
    };

    const config = getTimeframeConfig(timeframe);

    // Generate a random walk that ends at the current price
    const rawPrices: number[] = [];
    let price = currentPrice;
    for (let i = config.points - 1; i >= 0; i--) {
      rawPrices.unshift(price);
      const change = (seededRandom(i * 3 + 1) - 0.48) * config.volatility * 2;
      price = price / (1 + change);
    }

    return rawPrices.map((p, i) => ({
      timestamp: Math.floor((now - (config.points - 1 - i) * config.intervalMs) / 1000),
      price: Math.max(0.0001, p),
      volume: seededRandom(i * 7 + 99) * 2000000 + 500000,
    }));
  };



  // Set initial tokens based on active tab (use tokensWithBalances to preserve balances)
  useEffect(() => {
    const twb = tokensWithBalances.length > 0 ? tokensWithBalances : tokens;
    if (activeTab === "Buy") {
      setFromToken(null); // No from token for buy mode
      setToToken(twb[0]); // OEC
    } else if (activeTab === "Sell") {
      setFromToken(twb[0]); // OEC
      setToToken(twb[1]); // USDT
    } else {
      // For Trade tab, restore with balances if we have them
      const ethToken = twb.find(t => t.symbol === "ETH");
      const wethToken = twb.find(t => t.symbol === "WETH");
      setFromToken(ethToken || twb[1]);
      setToToken(wethToken || twb[0]);
    }
  }, [activeTab]);

  // Handle percentage selection for sell mode
  const handleSellPercentage = (percentage: number) => {
    if (!fromToken) return;

    setSellPercentage(percentage);
    const balance = fromToken.balance || 0;
    const amount = (balance * percentage / 100).toString();
    setFromAmount(amount);
    setLastEditedField('from');
    requestQuote(amount, 'from');
  };

  const handleSwapPercentage = (percentage: number) => {
    if (!fromToken) return;

    setSwapPercentage(percentage);
    const balance = fromToken.balance || 0;
    const amount = (balance * percentage / 100).toString();
    setFromAmount(amount);
    setLastEditedField('from');
    requestQuote(amount, 'from');
  };

  // Handle fiat preset amounts for buy mode
  const handleFiatPreset = (amount: number) => {
    setFiatAmount(amount.toString());
    if (toToken) {
      const tokenAmount = amount / toToken.price;
      setToAmount(tokenAmount.toString());
    }
  };

  // Calculate limit order trigger price based on market price and adjustment
  const calculateLimitPrice = () => {
    const conditionTokens = getPriceConditionTokens();
    if (!conditionTokens.from || !conditionTokens.to) return "";

    const marketRate = conditionTokens.from.price / conditionTokens.to.price;
    const adjustedRate = marketRate * (1 + limitOrder.priceAdjustment / 100);
    return adjustedRate.toFixed(6);
  };

  // Check if a token is a custom import (not in our built-in list)
  const isCustomToken = (token: Token | null): boolean => {
    if (!token) return false;
    return !tokens.some(t => t.address.toLowerCase() === token.address.toLowerCase());
  };

  // Check if a token is a stablecoin
  const isStablecoin = (token: Token | null) => {
    if (!token) return false;
    const stablecoins = ['USDT', 'USDC', 'BUSD', 'DAI', 'UST', 'FRAX'];
    return stablecoins.includes(token.symbol.toUpperCase());
  };

  // Generate chart data for the selected "from" token
  const chartPriceHistory = showChart && fromToken ? generatePairPriceHistory(fromToken, chartTimeframe) : [];

  // Check if current pair involves a stablecoin
  const hasStablecoin = () => {
    return isStablecoin(fromToken) || isStablecoin(toToken);
  };

  // Get current market price for display
  const getCurrentMarketPrice = () => {
    const conditionTokens = getPriceConditionTokens();
    if (!conditionTokens.from || !conditionTokens.to) return "0";
    return (conditionTokens.from.price / conditionTokens.to.price).toFixed(6);
  };

  // Get the price condition tokens (what shows in "When 1 X is worth Y")
  const getPriceConditionTokens = () => {
    // If no stablecoin involved, use current from/to tokens
    if (!hasStablecoin()) {
      return { from: fromToken, to: toToken };
    }

    // If stablecoin involved, keep the original pair or use current
    if (priceConditionTokens.from && priceConditionTokens.to) {
      return priceConditionTokens;
    }

    return { from: fromToken, to: toToken };
  };

  // Handle buy/sell toggle for limit orders
  const handleLimitOrderToggle = () => {
    const newType = limitOrderType === 'sell' ? 'buy' : 'sell';
    setLimitOrderType(newType);

    // Set price condition tokens if not already set
    if (!priceConditionTokens.from || !priceConditionTokens.to) {
      setPriceConditionTokens({ from: fromToken, to: toToken });
    }

    // For stablecoin pairs, toggle percentage sign when switching between buy/sell
    if (hasStablecoin()) {
      setUseNegativePercentages(!useNegativePercentages);
      // Reset price adjustment to positive equivalent
      if (limitOrder.priceAdjustment < 0) {
        setLimitOrder(prev => ({
          ...prev,
          priceAdjustment: Math.abs(prev.priceAdjustment)
        }));
      }
    }

    // Swap the sell/for tokens
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);

    // Clear amounts
    setFromAmount("");
    setToAmount("");
  };

  // Get percentage buttons based on stablecoin involvement
  const getPercentageButtons = () => {
    const basePercentages = [1, 5, 10];
    if (hasStablecoin() && useNegativePercentages) {
      return basePercentages.map(p => -p); // Negative percentages only when toggled
    }
    return basePercentages; // Default to positive percentages
  };

  // Handle tab changes with state reset
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setFromAmount("");
    setToAmount("");
    setFiatAmount("");
    setSellPercentage(null);
    setQuote(null);
    setLimitOrder({
      triggerPrice: "",
      expiry: "1 day",
      priceAdjustment: 0
    });
    setLimitOrderType('sell');
    setPriceConditionTokens({ from: null, to: null });
  };

  // Real fee percentage label from quote route
  const getQuoteFeePercent = (): string => {
    if (!quote) return '—';
    if (quote.route.includes('Uniswap')) {
      return `${((quote.feeTier || 3000) / 10000).toFixed(2)}%`;
    }
    if (quote.route.length > 3) return '0.60%'; // Eloqura bridge (2 hops × 0.3%)
    if (quote.route.includes('Eloqura')) return '0.30%';
    return '0%'; // wrap/unwrap
  };

  // Real fee in USD from quote
  const getQuoteFeeUsd = (): number => {
    if (!quote || !fromToken) return 0;
    return quote.fee * (fromToken.price || 0);
  };

  // Network cost in USD from gas price × estimated gas × ETH price
  const getNetworkCostUsd = (): number => {
    if (!gasPriceWei) return 0;
    const ethPrice = tokenPrices["0x0000000000000000000000000000000000000000"] || 0;
    // Typical gas usage: Uniswap ~185k, Eloqura ~130k, wrap/unwrap ~50k
    let estimatedGas = 185000n;
    if (quote?.route.includes('Eloqura')) {
      estimatedGas = quote.route.length > 3 ? 200000n : 130000n;
    } else if (quote?.route.length === 2) {
      estimatedGas = 50000n; // wrap/unwrap
    }
    const costWei = gasPriceWei * estimatedGas;
    const costEth = parseFloat(formatUnits(costWei, 18));
    return costEth * ethPrice;
  };

  // Price impact: % difference between quote rate and market rate
  const getPriceImpact = (): { value: number; color: string } => {
    if (!quote || !fromToken || !toToken || quote.exchangeRate === 0) {
      return { value: 0, color: 'text-green-400' };
    }
    const marketRate = toToken.price > 0 ? fromToken.price / toToken.price : 0;
    if (marketRate === 0) return { value: 0, color: 'text-green-400' };
    // Negative impact means you get less than market rate
    const impact = ((quote.exchangeRate - marketRate) / marketRate) * 100;
    const absImpact = Math.abs(impact);
    const color = absImpact < 1 ? 'text-green-400' : absImpact < 3 ? 'text-yellow-400' : 'text-red-400';
    return { value: absImpact, color };
  };

  // Chart formatting functions
  const formatXAxis = (tickItem: number) => {
    const date = new Date(tickItem * 1000);
    switch (chartTimeframe) {
      case "1H":
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case "1D":
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case "7D":
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      case "30D":
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      default:
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const formatTooltip = (value: any, name: string) => {
    if (name === 'price') {
      return [`$${Number(value).toFixed(6)}`, 'Price'];
    }
    return [value, name];
  };

  // Get dynamic color based on token
  const getTokenColor = (token?: Token) => {
    if (!token) return "#00D2FF"; // Default crypto blue

    const colorMap: { [key: string]: string } = {
      'BTC': '#F7931A',
      'ETH': '#627EEA', 
      'BNB': '#F3BA2F',
      'USDT': '#26A17B',
      'USDC': '#2775CA',
      'XRP': '#23292F',
      'ADA': '#0033AD',
      'SOL': '#9945FF',
      'DOT': '#E6007A',
      'MATIC': '#8247E5',
      'AVAX': '#E84142',
      'LINK': '#375BD2',
      'UNI': '#FF007A',
      'CAKE': '#D1884F',
      'OEC': '#8B5CF6', // Purple for OEC token
      'WBNB': '#F3BA2F',
      'BUSD': '#F0B90B',
    };

    return colorMap[token.symbol] || "#00D2FF";
  };

  const chartTimeframes = [
    { key: "1H", label: "1H" },
    { key: "1D", label: "24H" },
    { key: "7D", label: "7D" },
    { key: "30D", label: "30D" },
  ];

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className={`grid gap-6 ${showChart ? (hideSidebar ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 xl:grid-cols-5') : 'grid-cols-1 lg:grid-cols-3'}`}>
        {/* Main Swap Interface */}
        <div className={showChart ? (hideSidebar ? 'lg:col-span-1' : 'xl:col-span-2') : 'lg:col-span-2'}>
          <Card className="crypto-card border h-full">
            <CardHeader className="pb-0">
              {/* Tab Navigation */}
              <div className="flex items-center justify-between mb-0">
                <div className="flex space-x-1 bg-[var(--crypto-dark)] rounded-lg p-1">
                  {["Trade", "Limit"].map((tab) => (
                    <Button
                      key={tab}
                      variant={activeTab === tab ? "default" : "ghost"}
                      size="sm"
                      onClick={() => handleTabChange(tab)}
                      className={
                        activeTab === tab
                          ? "bg-crypto-blue hover:bg-crypto-blue/80 text-white px-6 py-2 min-w-[80px]"
                          : "text-gray-400 hover:text-white px-6 py-2 min-w-[80px]"
                      }
                    >
                      {tab}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowChart(!showChart);
                      setHideSidebar(!showChart);
                      setChartVisible(!showChart);
                    }}
                    className={`text-gray-400 hover:text-white ${showChart ? 'text-crypto-blue' : ''}`}
                  >
                    <BarChart3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSettings(!showSettings)}
                    className="text-gray-400 hover:text-white"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-0 relative">
              {/* Settings Panel */}
              {showSettings && (
                <Card className="bg-[var(--crypto-dark)] border-[var(--crypto-border)]">
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Slippage Tolerance</label>
                      <div className="flex space-x-2 mb-2">
                        {[0.1, 0.5, 1.0].map((value) => (
                          <Button
                            key={value}
                            variant={slippage === value && !isSlippageCustom ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setSlippage(value);
                              setIsSlippageCustom(false);
                            }}
                            className="text-xs"
                          >
                            {value}%
                          </Button>
                        ))}
                        <div className="flex items-center space-x-1">
                          <Input
                            type="number"
                            placeholder="Custom"
                            value={customSlippage}
                            onChange={(e) => {
                              setCustomSlippage(e.target.value);
                              if (e.target.value) {
                                setSlippage(parseFloat(e.target.value));
                                setIsSlippageCustom(true);
                              }
                            }}
                            className="w-20 h-8 text-xs"
                          />
                          <span className="text-xs text-gray-400">%</span>
                        </div>
                      </div>
                      {slippage > 5 && (
                        <div className="flex items-center space-x-1 text-yellow-500 text-xs">
                          <AlertTriangle className="w-3 h-3" />
                          <span>High slippage tolerance</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Transaction Deadline</label>
                      <div className="flex space-x-2">
                        {[5, 10, 20, 30].map((value) => (
                          <Button
                            key={value}
                            variant={txDeadline === value ? "default" : "outline"}
                            size="sm"
                            onClick={() => setTxDeadline(value)}
                            className="text-xs"
                          >
                            {value}m
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Transaction reverts if pending longer than this</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Limit Order Interface */}
              {activeTab === "Limit" && (
                <>
                  {/* Price Condition Section - Behavior depends on stablecoin involvement */}
                  <div className="bg-[var(--crypto-dark)] rounded-lg p-3 border border-[var(--crypto-border)]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-sm">
                        When 1 {getPriceConditionTokens().from?.symbol || fromToken?.symbol || 'Token'} is worth
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Input
                        type="number"
                        value={limitOrder.triggerPrice || calculateLimitPrice()}
                        onChange={(e) => setLimitOrder({...limitOrder, triggerPrice: e.target.value})}
                        placeholder="0.0"
                        className="flex-1 bg-transparent border-none font-bold text-white placeholder-gray-500 p-0 m-0 h-12 focus-visible:ring-0 focus:outline-none focus:ring-0 focus:border-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        style={{ 
                          padding: 0, 
                          margin: 0, 
                          fontSize: '2.25rem',
                          lineHeight: '1',
                          fontWeight: 'bold',
                          outline: 'none',
                          border: 'none',
                          boxShadow: 'none'
                        }}
                      />
                      <Button
                        variant="outline"
                        onClick={() => openTokenModal('priceCondition')}
                        className="bg-[var(--crypto-card)] border-[var(--crypto-border)] text-white hover:bg-[var(--crypto-dark)] px-3 py-2 h-auto"
                      >
                        {getPriceConditionTokens().to ? (
                          <div className="flex items-center space-x-2">
                            <img src={getPriceConditionTokens().to!.logo} alt={getPriceConditionTokens().to!.symbol} className="w-6 h-6 rounded-full" />
                            <span>{getPriceConditionTokens().to!.symbol}</span>
                          </div>
                        ) : toToken ? (
                          <div className="flex items-center space-x-2">
                            <img src={toToken.logo} alt={toToken.symbol} className="w-6 h-6 rounded-full" />
                            <span>{toToken.symbol}</span>
                          </div>
                        ) : (
                          <span>Select token</span>
                        )}
                      </Button>
                    </div>

                    {/* Market Price and Adjustments */}
                    <div className="flex items-center space-x-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLimitOrder({...limitOrder, triggerPrice: getCurrentMarketPrice(), priceAdjustment: 0})}
                        className="text-xs text-gray-400 border-gray-600 hover:text-white hover:border-gray-400"
                      >
                        Market
                      </Button>
                      {getPercentageButtons().map((percentage) => (
                        <Button
                          key={percentage}
                          variant={limitOrder.priceAdjustment === percentage ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            const marketPrice = parseFloat(getCurrentMarketPrice());
                            const adjustedPrice = marketPrice * (1 + percentage / 100);
                            setLimitOrder({
                              ...limitOrder, 
                              priceAdjustment: percentage,
                              triggerPrice: adjustedPrice.toFixed(6)
                            });
                          }}
                          className={limitOrder.priceAdjustment === percentage ? "bg-crypto-blue hover:bg-crypto-blue/80 text-xs" : "text-xs"}
                        >
                          {percentage > 0 ? '+' : ''}{percentage}%
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Sell Amount Section with relative positioning for toggle */}
                  <div className="relative">
                    <div className="bg-[var(--crypto-dark)] rounded-lg p-3 border border-[var(--crypto-border)]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">Sell</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Input
                          type="number"
                          value={fromAmount}
                          onChange={(e) => {
                            setFromAmount(e.target.value);
                            setLastEditedField('from');
                            requestQuote(e.target.value, 'from');
                          }}
                          placeholder="0.0"
                          className="flex-1 bg-transparent border-none font-bold text-white placeholder-gray-500 p-0 m-0 h-12 focus-visible:ring-0 focus:outline-none focus:ring-0 focus:border-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                          style={{
                            padding: 0,
                            margin: 0,
                            fontSize: '2.25rem',
                            lineHeight: '1',
                            fontWeight: 'bold',
                            outline: 'none',
                            border: 'none',
                            boxShadow: 'none'
                          }}
                        />
                        <Button
                          variant="outline"
                          onClick={() => openTokenModal('from')}
                          className="bg-[var(--crypto-card)] border-[var(--crypto-border)] text-white hover:bg-[var(--crypto-dark)] px-3 py-2 h-auto"
                        >
                          {fromToken ? (
                            <div className="flex items-center space-x-2">
                              <img src={fromToken.logo} alt={fromToken.symbol} className="w-6 h-6 rounded-full" />
                              <span>{fromToken.symbol}</span>
                            </div>
                          ) : (
                            <span>Select token</span>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Toggle Button - Overlapping between sections */}
                    <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-5 z-30">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLimitOrderToggle}
                        className="bg-[var(--crypto-dark)] border-2 border-[var(--crypto-border)] rounded-full w-10 h-10 p-0 hover:bg-[var(--crypto-card)]/80 shadow-xl"
                      >
                        <ArrowUpDown className="w-4 h-4 text-gray-400" />
                      </Button>
                    </div>
                  </div>

                  {/* For Amount Section - Shows what you'll receive */}
                  <div className="bg-[var(--crypto-dark)] rounded-lg p-3 border border-[var(--crypto-border)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">For</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Input
                        type="number"
                        value={toAmount}
                        onChange={(e) => {
                          setToAmount(e.target.value);
                          setLastEditedField('to');
                          requestQuote(e.target.value, 'to');
                        }}
                        placeholder="0.0"
                        className="flex-1 bg-transparent border-none font-bold text-white placeholder-gray-500 p-0 m-0 h-12 focus-visible:ring-0 focus:outline-none focus:ring-0 focus:border-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        style={{
                          padding: 0,
                          margin: 0,
                          fontSize: '2.25rem',
                          lineHeight: '1',
                          fontWeight: 'bold',
                          outline: 'none',
                          border: 'none',
                          boxShadow: 'none'
                        }}
                      />
                      <Button
                        variant="outline"
                        onClick={() => openTokenModal('to')}
                        className="bg-[var(--crypto-card)] border-[var(--crypto-border)] text-white hover:bg-[var(--crypto-dark)] px-3 py-2 h-auto"
                      >
                        {toToken ? (
                          <div className="flex items-center space-x-2">
                            <img src={toToken.logo} alt={toToken.symbol} className="w-6 h-6 rounded-full" />
                            <span>{toToken.symbol}</span>
                          </div>
                        ) : (
                          <span>Select token</span>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expiry Selection */}
                  <div className="bg-[var(--crypto-dark)] rounded-lg p-3 border border-[var(--crypto-border)]">
                    <span className="text-gray-400 text-sm mb-2 block">Expiry</span>
                    <div className="flex space-x-2">
                      {["1 day", "1 week", "1 month", "1 year"].map((period) => (
                        <Button
                          key={period}
                          variant={limitOrder.expiry === period ? "default" : "outline"}
                          size="sm"
                          onClick={() => setLimitOrder({...limitOrder, expiry: period})}
                          className={limitOrder.expiry === period ? "bg-crypto-blue hover:bg-crypto-blue/80 text-xs" : "text-xs"}
                        >
                          {period}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Buy Mode Interface */}
              {activeTab === "Buy" && (
                <div className="space-y-4">
                  <div className="bg-[var(--crypto-dark)] rounded-lg p-4 border border-[var(--crypto-border)]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-sm">You're buying</span>
                    </div>

                    {/* Fiat Amount Input */}
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="flex items-center space-x-2">
                        <img src="https://flagcdn.com/w20/us.png" alt="USD" className="w-5 h-3" />
                        <span className="text-white text-2xl font-bold">$</span>
                      </div>
                      <Input
                        type="number"
                        value={fiatAmount}
                        onChange={(e) => {
                          setFiatAmount(e.target.value);
                          if (toToken && e.target.value) {
                            const tokenAmount = parseFloat(e.target.value) / toToken.price;
                            setToAmount(tokenAmount.toString());
                          }
                        }}
                        placeholder="100"
                        className="flex-1 bg-transparent border-none font-bold text-white placeholder-gray-500 p-0 m-0 h-12 focus-visible:ring-0 focus:outline-none focus:ring-0 focus:border-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        style={{ 
                          padding: 0, 
                          margin: 0, 
                          fontSize: '2.25rem',
                          lineHeight: '1',
                          fontWeight: 'bold',
                          outline: 'none',
                          border: 'none',
                          boxShadow: 'none'
                        }}
                      />
                    </div>

                    {/* Preset Amount Buttons */}
                    <div className="flex space-x-2 mb-4">
                      {[100, 300, 1000].map((amount) => (
                        <Button
                          key={amount}
                          variant="outline"
                          size="sm"
                          onClick={() => handleFiatPreset(amount)}
                          className="text-crypto-blue border-crypto-blue hover:bg-crypto-blue hover:text-white"
                        >
                          ${amount}
                        </Button>
                      ))}
                    </div>

                    {/* Token Selection */}
                    <div className="flex items-center space-x-3">
                      <span className="text-gray-400 text-sm">Worth of</span>
                      <Button
                        variant="outline"
                        onClick={() => openTokenModal('to')}
                        className="bg-[var(--crypto-card)] border-[var(--crypto-border)] text-white hover:bg-[var(--crypto-dark)] px-3 py-2 h-auto"
                      >
                        {toToken ? (
                          <div className="flex items-center space-x-2">
                            <img src={toToken.logo} alt={toToken.symbol} className="w-6 h-6 rounded-full" />
                            <span>{toToken.symbol}</span>
                          </div>
                        ) : (
                          <span>Select token</span>
                        )}
                      </Button>
                    </div>

                    {/* Estimated Token Amount */}
                    {toToken && fiatAmount && (
                      <div className="text-center mt-4 p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-400/30 rounded-lg backdrop-blur-sm">
                        <div className="text-xl font-bold text-cyan-400">
                          ≈ {formatNumber(parseFloat(fiatAmount) / toToken.price, 6)} {toToken.symbol}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sell Mode Interface */}
              {activeTab === "Sell" && (
                <div className="space-y-4">
                  <div className="bg-[var(--crypto-dark)] rounded-lg p-4 border border-[var(--crypto-border)]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-sm">You're selling</span>
                      {fromToken && (
                        <span className="text-gray-400 text-sm">
                          Balance: {formatNumber(fromToken.balance || 0, 2)} {fromToken.symbol}
                        </span>
                      )}
                    </div>

                    {/* Percentage Buttons */}
                    <div className="flex space-x-2 mb-4">
                      {[25, 50, 75, 100].map((percentage) => (
                        <Button
                          key={percentage}
                          variant={sellPercentage === percentage ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleSellPercentage(percentage)}
                          className={sellPercentage === percentage ? "bg-crypto-blue hover:bg-crypto-blue/80" : "text-crypto-blue border-crypto-blue hover:bg-crypto-blue hover:text-white"}
                        >
                          {percentage === 100 ? "Max" : `${percentage}%`}
                        </Button>
                      ))}
                    </div>

                    {/* Token Amount */}
                    <div className="flex items-center space-x-3">
                      <Input
                        type="number"
                        value={fromAmount}
                        onChange={(e) => {
                          setFromAmount(e.target.value);
                          setSellPercentage(null);
                          setLastEditedField('from');
                          requestQuote(e.target.value, 'from');
                        }}
                        placeholder="0.0"
                        className="flex-1 bg-transparent border-none font-bold text-white placeholder-gray-500 p-0 m-0 h-12 focus-visible:ring-0 focus:outline-none focus:ring-0 focus:border-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        style={{
                          padding: 0,
                          margin: 0,
                          fontSize: '2.25rem',
                          lineHeight: '1',
                          fontWeight: 'bold',
                          outline: 'none',
                          border: 'none',
                          boxShadow: 'none'
                        }}
                      />
                      <Button
                        variant="outline"
                        onClick={() => openTokenModal('from')}
                        className="bg-[var(--crypto-card)] border-[var(--crypto-border)] text-white hover:bg-[var(--crypto-dark)] px-3 py-2 h-auto"
                      >
                        {fromToken ? (
                          <div className="flex items-center space-x-2">
                            <img src={fromToken.logo} alt={fromToken.symbol} className="w-6 h-6 rounded-full" />
                            <span>{fromToken.symbol}</span>
                          </div>
                        ) : (
                          <span>Select token</span>
                        )}
                      </Button>
                    </div>

                    {/* Estimated USD Value */}
                    {fromToken && fromAmount && (
                      <div className="text-center mt-4 p-4 bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-400/30 rounded-lg backdrop-blur-sm">
                        <div className="text-xl font-bold text-emerald-400">
                          ≈ ${formatNumber(parseFloat(fromAmount) * fromToken.price, 2)} USD
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Standard Trade Interface (Trade tab only) */}
              {activeTab === "Trade" && (
                <>
                  <div className="bg-[var(--crypto-dark)] rounded-lg p-4 border border-[var(--crypto-border)]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-sm">From</span>
                      {/* Percentage Buttons */}
                      <div className="flex space-x-2">
                        {[25, 50, 75, 100].map((percentage) => (
                          <Button
                            key={percentage}
                            variant={swapPercentage === percentage ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSwapPercentage(percentage)}
                            className={swapPercentage === percentage ? "bg-crypto-blue hover:bg-crypto-blue/80" : "text-crypto-blue border-crypto-blue hover:bg-crypto-blue hover:text-white"}
                          >
                            {percentage === 100 ? "Max" : `${percentage}%`}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Input
                        type="number"
                        value={fromAmount}
                        onChange={(e) => {
                          setFromAmount(e.target.value);
                          setSwapPercentage(null);
                          setLastEditedField('from');
                          requestQuote(e.target.value, 'from');
                        }}
                        placeholder="0.0"
                        className="flex-1 bg-transparent border-none font-bold text-white placeholder-gray-500 p-0 m-0 h-12 focus-visible:ring-0 focus:outline-none focus:ring-0 focus:border-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        style={{
                          padding: 0,
                          margin: 0,
                          fontSize: '2.25rem',
                          lineHeight: '1',
                          fontWeight: 'bold',
                          outline: 'none',
                          border: 'none',
                          boxShadow: 'none'
                        }}
                      />
                      <Button
                        variant="outline"
                        onClick={() => openTokenModal('from')}
                        className="bg-[var(--crypto-card)] border-[var(--crypto-border)] text-white hover:bg-[var(--crypto-dark)] px-3 py-2 h-auto"
                      >
                        {fromToken ? (
                          <div className="flex items-center space-x-2">
                            <img src={fromToken.logo} alt={fromToken.symbol} className="w-6 h-6 rounded-full" />
                            <span>{fromToken.symbol}</span>
                          </div>
                        ) : (
                          <span>Select token</span>
                        )}
                      </Button>
                    </div>

                    {/* Balance below token selection */}
                    {fromToken && (
                      <div className="text-right text-gray-400 text-sm mt-2">
                        Balance: {formatNumber(fromToken.balance || 0, 2)} {fromToken.symbol}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Swap Arrow - Only for Trade tab */}
              {activeTab === "Trade" && (
                <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-6 z-30">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSwapTokens}
                    className="bg-[var(--crypto-dark)] border-2 border-[var(--crypto-border)] rounded-full w-12 h-12 p-0 hover:bg-[var(--crypto-card)]/80 shadow-xl"
                  >
                    <ArrowUpDown className="w-5 h-5 text-gray-400" />
                  </Button>
                </div>
              )}

              {/* To Token - Only for Trade tab */}
              {activeTab === "Trade" && (
                <div className="bg-[var(--crypto-dark)] rounded-lg p-4 border border-[var(--crypto-border)]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-400 text-sm">To</span>
                    {toToken && (
                      <span className="text-gray-400 text-sm">
                        Balance: {formatNumber(toToken.balance || 0, 2)} {toToken.symbol}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    <Input
                      type="number"
                      value={toAmount}
                      onChange={(e) => {
                        setToAmount(e.target.value);
                        setLastEditedField('to');
                        requestQuote(e.target.value, 'to');
                      }}
                      placeholder="0.0"
                      className="flex-1 bg-transparent border-none font-bold text-white placeholder-gray-500 p-0 m-0 h-12 focus-visible:ring-0 focus:outline-none focus:ring-0 focus:border-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                      style={{
                        padding: 0,
                        margin: 0,
                        fontSize: '2.25rem',
                        lineHeight: '1',
                        fontWeight: 'bold',
                        outline: 'none',
                        border: 'none',
                        boxShadow: 'none'
                      }}
                    />
                    <Button
                      variant="outline"
                      onClick={() => openTokenModal('to')}
                      className="bg-[var(--crypto-card)] border-[var(--crypto-border)] text-white hover:bg-[var(--crypto-dark)] px-3 py-2 h-auto"
                    >
                      {toToken ? (
                        <div className="flex items-center space-x-2">
                          <img src={toToken.logo} alt={toToken.symbol} className="w-6 h-6 rounded-full" />
                          <span>{toToken.symbol}</span>
                        </div>
                      ) : (
                        <span>Select token</span>
                      )}
                    </Button>
                  </div>
                  {toToken && (
                    <div className="text-right text-gray-400 text-sm mt-2">
                      ≈ ${formatNumber((parseFloat(toAmount) || 0) * toToken.price, 2)}
                    </div>
                  )}
                </div>
              )}



              {/* Price Impact Warning Banner */}
              {activeTab === "Trade" && quote && (() => {
                const impact = getPriceImpact();
                if (impact.value >= 5) return (
                  <div className={`rounded-lg p-3 border flex items-center space-x-2 text-sm ${
                    impact.value >= 15
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                  }`}>
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>
                      {impact.value >= 15
                        ? `Price impact is extremely high (~${impact.value.toFixed(1)}%). This trade is blocked to protect your funds.`
                        : `Price impact is high (~${impact.value.toFixed(1)}%). You may receive significantly less than expected.`}
                    </span>
                  </div>
                );
                return null;
              })()}

              {/* Custom Token Warning */}
              {activeTab === "Trade" && fromToken && toToken && (
                isCustomToken(fromToken) || isCustomToken(toToken)
              ) && (
                <div className="rounded-lg p-3 border bg-yellow-500/10 border-yellow-500/30 flex items-center space-x-2 text-sm text-yellow-400">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    {isCustomToken(fromToken) && isCustomToken(toToken)
                      ? `${fromToken.symbol} and ${toToken.symbol} are custom imported tokens — not verified.`
                      : `${isCustomToken(fromToken) ? fromToken.symbol : toToken!.symbol} is a custom imported token — not verified.`}
                  </span>
                </div>
              )}

              {/* Action Button - Approve or Swap */}
              {activeTab === "Trade" && needsApproval && fromToken && fromToken.symbol !== 'ETH' && fromAmount ? (
                <Button
                  onClick={handleApprove}
                  disabled={isLoading || isWritePending || isConfirming || isApproving || !isConnected}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-6 text-lg"
                >
                  {isWritePending || isApproving ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Approving...</span>
                    </div>
                  ) : (
                    `Approve ${fromToken.symbol}`
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    const impact = getPriceImpact();
                    if (activeTab === "Trade" && impact.value >= 5 && impact.value < 15 && !highImpactConfirmed) {
                      setHighImpactConfirmed(true);
                      return;
                    }
                    handleSwapExecution();
                  }}
                  disabled={
                    isLoading || isWritePending || isConfirming ||
                    !isConnected ||
                    (activeTab === "Trade" && (!fromToken || !toToken || (!fromAmount && !toAmount))) ||
                    (activeTab === "Trade" && quote && quote.exchangeRate === 0 && fromToken?.symbol !== 'ETH' && toToken?.symbol !== 'WETH' && fromToken?.symbol !== 'WETH' && toToken?.symbol !== 'ETH') ||
                    (activeTab === "Trade" && getPriceImpact().value >= 15) ||
                    (activeTab === "Limit" && (!fromToken || !toToken || !fromAmount || !limitOrder.triggerPrice)) ||
                    (activeTab === "Buy" && (!toToken || !fiatAmount)) ||
                    (activeTab === "Sell" && (!fromToken || !fromAmount))
                  }
                  className={`w-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-6 text-lg ${
                    activeTab === "Trade" && highImpactConfirmed
                      ? 'bg-gradient-to-r from-red-500 to-orange-500'
                      : 'bg-gradient-to-r from-crypto-blue to-crypto-green'
                  }`}
                >
                  {isWritePending ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Confirm in Wallet...</span>
                    </div>
                  ) : isConfirming ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Confirming...</span>
                    </div>
                  ) : isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Getting Quote...</span>
                    </div>
                  ) : !isConnected ? (
                    "Connect Wallet"
                  ) : activeTab === "Trade" ? (
                    !fromToken || !toToken ? "Select Tokens" :
                    (!fromAmount && !toAmount) ? "Enter Amount" :
                    fromToken.symbol === 'ETH' && toToken.symbol === 'WETH' ? `Wrap ${fromToken.symbol}` :
                    fromToken.symbol === 'WETH' && toToken.symbol === 'ETH' ? `Unwrap ${fromToken.symbol}` :
                    quote && quote.exchangeRate === 0 ? "No Liquidity" :
                    highImpactConfirmed ? "Swap Anyway — High Price Impact" :
                    quote && quote.route.includes('Uniswap') ? `Swap via Uniswap` :
                    quote && quote.route.includes('Eloqura') ? `Swap via Eloqura` :
                    `Swap ${fromToken.symbol}`
                  ) : activeTab === "Limit" ? (
                    !fromToken || !toToken ? "Select Tokens" :
                    !fromAmount ? "Enter Amount" :
                    !limitOrder.triggerPrice ? "Set Limit Price" :
                    `Place Limit Order`
                  ) : activeTab === "Buy" ? (
                    !toToken ? "Select Token" :
                    !fiatAmount ? "Enter Amount" :
                    `Buy ${toToken.symbol}`
                  ) : activeTab === "Sell" ? (
                    !fromToken ? "Select Token" :
                    !fromAmount ? "Enter Amount" :
                    `Sell ${fromToken.symbol}`
                  ) : "Connect Wallet"}
                </Button>
              )}

              {/* Quote and Trade Information */}
              {activeTab === "Trade" && fromToken && toToken && (fromAmount || toAmount) && (
                <div className="bg-[var(--crypto-card)] rounded-lg p-4 border border-[var(--crypto-border)] space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Exchange Rate</span>
                    <span className="text-white">
                      1 {fromToken?.symbol} = {formatNumber(quote?.exchangeRate || (toToken.price > 0 ? fromToken.price / toToken.price : 0), 6)} {toToken?.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Protocol Fee ({quote ? getQuoteFeePercent() : '—'})</span>
                    <span className="text-white">
                      {quote ? `~$${formatNumber(getQuoteFeeUsd(), 2)}` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Network Cost</span>
                    <span className="text-white">
                      {(() => {
                        const cost = getNetworkCostUsd();
                        if (cost === 0) return '—';
                        if (cost < 0.01) return '< $0.01';
                        return `~$${formatNumber(cost, 2)}`;
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Price Impact</span>
                    {(() => {
                      const impact = getPriceImpact();
                      return (
                        <span className={impact.color}>
                          {impact.value < 0.01 ? '< 0.01%' : `~${impact.value.toFixed(2)}%`}
                        </span>
                      );
                    })()}
                  </div>
                  {quote && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Route</span>
                      <span className="text-gray-300">{quote.route.join(' → ')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Limit Order Information */}
              {activeTab === "Limit" && fromToken && toToken && limitOrder.triggerPrice && (
                <div className="bg-[var(--crypto-card)] rounded-lg p-4 border border-[var(--crypto-border)] space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Trigger Price</span>
                    <span className="text-white">
                      {formatNumber(parseFloat(limitOrder.triggerPrice), 6)} {toToken.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Current Market Price</span>
                    <span className="text-white">
                      {formatNumber(toToken.price / fromToken.price, 6)} {toToken.symbol}
                    </span>
                  </div>
                  {fromAmount && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">You'll receive</span>
                      <span className="text-white">
                        ≈ {formatNumber(parseFloat(fromAmount) * parseFloat(limitOrder.triggerPrice), 6)} {toToken.symbol}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Expires</span>
                    <span className="text-white">{limitOrder.expiry}</span>
                  </div>
                  <div className="text-xs text-yellow-400 mt-2">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Limits may not execute exactly when tokens reach the specified price.
                  </div>
                </div>
              )}

              {/* Buy Information */}
              {activeTab === "Buy" && toToken && fiatAmount && (
                <div className="bg-[var(--crypto-card)] rounded-lg p-4 border border-[var(--crypto-border)] space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">You Pay</span>
                    <span className="text-white">${formatNumber(parseFloat(fiatAmount), 2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">You Receive</span>
                    <span className="text-white">
                      ≈ {formatNumber(parseFloat(fiatAmount) / toToken.price, 6)} {toToken.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Exchange Rate</span>
                    <span className="text-white">1 {toToken.symbol} = ${formatNumber(toToken.price, 2)}</span>
                  </div>
                </div>
              )}

              {/* Sell Information */}
              {activeTab === "Sell" && fromToken && fromAmount && (
                <div className="bg-[var(--crypto-card)] rounded-lg p-4 border border-[var(--crypto-border)] space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">You Sell</span>
                    <span className="text-white">{formatNumber(parseFloat(fromAmount), 6)} {fromToken.symbol}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">You Receive</span>
                    <span className="text-white">
                      ≈ ${formatNumber(parseFloat(fromAmount) * fromToken.price, 2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Exchange Rate</span>
                    <span className="text-white">1 {fromToken.symbol} = ${formatNumber(fromToken.price, 2)}</span>
                  </div>
                  {sellPercentage && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Percentage of Balance</span>
                      <span className="text-crypto-blue">{sellPercentage}%</span>
                    </div>
                  )}
                </div>
              )}

              

              

              {/* Liquidity Button */}
              <div className="mt-4">
                <Button
                  onClick={() => setLocation('/liquidity')}
                  variant="outline"
                  className="w-full border-crypto-blue/30 text-crypto-blue hover:bg-crypto-blue/10 py-4"
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                      <path d="M12 16L13.09 18.26L16 19L13.09 19.74L12 22L10.91 19.74L8 19L10.91 18.26L12 16Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                    </svg>
                    <span>Manage Liquidity</span>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Price Chart */}
        {showChart && chartVisible && (
          <div className={`${hideSidebar ? 'lg:col-span-1' : 'xl:col-span-2'} relative`} key={`chart-container-${chartKey}`} style={{ isolation: 'isolate' }}>
            <Card className="crypto-card border h-full bg-[var(--crypto-card)] backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span>Price Chart</span>
                    {fromToken && toToken && (
                      <div className="text-sm text-gray-400">
                        {fromToken.symbol}/{toToken.symbol}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    {chartTimeframes.map((tf) => (
                      <Button
                        key={tf.key}
                        variant={chartTimeframe === tf.key ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setChartTimeframe(tf.key)}
                        className={chartTimeframe === tf.key ? "bg-crypto-blue hover:bg-crypto-blue/80 text-xs" : "text-gray-400 hover:text-white text-xs"}
                      >
                        {tf.label}
                      </Button>
                    ))}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                {!chartPriceHistory || chartPriceHistory.length === 0 ? (
                  <div className="w-full h-full bg-[var(--crypto-dark)] rounded-lg border border-[var(--crypto-border)] flex items-center justify-center">
                    <div className="text-center">
                      <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400 text-lg font-medium mb-2">No Price Data</p>
                      <p className="text-gray-500 text-sm">
                        {fromToken && toToken
                          ? `Price data for ${fromToken.symbol}/${toToken.symbol} not available`
                          : 'Select tokens to view chart'
                        }
                      </p>
                      {fromToken && toToken && (
                        <div className="mt-4 space-y-2 text-left max-w-xs mx-auto">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Current Rate:</span>
                            <span className="text-white">
                              1 {fromToken.symbol} = {formatNumber(toToken.price / fromToken.price, 6)} {toToken.symbol}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">24h Change:</span>
                            <span className={`font-medium ${
                              tokenData?.priceChangePercent24h && tokenData.priceChangePercent24h >= 0 
                                ? 'text-green-400' 
                                : 'text-red-400'
                            }`}>
                              {tokenData?.priceChangePercent24h 
                                ? `${tokenData.priceChangePercent24h >= 0 ? '+' : ''}${tokenData.priceChangePercent24h.toFixed(2)}%`
                                : '+0.12%'
                              }
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">24h Volume:</span>
                            <span className="text-white font-medium">
                              {tokenData?.volume24h 
                                ? `$${formatNumber(tokenData.volume24h)}`
                                : '$24.3M'
                              }
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">{fromToken.symbol} Price:</span>
                            <span className="text-white font-medium">
                              ${formatNumber(fromToken.price, 6)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full relative">
                    <ResponsiveContainer width="100%" height="100%" key={`chart-${chartKey}-${fromToken?.symbol}-${toToken?.symbol}-${chartTimeframe}`}>
                      <AreaChart data={chartPriceHistory}>
                        <defs>
                          <linearGradient id={`areaGradient-${fromToken?.symbol || 'default'}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={getTokenColor(fromToken || undefined)} stopOpacity={1.0}/>
                            <stop offset="25%" stopColor={getTokenColor(fromToken || undefined)} stopOpacity={1.0}/>
                            <stop offset="75%" stopColor={getTokenColor(fromToken || undefined)} stopOpacity={0.5}/>
                            <stop offset="100%" stopColor={getTokenColor(fromToken || undefined)} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--crypto-border)" />
                        <XAxis 
                          dataKey="timestamp" 
                          tickFormatter={formatXAxis}
                          stroke="#9CA3AF"
                          fontSize={12}
                        />
                        <YAxis 
                          domain={['dataMin * 0.99', 'dataMax * 1.01']}
                          tickFormatter={(value) => `$${value.toFixed(6)}`}
                          stroke="#9CA3AF"
                          fontSize={12}
                        />
                        <Tooltip 
                          formatter={formatTooltip}
                          labelFormatter={(value) => new Date(value * 1000).toLocaleString()}
                          contentStyle={{
                            backgroundColor: 'var(--crypto-card)',
                            border: '1px solid var(--crypto-border)',
                            borderRadius: '8px',
                            color: 'white'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="price" 
                          stroke={getTokenColor(fromToken || undefined)}
                          strokeWidth={2}
                          fill={`url(#areaGradient-${fromToken?.symbol || 'default'})`}
                          dot={false}
                          activeDot={{ r: 4, stroke: getTokenColor(fromToken || undefined), strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>

                    {/* Trading Pair Stats Overlay */}
                    {fromToken && toToken && (
                      <div className="absolute top-4 right-4 bg-[var(--crypto-card)]/90 backdrop-blur-sm rounded-lg p-3 border border-[var(--crypto-border)]">
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between items-center min-w-[160px]">
                            <span className="text-gray-400">Current Rate:</span>
                            <span className="text-white font-medium">
                              1 {fromToken.symbol} = {formatNumber(toToken.price / fromToken.price, 6)} {toToken.symbol}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">24h Change:</span>
                            <span className={`font-medium ${
                              tokenData?.priceChangePercent24h && tokenData.priceChangePercent24h >= 0 
                                ? 'text-green-400' 
                                : 'text-red-400'
                            }`}>
                              {tokenData?.priceChangePercent24h 
                                ? `${tokenData.priceChangePercent24h >= 0 ? '+' : ''}${tokenData.priceChangePercent24h.toFixed(2)}%`
                                : '+0.12%'
                              }
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">24h Volume:</span>
                            <span className="text-white font-medium">
                              {tokenData?.volume24h 
                                ? `$${formatNumber(tokenData.volume24h)}`
                                : '$24.3M'
                              }
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">{fromToken.symbol} Price:</span>
                            <span className="text-white font-medium">
                              ${formatNumber(fromToken.price, 6)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Sidebar Info */}
        {!hideSidebar && (
        <div className="space-y-6">

          {/* Market Stats */}
          <Card className="crypto-card border">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <TrendingUp className="w-5 h-5" />
                <span>Eloqura DEX Stats</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">24h Volume</span>
                  <span className="text-white font-medium">
                    {eloquraStats.volume24hUsd > 0
                      ? `$${formatNumber(eloquraStats.volume24hUsd, 2)}`
                      : '$0.00'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Total Liquidity</span>
                  <span className="text-white font-medium">
                    {eloquraStats.totalLiquidityUsd > 0
                      ? `$${formatNumber(eloquraStats.totalLiquidityUsd, 2)}`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Active Pairs</span>
                  <span className="text-white font-medium">{eloquraStats.activePairs}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transaction History Preview */}
          <Card className="crypto-card border">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Clock className="w-5 h-5" />
                <span>Recent Swaps</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentSwapsLoading ? (
                  <div className="text-sm text-gray-400 text-center py-2">Loading swaps...</div>
                ) : recentSwaps.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-2">No recent swaps found</div>
                ) : (
                  recentSwaps.map((swap, i) => {
                    const timeAgo = Math.floor((Date.now() / 1000 - swap.timestamp) / 60);
                    const timeLabel = timeAgo < 1 ? 'just now' : timeAgo < 60 ? `${timeAgo}m ago` : `${Math.floor(timeAgo / 60)}h ago`;
                    return (
                      <a
                        key={`${swap.txHash}-${i}`}
                        href={`https://sepolia.etherscan.io/tx/${swap.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between text-sm hover:bg-[var(--crypto-dark)] rounded-lg px-2 py-1 -mx-2 transition-colors"
                      >
                        <div className="flex items-center space-x-2">
                          <ArrowUpDown className="w-3 h-3 text-gray-400" />
                          <span className="text-gray-300">{swap.tokenIn} → {swap.tokenOut}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-green-400">+{swap.amountOut} {swap.tokenOut}</div>
                          <div className="text-xs text-gray-500">{timeLabel}</div>
                        </div>
                      </a>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Safety Features */}
          <Card className="crypto-card border">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Safety Features</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className="text-sm text-gray-200">MEV Protection</span>
                  </div>
                  <span className="text-xs text-gray-300">{txDeadline}m deadline · {slippage}% max slip</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${slippage <= 1 ? 'bg-green-400' : slippage <= 5 ? 'bg-yellow-400' : 'bg-red-400'}`} />
                    <span className="text-sm text-gray-200">Slippage Control</span>
                  </div>
                  <span className={`text-xs font-medium ${slippage <= 1 ? 'text-green-400' : slippage <= 5 ? 'text-yellow-400' : 'text-red-400'}`}>{slippage}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className="text-sm text-gray-200">Price Impact Warning</span>
                  </div>
                  <span className="text-xs text-gray-300">Warns &gt;5% · Blocks &gt;15%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {(() => {
                      const fromCustom = fromToken ? isCustomToken(fromToken) : false;
                      const toCustom = toToken ? isCustomToken(toToken) : false;
                      const hasCustom = fromCustom || toCustom;
                      return (
                        <>
                          <div className={`w-2 h-2 rounded-full ${hasCustom ? 'bg-yellow-400' : 'bg-green-400'}`} />
                          <span className="text-sm text-gray-200">Token Verification</span>
                        </>
                      );
                    })()}
                  </div>
                  <span className={`text-xs font-medium ${(() => {
                    const fromCustom = fromToken ? isCustomToken(fromToken) : false;
                    const toCustom = toToken ? isCustomToken(toToken) : false;
                    return (fromCustom || toCustom) ? 'text-yellow-400' : 'text-green-400';
                  })()}`}>
                    {(() => {
                      const fromCustom = fromToken ? isCustomToken(fromToken) : false;
                      const toCustom = toToken ? isCustomToken(toToken) : false;
                      if (fromCustom && toCustom) return 'Both unverified';
                      if (fromCustom) return `${fromToken?.symbol} unverified`;
                      if (toCustom) return `${toToken?.symbol} unverified`;
                      return 'Both verified';
                    })()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        )}
      </div>

      {/* Token Selection Modal */}
      <Dialog open={isTokenModalOpen} onOpenChange={setIsTokenModalOpen}>
        <DialogContent className="bg-[var(--crypto-card)] border-[var(--crypto-border)] text-white max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              Select {tokenSelectionFor === 'from' ? 'From' : tokenSelectionFor === 'to' ? 'To' : 'Price Condition'} Token
            </DialogTitle>
          </DialogHeader>

          {/* Search Box */}
          <div className="mb-4">
            <Input
              type="text"
              placeholder="Search tokens or paste contract address..."
              value={tokenSearchQuery}
              onChange={(e) => setTokenSearchQuery(e.target.value)}
              className="bg-[var(--crypto-dark)] border-[var(--crypto-border)] text-white placeholder-gray-400 focus:border-crypto-blue"
            />
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-hide">
            {filteredTokens.map((token) => (
              <div key={token.symbol} className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  onClick={() => selectToken(token)}
                  className="flex-1 justify-start p-3 hover:bg-[var(--crypto-dark)] text-white"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-3">
                      <img src={token.logo} alt={token.symbol} className="w-8 h-8 rounded-full" onError={(e) => { (e.target as HTMLImageElement).src = "/oec-logo.png"; }} />
                      <div className="text-left">
                        <div className="font-medium flex items-center space-x-1">
                          <span>{token.symbol}</span>
                          {isCustomToken(token) ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-normal">Custom</span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-normal">Verified</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400">{token.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-white">{formatNumber(token.balance || 0, 4)}</div>
                      <div className="text-xs text-gray-400">
                        {token.price > 0 && (token.balance || 0) > 0
                          ? `$${formatNumber((token.balance || 0) * token.price, 2)}`
                          : '\u00A0'}
                      </div>
                    </div>
                  </div>
                </Button>
                {isConnected && (
                  token.address !== "0x0000000000000000000000000000000000000000" ? (
                    <button
                      onClick={(e) => addTokenToWallet(token, e)}
                      className="flex-shrink-0 p-2 rounded-lg hover:bg-[var(--crypto-dark)] text-gray-400 hover:text-cyan-400 transition-colors"
                      title={`Add ${token.symbol} to wallet`}
                    >
                      <Wallet className="w-4 h-4" />
                    </button>
                  ) : (
                    <div className="flex-shrink-0 p-2 w-8" />
                  )
                )}
              </div>
            ))}

            {/* Custom token lookup result */}
            {lookupLoading && isAddress(tokenSearchQuery.trim()) && (
              <div className="flex items-center justify-center p-4 text-gray-400">
                <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mr-2" />
                Looking up token...
              </div>
            )}

            {lookupResult && !lookupLoading && (
              <div className="border border-yellow-500/30 rounded-lg p-3 bg-yellow-500/5">
                <div className="flex items-center space-x-2 mb-2 text-yellow-400 text-xs">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Unverified token — trade at your own risk. Verify the contract address before importing.</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-white">
                      {lookupResult.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-medium text-white">{lookupResult.symbol}</div>
                      <div className="text-sm text-gray-400">{lookupResult.name}</div>
                      <div className="text-xs text-gray-500 font-mono">{lookupResult.address.slice(0, 6)}...{lookupResult.address.slice(-4)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    {lookupResult.balance !== undefined && lookupResult.balance > 0 && (
                      <div className="text-sm text-white mb-1">{formatNumber(lookupResult.balance, 4)}</div>
                    )}
                    <Button
                      size="sm"
                      onClick={() => importCustomToken(lookupResult)}
                      className="bg-yellow-500 hover:bg-yellow-600 text-black text-xs font-semibold"
                    >
                      Import Anyway
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {filteredTokens.length === 0 && !lookupResult && !lookupLoading && (
              <div className="text-center text-gray-400 py-4 text-sm">
                {isAddress(tokenSearchQuery.trim())
                  ? "No valid ERC-20 token found at this address"
                  : "No tokens found. Try pasting a contract address."}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Network Selection Modal */}
      <Dialog open={isNetworkModalOpen} onOpenChange={setIsNetworkModalOpen}>
        <DialogContent className="bg-[var(--crypto-card)] border-[var(--crypto-border)] text-white max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              Select {networkSelectionFor === 'from' ? 'Source' : 'Destination'} Network
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {/* OEC Chain */}
            <Button
              variant="ghost"
              onClick={() => setIsNetworkModalOpen(false)}
              className="w-full justify-start p-3 hover:bg-[var(--crypto-dark)] text-white"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                    O
                  </div>
                  <div className="text-left">
                    <div className="font-medium">OEC Chain</div>
                    <div className="text-sm text-gray-400">Fast & Low Cost</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Chain ID: 66</div>
                </div>
              </div>
            </Button>

            {/* Ethereum */}
            <Button
              variant="ghost"
              onClick={() => setIsNetworkModalOpen(false)}
              className="w-full justify-start p-3 hover:bg-[var(--crypto-dark)] text-white"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold text-white">
                    E
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Ethereum</div>
                    <div className="text-sm text-gray-400">Mainnet</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Chain ID: 1</div>
                </div>
              </div>
            </Button>

            {/* Polygon */}
            <Button
              variant="ghost"
              onClick={() => setIsNetworkModalOpen(false)}
              className="w-full justify-start p-3 hover:bg-[var(--crypto-dark)] text-white"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-sm font-bold text-white">
                    P
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Polygon</div>
                    <div className="text-sm text-gray-400">PoS Chain</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Chain ID: 137</div>
                </div>
              </div>
            </Button>

            {/* BSC */}
            <Button
              variant="ghost"
              onClick={() => setIsNetworkModalOpen(false)}
              className="w-full justify-start p-3 hover:bg-[var(--crypto-dark)] text-white"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-sm font-bold text-black">
                    B
                  </div>
                  <div className="text-left">
                    <div className="font-medium">BNB Smart Chain</div>
                    <div className="text-sm text-gray-400">BSC Mainnet</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Chain ID: 56</div>
                </div>
              </div>
            </Button>

            {/* Arbitrum */}
            <Button
              variant="ghost"
              onClick={() => setIsNetworkModalOpen(false)}
              className="w-full justify-start p-3 hover:bg-[var(--crypto-dark)] text-white"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center text-sm font-bold text-white">
                    A
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Arbitrum One</div>
                    <div className="text-sm text-gray-400">L2 Rollup</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Chain ID: 42161</div>
                </div>
              </div>
            </Button>

            {/* Optimism */}
            <Button
              variant="ghost"
              onClick={() => setIsNetworkModalOpen(false)}
              className="w-full justify-start p-3 hover:bg-[var(--crypto-dark)] text-white"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-sm font-bold text-white">
                    O
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Optimism</div>
                    <div className="text-sm text-gray-400">L2 Rollup</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Chain ID: 10</div>
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

export default function Swap() {
  return (
    <Layout>
      <SwapContent />
    </Layout>
  );
}

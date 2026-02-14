import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  Plus,
  ArrowLeft,
  Settings,
  Info,
  TrendingUp,
  TrendingDown,
  Droplets,
  Star,
  ExternalLink,
  AlertTriangle,
  Zap,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Search,
  Filter,
  ArrowLeftRight
} from "lucide-react";
import { useTokenData } from "@/hooks/use-token-data";
import { useQuery } from "@tanstack/react-query";
import { formatCryptoData } from "@/utils/crypto-logos";
import type { LiveCoinWatchDbCoin } from "@shared/schema";
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt, useWalletClient } from "wagmi";
import { formatUnits, parseUnits, erc20Abi } from "viem";
import { ELOQURA_CONTRACTS, FACTORY_ABI, ROUTER_ABI, PAIR_ABI, ERC20_ABI } from "@/lib/contracts";
import { useToast } from "@/hooks/use-toast";

interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logo: string;
  price: number;
  balance?: number;
}

interface Position {
  id: string;
  token0: Token;
  token1: Token;
  liquidity: string;
  fee: number;
  minPrice: number;
  maxPrice: number;
  currentPrice: number;
  uncollectedFees0: string;
  uncollectedFees1: string;
  value: number;
  status: 'in-range' | 'out-of-range';
}

function LiquidityContent() {
  const [, setLocation] = useLocation();
  const [activeView, setActiveView] = useState<'positions' | 'create' | 'pools'>('positions');
  const [selectedToken0, setSelectedToken0] = useState<Token | null>(null);
  const [selectedToken1, setSelectedToken1] = useState<Token | null>(null);
  const [amount0, setAmount0] = useState("");
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set());
  const [reversedPricePositions, setReversedPricePositions] = useState<Set<string>>(new Set());
  const [amount1, setAmount1] = useState("");
  const [selectedFee, setSelectedFee] = useState<number>(0.25);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<'pools' | 'tokens'>('pools');
  const [timeframe, setTimeframe] = useState("1D");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [isFullRange, setIsFullRange] = useState(true);
  const [poolVersion, setPoolVersion] = useState<'v3' | 'v2'>('v3');
  const [isLoading, setIsLoading] = useState(false);

  // Sorting state
  const [poolsSortField, setPoolsSortField] = useState<string | null>(null);
  const [poolsSortDirection, setPoolsSortDirection] = useState<'asc' | 'desc'>('asc');
  const [tokensSortField, setTokensSortField] = useState<string | null>('marketCap');
  const [tokensSortDirection, setTokensSortDirection] = useState<'asc' | 'desc'>('desc');

  // Remove liquidity modal state
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedPositionForRemoval, setSelectedPositionForRemoval] = useState<Position | null>(null);
  const [removalPercentage, setRemovalPercentage] = useState(25);

  // Add liquidity modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPositionForAddition, setSelectedPositionForAddition] = useState<Position | null>(null);
  const [addAmount0, setAddAmount0] = useState("");
  const [addAmount1, setAddAmount1] = useState("");

  // Token selection modal state
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [tokenSelectionFor, setTokenSelectionFor] = useState<'token0' | 'token1'>('token0');
  const [tokenSearchQuery, setTokenSearchQuery] = useState("");

  // Wagmi hooks for blockchain interaction
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContract, data: txHash, isPending: isWritePending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const { data: walletClient } = useWalletClient();
  const { toast } = useToast();

  // Real Eloqura pool data
  const [eloquraPairs, setEloquraPairs] = useState<Array<{
    address: string;
    token0: string;
    token1: string;
    reserve0: bigint;
    reserve1: bigint;
    lpBalance: bigint;
    totalSupply: bigint;
  }>>([]);

  // Fetch Eloqura pairs from Factory
  const fetchEloquraPairs = async () => {
    if (!publicClient) return;

    try {
      const pairCount = await publicClient.readContract({
        address: ELOQURA_CONTRACTS.sepolia.Factory as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: 'allPairsLength',
      }) as bigint;

      const pairs = [];
      for (let i = 0; i < Number(pairCount); i++) {
        const pairAddress = await publicClient.readContract({
          address: ELOQURA_CONTRACTS.sepolia.Factory as `0x${string}`,
          abi: FACTORY_ABI,
          functionName: 'allPairs',
          args: [BigInt(i)],
        }) as `0x${string}`;

        const [token0, token1, reserves, totalSupply] = await Promise.all([
          publicClient.readContract({ address: pairAddress, abi: PAIR_ABI, functionName: 'token0' }),
          publicClient.readContract({ address: pairAddress, abi: PAIR_ABI, functionName: 'token1' }),
          publicClient.readContract({ address: pairAddress, abi: PAIR_ABI, functionName: 'getReserves' }),
          publicClient.readContract({ address: pairAddress, abi: PAIR_ABI, functionName: 'totalSupply' }),
        ]) as [string, string, [bigint, bigint, number], bigint];

        let lpBalance = 0n;
        if (address) {
          lpBalance = await publicClient.readContract({
            address: pairAddress,
            abi: PAIR_ABI,
            functionName: 'balanceOf',
            args: [address],
          }) as bigint;
        }

        pairs.push({
          address: pairAddress,
          token0: token0 as string,
          token1: token1 as string,
          reserve0: reserves[0],
          reserve1: reserves[1],
          lpBalance,
          totalSupply,
        });
      }

      setEloquraPairs(pairs);
    } catch (error) {
      console.error('Error fetching Eloqura pairs:', error);
    }
  };

  // Fetch pairs on mount and when address changes
  useEffect(() => {
    fetchEloquraPairs();
  }, [publicClient, address]);

  // Token approval state
  const [needsApprovalToken0, setNeedsApprovalToken0] = useState(false);
  const [needsApprovalToken1, setNeedsApprovalToken1] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Minimum reserve threshold - ignore dust-level reserves left from fully removed liquidity
  const MIN_RESERVE_THRESHOLD = 10000000000000n; // 0.00001 tokens (18 decimals)

  // Get current pair for selected tokens (if exists with meaningful liquidity)
  const getCurrentPair = () => {
    if (!selectedToken0 || !selectedToken1) return null;

    // Get the actual token addresses (ETH uses WETH in pairs)
    const addr0 = selectedToken0.symbol === 'ETH'
      ? ELOQURA_CONTRACTS.sepolia.WETH.toLowerCase()
      : selectedToken0.address.toLowerCase();
    const addr1 = selectedToken1.symbol === 'ETH'
      ? ELOQURA_CONTRACTS.sepolia.WETH.toLowerCase()
      : selectedToken1.address.toLowerCase();

    return eloquraPairs.find(pair => {
      const isMatch =
        (pair.token0.toLowerCase() === addr0 && pair.token1.toLowerCase() === addr1) ||
        (pair.token0.toLowerCase() === addr1 && pair.token1.toLowerCase() === addr0);
      if (!isMatch) return false;
      // Skip pairs with dust-level reserves (leftover from fully removed liquidity)
      return pair.reserve0 > MIN_RESERVE_THRESHOLD && pair.reserve1 > MIN_RESERVE_THRESHOLD;
    });
  };

  // Get raw pair (including dust reserves) - used to detect stale dust pairs
  const getRawPair = () => {
    if (!selectedToken0 || !selectedToken1) return null;
    const addr0 = selectedToken0.symbol === 'ETH'
      ? ELOQURA_CONTRACTS.sepolia.WETH.toLowerCase()
      : selectedToken0.address.toLowerCase();
    const addr1 = selectedToken1.symbol === 'ETH'
      ? ELOQURA_CONTRACTS.sepolia.WETH.toLowerCase()
      : selectedToken1.address.toLowerCase();
    return eloquraPairs.find(pair =>
      (pair.token0.toLowerCase() === addr0 && pair.token1.toLowerCase() === addr1) ||
      (pair.token0.toLowerCase() === addr1 && pair.token1.toLowerCase() === addr0)
    );
  };

  // Calculate amount1 when amount0 changes based on pool ratio
  const handleAmount0Change = (value: string) => {
    setAmount0(value);

    if (!value || !selectedToken0 || !selectedToken1) {
      return;
    }

    const pair = getCurrentPair();
    if (pair) {
      // Determine which reserve corresponds to which token
      const addr0 = selectedToken0.symbol === 'ETH'
        ? ELOQURA_CONTRACTS.sepolia.WETH.toLowerCase()
        : selectedToken0.address.toLowerCase();

      const isToken0First = pair.token0.toLowerCase() === addr0;
      const reserve0 = isToken0First ? pair.reserve0 : pair.reserve1;
      const reserve1 = isToken0First ? pair.reserve1 : pair.reserve0;

      if (reserve0 > 0n) {
        const inputAmount = parseFloat(value);
        const reserve0Float = parseFloat(formatUnits(reserve0, selectedToken0.decimals));
        const reserve1Float = parseFloat(formatUnits(reserve1, selectedToken1.decimals));

        // Calculate amount1 based on the ratio
        const calculatedAmount1 = (inputAmount * reserve1Float) / reserve0Float;
        if (isFinite(calculatedAmount1) && calculatedAmount1 > 0) {
          setAmount1(calculatedAmount1.toFixed(6));
        }
      }
    }
    // If no pair exists, user is setting initial ratio - don't auto-calculate
  };

  // Calculate amount0 when amount1 changes based on pool ratio
  const handleAmount1Change = (value: string) => {
    setAmount1(value);

    if (!value || !selectedToken0 || !selectedToken1) {
      return;
    }

    const pair = getCurrentPair();
    if (pair) {
      // Determine which reserve corresponds to which token
      const addr0 = selectedToken0.symbol === 'ETH'
        ? ELOQURA_CONTRACTS.sepolia.WETH.toLowerCase()
        : selectedToken0.address.toLowerCase();

      const isToken0First = pair.token0.toLowerCase() === addr0;
      const reserve0 = isToken0First ? pair.reserve0 : pair.reserve1;
      const reserve1 = isToken0First ? pair.reserve1 : pair.reserve0;

      if (reserve1 > 0n) {
        const inputAmount = parseFloat(value);
        const reserve0Float = parseFloat(formatUnits(reserve0, selectedToken0.decimals));
        const reserve1Float = parseFloat(formatUnits(reserve1, selectedToken1.decimals));

        // Calculate amount0 based on the ratio
        const calculatedAmount0 = (inputAmount * reserve0Float) / reserve1Float;
        if (isFinite(calculatedAmount0) && calculatedAmount0 > 0) {
          setAmount0(calculatedAmount0.toFixed(6));
        }
      }
    }
    // If no pair exists, user is setting initial ratio - don't auto-calculate
  };

  // Check token approvals
  const checkApprovals = async () => {
    if (!publicClient || !address || !selectedToken0 || !selectedToken1) return;

    // ETH doesn't need approval
    if (selectedToken0.symbol !== 'ETH' && amount0) {
      try {
        const allowance = await publicClient.readContract({
          address: selectedToken0.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, ELOQURA_CONTRACTS.sepolia.Router as `0x${string}`],
        }) as bigint;
        const needed = parseUnits(amount0, selectedToken0.decimals);
        setNeedsApprovalToken0(allowance < needed);
      } catch {
        setNeedsApprovalToken0(false);
      }
    } else {
      setNeedsApprovalToken0(false);
    }

    if (selectedToken1.symbol !== 'ETH' && amount1) {
      try {
        const allowance = await publicClient.readContract({
          address: selectedToken1.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, ELOQURA_CONTRACTS.sepolia.Router as `0x${string}`],
        }) as bigint;
        const needed = parseUnits(amount1, selectedToken1.decimals);
        setNeedsApprovalToken1(allowance < needed);
      } catch {
        setNeedsApprovalToken1(false);
      }
    } else {
      setNeedsApprovalToken1(false);
    }
  };

  // Check approvals when tokens or amounts change
  useEffect(() => {
    checkApprovals();
  }, [selectedToken0, selectedToken1, amount0, amount1, address]);

  // Handle token approval
  const handleApproveToken = async (tokenIndex: 0 | 1) => {
    const token = tokenIndex === 0 ? selectedToken0 : selectedToken1;
    if (!token || token.symbol === 'ETH') return;

    setIsApproving(true);
    writeContract({
      address: token.address as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ELOQURA_CONTRACTS.sepolia.Router as `0x${string}`, parseUnits('1000000000', token.decimals)],
    });
  };

  // Recheck approvals after successful transaction
  useEffect(() => {
    if (isConfirmed && isApproving) {
      setIsApproving(false);
      setTimeout(checkApprovals, 1000);
    }
  }, [isConfirmed]);

  // Show errors from writeContract
  useEffect(() => {
    if (writeError) {
      console.error('Write contract error:', writeError);
      toast({
        title: "Transaction Failed",
        description: writeError.message?.slice(0, 100) || "Failed to execute transaction",
        variant: "destructive",
      });
    }
  }, [writeError]);

  // Track if we're adding liquidity (not approving)
  const [isAddingLiquidity, setIsAddingLiquidity] = useState(false);
  const [isAddingToExisting, setIsAddingToExisting] = useState(false);

  // Approval states for add-to-existing modal
  const [addNeedsApproval0, setAddNeedsApproval0] = useState(false);
  const [addNeedsApproval1, setAddNeedsApproval1] = useState(false);
  const [isApprovingAdd, setIsApprovingAdd] = useState(false);

  // Check approvals for add-to-existing modal
  const checkAddApprovals = async () => {
    if (!publicClient || !address || !selectedPositionForAddition) return;
    const t0 = selectedPositionForAddition.token0;
    const t1 = selectedPositionForAddition.token1;

    // ETH / WETH used as ETH doesn't need approval (we'll use addLiquidityETH)
    const wethAddr = ELOQURA_CONTRACTS.sepolia.WETH.toLowerCase();
    const isT0Eth = t0.symbol === 'ETH' || t0.address.toLowerCase() === wethAddr;
    const isT1Eth = t1.symbol === 'ETH' || t1.address.toLowerCase() === wethAddr;

    if (!isT0Eth && addAmount0) {
      try {
        const allowance = await publicClient.readContract({
          address: t0.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, ELOQURA_CONTRACTS.sepolia.Router as `0x${string}`],
        }) as bigint;
        const needed = parseUnits(parseFloat(addAmount0).toFixed(t0.decimals), t0.decimals);
        setAddNeedsApproval0(allowance < needed);
      } catch {
        setAddNeedsApproval0(false);
      }
    } else {
      setAddNeedsApproval0(false);
    }

    if (!isT1Eth && addAmount1) {
      try {
        const allowance = await publicClient.readContract({
          address: t1.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, ELOQURA_CONTRACTS.sepolia.Router as `0x${string}`],
        }) as bigint;
        const needed = parseUnits(parseFloat(addAmount1).toFixed(t1.decimals), t1.decimals);
        setAddNeedsApproval1(allowance < needed);
      } catch {
        setAddNeedsApproval1(false);
      }
    } else {
      setAddNeedsApproval1(false);
    }
  };

  // Check add approvals when amounts change
  useEffect(() => {
    checkAddApprovals();
  }, [selectedPositionForAddition, addAmount0, addAmount1, address]);

  // Handle approval for add-to-existing tokens
  const handleApproveAddToken = async (tokenIndex: 0 | 1) => {
    if (!selectedPositionForAddition) return;
    const token = tokenIndex === 0 ? selectedPositionForAddition.token0 : selectedPositionForAddition.token1;
    setIsApprovingAdd(true);
    writeContract({
      address: token.address as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ELOQURA_CONTRACTS.sepolia.Router as `0x${string}`, parseUnits('1000000000', token.decimals)],
    });
  };

  // Handle adding liquidity to existing position
  const handleAddToExistingPosition = async () => {
    if (!selectedPositionForAddition || !addAmount0 || !addAmount1 || !address) return;

    const t0 = selectedPositionForAddition.token0;
    const t1 = selectedPositionForAddition.token1;
    const wethAddr = ELOQURA_CONTRACTS.sepolia.WETH.toLowerCase();
    const isT0Weth = t0.address.toLowerCase() === wethAddr;
    const isT1Weth = t1.address.toLowerCase() === wethAddr;

    try {
      const amount0Wei = parseUnits(parseFloat(addAmount0).toFixed(t0.decimals), t0.decimals);
      const amount1Wei = parseUnits(parseFloat(addAmount1).toFixed(t1.decimals), t1.decimals);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

      toast({
        title: "Adding Liquidity",
        description: "Please confirm the transaction in your wallet",
      });

      setIsAddingToExisting(true);

      if (isT0Weth || isT1Weth) {
        // Use addLiquidityETH - user sends ETH for the WETH side
        const tokenAddress = isT0Weth ? t1.address : t0.address;
        const tokenAmount = isT0Weth ? amount1Wei : amount0Wei;
        const ethAmount = isT0Weth ? amount0Wei : amount1Wei;

        writeContract({
          address: ELOQURA_CONTRACTS.sepolia.Router as `0x${string}`,
          abi: ROUTER_ABI,
          functionName: 'addLiquidityETH',
          args: [
            tokenAddress as `0x${string}`,
            tokenAmount,
            0n,
            0n,
            address,
            deadline,
          ],
          value: ethAmount,
        });
      } else {
        // Token-token pair
        writeContract({
          address: ELOQURA_CONTRACTS.sepolia.Router as `0x${string}`,
          abi: ROUTER_ABI,
          functionName: 'addLiquidity',
          args: [
            t0.address as `0x${string}`,
            t1.address as `0x${string}`,
            amount0Wei,
            amount1Wei,
            0n,
            0n,
            address,
            deadline,
          ],
        });
      }
    } catch (error: any) {
      console.error('Add to existing position error:', error);
      setIsAddingToExisting(false);
      toast({
        title: "Error",
        description: error?.message || "Failed to add liquidity",
        variant: "destructive",
      });
    }
  };

  // Show success toast when transaction confirms
  useEffect(() => {
    if (isConfirmed && txHash) {
      if (isApprovingLP) {
        toast({
          title: "LP Token Approved!",
          description: "You can now remove liquidity",
        });
        setIsApprovingLP(false);
        setNeedsLPApproval(false);
      } else if (isApproving) {
        toast({
          title: "Token Approved!",
          description: "You can now add liquidity",
        });
        setIsApproving(false);
      } else if (isApprovingAdd) {
        toast({
          title: "Token Approved!",
          description: "You can now add liquidity",
        });
        setIsApprovingAdd(false);
        setTimeout(checkAddApprovals, 1000);
      } else if (isAddingToExisting) {
        toast({
          title: "Liquidity Added!",
          description: `Successfully added liquidity to ${selectedPositionForAddition?.token0.symbol}/${selectedPositionForAddition?.token1.symbol} pool`,
        });
        setIsAddingToExisting(false);
        setShowAddModal(false);
        setSelectedPositionForAddition(null);
        setAddAmount0("");
        setAddAmount1("");
        fetchEloquraPairs();
      } else if (isAddingLiquidity) {
        toast({
          title: "Liquidity Added!",
          description: `Successfully added liquidity to ${selectedToken0?.symbol}/${selectedToken1?.symbol} pool`,
        });
        setIsAddingLiquidity(false);
        // Clear the form
        setAmount0("");
        setAmount1("");
      } else if (isRemovingLiquidity) {
        toast({
          title: "Liquidity Removed!",
          description: "Successfully removed liquidity from the pool",
        });
        setIsRemovingLiquidity(false);
        setShowRemoveModal(false);
        setSelectedPositionForRemoval(null);
        // Refresh pairs
        fetchEloquraPairs();
      }
    }
  }, [isConfirmed, txHash]);

  // Add liquidity to Eloqura
  const handleAddLiquidityEloqura = async () => {
    if (!selectedToken0 || !selectedToken1 || !amount0 || !amount1 || !address) {
      toast({
        title: "Missing Information",
        description: "Please select both tokens and enter amounts",
        variant: "destructive",
      });
      return;
    }

    try {
      const amount0Wei = parseUnits(amount0, selectedToken0.decimals);
      const amount1Wei = parseUnits(amount1, selectedToken1.decimals);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes

      // Check if one token is ETH
      const isToken0ETH = selectedToken0.symbol === 'ETH';
      const isToken1ETH = selectedToken1.symbol === 'ETH';

      setIsAddingLiquidity(true);

      // Check for dust pair that needs ratio correction before adding liquidity
      const currentPair = getCurrentPair();
      const rawPair = getRawPair();
      let dustCorrected = false;

      if (!currentPair && rawPair) {
        const isDust = rawPair.reserve0 <= MIN_RESERVE_THRESHOLD || rawPair.reserve1 <= MIN_RESERVE_THRESHOLD;

        if (isDust) {
          if (!walletClient || !publicClient) {
            toast({
              title: "Wallet Not Ready",
              description: "Please ensure your wallet is connected and try again",
              variant: "destructive",
            });
            setIsAddingLiquidity(false);
            return;
          }

          toast({
            title: "Fixing Stale Price Ratio",
            description: "This pair has leftover dust. Please confirm 2 transactions to correct the price ratio...",
          });

          // Map user's selected tokens to pair's token0/token1 order
          const userAddr0 = isToken0ETH
            ? ELOQURA_CONTRACTS.sepolia.WETH.toLowerCase()
            : selectedToken0.address.toLowerCase();
          const isUserToken0PairToken0 = rawPair.token0.toLowerCase() === userAddr0;

          // Get desired amounts in pair's token0/token1 order
          const pairAmount0 = isUserToken0PairToken0 ? amount0Wei : amount1Wei;
          const pairAmount1 = isUserToken0PairToken0 ? amount1Wei : amount0Wei;

          // Determine which token to send to correct the ratio
          const desiredCross = pairAmount0 * rawPair.reserve1;
          const currentCross = pairAmount1 * rawPair.reserve0;

          let correctionTokenAddr: `0x${string}`;
          let correctionAmount: bigint;

          if (desiredCross < currentCross) {
            const needed = rawPair.reserve0 * pairAmount1 / pairAmount0;
            correctionAmount = (needed > rawPair.reserve1 ? needed - rawPair.reserve1 : 1n) * 10n;
            correctionTokenAddr = rawPair.token1 as `0x${string}`;
          } else {
            const needed = rawPair.reserve1 * pairAmount0 / pairAmount1;
            correctionAmount = (needed > rawPair.reserve0 ? needed - rawPair.reserve0 : 1n) * 10n;
            correctionTokenAddr = rawPair.token0 as `0x${string}`;
          }

          console.log('Dust pair correction:', {
            pairAddress: rawPair.address,
            correctionToken: correctionTokenAddr,
            correctionAmount: correctionAmount.toString(),
            currentReserve0: rawPair.reserve0.toString(),
            currentReserve1: rawPair.reserve1.toString(),
            desiredCross: desiredCross.toString(),
            currentCross: currentCross.toString(),
          });

          try {
            // Transfer correction token to pair contract
            const transferHash = await walletClient.writeContract({
              address: correctionTokenAddr,
              abi: erc20Abi,
              functionName: 'transfer',
              args: [rawPair.address as `0x${string}`, correctionAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: transferHash });

            // Sync pair reserves to reflect the new balance
            const syncHash = await walletClient.writeContract({
              address: rawPair.address as `0x${string}`,
              abi: PAIR_ABI,
              functionName: 'sync',
            });
            await publicClient.waitForTransactionReceipt({ hash: syncHash });

            dustCorrected = true;
            await fetchEloquraPairs();

            toast({
              title: "Price Ratio Fixed",
              description: "Now adding liquidity at your desired ratio...",
            });
          } catch (correctionError: any) {
            console.error('Dust correction failed:', correctionError);
            toast({
              title: "Ratio Correction Failed",
              description: correctionError?.message || "Could not fix stale price ratio. Please try again.",
              variant: "destructive",
            });
            setIsAddingLiquidity(false);
            return;
          }
        }
      }

      toast({
        title: "Adding Liquidity",
        description: "Please confirm the transaction in your wallet",
      });

      // Slippage protection: use 5% tolerance if pair has real reserves or dust was corrected
      // For uncorrected dust pairs this code won't reach (we return above on failure)
      const useSlippage = currentPair || dustCorrected;
      const amount0Min = useSlippage ? amount0Wei * 95n / 100n : 0n;
      const amount1Min = useSlippage ? amount1Wei * 95n / 100n : 0n;

      if (isToken0ETH || isToken1ETH) {
        // Use addLiquidityETH
        const tokenAddress = isToken0ETH ? selectedToken1.address : selectedToken0.address;
        const tokenAmount = isToken0ETH ? amount1Wei : amount0Wei;
        const tokenAmountMin = isToken0ETH ? amount1Min : amount0Min;
        const ethAmount = isToken0ETH ? amount0Wei : amount1Wei;
        const ethAmountMin = isToken0ETH ? amount0Min : amount1Min;

        console.log('Adding liquidity ETH:', {
          router: ELOQURA_CONTRACTS.sepolia.Router,
          token: tokenAddress,
          tokenAmount: tokenAmount.toString(),
          ethAmount: ethAmount.toString(),
          deadline: deadline.toString(),
        });

        writeContract({
          address: ELOQURA_CONTRACTS.sepolia.Router as `0x${string}`,
          abi: ROUTER_ABI,
          functionName: 'addLiquidityETH',
          args: [
            tokenAddress as `0x${string}`,
            tokenAmount,
            tokenAmountMin,
            ethAmountMin,
            address,
            deadline,
          ],
          value: ethAmount,
        });
      } else {
        // Use addLiquidity for token-token pairs
        console.log('Adding liquidity tokens:', {
          router: ELOQURA_CONTRACTS.sepolia.Router,
          token0: selectedToken0.address,
          token1: selectedToken1.address,
          amount0: amount0Wei.toString(),
          amount1: amount1Wei.toString(),
          amount0Min: amount0Min.toString(),
          amount1Min: amount1Min.toString(),
          deadline: deadline.toString(),
        });

        writeContract({
          address: ELOQURA_CONTRACTS.sepolia.Router as `0x${string}`,
          abi: ROUTER_ABI,
          functionName: 'addLiquidity',
          args: [
            selectedToken0.address as `0x${string}`,
            selectedToken1.address as `0x${string}`,
            amount0Wei,
            amount1Wei,
            amount0Min,
            amount1Min,
            address,
            deadline,
          ],
        });
      }
    } catch (error: any) {
      console.error('Add liquidity error:', error);
      setIsAddingLiquidity(false);
      toast({
        title: "Error",
        description: error?.message || "Failed to add liquidity",
        variant: "destructive",
      });
    }
  };

  // Track if we're removing liquidity
  const [isRemovingLiquidity, setIsRemovingLiquidity] = useState(false);
  const [needsLPApproval, setNeedsLPApproval] = useState(false);
  const [isApprovingLP, setIsApprovingLP] = useState(false);

  // Check LP token approval for removal
  const checkLPApproval = async (pairAddress: string, lpAmount: bigint) => {
    if (!publicClient || !address) return true; // Assume approved if can't check

    try {
      const allowance = await publicClient.readContract({
        address: pairAddress as `0x${string}`,
        abi: PAIR_ABI,
        functionName: 'balanceOf', // First check balance
        args: [address],
      }) as bigint;

      // Check allowance to Router
      const lpAllowance = await publicClient.readContract({
        address: pairAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, ELOQURA_CONTRACTS.sepolia.Router as `0x${string}`],
      }) as bigint;

      return lpAllowance >= lpAmount;
    } catch (error) {
      console.error('Error checking LP approval:', error);
      return false;
    }
  };

  // Approve LP tokens to Router
  const handleApproveLPToken = async (pairAddress: string) => {
    setIsApprovingLP(true);
    toast({
      title: "Approving LP Token",
      description: "Please confirm the approval in your wallet",
    });

    writeContract({
      address: pairAddress as `0x${string}`,
      abi: PAIR_ABI,
      functionName: 'approve',
      args: [ELOQURA_CONTRACTS.sepolia.Router as `0x${string}`, parseUnits('1000000000', 18)],
    });
  };

  // Remove liquidity from Eloqura
  const handleRemoveLiquidityEloqura = async (pairAddress: string, lpAmount: bigint, token0: string, token1: string) => {
    if (!address) return;

    try {
      // Check if LP tokens are approved
      const isApproved = await checkLPApproval(pairAddress, lpAmount);
      if (!isApproved) {
        setNeedsLPApproval(true);
        toast({
          title: "Approval Required",
          description: "You need to approve LP tokens before removing liquidity",
          variant: "destructive",
        });
        return;
      }

      setIsRemovingLiquidity(true);
      toast({
        title: "Removing Liquidity",
        description: "Please confirm the transaction in your wallet",
      });

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
      const isToken0WETH = token0.toLowerCase() === ELOQURA_CONTRACTS.sepolia.WETH.toLowerCase();
      const isToken1WETH = token1.toLowerCase() === ELOQURA_CONTRACTS.sepolia.WETH.toLowerCase();

      console.log('Removing liquidity:', {
        pairAddress,
        lpAmount: lpAmount.toString(),
        token0,
        token1,
        isToken0WETH,
        isToken1WETH,
      });

      if (isToken0WETH || isToken1WETH) {
        const tokenAddress = isToken0WETH ? token1 : token0;

        writeContract({
          address: ELOQURA_CONTRACTS.sepolia.Router as `0x${string}`,
          abi: ROUTER_ABI,
          functionName: 'removeLiquidityETH',
          args: [
            tokenAddress as `0x${string}`,
            lpAmount,
            0n,
            0n,
            address,
            deadline,
          ],
        });
      } else {
        writeContract({
          address: ELOQURA_CONTRACTS.sepolia.Router as `0x${string}`,
          abi: ROUTER_ABI,
          functionName: 'removeLiquidity',
          args: [
            token0 as `0x${string}`,
            token1 as `0x${string}`,
            lpAmount,
            0n,
            0n,
            address,
            deadline,
          ],
        });
      }
    } catch (error: any) {
      console.error('Remove liquidity error:', error);
      setIsRemovingLiquidity(false);
      toast({
        title: "Error",
        description: error?.message || "Failed to remove liquidity",
        variant: "destructive",
      });
    }
  };

  // Handle URL parameters to switch to tokens tab when returning from token detail
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    const create = urlParams.get('create');
    const tokenParam = urlParams.get('token');

    if (tab === 'tokens') {
      setActiveTab('tokens');
      setActiveView('pools'); // Ensure we're in the pools view which contains the tabs
    }

    if (create === 'true') {
      setActiveView('create');

      // Pre-select token if specified
      if (tokenParam) {
        // Find the token from our tokens list by ID
        const tokenData = tokens.find(token => token?.id === tokenParam);
        if (tokenData) {
          // Convert to Token interface format for the form
          const token: Token = {
            symbol: tokenData.symbol,
            name: tokenData.name,
            address: `0x${tokenData.id}`, // Mock address using ID
            decimals: 18,
            logo: tokenData.logo,
            price: tokenData.price,
            balance: 1000 // Default balance
          };
          setSelectedToken0(token);
        }
      }
    }
  }, []);

  // Sorting functions
  const handlePoolsSort = (field: string) => {
    if (poolsSortField === field) {
      setPoolsSortDirection(poolsSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setPoolsSortField(field);
      setPoolsSortDirection('asc');
    }
  };

  const handleTokensSort = (field: string) => {
    if (tokensSortField === field) {
      setTokensSortDirection(tokensSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setTokensSortField(field);
      setTokensSortDirection('asc');
    }
  };

  const getSortIcon = (field: string, currentField: string | null, direction: 'asc' | 'desc') => {
    if (field !== currentField) {
      return <ChevronUp className="w-4 h-4 opacity-30" />;
    }
    return direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };



  // Token balances state
  const [tokenBalances, setTokenBalances] = useState<Record<string, bigint>>({});

  // Fetch token balances
  const fetchTokenBalances = async () => {
    if (!publicClient || !address) return;

    try {
      const balances: Record<string, bigint> = {};

      // Fetch ETH balance
      const ethBal = await publicClient.getBalance({ address });
      balances["0x0000000000000000000000000000000000000000"] = ethBal;

      // Fetch ERC20 balances
      const tokenAddresses = [
        "0x2b2fb8df4ac5d394f0d5674d7a54802e42a06aba", // OEC
        ELOQURA_CONTRACTS.sepolia.WETH,
        "0x779877A7B0D9E8603169DdbD7836e478b4624789", // LINK
        "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC
        "0x5bB220Afc6E2e008CB2302a83536A019ED245AA2", // AAVE
        "0x3e622317f8c93f7328350cf0b56d9ed4c620c5d6", // DAI
      ];

      for (const tokenAddr of tokenAddresses) {
        try {
          const bal = await publicClient.readContract({
            address: tokenAddr as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address],
          }) as bigint;
          balances[tokenAddr] = bal;
        } catch (err) {
          balances[tokenAddr] = 0n;
        }
      }

      setTokenBalances(balances);
    } catch (error) {
      console.error('Error fetching token balances:', error);
    }
  };

  // Fetch balances on mount and when address changes
  useEffect(() => {
    fetchTokenBalances();
  }, [publicClient, address]);

  // Refetch balances after successful transaction
  useEffect(() => {
    if (isConfirmed) {
      setTimeout(() => {
        fetchTokenBalances();
        fetchEloquraPairs();
      }, 1000);
    }
  }, [isConfirmed]);

  // Sepolia testnet tokens for liquidity
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
      address: "0x0000000000000000000000000000000000000000",
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

  // Custom token resolved from pasted address
  const [customToken, setCustomToken] = useState<Token | null>(null);
  const [isResolvingToken, setIsResolvingToken] = useState(false);

  // Resolve custom token when user pastes an address
  useEffect(() => {
    const query = tokenSearchQuery.trim();
    if (!query.match(/^0x[a-fA-F0-9]{40}$/) || !publicClient) {
      setCustomToken(null);
      return;
    }
    // Check if address already in list
    const existing = sepoliaTokens.find(t => t.address.toLowerCase() === query.toLowerCase());
    if (existing) {
      setCustomToken(null);
      return;
    }
    // Resolve on-chain
    setIsResolvingToken(true);
    (async () => {
      try {
        const [symbol, name, decimals] = await Promise.all([
          publicClient.readContract({ address: query as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' }) as Promise<string>,
          publicClient.readContract({ address: query as `0x${string}`, abi: ERC20_ABI, functionName: 'name' }) as Promise<string>,
          publicClient.readContract({ address: query as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' }) as Promise<number>,
        ]);
        let balance = 0;
        if (address) {
          const raw = await publicClient.readContract({
            address: query as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address],
          }) as bigint;
          balance = parseFloat(formatUnits(raw, Number(decimals)));
        }
        setCustomToken({
          symbol,
          name,
          address: query,
          decimals: Number(decimals),
          logo: "",
          price: 0,
          balance,
        });
      } catch {
        setCustomToken(null);
      } finally {
        setIsResolvingToken(false);
      }
    })();
  }, [tokenSearchQuery, publicClient, address]);

  // Add balances to tokens (computed early so getTokenInfo can use it)
  const availableTokens = sepoliaTokens.map(token => {
    const balance = tokenBalances[token.address] ?? 0n;
    return {
      ...token,
      balance: parseFloat(formatUnits(balance, token.decimals)),
    };
  });

  // Helper to get token info from address (uses availableTokens which includes balances)
  const getTokenInfo = (tokenAddress: string): Token => {
    const found = availableTokens.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
    if (found) return found;
    // Return placeholder for unknown tokens
    return {
      symbol: tokenAddress.slice(0, 6) + "...",
      name: "Unknown Token",
      address: tokenAddress,
      decimals: 18,
      logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
      price: 0,
    };
  };

  // Helper: estimate USD value for a token amount using known stablecoin prices
  const estimateTokenUsd = (token: Token, amount: number, allPairs: typeof eloquraPairs): number => {
    const addr = token.address.toLowerCase();
    const stablecoins = [
      "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238", // USDC
      "0x3e622317f8c93f7328350cf0b56d9ed4c620c5d6", // DAI
    ];
    // If token is a stablecoin, 1:1 with USD
    if (stablecoins.includes(addr)) return amount;
    // Try to find a pair with a stablecoin to derive price
    for (const pair of allPairs) {
      const t0 = pair.token0.toLowerCase();
      const t1 = pair.token1.toLowerCase();
      if ((t0 === addr && stablecoins.includes(t1)) || (t1 === addr && stablecoins.includes(t0))) {
        const isToken0 = t0 === addr;
        const stableInfo = getTokenInfo(isToken0 ? pair.token1 : pair.token0);
        const tokenReserve = parseFloat(formatUnits(isToken0 ? pair.reserve0 : pair.reserve1, token.decimals));
        const stableReserve = parseFloat(formatUnits(isToken0 ? pair.reserve1 : pair.reserve0, stableInfo.decimals));
        if (tokenReserve > 0) {
          return amount * (stableReserve / tokenReserve);
        }
      }
    }
    // Try WETH path: token -> WETH pair, then WETH -> stablecoin pair
    const wethAddr = ELOQURA_CONTRACTS.sepolia.WETH.toLowerCase();
    for (const pair of allPairs) {
      const t0 = pair.token0.toLowerCase();
      const t1 = pair.token1.toLowerCase();
      if ((t0 === addr && t1 === wethAddr) || (t1 === addr && t0 === wethAddr)) {
        const isToken0 = t0 === addr;
        const tokenReserve = parseFloat(formatUnits(isToken0 ? pair.reserve0 : pair.reserve1, token.decimals));
        const wethReserve = parseFloat(formatUnits(isToken0 ? pair.reserve1 : pair.reserve0, 18));
        if (tokenReserve > 0) {
          const amountInWeth = amount * (wethReserve / tokenReserve);
          const wethToken = getTokenInfo(ELOQURA_CONTRACTS.sepolia.WETH);
          const wethUsd = estimateTokenUsd(wethToken, amountInWeth, allPairs);
          if (wethUsd > 0) return wethUsd;
        }
      }
    }
    return 0;
  };

  // Convert Eloqura pairs to Position format for display
  const positions: Position[] = eloquraPairs
    .filter(pair => pair.lpBalance > 0n) // Only show pairs where user has LP tokens
    .map((pair) => {
      const token0Info = getTokenInfo(pair.token0);
      const token1Info = getTokenInfo(pair.token1);
      const lpBalanceFormatted = parseFloat(formatUnits(pair.lpBalance, 18));
      const totalSupply = parseFloat(formatUnits(pair.totalSupply, 18));
      const sharePercent = totalSupply > 0 ? lpBalanceFormatted / totalSupply : 0;
      const reserve0 = parseFloat(formatUnits(pair.reserve0, token0Info.decimals));
      const reserve1 = parseFloat(formatUnits(pair.reserve1, token1Info.decimals));

      // User's share of each token in the pool
      const userToken0 = reserve0 * sharePercent;
      const userToken1 = reserve1 * sharePercent;

      // Calculate USD value of user's share
      // First try to price each token independently
      let usd0 = estimateTokenUsd(token0Info, userToken0, eloquraPairs);
      let usd1 = estimateTokenUsd(token1Info, userToken1, eloquraPairs);

      // If only one side is priced, derive the other from the pair's reserves
      // In a V2 AMM, both sides are always equal USD value, so the unpriced side = priced side
      if (usd0 > 0 && usd1 === 0) {
        usd1 = usd0; // Equal value on both sides
      } else if (usd1 > 0 && usd0 === 0) {
        usd0 = usd1; // Equal value on both sides
      }
      const totalValue = usd0 + usd1;

      // Current price: price of token0 in terms of token1
      const currentPrice = reserve0 > 0 ? reserve1 / reserve0 : 0;

      return {
        id: pair.address,
        token0: token0Info,
        token1: token1Info,
        liquidity: `${userToken0}|${userToken1}|${token0Info.symbol}|${token1Info.symbol}`,
        fee: 0.3,
        minPrice: 0, // V2 = full range
        maxPrice: 0, // V2 = full range (displayed as "Full Range")
        currentPrice,
        uncollectedFees0: "0",
        uncollectedFees1: "0",
        value: totalValue,
        status: 'in-range' as const, // V2 pools are always in range
      };
    });

  const feeOptions = [
    { value: 0.05, label: "0.05%", description: "Best for stablecoin pairs" },
    { value: 0.25, label: "0.25%", description: "Best for most pairs" },
    { value: 0.5, label: "0.5%", description: "Best for exotic pairs" },
    { value: 1.0, label: "1.0%", description: "Best for very exotic pairs" }
  ];

  // Fetch Live Coin Watch data from database
  const { data: liveCoinWatchData, isLoading: isLiveCoinWatchLoading } = useQuery<{coins: LiveCoinWatchDbCoin[]}>({
    queryKey: ["/api/live-coin-watch/coins"],
    refetchInterval: 15 * 1000, // Refresh every 15 seconds for real-time data
  });

  // Transform Live Coin Watch data into the format expected by the UI
  const tokens = liveCoinWatchData?.coins?.map((coin: LiveCoinWatchDbCoin) => {
    const formatted = formatCryptoData(coin);

    return {
      id: coin.code,
      name: formatted.cleanName,
      symbol: formatted.cleanCode,
      logo: formatted.logo,
      price: coin.rate,
      change24h: coin.deltaDay ? (coin.deltaDay - 1) * 100 : 0,
      marketCap: coin.cap || 0,
      volume24h: coin.volume || 0,
      holders: Math.floor(Math.random() * 100000), // Mock holder data since not available in Live Coin Watch
    };
  }) || [];

  // Mock pool data for pools view
  const mockPools = [
    {
      id: 1,
      tokenA: { symbol: "USDT", name: "Tether USD", logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png" },
      tokenB: { symbol: "BNB", name: "Binance Coin", logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png" },
      fee: "0.05%",
      volume24h: "$2.4M",
      volume7d: "$18.2M",
      tvl: "$8.9M",
      apr: "12.4%",
      priceChange24h: 2.1,
      network: "BSC"
    },
    {
      id: 2,
      tokenA: { symbol: "OEC", name: "Oeconomia", logo: "https://pub-37d61a7eb7ae45898b46702664710cb2.r2.dev/images/OEC%20Logo%20Square.png" },
      tokenB: { symbol: "USDT", name: "Tether USD", logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png" },
      fee: "0.30%",
      volume24h: "$567K",
      volume7d: "$4.2M",
      tvl: "$2.1M",
      apr: "24.8%",
      priceChange24h: -1.3,
      network: "BSC"
    },
    {
      id: 3,
      tokenA: { symbol: "WBNB", name: "Wrapped BNB", logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png" },
      tokenB: { symbol: "BUSD", name: "Binance USD", logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/4687.png" },
      fee: "0.25%",
      volume24h: "$1.8M",
      volume7d: "$12.6M",
      tvl: "$5.4M",
      apr: "18.7%",
      priceChange24h: 0.8,
      network: "BSC"
    },
    {
      id: 4,
      tokenA: { symbol: "CAKE", name: "PancakeSwap", logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/7186.png" },
      tokenB: { symbol: "WBNB", name: "Wrapped BNB", logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png" },
      fee: "0.25%",
      volume24h: "$890K",
      volume7d: "$6.8M",
      tvl: "$3.2M",
      apr: "31.2%",
      priceChange24h: 5.6,
      network: "BSC"
    },
    {
      id: 5,
      tokenA: { symbol: "ETH", name: "Ethereum", logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png" },
      tokenB: { symbol: "USDT", name: "Tether USD", logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png" },
      fee: "0.05%",
      volume24h: "$3.1M",
      volume7d: "$21.4M",
      tvl: "$12.8M",
      apr: "8.9%",
      priceChange24h: 1.4,
      network: "BSC"
    },
    {
      id: 6,
      tokenA: { symbol: "BTCB", name: "Bitcoin BEP20", logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1.png" },
      tokenB: { symbol: "BNB", name: "Binance Coin", logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png" },
      fee: "0.25%",
      volume24h: "$1.2M",
      volume7d: "$8.7M",
      tvl: "$6.3M",
      apr: "15.2%",
      priceChange24h: 3.4,
      network: "BSC"
    },
    {
      id: 7,
      tokenA: { symbol: "ADA", name: "Cardano", logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/2010.png" },
      tokenB: { symbol: "USDC", name: "USD Coin", logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png" },
      fee: "0.30%",
      volume24h: "$445K",
      volume7d: "$3.1M",
      tvl: "$1.8M",
      apr: "28.5%",
      priceChange24h: -2.1,
      network: "BSC"
    },
    {
      id: 8,
      tokenA: { symbol: "DOT", name: "Polkadot", logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/6636.png" },
      tokenB: { symbol: "BNB", name: "Binance Coin", logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png" },
      fee: "0.25%",
      volume24h: "$678K",
      volume7d: "$4.9M",
      tvl: "$2.7M",
      apr: "22.1%",
      priceChange24h: 1.8,
      network: "BSC"
    },
    {
      id: 9,
      tokenA: { symbol: "LINK", name: "Chainlink", logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1975.png" },
      tokenB: { symbol: "ETH", name: "Ethereum", logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png" },
      fee: "0.30%",
      volume24h: "$523K",
      volume7d: "$3.8M",
      tvl: "$2.2M",
      apr: "26.7%",
      priceChange24h: 4.2,
      network: "BSC"
    },
    {
      id: 10,
      tokenA: { symbol: "UNI", name: "Uniswap", logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/7083.png" },
      tokenB: { symbol: "USDT", name: "Tether USD", logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png" },
      fee: "0.25%",
      volume24h: "$389K",
      volume7d: "$2.6M",
      tvl: "$1.9M",
      apr: "19.8%",
      priceChange24h: -0.7,
      network: "BSC"
    }
  ];

  // Sort pools data  
  const sortedPools = [...mockPools].sort((a, b) => {
    if (!poolsSortField) return 0;

    let aValue: any = a;
    let bValue: any = b;

    // Handle nested properties
    const fieldParts = poolsSortField.split('.');
    for (const part of fieldParts) {
      aValue = aValue?.[part];
      bValue = bValue?.[part];
    }

    // Handle different data types
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      // Remove currency symbols and convert to numbers for volume/TVL
      if (aValue.includes('$') || aValue.includes('%')) {
        aValue = parseFloat(aValue.replace(/[$%,]/g, ''));
        bValue = parseFloat(bValue.replace(/[$%,]/g, ''));
      } else {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
    }

    if (poolsSortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Sort tokens data
  const sortedTokens = [...tokens].sort((a, b) => {
    if (!tokensSortField || !a || !b) {
      // Default fallback: sort by market cap descending (largest first)
      return (b.marketCap || 0) - (a.marketCap || 0);
    }

    let aValue: any = a[tokensSortField as keyof typeof a];
    let bValue: any = b[tokensSortField as keyof typeof b];

    // Handle string sorting
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (tokensSortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const filteredPools = sortedPools.filter(pool => 
    pool.tokenA.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pool.tokenB.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pool.tokenA.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pool.tokenB.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTokens = sortedTokens.filter(token =>
    token && (
      token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      token.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const timeframes = [
    { key: "1H", label: "1H" },
    { key: "1D", label: "1D" },
    { key: "1W", label: "1W" },
    { key: "1M", label: "1M" }
  ];

  const formatNumber = (num: number, decimals: number = 2) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  };

  const formatPrice = (price: number) => {
    return `$${formatNumber(price, 2)}`;
  };

  const calculateTotalValue = () => {
    return positions.reduce((total, position) => total + position.value, 0);
  };

  const calculateTotalFees = () => {
    return positions.reduce((total, position) => {
      const fees0Value = parseFloat(position.uncollectedFees0) * position.token0.price;
      const fees1Value = parseFloat(position.uncollectedFees1) * position.token1.price;
      return total + fees0Value + fees1Value;
    }, 0);
  };

  const togglePositionExpansion = (positionId: string) => {
    const newExpanded = new Set(expandedPositions);
    if (newExpanded.has(positionId)) {
      newExpanded.delete(positionId);
    } else {
      newExpanded.add(positionId);
    }
    setExpandedPositions(newExpanded);
  };

  const selectToken = (token: Token) => {
    if (tokenSelectionFor === 'token0') {
      setSelectedToken0(token);
    } else if (tokenSelectionFor === 'token1') {
      setSelectedToken1(token);
    }
    setIsTokenModalOpen(false);
    setTokenSearchQuery("");
  };

  // Filter tokens based on search query (symbol, name, or address)
  const filteredAvailableTokens = availableTokens.filter(token =>
    token.symbol.toLowerCase().includes(tokenSearchQuery.toLowerCase()) ||
    token.name.toLowerCase().includes(tokenSearchQuery.toLowerCase()) ||
    token.address.toLowerCase().includes(tokenSearchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">

          {/* Navigation Tabs */}
          <div className="mb-6">
            <div className="grid w-auto grid-cols-3 bg-gray-800 border border-gray-700 rounded-lg p-1">
              <Button
                variant={activeView === 'pools' ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveView('pools')}
                className={
                  activeView === 'pools'
                    ? "bg-crypto-blue hover:bg-crypto-blue/80 text-white px-6 py-3 rounded-md"
                    : "text-gray-400 hover:text-white px-6 py-3 rounded-md hover:bg-gray-700/50"
                }
              >
                Examine
              </Button>
              <Button
                variant={activeView === 'positions' ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveView('positions')}
                className={
                  activeView === 'positions'
                    ? "bg-crypto-blue hover:bg-crypto-blue/80 text-white px-6 py-3 rounded-md"
                    : "text-gray-400 hover:text-white px-6 py-3 rounded-md hover:bg-gray-700/50"
                }
              >
                My Positions
              </Button>
              <Button
                variant={activeView === 'create' ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveView('create')}
                className={
                  activeView === 'create'
                    ? "bg-crypto-blue hover:bg-crypto-blue/80 text-white px-6 py-3 rounded-md"
                    : "text-gray-400 hover:text-white px-6 py-3 rounded-md hover:bg-gray-700/50"
                }
              >
                Create Position
              </Button>
            </div>
          </div>

          {/* Positions View */}
          {activeView === 'positions' && (
            <div className="space-y-6">
              {/* Portfolio Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="crypto-card border">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Total Liquidity</p>
                        <p className="text-2xl font-bold text-white">{formatPrice(calculateTotalValue())}</p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center">
                        <Droplets className="w-6 h-6 text-cyan-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="crypto-card border">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Uncollected Fees</p>
                        <p className="text-2xl font-bold text-white">{formatPrice(calculateTotalFees())}</p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-green-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="crypto-card border">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Active Positions</p>
                        <p className="text-2xl font-bold text-white">{positions.length}</p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg flex items-center justify-center">
                        <Star className="w-6 h-6 text-purple-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Positions List */}
              <Card className="crypto-card border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white">Your Positions</CardTitle>
                    <Button
                      onClick={() => setLocation('/swap')}
                      variant="outline"
                      size="sm"
                      className="border-crypto-border text-crypto-blue hover:bg-crypto-blue/10"
                    >
                      <ArrowLeftRight className="w-4 h-4 mr-2" />
                      Go to Swap
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-0.5">
                  {positions.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gradient-to-r from-crypto-blue/20 to-crypto-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Droplets className="w-8 h-8 text-crypto-blue" />
                      </div>
                      <h3 className="text-xl font-semibold text-white mb-2">No Eloqura LP Positions</h3>
                      <p className="text-gray-400 mb-2">You don't have any liquidity positions on Eloqura DEX yet.</p>
                      <p className="text-gray-500 text-sm mb-6">Add liquidity to earn 0.3% fees on every swap!</p>
                      <Button
                        onClick={() => setActiveView('create')}
                        className="bg-gradient-to-r from-crypto-blue to-crypto-green hover:opacity-90"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Liquidity
                      </Button>
                    </div>
                  ) : (
                    positions.map((position) => {
                      const isExpanded = expandedPositions.has(position.id);
                      return (
                        <div key={position.id} className="bg-[var(--crypto-dark)] border border-[var(--crypto-border)] rounded-lg overflow-hidden">
                          {/* Collapsed Header */}
                          <div 
                            className="p-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
                            onClick={() => togglePositionExpansion(position.id)}
                          >
                            <div className="grid items-center gap-1" style={{ gridTemplateColumns: '1fr 110px 24px 190px 32px 70px auto 28px' }}>
                              {/* Token Pair & Status */}
                              <div className="flex items-center space-x-4">
                                <div className="flex items-center -space-x-2">
                                  <img
                                    src={position.token0.logo}
                                    alt={position.token0.symbol}
                                    className="w-8 h-8 rounded-full border-2 border-[var(--crypto-card)]"
                                  />
                                  <img
                                    src={position.token1.logo}
                                    alt={position.token1.symbol}
                                    className="w-8 h-8 rounded-full border-2 border-[var(--crypto-card)]"
                                  />
                                </div>
                                <div className="flex items-center space-x-3">
                                  <h3 className="text-white font-semibold min-w-[100px]">
                                    {position.token0.symbol}/{position.token1.symbol}
                                  </h3>
                                  <Badge className={`text-xs ${position.status === 'in-range' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {position.status === 'in-range' ? 'In Range' : 'Out of Range'}
                                  </Badge>
                                </div>
                              </div>

                              {/* Uncollected Fees */}
                              <div className="text-center">
                                <p className="text-green-400 font-semibold">
                                  {formatPrice(parseFloat(position.uncollectedFees0) * position.token0.price + parseFloat(position.uncollectedFees1) * position.token1.price)}
                                </p>
                                <p className="text-xs text-gray-400">Uncollected Fees</p>
                              </div>

                              {/* Spacer */}
                              <div />

                              {/* Value & Breakdown */}
                              <div className="text-center">
                                <p className="text-white font-semibold">{formatPrice(position.value)}</p>
                                <p className="text-xs text-gray-400">
                                  {(() => {
                                    const parts = position.liquidity.split('|');
                                    if (parts.length === 4) {
                                      return `${formatNumber(parseFloat(parts[0]), 2)} ${parts[2]} + ${formatNumber(parseFloat(parts[1]), 2)} ${parts[3]}`;
                                    }
                                    return position.liquidity;
                                  })()}
                                </p>
                              </div>

                              {/* External Link */}
                              <div className="flex justify-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-gray-400 hover:text-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`https://sepolia.etherscan.io/address/${position.id}`, '_blank');
                                  }}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              </div>

                              {/* Fee Tier */}
                              <div className="text-center">
                                <p className="text-cyan-400 font-semibold">
                                  {position.fee}%
                                </p>
                                <p className="text-xs text-gray-400">Fee Tier</p>
                              </div>

                              {/* Collect Fees */}
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Handle collect fees
                                }}
                              >
                                Collect Fees
                              </Button>

                              {/* Expand/Collapse */}
                              <div className="flex justify-center">
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-gray-400" />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="border-t border-[var(--crypto-border)] p-4 bg-gray-900/20">
                              <div className="grid grid-cols-3 gap-6 mb-4">
                                <div>
                                  <p className="text-xs text-gray-400 mb-1">Price Range</p>
                                  <p className="text-lg font-bold text-white">Full Range</p>
                                  <p className="text-xs text-gray-500">0 ↔ ∞</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 mb-1">Current Price</p>
                                  {(() => {
                                    const isReversed = reversedPricePositions.has(position.id);
                                    const price = isReversed && position.currentPrice > 0
                                      ? 1 / position.currentPrice
                                      : position.currentPrice;
                                    const baseSymbol = isReversed ? position.token0.symbol : position.token1.symbol;
                                    const quoteSymbol = isReversed ? position.token1.symbol : position.token0.symbol;
                                    return (
                                      <>
                                        <p className="text-lg font-bold text-white">
                                          {price < 0.001
                                            ? price.toExponential(4)
                                            : formatNumber(price, 6)}
                                        </p>
                                        <button
                                          className="text-xs text-gray-500 hover:text-cyan-400 transition-colors cursor-pointer flex items-center gap-1"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setReversedPricePositions(prev => {
                                              const next = new Set(prev);
                                              if (next.has(position.id)) {
                                                next.delete(position.id);
                                              } else {
                                                next.add(position.id);
                                              }
                                              return next;
                                            });
                                          }}
                                          title="Click to toggle price direction"
                                        >
                                          {baseSymbol} per {quoteSymbol} <ArrowLeftRight className="w-3 h-3 inline" />
                                        </button>
                                      </>
                                    );
                                  })()}
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 mb-1">Your Pool Share</p>
                                  <p className="text-lg font-bold text-white">
                                    {(() => {
                                      const pair = eloquraPairs.find(p => p.address === position.id);
                                      if (!pair) return "0%";
                                      const lp = parseFloat(formatUnits(pair.lpBalance, 18));
                                      const total = parseFloat(formatUnits(pair.totalSupply, 18));
                                      return total > 0 ? `${formatNumber((lp / total) * 100, 2)}%` : "0%";
                                    })()}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center space-x-3">
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="border-crypto-blue/30 text-crypto-blue hover:bg-crypto-blue/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPositionForAddition(position);
                                    setShowAddModal(true);
                                  }}
                                >
                                  Add Liquidity
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="border-gray-600 text-gray-400 hover:bg-gray-600/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPositionForRemoval(position);
                                    setNeedsLPApproval(false);
                                    setRemovalPercentage(25);
                                    setShowRemoveModal(true);
                                  }}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Create Position View */}
          {activeView === 'create' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Create Interface */}
              <div className="lg:col-span-2">
                <Card className="crypto-card border">
                  <CardHeader>
                    <CardTitle className="text-white">Create a New Position</CardTitle>
                    <p className="text-gray-400">Select a fee tier and price range to provide liquidity</p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Token Pair Selection */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-white">Select Pair</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-gray-400 mb-2 block">Token 1</label>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setTokenSelectionFor('token0');
                              setIsTokenModalOpen(true);
                            }}
                            className="w-full bg-[var(--crypto-dark)] border-[var(--crypto-border)] text-white hover:bg-[var(--crypto-card)] justify-start h-12"
                          >
                            {selectedToken0 ? (
                              <div className="flex items-center space-x-2">
                                <img src={selectedToken0.logo} alt={selectedToken0.symbol} className="w-6 h-6 rounded-full" />
                                <span>{selectedToken0.symbol}</span>
                                <span className="text-gray-400 text-sm">- {selectedToken0.name}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400">Select token</span>
                            )}
                          </Button>
                        </div>
                        <div>
                          <label className="text-sm text-gray-400 mb-2 block">Token 2</label>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setTokenSelectionFor('token1');
                              setIsTokenModalOpen(true);
                            }}
                            className="w-full bg-[var(--crypto-dark)] border-[var(--crypto-border)] text-white hover:bg-[var(--crypto-card)] justify-start h-12"
                          >
                            {selectedToken1 ? (
                              <div className="flex items-center space-x-2">
                                <img src={selectedToken1.logo} alt={selectedToken1.symbol} className="w-6 h-6 rounded-full" />
                                <span>{selectedToken1.symbol}</span>
                                <span className="text-gray-400 text-sm">- {selectedToken1.name}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400">Select token</span>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Fee Tier Selection */}
                    {selectedToken0 && selectedToken1 && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white">Select Fee Tier</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {feeOptions.map((option) => (
                            <Button
                              key={option.value}
                              variant={selectedFee === option.value ? "default" : "outline"}
                              onClick={() => setSelectedFee(option.value)}
                              className={`h-auto p-4 flex flex-col items-center space-y-2 ${
                                selectedFee === option.value
                                  ? "bg-crypto-blue hover:bg-crypto-blue/80 text-white border-crypto-blue"
                                  : "border-[var(--crypto-border)] text-gray-400 hover:text-white hover:border-crypto-blue/50"
                              }`}
                            >
                              <span className="font-semibold">{option.label}</span>
                              <span className="text-xs opacity-80 text-center">{option.description}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Price Range */}
                    {selectedToken0 && selectedToken1 && selectedFee && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-white">Set Price Range</h3>
                          <div className="flex items-center space-x-2 text-sm text-gray-400">
                            <span>Current Price:</span>
                            <span className="text-white font-medium">
                              {formatNumber(selectedToken1.price / selectedToken0.price, 6)} {selectedToken1.symbol}
                            </span>
                          </div>
                        </div>

                        {/* Full Range / Set Range Toggle */}
                        <div className="grid grid-cols-2 gap-2 bg-gray-800 border border-gray-700 rounded-lg p-1">
                          <Button
                            variant={isFullRange ? "default" : "ghost"}
                            size="sm"
                            onClick={() => {
                              setIsFullRange(true);
                              setMinPrice("");
                              setMaxPrice("");
                            }}
                            className={
                              isFullRange
                                ? "bg-crypto-blue hover:bg-crypto-blue/80 text-white px-4 py-2 rounded-md"
                                : "text-gray-400 hover:text-white px-4 py-2 rounded-md hover:bg-gray-700/50"
                            }
                          >
                            Full Range
                          </Button>
                          <Button
                            variant={!isFullRange ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setIsFullRange(false)}
                            className={
                              !isFullRange
                                ? "bg-crypto-blue hover:bg-crypto-blue/80 text-white px-4 py-2 rounded-md"
                                : "text-gray-400 hover:text-white px-4 py-2 rounded-md hover:bg-gray-700/50"
                            }
                          >
                            Set Range
                          </Button>
                        </div>

                        {isFullRange ? (
                          <div className="bg-[var(--crypto-dark)] rounded-lg p-4 border border-[var(--crypto-border)]">
                            <div className="flex items-center justify-center space-x-3 text-gray-300">
                              <span className="text-lg font-medium">0</span>
                              <ArrowLeftRight className="w-5 h-5 text-gray-500" />
                              <span className="text-lg font-medium">&infin;</span>
                            </div>
                            <p className="text-center text-xs text-gray-400 mt-2">
                              Full range positions earn fees on all trades but may experience more impermanent loss.
                            </p>
                          </div>
                        ) : (
                          <div className="bg-[var(--crypto-dark)] rounded-lg p-4 border border-[var(--crypto-border)]">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm text-gray-400 mb-2 block">Min Price</label>
                                <Input
                                  type="number"
                                  value={minPrice}
                                  onChange={(e) => setMinPrice(e.target.value)}
                                  placeholder="0.0"
                                  className="bg-transparent border-0 text-white text-xl focus:ring-0 focus:border-0 focus:outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                  {selectedToken1.symbol} per {selectedToken0.symbol}
                                </p>
                              </div>
                              <div>
                                <label className="text-sm text-gray-400 mb-2 block">Max Price</label>
                                <Input
                                  type="number"
                                  value={maxPrice}
                                  onChange={(e) => setMaxPrice(e.target.value)}
                                  placeholder="0.0"
                                  className="bg-transparent border-0 text-white text-xl focus:ring-0 focus:border-0 focus:outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                  {selectedToken1.symbol} per {selectedToken0.symbol}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Deposit Amounts */}
                    {selectedToken0 && selectedToken1 && (isFullRange || (minPrice && maxPrice)) && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white">Deposit Amounts</h3>

                        <div className="space-y-3">
                          <div className="bg-[var(--crypto-dark)] rounded-lg p-4 border border-[var(--crypto-border)]">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-gray-400 text-sm">{selectedToken0.symbol}</span>
                              <span className="text-gray-400 text-sm">
                                Balance: {formatNumber(selectedToken0.balance || 0, 2)}
                              </span>
                            </div>
                            <div className="flex items-center space-x-3">
                              <Input
                                type="number"
                                value={amount0}
                                onChange={(e) => handleAmount0Change(e.target.value)}
                                placeholder="0.0"
                                className="flex-1 bg-transparent border-none text-white text-xl font-semibold"
                              />
                              <div className="flex items-center space-x-2">
                                <img src={selectedToken0.logo} alt={selectedToken0.symbol} className="w-6 h-6 rounded-full" />
                                <span className="text-white font-medium">{selectedToken0.symbol}</span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-[var(--crypto-dark)] rounded-lg p-4 border border-[var(--crypto-border)]">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-gray-400 text-sm">{selectedToken1.symbol}</span>
                              <span className="text-gray-400 text-sm">
                                Balance: {formatNumber(selectedToken1.balance || 0, 2)}
                              </span>
                            </div>
                            <div className="flex items-center space-x-3">
                              <Input
                                type="number"
                                value={amount1}
                                onChange={(e) => handleAmount1Change(e.target.value)}
                                placeholder="0.0"
                                className="flex-1 bg-transparent border-none text-white text-xl font-semibold"
                              />
                              <div className="flex items-center space-x-2">
                                <img src={selectedToken1.logo} alt={selectedToken1.symbol} className="w-6 h-6 rounded-full" />
                                <span className="text-white font-medium">{selectedToken1.symbol}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Create Position Button */}
                    {selectedToken0 && selectedToken1 && amount0 && amount1 && (
                      <div className="space-y-3">
                        {/* Token0 Approval Button */}
                        {needsApprovalToken0 && selectedToken0.symbol !== 'ETH' && (
                          <Button
                            onClick={() => handleApproveToken(0)}
                            disabled={isWritePending || isConfirming || isApproving || !isConnected}
                            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:opacity-90 disabled:opacity-50 py-6 text-lg"
                          >
                            {isWritePending && isApproving ? (
                              <div className="flex items-center space-x-2">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Approving {selectedToken0.symbol}...</span>
                              </div>
                            ) : (
                              `Approve ${selectedToken0.symbol}`
                            )}
                          </Button>
                        )}

                        {/* Token1 Approval Button */}
                        {!needsApprovalToken0 && needsApprovalToken1 && selectedToken1.symbol !== 'ETH' && (
                          <Button
                            onClick={() => handleApproveToken(1)}
                            disabled={isWritePending || isConfirming || isApproving || !isConnected}
                            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:opacity-90 disabled:opacity-50 py-6 text-lg"
                          >
                            {isWritePending && isApproving ? (
                              <div className="flex items-center space-x-2">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Approving {selectedToken1.symbol}...</span>
                              </div>
                            ) : (
                              `Approve ${selectedToken1.symbol}`
                            )}
                          </Button>
                        )}

                        {/* Add Liquidity Button - only show when both tokens are approved */}
                        {!needsApprovalToken0 && !needsApprovalToken1 && (
                          <Button
                            onClick={handleAddLiquidityEloqura}
                            disabled={isLoading || isWritePending || isConfirming || !isConnected}
                            className="w-full bg-gradient-to-r from-crypto-blue to-crypto-green hover:opacity-90 disabled:opacity-50 py-6 text-lg"
                          >
                            {isWritePending ? (
                              <div className="flex items-center space-x-2">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Confirm in Wallet...</span>
                              </div>
                            ) : isConfirming ? (
                              <div className="flex items-center space-x-2">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Adding Liquidity...</span>
                              </div>
                            ) : !isConnected ? (
                              "Connect Wallet"
                            ) : (
                              `Add Liquidity (${selectedToken0.symbol}/${selectedToken1.symbol})`
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Info Sidebar */}
              <div className="space-y-6">
                <Card className="crypto-card border">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center space-x-2">
                      <Info className="w-5 h-5" />
                      <span>Position Summary</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedToken0 && selectedToken1 ? (
                      <>
                        <div className="flex items-center space-x-3 p-3 bg-[var(--crypto-dark)] rounded-lg">
                          <div className="flex items-center -space-x-2">
                            <img src={selectedToken0.logo} alt={selectedToken0.symbol} className="w-8 h-8 rounded-full border-2 border-[var(--crypto-card)]" />
                            <img src={selectedToken1.logo} alt={selectedToken1.symbol} className="w-8 h-8 rounded-full border-2 border-[var(--crypto-card)]" />
                          </div>
                          <div>
                            <p className="font-semibold text-white">{selectedToken0.symbol}/{selectedToken1.symbol}</p>
                            <p className="text-sm text-gray-400">{selectedFee}% Fee Tier</p>
                          </div>
                        </div>

                        {amount0 && amount1 && (
                          <>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Est. Total Value</span>
                                <span className="text-white">
                                  {formatPrice((parseFloat(amount0) * selectedToken0.price) + (parseFloat(amount1) * selectedToken1.price))}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Network Fee</span>
                                <span className="text-white">~$2.50</span>
                              </div>
                            </div>

                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                              <div className="flex items-start space-x-2">
                                <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                                <div className="text-xs text-yellow-400">
                                  <p className="font-medium mb-1">Impermanent Loss Risk</p>
                                  <p>Your position may lose value if token prices diverge significantly.</p>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-400 text-sm">Select tokens to see position details</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="crypto-card border">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center space-x-2">
                      <Zap className="w-5 h-5" />
                      <span>Learn More</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button variant="ghost" className="w-full justify-start text-left text-gray-400 hover:text-white">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      <div>
                        <p className="font-medium">About Liquidity Pools</p>
                        <p className="text-xs opacity-80">Learn how AMMs work</p>
                      </div>
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-left text-gray-400 hover:text-white">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      <div>
                        <p className="font-medium">Fee Tier Guide</p>
                        <p className="text-xs opacity-80">Choose the right fee</p>
                      </div>
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-left text-gray-400 hover:text-white">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      <div>
                        <p className="font-medium">Impermanent Loss</p>
                        <p className="text-xs opacity-80">Understand the risks</p>
                      </div>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Pools View */}
          {activeView === 'pools' && (
            <div className="space-y-6">
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="crypto-card p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">24H Volume</span>
                    <TrendingUp className="w-4 h-4 text-crypto-green" />
                  </div>
                  <div className="text-2xl font-bold text-crypto-green">$8.7M</div>
                  <div className="text-crypto-green text-sm">+16.3%</div>
                </Card>

                <Card className="crypto-card p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Total TVL</span>
                    <TrendingUp className="w-4 h-4 text-crypto-blue" />
                  </div>
                  <div className="text-2xl font-bold text-crypto-blue">$32.4M</div>
                  <div className="text-crypto-green text-sm">+2.8%</div>
                </Card>

                <Card className="crypto-card p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Active Pools</span>
                    <div className="w-4 h-4 bg-crypto-purple rounded-full" />
                  </div>
                  <div className="text-2xl font-bold text-crypto-purple">1,247</div>
                  <div className="text-gray-400 text-sm">pools</div>
                </Card>

                <Card className="crypto-card p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Avg APR</span>
                    <TrendingUp className="w-4 h-4 text-crypto-green" />
                  </div>
                  <div className="text-2xl font-bold text-crypto-green">19.2%</div>
                  <div className="text-crypto-green text-sm">+0.4%</div>
                </Card>
              </div>

              {/* V2/V3 Toggle */}
              <div className="flex items-center space-x-2">
                <Button
                  variant={poolVersion === 'v3' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setPoolVersion('v3')}
                  className={poolVersion === 'v3' ? "bg-violet-600 hover:bg-violet-700 text-white px-4 py-1 rounded-md text-xs" : "text-gray-400 hover:text-white px-4 py-1 rounded-md text-xs hover:bg-gray-700/50"}
                >
                  V3
                </Button>
                <Button
                  variant={poolVersion === 'v2' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setPoolVersion('v2')}
                  className={poolVersion === 'v2' ? "bg-violet-600 hover:bg-violet-700 text-white px-4 py-1 rounded-md text-xs" : "text-gray-400 hover:text-white px-4 py-1 rounded-md text-xs hover:bg-gray-700/50"}
                >
                  V2
                </Button>
                {poolVersion === 'v2' && (
                  <span className="text-xs text-gray-500 ml-2">0.3% fixed fee</span>
                )}
              </div>

              {/* Navigation and Search */}
              <div className="flex justify-between items-center">
                <div className="grid w-auto grid-cols-2 bg-gray-800 border border-gray-700 rounded-lg p-1">
                  <Button 
                    variant={activeTab === 'pools' ? "default" : "ghost"} 
                    size="sm" 
                    className={activeTab === 'pools' ? "bg-crypto-blue hover:bg-crypto-blue/80 text-white px-6 py-2 rounded-md w-24" : "text-gray-400 hover:text-white px-6 py-2 rounded-md hover:bg-gray-700/50 w-24"}
                    onClick={() => setActiveTab('pools')}
                  >
                    Pools
                  </Button>
                  <Button 
                    variant={activeTab === 'tokens' ? "default" : "ghost"} 
                    size="sm" 
                    className={activeTab === 'tokens' ? "bg-crypto-blue hover:bg-crypto-blue/80 text-white px-6 py-2 rounded-md w-24" : "text-gray-400 hover:text-white px-6 py-2 rounded-md hover:bg-gray-700/50 w-24"}
                    onClick={() => setActiveTab('tokens')}
                  >
                    Tokens
                  </Button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder={activeTab === 'pools' ? "Search pools..." : "Search tokens..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-[#1a1b23] border-crypto-border text-white placeholder:text-gray-400 focus:ring-0 focus:ring-offset-0 focus:outline-none focus:border-crypto-border focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </div>

              {/* Tables Container */}
              {activeTab === 'pools' ? (
                <div>
                <div className="border rounded-lg overflow-hidden relative max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-hide">
                  <table className="w-full">
                    <thead className="sticky top-0 z-20 bg-[#1a1b23] border-b border-crypto-border">
                      <tr>
                        <th className="text-left py-4 px-6 font-medium text-gray-400 bg-[#1a1b23]">#</th>
                        <th className="text-left py-4 px-6 font-medium text-gray-400 bg-[#1a1b23]">
                          <button 
                            onClick={() => handlePoolsSort('tokenA.symbol')}
                            className="flex items-center space-x-1 hover:text-white transition-colors"
                          >
                            <span>Pool</span>
                            {getSortIcon('tokenA.symbol', poolsSortField, poolsSortDirection)}
                          </button>
                        </th>
                        <th className="text-left py-4 px-6 font-medium text-gray-400 bg-[#1a1b23]">
                          <button 
                            onClick={() => handlePoolsSort('fee')}
                            className="flex items-center space-x-1 hover:text-white transition-colors"
                          >
                            <span>Fee</span>
                            {getSortIcon('fee', poolsSortField, poolsSortDirection)}
                          </button>
                        </th>
                        <th className="text-left py-4 px-6 font-medium text-gray-400 bg-[#1a1b23]">
                          <button 
                            onClick={() => handlePoolsSort('volume24h')}
                            className="flex items-center space-x-1 hover:text-white transition-colors"
                          >
                            <span>24H Vol</span>
                            {getSortIcon('volume24h', poolsSortField, poolsSortDirection)}
                          </button>
                        </th>
                        <th className="text-left py-4 px-6 font-medium text-gray-400 bg-[#1a1b23]">
                          <button 
                            onClick={() => handlePoolsSort('volume7d')}
                            className="flex items-center space-x-1 hover:text-white transition-colors"
                          >
                            <span>7D Vol</span>
                            {getSortIcon('volume7d', poolsSortField, poolsSortDirection)}
                          </button>
                        </th>
                        <th className="text-left py-4 px-6 font-medium text-gray-400 bg-[#1a1b23]">
                          <button 
                            onClick={() => handlePoolsSort('tvl')}
                            className="flex items-center space-x-1 hover:text-white transition-colors"
                          >
                            <span>TVL</span>
                            {getSortIcon('tvl', poolsSortField, poolsSortDirection)}
                          </button>
                        </th>
                        <th className="text-left py-4 px-6 font-medium text-gray-400 bg-[#1a1b23]">
                          <button 
                            onClick={() => handlePoolsSort('apr')}
                            className="flex items-center space-x-1 hover:text-white transition-colors"
                          >
                            <span>APR</span>
                            {getSortIcon('apr', poolsSortField, poolsSortDirection)}
                          </button>
                        </th>
                        <th className="text-left py-4 px-6 font-medium text-gray-400 bg-[#1a1b23]">
                          <button 
                            onClick={() => handlePoolsSort('priceChange24h')}
                            className="flex items-center space-x-1 hover:text-white transition-colors"
                          >
                            <span>24H %</span>
                            {getSortIcon('priceChange24h', poolsSortField, poolsSortDirection)}
                          </button>
                        </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPools.map((pool, index) => (
                        <tr 
                          key={pool.id} 
                          className="border-b border-crypto-border hover:bg-gray-800/40 hover:border-crypto-blue/60 hover:shadow-lg transition-all duration-200 cursor-pointer group"
                          onClick={() => setActiveView('create')}
                        >
                          <td className="py-4 px-6">
                            <span className="text-gray-400 font-mono group-hover:text-white transition-colors duration-200">{index + 1}</span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-3">
                              <div className="flex items-center -space-x-2">
                                <img 
                                  src={pool.tokenA.logo} 
                                  alt={pool.tokenA.symbol}
                                  className="w-8 h-8 rounded-full z-10"
                                />
                                <img 
                                  src={pool.tokenB.logo} 
                                  alt={pool.tokenB.symbol}
                                  className="w-8 h-8 rounded-full"
                                />
                              </div>
                              <div>
                                <div className="font-medium group-hover:text-white transition-colors duration-200">
                                  {pool.tokenA.symbol}/{pool.tokenB.symbol}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <Badge variant="outline" className="border-crypto-border text-crypto-blue">
                              {pool.fee}
                            </Badge>
                          </td>
                          <td className="py-4 px-6 font-mono">{pool.volume24h}</td>
                          <td className="py-4 px-6 font-mono text-gray-400">{pool.volume7d}</td>
                          <td className="py-4 px-6 font-mono">{pool.tvl}</td>
                          <td className="py-4 px-6">
                            <span className="text-crypto-green font-medium">{pool.apr}</span>
                          </td>
                          <td className="py-4 px-6">
                            <div className={`flex items-center space-x-1 ${
                              pool.priceChange24h >= 0 ? 'text-crypto-green' : 'text-red-400'
                            }`}>
                              {pool.priceChange24h >= 0 ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                              <span className="font-medium">
                                {pool.priceChange24h >= 0 ? '+' : ''}{pool.priceChange24h}%
                              </span>
                            </div>
                          </td>

                        </tr>
                    ))}

                    {filteredPools.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-12">
                          <div className="text-gray-400 mb-2">No pools found</div>
                          <div className="text-sm text-gray-500">Try adjusting your search terms</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer Note */}
              <div className="text-center text-sm text-gray-500">
                <p>Pool data updates every 30 seconds • APR calculations include trading fees and liquidity mining rewards</p>
              </div>
              </div>
              ) : (
                <div>
                <div className="border rounded-lg overflow-hidden relative max-h-[700px] overflow-y-auto scrollbar-hide">
                  <table className="w-full">
                    <thead className="sticky top-0 z-20 bg-[#1a1b23] border-b border-crypto-border">
                      <tr>
                        <th className="text-left py-4 px-6 font-medium text-gray-400 bg-[#1a1b23]">#</th>
                        <th className="text-left py-4 px-6 font-medium text-gray-400 bg-[#1a1b23]">
                          <button 
                            onClick={() => handleTokensSort('symbol')}
                            className="flex items-center space-x-1 hover:text-white transition-colors"
                          >
                            <span>Token</span>
                            {getSortIcon('symbol', tokensSortField, tokensSortDirection)}
                          </button>
                        </th>
                        <th className="text-left py-4 px-6 font-medium text-gray-400 bg-[#1a1b23]">
                          <button 
                            onClick={() => handleTokensSort('price')}
                            className="flex items-center space-x-1 hover:text-white transition-colors"
                          >
                            <span>Price</span>
                            {getSortIcon('price', tokensSortField, tokensSortDirection)}
                          </button>
                        </th>
                        <th className="text-left py-4 px-6 font-medium text-gray-400 bg-[#1a1b23]">
                          <button 
                            onClick={() => handleTokensSort('change24h')}
                            className="flex items-center space-x-1 hover:text-white transition-colors"
                          >
                            <span>24H Change</span>
                            {getSortIcon('change24h', tokensSortField, tokensSortDirection)}
                          </button>
                        </th>
                        <th className="text-left py-4 px-6 font-medium text-gray-400 bg-[#1a1b23]">
                          <button 
                            onClick={() => handleTokensSort('volume24h')}
                            className="flex items-center space-x-1 hover:text-white transition-colors"
                          >
                            <span>24H Volume</span>
                            {getSortIcon('volume24h', tokensSortField, tokensSortDirection)}
                          </button>
                        </th>
                        <th className="text-left py-4 px-6 font-medium text-gray-400 bg-[#1a1b23]">
                          <button 
                            onClick={() => handleTokensSort('marketCap')}
                            className="flex items-center space-x-1 hover:text-white transition-colors"
                          >
                            <span>Market Cap</span>
                            {getSortIcon('marketCap', tokensSortField, tokensSortDirection)}
                          </button>
                        </th>
                        <th className="text-left py-4 px-6 font-medium text-gray-400 bg-[#1a1b23]">
                          <button 
                            onClick={() => handleTokensSort('holders')}
                            className="flex items-center space-x-1 hover:text-white transition-colors"
                          >
                            <span>Holders</span>
                            {getSortIcon('holders', tokensSortField, tokensSortDirection)}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTokens.map((token, index) => (
                        <tr key={token.id} className="border-b border-crypto-border hover:bg-gray-800/40 hover:border-crypto-green/60 hover:shadow-lg transition-all duration-200 cursor-pointer group"
                            onClick={() => setLocation(`/coin/${token.symbol}`)}>
                          <td className="py-4 px-6">
                            <span className="text-gray-400 font-mono group-hover:text-white transition-colors duration-200">{index + 1}</span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-3">
                              <img 
                                src={token.logo} 
                                alt={token.symbol}
                                className="w-8 h-8 rounded-full"
                                onError={(e) => {
                                  e.currentTarget.src = '/oec-logo.png';
                                }}
                              />
                              <div>
                                <div className="font-medium group-hover:text-white transition-colors duration-200">{token.symbol} <span className="text-sm text-gray-400 font-normal group-hover:text-gray-300">{token.name}</span></div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 font-mono">
                            ${token.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                          </td>
                          <td className="py-4 px-6">
                            <div className={`flex items-center space-x-1 ${
                              token.change24h >= 0 ? 'text-crypto-green' : 'text-red-400'
                            }`}>
                              {token.change24h >= 0 ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                              <span className="font-medium">
                                {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6 font-mono">
                            {token.volume24h > 0 ? `$${(token.volume24h / 1000000).toFixed(1)}M` : 'N/A'}
                          </td>
                          <td className="py-4 px-6 font-mono">
                            {token.marketCap > 0 ? (
                              token.marketCap > 1000000000 ? 
                                `$${(token.marketCap / 1000000000).toFixed(1)}B` : 
                                `$${(token.marketCap / 1000000).toFixed(0)}M`
                            ) : 'N/A'}
                          </td>
                          <td className="py-4 px-6 font-mono">
                            {token.holders.toLocaleString()}
                          </td>
                        </tr>
                      ))}

                      {filteredTokens.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-12">
                            <div className="text-gray-400 mb-2">No tokens found</div>
                            <div className="text-sm text-gray-500">Try adjusting your search terms</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer Note */}
                <div className="text-center text-sm text-gray-500">
                  <p>Token data updates every 30 seconds • Prices from BSC network via Moralis API</p>
                </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Remove Liquidity Modal */}
      <Dialog open={showRemoveModal} onOpenChange={setShowRemoveModal}>
        <DialogContent className="sm:max-w-md crypto-card border-crypto-border max-h-[90vh] overflow-y-auto scrollbar-hide">
          <DialogHeader>
            <DialogTitle className="text-white">Remove Liquidity</DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedPositionForRemoval && (
                <>Remove liquidity from {selectedPositionForRemoval.token0.symbol}/{selectedPositionForRemoval.token1.symbol} pool</>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedPositionForRemoval && (
            <div className="space-y-6">
              {/* Amount Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-400">Amount to remove</label>
                  <span className="text-lg font-semibold text-white">{removalPercentage}%</span>
                </div>

                <Slider
                  value={[removalPercentage]}
                  onValueChange={(value) => setRemovalPercentage(value[0])}
                  max={100}
                  min={1}
                  step={1}
                  className="w-full"
                />

                <div className="grid grid-cols-4 gap-2">
                  {[25, 50, 75, 100].map((percent) => (
                    <Button
                      key={percent}
                      size="sm"
                      variant={removalPercentage === percent ? "default" : "outline"}
                      onClick={() => setRemovalPercentage(percent)}
                      className={removalPercentage === percent 
                        ? "bg-crypto-blue hover:bg-crypto-blue/80" 
                        : "border-crypto-border text-gray-400 hover:text-white"
                      }
                    >
                      {percent}%
                    </Button>
                  ))}
                </div>
              </div>

              {/* Position Summary */}
              <div className="bg-[var(--crypto-dark)] rounded-lg p-4 border border-[var(--crypto-border)]">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="flex items-center -space-x-2">
                    <img 
                      src={selectedPositionForRemoval.token0.logo} 
                      alt={selectedPositionForRemoval.token0.symbol}
                      className="w-8 h-8 rounded-full border-2 border-[var(--crypto-card)]"
                    />
                    <img 
                      src={selectedPositionForRemoval.token1.logo} 
                      alt={selectedPositionForRemoval.token1.symbol}
                      className="w-8 h-8 rounded-full border-2 border-[var(--crypto-card)]"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">
                      {selectedPositionForRemoval.token0.symbol}/{selectedPositionForRemoval.token1.symbol}
                    </h3>
                    <p className="text-sm text-gray-400">{selectedPositionForRemoval.fee}% Fee Tier</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {(() => {
                    // Calculate actual token amounts based on pool share
                    const pair = eloquraPairs.find(p => p.address === selectedPositionForRemoval.id);
                    if (!pair) return null;

                    const lpBalance = parseFloat(formatUnits(pair.lpBalance, 18));
                    const totalSupply = parseFloat(formatUnits(pair.totalSupply, 18));
                    const reserve0 = parseFloat(formatUnits(pair.reserve0, selectedPositionForRemoval.token0.decimals));
                    const reserve1 = parseFloat(formatUnits(pair.reserve1, selectedPositionForRemoval.token1.decimals));

                    // User's share of the pool
                    const sharePercent = totalSupply > 0 ? lpBalance / totalSupply : 0;

                    // Estimated token amounts for removal
                    const estimatedToken0 = reserve0 * sharePercent * (removalPercentage / 100);
                    const estimatedToken1 = reserve1 * sharePercent * (removalPercentage / 100);
                    const lpToRemove = lpBalance * (removalPercentage / 100);

                    return (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Pool Share</span>
                          <span className="text-white">{(sharePercent * 100).toFixed(4)}%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">LP Tokens to Remove</span>
                          <span className="text-white">{formatNumber(lpToRemove, 6)} LP</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Estimated {selectedPositionForRemoval.token0.symbol}</span>
                          <span className="text-white">
                            {formatNumber(estimatedToken0, 6)} {selectedPositionForRemoval.token0.symbol}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Estimated {selectedPositionForRemoval.token1.symbol}</span>
                          <span className="text-white">
                            {formatNumber(estimatedToken1, 6)} {selectedPositionForRemoval.token1.symbol}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Uncollected Fees Warning */}
              {(parseFloat(selectedPositionForRemoval.uncollectedFees0) > 0 || parseFloat(selectedPositionForRemoval.uncollectedFees1) > 0) && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-yellow-400">
                      <p className="font-medium mb-1">Uncollected Fees</p>
                      <p>You have {formatPrice(parseFloat(selectedPositionForRemoval.uncollectedFees0) * selectedPositionForRemoval.token0.price + parseFloat(selectedPositionForRemoval.uncollectedFees1) * selectedPositionForRemoval.token1.price)} in uncollected fees. Consider collecting them first.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowRemoveModal(false)}
                  className="flex-1 border-crypto-border text-gray-400 hover:text-white"
                >
                  Cancel
                </Button>
                {needsLPApproval ? (
                  <Button
                    onClick={() => {
                      if (selectedPositionForRemoval) {
                        handleApproveLPToken(selectedPositionForRemoval.id);
                      }
                    }}
                    disabled={isWritePending || isConfirming || isApprovingLP}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white"
                  >
                    {isWritePending || isApprovingLP ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Approving...</span>
                      </div>
                    ) : (
                      "Approve LP Token"
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      if (selectedPositionForRemoval) {
                        // Find the pair data to get token addresses
                        const pair = eloquraPairs.find(p => p.address === selectedPositionForRemoval.id);
                        if (pair) {
                          const lpAmountToRemove = (pair.lpBalance * BigInt(removalPercentage)) / 100n;
                          handleRemoveLiquidityEloqura(
                            pair.address,
                            lpAmountToRemove,
                            pair.token0,
                            pair.token1
                          );
                        }
                      }
                    }}
                    disabled={isWritePending || isConfirming || isRemovingLiquidity}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isWritePending || isRemovingLiquidity ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Removing...</span>
                      </div>
                    ) : isConfirming ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Confirming...</span>
                      </div>
                    ) : (
                      "Remove Liquidity"
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Liquidity Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-lg crypto-card border-crypto-border max-h-[90vh] overflow-y-auto scrollbar-hide">
          <DialogHeader>
            <DialogTitle className="text-white">Add Liquidity</DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedPositionForAddition && (
                <>Add more liquidity to your {selectedPositionForAddition.token0.symbol}/{selectedPositionForAddition.token1.symbol} position</>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedPositionForAddition && (
            <div className="space-y-6">
              {/* Position Summary */}
              <div className="bg-[var(--crypto-dark)] rounded-lg p-4 border border-[var(--crypto-border)]">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="flex items-center -space-x-2">
                    <img 
                      src={selectedPositionForAddition.token0.logo} 
                      alt={selectedPositionForAddition.token0.symbol}
                      className="w-8 h-8 rounded-full border-2 border-[var(--crypto-card)]"
                    />
                    <img 
                      src={selectedPositionForAddition.token1.logo} 
                      alt={selectedPositionForAddition.token1.symbol}
                      className="w-8 h-8 rounded-full border-2 border-[var(--crypto-card)]"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">
                      {selectedPositionForAddition.token0.symbol}/{selectedPositionForAddition.token1.symbol}
                    </h3>
                    <p className="text-sm text-gray-400">{selectedPositionForAddition.fee}% Fee Tier</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Current Position Value</span>
                    <span className="text-white">{formatPrice(selectedPositionForAddition.value)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Price Range</span>
                    <span className="text-white">Full Range</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Current Price</span>
                    <span className="text-white">{formatNumber(selectedPositionForAddition.currentPrice, 6)}</span>
                  </div>
                </div>
              </div>

              {/* Deposit Amounts */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Deposit Amounts</h3>

                <div className="space-y-3">
                  <div className="bg-[var(--crypto-dark)] rounded-lg p-4 border border-[var(--crypto-border)]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-sm">{selectedPositionForAddition.token0.symbol}</span>
                      <span className="text-gray-400 text-sm">
                        Balance: {formatNumber(selectedPositionForAddition.token0.balance || 0, 2)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Input
                        type="number"
                        value={addAmount0}
                        onChange={(e) => {
                          setAddAmount0(e.target.value);
                          // Auto-calculate the proportional amount for token1 based on current price ratio
                          if (e.target.value && selectedPositionForAddition) {
                            const ratio = selectedPositionForAddition.currentPrice;
                            const calculatedAmount1 = (parseFloat(e.target.value) * ratio).toString();
                            setAddAmount1(calculatedAmount1);
                          }
                        }}
                        placeholder="0.0"
                        className="flex-1 bg-transparent border-none text-white text-xl font-semibold"
                      />
                      <div className="flex items-center space-x-2">
                        <img src={selectedPositionForAddition.token0.logo} alt={selectedPositionForAddition.token0.symbol} className="w-6 h-6 rounded-full" />
                        <span className="text-white font-medium">{selectedPositionForAddition.token0.symbol}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[var(--crypto-dark)] rounded-lg p-4 border border-[var(--crypto-border)]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-sm">{selectedPositionForAddition.token1.symbol}</span>
                      <span className="text-gray-400 text-sm">
                        Balance: {formatNumber(selectedPositionForAddition.token1.balance || 0, 2)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Input
                        type="number"
                        value={addAmount1}
                        onChange={(e) => {
                          setAddAmount1(e.target.value);
                          // Auto-calculate the proportional amount for token0 based on current price ratio
                          if (e.target.value && selectedPositionForAddition) {
                            const ratio = selectedPositionForAddition.currentPrice;
                            const calculatedAmount0 = (parseFloat(e.target.value) / ratio).toString();
                            setAddAmount0(calculatedAmount0);
                          }
                        }}
                        placeholder="0.0"
                        className="flex-1 bg-transparent border-none text-white text-xl font-semibold"
                      />
                      <div className="flex items-center space-x-2">
                        <img src={selectedPositionForAddition.token1.logo} alt={selectedPositionForAddition.token1.symbol} className="w-6 h-6 rounded-full" />
                        <span className="text-white font-medium">{selectedPositionForAddition.token1.symbol}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction Summary */}
              {addAmount0 && addAmount1 && (
                <div className="bg-[var(--crypto-dark)] rounded-lg p-4 border border-[var(--crypto-border)]">
                  <h4 className="font-medium text-white mb-3">Transaction Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Total Value to Add</span>
                      <span className="text-white">
                        {formatPrice((parseFloat(addAmount0) * selectedPositionForAddition.token0.price) + (parseFloat(addAmount1) * selectedPositionForAddition.token1.price))}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Network Fee</span>
                      <span className="text-white">~$2.50</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">New Position Value</span>
                      <span className="text-crypto-green font-medium">
                        {formatPrice(selectedPositionForAddition.value + (parseFloat(addAmount0) * selectedPositionForAddition.token0.price) + (parseFloat(addAmount1) * selectedPositionForAddition.token1.price))}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Price Impact Warning */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-400">
                    <p className="font-medium mb-1">Adding to Existing Position</p>
                    <p>Your liquidity will be added to the full price range of your existing position.</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddModal(false);
                    setAddAmount0("");
                    setAddAmount1("");
                  }}
                  className="flex-1 border-crypto-border text-gray-400 hover:text-white"
                >
                  Cancel
                </Button>
                {addNeedsApproval0 && (
                  <Button
                    onClick={() => handleApproveAddToken(0)}
                    disabled={isWritePending || isConfirming || isApprovingAdd}
                    className="flex-1 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:opacity-90 disabled:opacity-50"
                  >
                    {isWritePending && isApprovingAdd ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Approving...</span>
                      </div>
                    ) : (
                      `Approve ${selectedPositionForAddition?.token0.symbol}`
                    )}
                  </Button>
                )}
                {!addNeedsApproval0 && addNeedsApproval1 && (
                  <Button
                    onClick={() => handleApproveAddToken(1)}
                    disabled={isWritePending || isConfirming || isApprovingAdd}
                    className="flex-1 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:opacity-90 disabled:opacity-50"
                  >
                    {isWritePending && isApprovingAdd ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Approving...</span>
                      </div>
                    ) : (
                      `Approve ${selectedPositionForAddition?.token1.symbol}`
                    )}
                  </Button>
                )}
                {!addNeedsApproval0 && !addNeedsApproval1 && (
                  <Button
                    onClick={handleAddToExistingPosition}
                    disabled={isWritePending || isConfirming || isAddingToExisting || !addAmount0 || !addAmount1}
                    className="flex-1 bg-gradient-to-r from-crypto-blue to-crypto-green hover:opacity-90 disabled:opacity-50"
                  >
                    {(isWritePending || isAddingToExisting) ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Adding...</span>
                      </div>
                    ) : (
                      "Add Liquidity"
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Token Selection Modal */}
      <Dialog open={isTokenModalOpen} onOpenChange={setIsTokenModalOpen}>
        <DialogContent className="bg-[var(--crypto-card)] border-[var(--crypto-border)] text-white max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              Select {tokenSelectionFor === 'token0' ? 'Token 1' : 'Token 2'}
            </DialogTitle>
          </DialogHeader>

          {/* Search Box */}
          <div className="mb-4">
            <Input
              type="text"
              placeholder="Search by name or paste address..."
              value={tokenSearchQuery}
              onChange={(e) => setTokenSearchQuery(e.target.value)}
              className="bg-[var(--crypto-dark)] border-[var(--crypto-border)] text-white placeholder-gray-400 focus:border-crypto-blue"
            />
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-hide">
            {filteredAvailableTokens.map((token) => (
              <Button
                key={token.symbol}
                variant="ghost"
                onClick={() => selectToken(token)}
                className="w-full justify-start p-3 hover:bg-[var(--crypto-dark)] text-white"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center space-x-3">
                    <img src={token.logo} alt={token.symbol} className="w-8 h-8 rounded-full" />
                    <div className="text-left">
                      <div className="font-medium">{token.symbol}</div>
                      <div className="text-sm text-gray-400">{token.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white">${formatNumber(token.price, 6)}</div>
                    <div className="text-xs text-gray-400">
                      Balance: {formatNumber(token.balance || 0, 2)}
                    </div>
                  </div>
                </div>
              </Button>
            ))}

            {/* Loading state for custom token resolution */}
            {isResolvingToken && (
              <div className="flex items-center justify-center p-3 text-gray-400 text-sm">
                Resolving token...
              </div>
            )}

            {/* Custom token resolved from pasted address */}
            {customToken && !isResolvingToken && (
              <div>
                <div className="text-xs text-gray-500 px-3 py-1">Imported Token</div>
                <Button
                  variant="ghost"
                  onClick={() => selectToken(customToken)}
                  className="w-full justify-start p-3 hover:bg-[var(--crypto-dark)] text-white"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">
                        {customToken.symbol.slice(0, 3)}
                      </div>
                      <div className="text-left">
                        <div className="font-medium">{customToken.symbol}</div>
                        <div className="text-sm text-gray-400">{customToken.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">
                        Balance: {formatNumber(customToken.balance || 0, 4)}
                      </div>
                    </div>
                  </div>
                </Button>
              </div>
            )}

            {/* No results message */}
            {filteredAvailableTokens.length === 0 && !customToken && !isResolvingToken && (
              <div className="text-center p-4 text-gray-400 text-sm">
                No tokens found. Paste a token address to import.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

export default function Liquidity() {
  return <LiquidityContent />;
}
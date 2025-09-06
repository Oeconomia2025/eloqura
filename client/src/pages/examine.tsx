import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [amount1, setAmount1] = useState("");
  const [selectedFee, setSelectedFee] = useState<number>(0.25);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<'pools' | 'tokens'>('pools');
  const [timeframe, setTimeframe] = useState("1D");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Sorting state
  const [poolsSortField, setPoolsSortField] = useState<string | null>(null);
  const [poolsSortDirection, setPoolsSortDirection] = useState<'asc' | 'desc'>('asc');
  const [tokensSortField, setTokensSortField] = useState<string | null>('marketCap');
  const [tokensSortDirection, setTokensSortDirection] = useState<'asc' | 'desc'>('desc');

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



  // Sample positions data
  const [positions] = useState<Position[]>([
    {
      id: "1",
      token0: {
        symbol: "OEC",
        name: "Eloqura",
        address: "0x55d398326f99059fF775485246999027B3197955",
        decimals: 18,
        logo: "/oec-logo.png",
        price: 0.85,
        balance: 1000
      },
      token1: {
        symbol: "BNB",
        name: "Binance Coin",
        address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        decimals: 18,
        logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png",
        price: 610.50,
        balance: 5
      },
      liquidity: "12.5",
      fee: 0.25,
      minPrice: 0.00120,
      maxPrice: 0.00180,
      currentPrice: 0.00139,
      uncollectedFees0: "2.34",
      uncollectedFees1: "0.0012",
      value: 2450.75,
      status: 'in-range'
    },
    {
      id: "2",
      token0: {
        symbol: "USDT",
        name: "Tether USD",
        address: "0x55d398326f99059fF775485246999027B3197955",
        decimals: 18,
        logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png",
        price: 1.00,
        balance: 500
      },
      token1: {
        symbol: "OEC",
        name: "Eloqura",
        address: "0x55d398326f99059fF775485246999027B3197955",
        decimals: 18,
        logo: "/oec-logo.png",
        price: 0.85,
        balance: 1000
      },
      liquidity: "8.2",
      fee: 0.5,
      minPrice: 0.75,
      maxPrice: 1.20,
      currentPrice: 0.85,
      uncollectedFees0: "1.23",
      uncollectedFees1: "0.89",
      value: 1680.50,
      status: 'in-range'
    },
    {
      id: "3",
      token0: {
        symbol: "BTC",
        name: "Bitcoin",
        address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
        decimals: 18,
        logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1.png",
        price: 97500.00,
        balance: 0.1
      },
      token1: {
        symbol: "WETH",
        name: "Wrapped Ethereum",
        address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
        decimals: 18,
        logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png",
        price: 3200.50,
        balance: 2
      },
      liquidity: "18.7",
      fee: 0.5,
      minPrice: 28.5,
      maxPrice: 32.8,
      currentPrice: 30.46,
      uncollectedFees0: "0.0084",
      uncollectedFees1: "0.257",
      value: 5250.00,
      status: 'in-range'
    },
    {
      id: "4",
      token0: {
        symbol: "BTC",
        name: "Bitcoin",
        address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
        decimals: 18,
        logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1.png",
        price: 97500.00,
        balance: 0.1
      },
      token1: {
        symbol: "USDC",
        name: "USD Coin",
        address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
        decimals: 18,
        logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png",
        price: 1.00,
        balance: 1000
      },
      liquidity: "22.1",
      fee: 0.05,
      minPrice: 95000,
      maxPrice: 102000,
      currentPrice: 97500,
      uncollectedFees0: "0.0009",
      uncollectedFees1: "31.50",
      value: 3800.00,
      status: 'in-range'
    }
  ]);

  const availableTokens: Token[] = [
    {
      symbol: "OEC",
      name: "Oeconomia",
      address: "0x55d398326f99059fF775485246999027B3197955",
      decimals: 18,
      logo: "/oec-logo.png",
      price: 0.85,
      balance: 1000
    },
    {
      symbol: "BNB",
      name: "Binance Coin",
      address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
      decimals: 18,
      logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png",
      price: 610.50,
      balance: 5
    },
    {
      symbol: "USDT",
      name: "Tether USD",
      address: "0x55d398326f99059fF775485246999027B3197955",
      decimals: 18,
      logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png",
      price: 1.00,
      balance: 500
    },
    {
      symbol: "WETH",
      name: "Wrapped Ethereum",
      address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
      decimals: 18,
      logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png",
      price: 3200.50,
      balance: 2
    },
    {
      symbol: "BTC",
      name: "Bitcoin",
      address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
      decimals: 18,
      logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1.png",
      price: 97500.00,
      balance: 0.1
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      decimals: 18,
      logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png",
      price: 1.00,
      balance: 1000
    }
  ];

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
      tokenA: { symbol: "OEC", name: "Oeconomia", logo: "/oec-logo.png" },
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

  return (
    <Layout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">

          {/* Navigation Tabs */}
          <div className="mb-6">
            <div className="grid w-auto grid-cols-3 bg-gray-800 border border-gray-700 rounded-lg p-1">
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
                Pools
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
                      <div className="w-12 h-12 bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-lg flex items-center justify-center">
                        <Star className="w-6 h-6 text-violet-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Positions List */}
              <Card className="crypto-card border">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl text-white">My Liquidity Positions</CardTitle>
                  <p className="text-gray-400 text-sm">Manage your liquidity positions and collect fees</p>
                </CardHeader>
                <CardContent className="p-0">
                  {positions.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Droplets className="w-8 h-8 text-cyan-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">No Liquidity Positions</h3>
                      <p className="text-gray-400 mb-6">Start earning fees by providing liquidity to trading pairs</p>
                      <Button 
                        onClick={() => setActiveView('create')}
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
                      >
                        Create Your First Position
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-700">
                      {positions.map((position, index) => {
                        const isExpanded = expandedPositions.has(position.id);
                        const fees0Value = parseFloat(position.uncollectedFees0) * position.token0.price;
                        const fees1Value = parseFloat(position.uncollectedFees1) * position.token1.price;
                        const totalFeesValue = fees0Value + fees1Value;

                        return (
                          <div key={position.id} className="p-6">
                            <div 
                              className="flex items-center justify-between cursor-pointer"
                              onClick={() => togglePositionExpansion(position.id)}
                            >
                              <div className="flex items-center space-x-4">
                                {/* Token Logos */}
                                <div className="flex -space-x-2">
                                  <img src={position.token0.logo} alt={position.token0.symbol} className="w-10 h-10 rounded-full border-2 border-gray-700" />
                                  <img src={position.token1.logo} alt={position.token1.symbol} className="w-10 h-10 rounded-full border-2 border-gray-700" />
                                </div>

                                {/* Position Info */}
                                <div>
                                  <h3 className="text-lg font-semibold text-white">
                                    {position.token0.symbol}/{position.token1.symbol}
                                  </h3>
                                  <div className="flex items-center space-x-3 text-sm">
                                    <Badge variant="secondary" className="bg-gray-700/50 text-gray-300">
                                      {position.fee}% Fee
                                    </Badge>
                                    <Badge 
                                      variant={position.status === 'in-range' ? 'default' : 'destructive'}
                                      className={position.status === 'in-range' 
                                        ? 'bg-green-500/20 text-green-300 border-green-500/30' 
                                        : 'bg-red-500/20 text-red-300 border-red-500/30'
                                      }
                                    >
                                      {position.status === 'in-range' ? 'In Range' : 'Out of Range'}
                                    </Badge>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center space-x-6">
                                <div className="text-right">
                                  <p className="text-lg font-semibold text-white">
                                    {formatPrice(position.value)}
                                  </p>
                                  <p className="text-sm text-green-400">
                                    +{formatPrice(totalFeesValue)} fees
                                  </p>
                                </div>
                                {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                              </div>
                            </div>

                            {/* Expanded Position Details */}
                            {isExpanded && (
                              <div className="mt-6 pt-6 border-t border-gray-700/50">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                  {/* Position Details */}
                                  <div className="space-y-4">
                                    <h4 className="font-semibold text-white mb-3">Position Details</h4>
                                    
                                    <div className="space-y-3">
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Liquidity:</span>
                                        <span className="text-white font-medium">{position.liquidity}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Current Price:</span>
                                        <span className="text-white font-medium">
                                          {formatNumber(position.currentPrice, 6)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Min Price:</span>
                                        <span className="text-white font-medium">
                                          {formatNumber(position.minPrice, 6)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Max Price:</span>
                                        <span className="text-white font-medium">
                                          {formatNumber(position.maxPrice, 6)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Token Composition */}
                                  <div className="space-y-4">
                                    <h4 className="font-semibold text-white mb-3">Composition</h4>
                                    
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                          <img src={position.token0.logo} alt={position.token0.symbol} className="w-5 h-5 rounded-full" />
                                          <span className="text-sm text-gray-300">{position.token0.symbol}</span>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-sm text-white font-medium">
                                            {formatNumber(position.value / (2 * position.token0.price), 4)}
                                          </p>
                                          <p className="text-xs text-gray-400">
                                            {formatPrice(position.value / 2)}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                          <img src={position.token1.logo} alt={position.token1.symbol} className="w-5 h-5 rounded-full" />
                                          <span className="text-sm text-gray-300">{position.token1.symbol}</span>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-sm text-white font-medium">
                                            {formatNumber(position.value / (2 * position.token1.price), 4)}
                                          </p>
                                          <p className="text-xs text-gray-400">
                                            {formatPrice(position.value / 2)}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Uncollected Fees */}
                                  <div className="space-y-4">
                                    <h4 className="font-semibold text-white mb-3">Uncollected Fees</h4>
                                    
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                          <img src={position.token0.logo} alt={position.token0.symbol} className="w-5 h-5 rounded-full" />
                                          <span className="text-sm text-gray-300">{position.token0.symbol}</span>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-sm text-green-400 font-medium">
                                            {position.uncollectedFees0}
                                          </p>
                                          <p className="text-xs text-gray-400">
                                            {formatPrice(fees0Value)}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                          <img src={position.token1.logo} alt={position.token1.symbol} className="w-5 h-5 rounded-full" />
                                          <span className="text-sm text-gray-300">{position.token1.symbol}</span>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-sm text-green-400 font-medium">
                                            {position.uncollectedFees1}
                                          </p>
                                          <p className="text-xs text-gray-400">
                                            {formatPrice(fees1Value)}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="border-t border-gray-700/50 pt-3">
                                        <div className="flex justify-between">
                                          <span className="text-sm text-gray-400">Total Fees:</span>
                                          <span className="text-sm text-green-400 font-medium">
                                            {formatPrice(totalFeesValue)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex space-x-3 mt-6 pt-4 border-t border-gray-700/50">
                                  <Button 
                                    size="sm" 
                                    className="bg-green-500 hover:bg-green-600 text-white"
                                  >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Collect Fees
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                                  >
                                    Add Liquidity
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                                  >
                                    Remove Liquidity
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Create Position View */}
          {activeView === 'create' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-white">Create Liquidity Position</h2>
                <p className="text-gray-400">Add liquidity to a trading pair and start earning fees</p>
              </div>

              <Card className="crypto-card border">
                <CardHeader>
                  <CardTitle className="text-white">Select Token Pair</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Token Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">First Token</label>
                      <Select value={selectedToken0?.symbol || ""} onValueChange={(value) => {
                        const token = availableTokens.find(t => t.symbol === value);
                        setSelectedToken0(token || null);
                      }}>
                        <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                          <div className="flex items-center space-x-2">
                            {selectedToken0 && (
                              <img src={selectedToken0.logo} alt={selectedToken0.symbol} className="w-5 h-5 rounded-full" />
                            )}
                            <span>{selectedToken0 ? selectedToken0.symbol : "Select token"}</span>
                          </div>
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          {availableTokens.map((token) => (
                            <SelectItem key={token.symbol} value={token.symbol} className="text-white hover:bg-gray-700">
                              <div className="flex items-center space-x-2">
                                <img src={token.logo} alt={token.symbol} className="w-5 h-5 rounded-full" />
                                <span>{token.symbol}</span>
                                <span className="text-gray-400 text-sm">- {token.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300">Second Token</label>
                      <Select value={selectedToken1?.symbol || ""} onValueChange={(value) => {
                        const token = availableTokens.find(t => t.symbol === value);
                        setSelectedToken1(token || null);
                      }}>
                        <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                          <div className="flex items-center space-x-2">
                            {selectedToken1 && (
                              <img src={selectedToken1.logo} alt={selectedToken1.symbol} className="w-5 h-5 rounded-full" />
                            )}
                            <span>{selectedToken1 ? selectedToken1.symbol : "Select token"}</span>
                          </div>
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          {availableTokens.map((token) => (
                            <SelectItem key={token.symbol} value={token.symbol} className="text-white hover:bg-gray-700">
                              <div className="flex items-center space-x-2">
                                <img src={token.logo} alt={token.symbol} className="w-5 h-5 rounded-full" />
                                <span>{token.symbol}</span>
                                <span className="text-gray-400 text-sm">- {token.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Fee Tier Selection */}
                  {selectedToken0 && selectedToken1 && (
                    <div className="space-y-4">
                      <label className="text-sm font-medium text-gray-300">Fee Tier</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {feeOptions.map((option) => (
                          <Button
                            key={option.value}
                            variant={selectedFee === option.value ? "default" : "outline"}
                            className={selectedFee === option.value 
                              ? "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0" 
                              : "border-gray-600 text-gray-300 hover:bg-gray-700/50"
                            }
                            onClick={() => setSelectedFee(option.value)}
                          >
                            <div className="text-center">
                              <div className="font-semibold">{option.label}</div>
                              <div className="text-xs opacity-75">{option.description}</div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Amount Inputs */}
                  {selectedToken0 && selectedToken1 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">
                          {selectedToken0.symbol} Amount
                        </label>
                        <div className="relative">
                          <Input
                            type="number"
                            placeholder="0.0"
                            value={amount0}
                            onChange={(e) => setAmount0(e.target.value)}
                            className="bg-gray-800 border-gray-700 text-white pr-16"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                            {selectedToken0.symbol}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">
                          Balance: {formatNumber(selectedToken0.balance || 0, 4)} {selectedToken0.symbol}
                        </div>
                      </div>

                      <div className="flex justify-center">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                          <Plus className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">
                          {selectedToken1.symbol} Amount
                        </label>
                        <div className="relative">
                          <Input
                            type="number"
                            placeholder="0.0"
                            value={amount1}
                            onChange={(e) => setAmount1(e.target.value)}
                            className="bg-gray-800 border-gray-700 text-white pr-16"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                            {selectedToken1.symbol}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">
                          Balance: {formatNumber(selectedToken1.balance || 0, 4)} {selectedToken1.symbol}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Position Summary */}
                  {selectedToken0 && selectedToken1 && amount0 && amount1 && (
                    <Card className="bg-gray-800/50 border-gray-700">
                      <CardContent className="p-4">
                        <h4 className="font-semibold text-white mb-3">Position Preview</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">{selectedToken0.symbol} Deposited</span>
                            <span className="text-white">{amount0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">{selectedToken1.symbol} Deposited</span>
                            <span className="text-white">{amount1}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Fee Tier</span>
                            <span className="text-white">{selectedFee}%</span>
                          </div>
                          <div className="flex justify-between font-medium pt-2 border-t border-gray-700">
                            <span className="text-gray-300">Total Value</span>
                            <span className="text-white">
                              ${formatNumber((parseFloat(amount0) * selectedToken0.price) + (parseFloat(amount1) * selectedToken1.price))}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-4 pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setActiveView('positions')}
                      className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => {
                        setIsLoading(true);
                        setTimeout(() => {
                          setIsLoading(false);
                          setActiveView('positions');
                        }, 2000);
                      }}
                      disabled={!selectedToken0 || !selectedToken1 || !amount0 || !amount1 || isLoading}
                      className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
                    >
                      {isLoading ? "Creating Position..." : "Create Position"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Pools View */}
          {activeView === 'pools' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Liquidity Pools</h2>
                  <p className="text-gray-400">Browse available pools and provide liquidity to earn fees</p>
                </div>
                <Button 
                  onClick={() => setActiveView('create')}
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Position
                </Button>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search pools..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger className="w-32 bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {timeframes.map((tf) => (
                      <SelectItem key={tf.key} value={tf.key} className="text-white hover:bg-gray-700">
                        {tf.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Pools Table */}
              <Card className="crypto-card border">
                <CardContent className="p-0">
                  {/* Table Header */}
                  <div className="grid grid-cols-6 gap-4 p-4 border-b border-gray-700 bg-gray-800/50">
                    <button 
                      onClick={() => handlePoolsSort('tokenA.symbol')}
                      className="text-left text-sm font-medium text-gray-300 hover:text-white flex items-center space-x-1"
                    >
                      <span>Pool</span>
                      {getSortIcon('tokenA.symbol', poolsSortField, poolsSortDirection)}
                    </button>
                    <button 
                      onClick={() => handlePoolsSort('tvl')}
                      className="text-left text-sm font-medium text-gray-300 hover:text-white flex items-center space-x-1"
                    >
                      <span>TVL</span>
                      {getSortIcon('tvl', poolsSortField, poolsSortDirection)}
                    </button>
                    <button 
                      onClick={() => handlePoolsSort('volume24h')}
                      className="text-left text-sm font-medium text-gray-300 hover:text-white flex items-center space-x-1"
                    >
                      <span>Volume 24H</span>
                      {getSortIcon('volume24h', poolsSortField, poolsSortDirection)}
                    </button>
                    <button 
                      onClick={() => handlePoolsSort('volume7d')}
                      className="text-left text-sm font-medium text-gray-300 hover:text-white flex items-center space-x-1"
                    >
                      <span>Volume 7D</span>
                      {getSortIcon('volume7d', poolsSortField, poolsSortDirection)}
                    </button>
                    <button 
                      onClick={() => handlePoolsSort('apr')}
                      className="text-left text-sm font-medium text-gray-300 hover:text-white flex items-center space-x-1"
                    >
                      <span>APR</span>
                      {getSortIcon('apr', poolsSortField, poolsSortDirection)}
                    </button>
                    <span className="text-sm font-medium text-gray-300">Actions</span>
                  </div>

                  {/* Table Body */}
                  <div className="divide-y divide-gray-700">
                    {filteredPools.map((pool) => (
                      <div key={pool.id} className="grid grid-cols-6 gap-4 p-4 hover:bg-gray-800/30 transition-colors">
                        {/* Pool Info */}
                        <div className="flex items-center space-x-3">
                          <div className="flex -space-x-2">
                            <img src={pool.tokenA.logo} alt={pool.tokenA.symbol} className="w-8 h-8 rounded-full border-2 border-gray-700" />
                            <img src={pool.tokenB.logo} alt={pool.tokenB.symbol} className="w-8 h-8 rounded-full border-2 border-gray-700" />
                          </div>
                          <div>
                            <div className="font-medium text-white">
                              {pool.tokenA.symbol}/{pool.tokenB.symbol}
                            </div>
                            <div className="text-sm text-gray-400">{pool.fee}</div>
                          </div>
                        </div>

                        {/* TVL */}
                        <div className="flex items-center">
                          <span className="text-white font-medium">{pool.tvl}</span>
                        </div>

                        {/* Volume 24h */}
                        <div className="flex items-center">
                          <span className="text-white font-medium">{pool.volume24h}</span>
                        </div>

                        {/* Volume 7d */}
                        <div className="flex items-center">
                          <span className="text-white font-medium">{pool.volume7d}</span>
                        </div>

                        {/* APR */}
                        <div className="flex items-center">
                          <span className="text-green-400 font-medium">{pool.apr}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center">
                          <Button 
                            size="sm" 
                            onClick={() => setActiveView('create')}
                            className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
                          >
                            Add Liquidity
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default function Examine() {
  return <LiquidityContent />;
}
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
  const [activeView, setActiveView] = useState<'positions' | 'create' | 'pools'>('pools');
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
        logo: "https://pub-37d61a7eb7ae45898b46702664710cb2.r2.dev/images/OEC%20Logo%20Square.png",
        price: 0.85,
        balance: 1000
      },
      token1: {
        symbol: "BNB",
        name: "Binance Coin",
        address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        decimals: 18,
        logo: "https://cryptofonts.com/img/SVG/bnb.svg",
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
        logo: "https://cryptofonts.com/img/SVG/usdt.svg",
        price: 1.00,
        balance: 500
      },
      token1: {
        symbol: "OEC",
        name: "Eloqura",
        address: "0x55d398326f99059fF775485246999027B3197955",
        decimals: 18,
        logo: "https://pub-37d61a7eb7ae45898b46702664710cb2.r2.dev/images/OEC%20Logo%20Square.png",
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
        logo: "https://cryptofonts.com/img/SVG/btc.svg",
        price: 97500.00,
        balance: 0.1
      },
      token1: {
        symbol: "WETH",
        name: "Wrapped Ethereum",
        address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
        decimals: 18,
        logo: "https://cryptofonts.com/img/SVG/eth.svg",
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
        logo: "https://cryptofonts.com/img/SVG/btc.svg",
        price: 97500.00,
        balance: 0.1
      },
      token1: {
        symbol: "USDC",
        name: "USD Coin",
        address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
        decimals: 18,
        logo: "https://cryptofonts.com/img/SVG/usdc.svg",
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
      logo: "https://pub-37d61a7eb7ae45898b46702664710cb2.r2.dev/images/OEC%20Logo%20Square.png",
      price: 0.85,
      balance: 1000
    },
    {
      symbol: "BNB",
      name: "Binance Coin",
      address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
      decimals: 18,
      logo: "https://cryptofonts.com/img/SVG/bnb.svg",
      price: 610.50,
      balance: 5
    },
    {
      symbol: "USDT",
      name: "Tether USD",
      address: "0x55d398326f99059fF775485246999027B3197955",
      decimals: 18,
      logo: "https://cryptofonts.com/img/SVG/usdt.svg",
      price: 1.00,
      balance: 500
    },
    {
      symbol: "WETH",
      name: "Wrapped Ethereum",
      address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
      decimals: 18,
      logo: "https://cryptofonts.com/img/SVG/eth.svg",
      price: 3200.50,
      balance: 2
    },
    {
      symbol: "BTC",
      name: "Bitcoin",
      address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
      decimals: 18,
      logo: "https://cryptofonts.com/img/SVG/btc.svg",
      price: 97500.00,
      balance: 0.1
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      decimals: 18,
      logo: "https://cryptofonts.com/img/SVG/usdc.svg",
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
      tokenA: { symbol: "USDT", name: "Tether USD", logo: "https://cryptofonts.com/img/SVG/usdt.svg" },
      tokenB: { symbol: "BNB", name: "Binance Coin", logo: "https://cryptofonts.com/img/SVG/bnb.svg" },
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
      tokenB: { symbol: "USDT", name: "Tether USD", logo: "https://cryptofonts.com/img/SVG/usdt.svg" },
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
      tokenA: { symbol: "WBNB", name: "Wrapped BNB", logo: "https://cryptofonts.com/img/SVG/bnb.svg" },
      tokenB: { symbol: "BUSD", name: "Binance USD", logo: "https://cryptofonts.com/img/SVG/busd.svg" },
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
      tokenA: { symbol: "CAKE", name: "PancakeSwap", logo: "https://cryptofonts.com/img/SVG/cake.svg" },
      tokenB: { symbol: "WBNB", name: "Wrapped BNB", logo: "https://cryptofonts.com/img/SVG/bnb.svg" },
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
      tokenA: { symbol: "ETH", name: "Ethereum", logo: "https://cryptofonts.com/img/SVG/eth.svg" },
      tokenB: { symbol: "USDT", name: "Tether USD", logo: "https://cryptofonts.com/img/SVG/usdt.svg" },
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
      tokenA: { symbol: "BTCB", name: "Bitcoin BEP20", logo: "https://cryptofonts.com/img/SVG/btc.svg" },
      tokenB: { symbol: "BNB", name: "Binance Coin", logo: "https://cryptofonts.com/img/SVG/bnb.svg" },
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
      tokenA: { symbol: "ADA", name: "Cardano", logo: "https://cryptofonts.com/img/SVG/ada.svg" },
      tokenB: { symbol: "USDC", name: "USD Coin", logo: "https://cryptofonts.com/img/SVG/usdc.svg" },
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
      tokenA: { symbol: "DOT", name: "Polkadot", logo: "https://cryptofonts.com/img/SVG/dot.svg" },
      tokenB: { symbol: "BNB", name: "Binance Coin", logo: "https://cryptofonts.com/img/SVG/bnb.svg" },
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
      tokenA: { symbol: "LINK", name: "Chainlink", logo: "https://cryptofonts.com/img/SVG/link.svg" },
      tokenB: { symbol: "ETH", name: "Ethereum", logo: "https://cryptofonts.com/img/SVG/eth.svg" },
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
      tokenA: { symbol: "UNI", name: "Uniswap", logo: "https://cryptofonts.com/img/SVG/uni.svg" },
      tokenB: { symbol: "USDT", name: "Tether USD", logo: "https://cryptofonts.com/img/SVG/usdt.svg" },
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
                      <div className="w-12 h-12 bg-gradient-to-r from-sky-500/20 to-blue-500/20 rounded-lg flex items-center justify-center">
                        <Star className="w-6 h-6 text-sky-400" />
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
                      <h3 className="text-xl font-semibold text-white mb-2">No liquidity positions</h3>
                      <p className="text-gray-400 mb-6">Create your first position to start earning fees</p>
                      <Button
                        onClick={() => setActiveView('create')}
                        className="bg-gradient-to-r from-crypto-blue to-crypto-green hover:opacity-90"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Position
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
                            <div className="flex items-center justify-between">
                              {/* Left: Token Pair & Status */}
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
                                  <h3 className="text-white font-semibold">
                                    {position.token0.symbol}/{position.token1.symbol}
                                  </h3>
                                  <Badge className={`text-xs ${position.status === 'in-range' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {position.status === 'in-range' ? 'In Range' : 'Out of Range'}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {position.fee}% Fee
                                  </Badge>
                                </div>
                              </div>

                              {/* Center: Key Values */}
                              <div className="flex items-center space-x-6">
                                <div className="text-center min-w-[120px]">
                                  <p className="text-green-400 font-semibold">
                                    {formatPrice(parseFloat(position.uncollectedFees0) * position.token0.price + parseFloat(position.uncollectedFees1) * position.token1.price)}
                                  </p>
                                  <p className="text-xs text-gray-400">Uncollected Fees</p>
                                </div>
                                <div className="text-center min-w-[120px]">
                                  <p className="text-white font-semibold">{formatPrice(position.value)}</p>
                                  <p className="text-xs text-gray-400">{position.liquidity} Liquidity</p>
                                </div>
                                <div className="flex justify-center min-w-[48px]">
                                  <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                                    <ExternalLink className="w-4 h-4" />
                                  </Button>
                                </div>
                                <div className="text-center min-w-[80px]">
                                  <p className="text-cyan-400 font-semibold">
                                    {position.id === "3" ? "6.00%" : position.id === "4" ? "3.00%" : 
                                     position.id === "1" ? "40.53%" : "43.15%"}
                                  </p>
                                  <p className="text-xs text-gray-400">APR</p>
                                </div>
                              </div>

                              {/* Right: Collect Fees + Expand */}
                              <div className="flex items-center space-x-3">
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
                                  <p className="text-xs text-gray-400 mb-1">Min Price</p>
                                  <p className="text-lg font-bold text-white">{formatNumber(position.minPrice, 6)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 mb-1">Max Price</p>
                                  <p className="text-lg font-bold text-white">{formatNumber(position.maxPrice, 6)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 mb-1">Current Price</p>
                                  <p className="text-lg font-bold text-white">{formatNumber(position.currentPrice, 6)}</p>
                                </div>
                              </div>

                              <div className="flex items-center space-x-3">
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="border-crypto-blue/30 text-crypto-blue hover:bg-crypto-blue/10"
                                >
                                  Add Liquidity
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="border-gray-600 text-gray-400 hover:bg-gray-600/10"
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
                          <Select onValueChange={(value) => {
                            const token = availableTokens.find(t => t.symbol === value);
                            setSelectedToken0(token || null);
                          }}>
                            <SelectTrigger className="bg-[var(--crypto-dark)] border-[var(--crypto-border)] text-white">
                              <SelectValue placeholder="Select token" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableTokens.map((token) => (
                                <SelectItem key={token.symbol} value={token.symbol}>
                                  <div className="flex items-center space-x-2">
                                    <img src={token.logo} alt={token.symbol} className="w-5 h-5 rounded-full" />
                                    <span>{token.symbol}</span>
                                    <span className="text-gray-400">- {token.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm text-gray-400 mb-2 block">Token 2</label>
                          <Select onValueChange={(value) => {
                            const token = availableTokens.find(t => t.symbol === value);
                            setSelectedToken1(token || null);
                          }}>
                            <SelectTrigger className="bg-[var(--crypto-dark)] border-[var(--crypto-border)] text-white">
                              <SelectValue placeholder="Select token" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableTokens.map((token) => (
                                <SelectItem key={token.symbol} value={token.symbol}>
                                  <div className="flex items-center space-x-2">
                                    <img src={token.logo} alt={token.symbol} className="w-5 h-5 rounded-full" />
                                    <span>{token.symbol}</span>
                                    <span className="text-gray-400">- {token.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                      </div>
                    )}

                    {/* Deposit Amounts */}
                    {selectedToken0 && selectedToken1 && minPrice && maxPrice && (
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
                                onChange={(e) => setAmount0(e.target.value)}
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
                                onChange={(e) => setAmount1(e.target.value)}
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
                      <Button
                        onClick={() => {
                          setIsLoading(true);
                          // Simulate transaction
                          setTimeout(() => {
                            setIsLoading(false);
                            setActiveView('positions');
                          }, 2000);
                        }}
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-crypto-blue to-crypto-green hover:opacity-90 disabled:opacity-50 py-6 text-lg"
                      >
                        {isLoading ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Creating Position...</span>
                          </div>
                        ) : (
                          "Create Position"
                        )}
                      </Button>
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
                    <div className="w-4 h-4 bg-sky-400 rounded-full" />
                  </div>
                  <div className="text-2xl font-bold text-sky-400">1,247</div>
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
    </Layout>
  );
}

export default function Examine() {
  return <LiquidityContent />;
}
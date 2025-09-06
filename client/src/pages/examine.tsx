
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Search, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Zap,
  BarChart3,
  Settings,
  Info
} from 'lucide-react';

// Types
interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logo: string;
  price: number;
  balance: number;
}

interface Position {
  id: string;
  tokenA: Token;
  tokenB: Token;
  liquidity: string;
  value: string;
  fees: string;
  apr: string;
  status: 'active' | 'out-of-range' | 'closed';
  minPrice: number;
  maxPrice: number;
  currentPrice: number;
}

// Mock tokens data
const mockTokens = [
  {
    id: '0xbnb',
    symbol: 'BNB',
    name: 'Binance Coin',
    logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png',
    price: 312.45,
    marketCap: 47800000000,
    volume24h: 890000000,
    change24h: 2.34,
    tvl: 2400000000,
    holders: 1250000,
    network: 'BSC'
  },
  {
    id: '0xusdt',
    symbol: 'USDT',
    name: 'Tether USD',
    logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
    price: 1.00,
    marketCap: 97500000000,
    volume24h: 15600000000,
    change24h: 0.01,
    tvl: 5600000000,
    holders: 4890000,
    network: 'BSC'
  },
  {
    id: '0xoec',
    symbol: 'OEC',
    name: 'Oeconomia',
    logo: '/oec-logo.png',
    price: 0.0045,
    marketCap: 450000000,
    volume24h: 12000000,
    change24h: -3.21,
    tvl: 89000000,
    holders: 125000,
    network: 'BSC'
  }
];

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

  const tokens = mockTokens;

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

  // Sort icon helper
  const getSortIcon = (field: string, currentField: string | null, direction: 'asc' | 'desc') => {
    if (currentField !== field) return null;
    return direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

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
      tokenB: { symbol: "BNB", name: "Binance Coin", logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png" },
      fee: "0.25%",
      volume24h: "$987K",
      volume7d: "$7.1M",
      tvl: "$3.2M",
      apr: "15.3%",
      priceChange24h: -0.5,
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
    if (!tokensSortField) return 0;
    
    let aValue = a[tokensSortField as keyof typeof a];
    let bValue = b[tokensSortField as keyof typeof b];
    
    // Handle string comparisons (like symbol, name)
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

  // Filter pools and tokens based on search
  const filteredPools = sortedPools.filter(pool =>
    pool.tokenA.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pool.tokenB.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pool.tokenA.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pool.tokenB.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTokens = sortedTokens.filter(token =>
    token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Mock positions data
  const mockPositions: Position[] = [
    {
      id: '1',
      tokenA: { symbol: 'BNB', name: 'Binance Coin', address: '0x...', decimals: 18, logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png', price: 312.45, balance: 1000 },
      tokenB: { symbol: 'USDT', name: 'Tether USD', address: '0x...', decimals: 18, logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png', price: 1.00, balance: 1000 },
      liquidity: '$12,450',
      value: '$12,789',
      fees: '$234',
      apr: '24.5%',
      status: 'active',
      minPrice: 300,
      maxPrice: 350,
      currentPrice: 312.45
    },
    {
      id: '2',
      tokenA: { symbol: 'OEC', name: 'Oeconomia', address: '0x...', decimals: 18, logo: '/oec-logo.png', price: 0.0045, balance: 1000 },
      tokenB: { symbol: 'USDT', name: 'Tether USD', address: '0x...', decimals: 18, logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png', price: 1.00, balance: 1000 },
      liquidity: '$5,678',
      value: '$5,234',
      fees: '$89',
      apr: '42.1%',
      status: 'out-of-range',
      minPrice: 0.004,
      maxPrice: 0.006,
      currentPrice: 0.0045
    }
  ];

  const togglePositionExpansion = (positionId: string) => {
    const newExpanded = new Set(expandedPositions);
    if (newExpanded.has(positionId)) {
      newExpanded.delete(positionId);
    } else {
      newExpanded.add(positionId);
    }
    setExpandedPositions(newExpanded);
  };

  const calculatePriceFromAmount = (amount: string, token: Token | null) => {
    if (!amount || !token) return "0.00";
    return (parseFloat(amount) * token.price).toFixed(2);
  };

  const handleCreatePosition = () => {
    if (!selectedToken0 || !selectedToken1 || !amount0 || !amount1) {
      alert("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      alert("Position created successfully!");
      // Reset form
      setSelectedToken0(null);
      setSelectedToken1(null);
      setAmount0("");
      setAmount1("");
      setMinPrice("");
      setMaxPrice("");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[var(--crypto-dark)] text-white">
      <div className="container mx-auto p-6">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content */}
          <div className="flex-1 space-y-6">
            {/* Header */}
            <div className="text-center lg:text-left">
              <h1 className="text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-crypto-blue to-crypto-purple bg-clip-text text-transparent">
                Examine Liquidity
              </h1>
              <p className="text-xl text-gray-400 mb-8">
                Examine pools, tokens, and manage your liquidity positions
              </p>
            </div>

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

            {/* My Positions View */}
            {activeView === 'positions' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="crypto-card p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">Total Value</span>
                      <BarChart3 className="w-4 h-4 text-crypto-blue" />
                    </div>
                    <div className="text-2xl font-bold text-crypto-blue">$18,023</div>
                    <div className="text-crypto-green text-sm">+5.2%</div>
                  </Card>
                  
                  <Card className="crypto-card p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">Fees Earned</span>
                      <TrendingUp className="w-4 h-4 text-crypto-green" />
                    </div>
                    <div className="text-2xl font-bold text-crypto-green">$323</div>
                    <div className="text-crypto-green text-sm">+$45 24h</div>
                  </Card>
                  
                  <Card className="crypto-card p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">Avg APR</span>
                      <div className="w-4 h-4 bg-crypto-purple rounded-full" />
                    </div>
                    <div className="text-2xl font-bold text-crypto-purple">33.3%</div>
                    <div className="text-crypto-green text-sm">Active</div>
                  </Card>
                </div>

                <div className="space-y-4">
                  {mockPositions.map((position) => (
                    <Card key={position.id} className="crypto-card">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center -space-x-2">
                              <img src={position.tokenA.logo} alt={position.tokenA.symbol} className="w-8 h-8 rounded-full z-10" />
                              <img src={position.tokenB.logo} alt={position.tokenB.symbol} className="w-8 h-8 rounded-full" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{position.tokenA.symbol}/{position.tokenB.symbol}</h3>
                              <Badge variant={
                                position.status === 'active' ? 'default' : 
                                position.status === 'out-of-range' ? 'destructive' : 'secondary'
                              }>
                                {position.status.replace('-', ' ')}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-6">
                            <div className="text-right">
                              <div className="font-medium">{position.value}</div>
                              <div className="text-sm text-gray-400">Value</div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-crypto-green">{position.fees}</div>
                              <div className="text-sm text-gray-400">Fees</div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-crypto-purple">{position.apr}</div>
                              <div className="text-sm text-gray-400">APR</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => togglePositionExpansion(position.id)}
                            >
                              {expandedPositions.has(position.id) ? 
                                <ChevronUp className="w-4 h-4" /> : 
                                <ChevronDown className="w-4 h-4" />
                              }
                            </Button>
                          </div>
                        </div>

                        {expandedPositions.has(position.id) && (
                          <div className="mt-6 pt-6 border-t border-gray-700">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div className="space-y-2">
                                <h4 className="font-medium text-gray-300">Price Range</h4>
                                <div className="text-sm">
                                  <div>Min: ${position.minPrice.toFixed(4)}</div>
                                  <div>Max: ${position.maxPrice.toFixed(4)}</div>
                                  <div>Current: ${position.currentPrice.toFixed(4)}</div>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <h4 className="font-medium text-gray-300">Position Details</h4>
                                <div className="text-sm">
                                  <div>Liquidity: {position.liquidity}</div>
                                  <div>Fees: {position.fees}</div>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <h4 className="font-medium text-gray-300">Actions</h4>
                                <div className="flex space-x-2">
                                  <Button size="sm" variant="outline">Add</Button>
                                  <Button size="sm" variant="outline">Remove</Button>
                                  <Button size="sm" variant="outline">Collect</Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Create Position View */}
            {activeView === 'create' && (
              <div className="space-y-6">
                <Card className="crypto-card">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center space-x-2">
                      <Plus className="w-5 h-5" />
                      <span>Create New Position</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Fee Tier Selection */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-gray-300">Fee Tier</label>
                      <div className="grid grid-cols-4 gap-3">
                        {[0.05, 0.25, 0.30, 1.00].map((fee) => (
                          <Button
                            key={fee}
                            variant={selectedFee === fee ? "default" : "outline"}
                            className={selectedFee === fee ? "border-crypto-blue" : ""}
                            onClick={() => setSelectedFee(fee)}
                          >
                            {fee}%
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Token Pair Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-300">First Token</label>
                        <div className="border border-gray-700 rounded-lg p-4">
                          {selectedToken0 ? (
                            <div className="flex items-center space-x-3">
                              <img src={selectedToken0.logo} alt={selectedToken0.symbol} className="w-8 h-8 rounded-full" />
                              <div>
                                <div className="font-medium">{selectedToken0.symbol}</div>
                                <div className="text-sm text-gray-400">{selectedToken0.name}</div>
                              </div>
                            </div>
                          ) : (
                            <Button variant="ghost" className="w-full justify-start">
                              Select Token
                            </Button>
                          )}
                        </div>
                        <Input
                          placeholder="0.0"
                          value={amount0}
                          onChange={(e) => setAmount0(e.target.value)}
                        />
                        {selectedToken0 && amount0 && (
                          <div className="text-sm text-gray-400">
                            ≈ ${calculatePriceFromAmount(amount0, selectedToken0)}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-300">Second Token</label>
                        <div className="border border-gray-700 rounded-lg p-4">
                          {selectedToken1 ? (
                            <div className="flex items-center space-x-3">
                              <img src={selectedToken1.logo} alt={selectedToken1.symbol} className="w-8 h-8 rounded-full" />
                              <div>
                                <div className="font-medium">{selectedToken1.symbol}</div>
                                <div className="text-sm text-gray-400">{selectedToken1.name}</div>
                              </div>
                            </div>
                          ) : (
                            <Button variant="ghost" className="w-full justify-start">
                              Select Token
                            </Button>
                          )}
                        </div>
                        <Input
                          placeholder="0.0"
                          value={amount1}
                          onChange={(e) => setAmount1(e.target.value)}
                        />
                        {selectedToken1 && amount1 && (
                          <div className="text-sm text-gray-400">
                            ≈ ${calculatePriceFromAmount(amount1, selectedToken1)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Price Range */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-300">Min Price</label>
                        <Input
                          placeholder="0.0"
                          value={minPrice}
                          onChange={(e) => setMinPrice(e.target.value)}
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-300">Max Price</label>
                        <Input
                          placeholder="0.0"
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(e.target.value)}
                        />
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleCreatePosition}
                      disabled={isLoading || !selectedToken0 || !selectedToken1 || !amount0 || !amount1}
                    >
                      {isLoading ? "Creating Position..." : "Create Position"}
                    </Button>
                  </CardContent>
                </Card>
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
                    <div className="text-crypto-green text-sm">+23 new</div>
                  </Card>
                  
                  <Card className="crypto-card p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">Avg APR</span>
                      <BarChart3 className="w-4 h-4 text-crypto-green" />
                    </div>
                    <div className="text-2xl font-bold text-crypto-green">18.2%</div>
                    <div className="text-crypto-green text-sm">Weighted</div>
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
                      className="pl-10 w-80"
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
                                  <div className="text-sm text-gray-500">{pool.network}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <Badge variant="outline" className="text-crypto-blue border-crypto-blue/30">
                                {pool.fee}
                              </Badge>
                            </td>
                            <td className="py-4 px-6">
                              <span className="font-medium">{pool.volume24h}</span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="font-medium">{pool.volume7d}</span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="font-medium">{pool.tvl}</span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="font-medium text-crypto-green">{pool.apr}</span>
                            </td>
                            <td className="py-4 px-6">
                              <span className={`font-medium flex items-center ${
                                pool.priceChange24h >= 0 ? 'text-crypto-green' : 'text-red-400'
                              }`}>
                                {pool.priceChange24h >= 0 ? (
                                  <ArrowUpRight className="w-3 h-3 mr-1" />
                                ) : (
                                  <ArrowDownRight className="w-3 h-3 mr-1" />
                                )}
                                {Math.abs(pool.priceChange24h).toFixed(2)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden relative max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-hide">
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
                              <span>24H %</span>
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
                              onClick={() => handleTokensSort('tvl')}
                              className="flex items-center space-x-1 hover:text-white transition-colors"
                            >
                              <span>TVL</span>
                              {getSortIcon('tvl', tokensSortField, tokensSortDirection)}
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTokens.map((token, index) => (
                          <tr 
                            key={token.id}
                            className="border-b border-crypto-border hover:bg-gray-800/40 hover:border-crypto-blue/60 hover:shadow-lg transition-all duration-200 cursor-pointer group"
                            onClick={() => {
                              setLocation(`/examine?tab=tokens&create=true&token=${token.id}`);
                            }}
                          >
                            <td className="py-4 px-6">
                              <span className="text-gray-400 font-mono group-hover:text-white transition-colors duration-200">{index + 1}</span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center space-x-3">
                                <img 
                                  src={token.logo} 
                                  alt={token.symbol}
                                  className="w-8 h-8 rounded-full"
                                />
                                <div>
                                  <div className="font-medium group-hover:text-white transition-colors duration-200">{token.symbol}</div>
                                  <div className="text-sm text-gray-500">{token.name}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <span className="font-medium">${token.price.toFixed(6)}</span>
                            </td>
                            <td className="py-4 px-6">
                              <span className={`font-medium flex items-center ${
                                token.change24h >= 0 ? 'text-crypto-green' : 'text-red-400'
                              }`}>
                                {token.change24h >= 0 ? (
                                  <ArrowUpRight className="w-3 h-3 mr-1" />
                                ) : (
                                  <ArrowDownRight className="w-3 h-3 mr-1" />
                                )}
                                {Math.abs(token.change24h).toFixed(2)}%
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="font-medium">
                                ${(token.volume24h / 1000000).toFixed(1)}M
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="font-medium">
                                ${(token.tvl / 1000000).toFixed(1)}M
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="w-full lg:w-80 space-y-6">
            {/* Quick Actions */}
            <Card className="crypto-card border">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Zap className="w-5 h-5" />
                  <span>Quick Actions</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="ghost" className="w-full justify-start text-left" onClick={() => setActiveView('create')}>
                  <Plus className="w-4 h-4 mr-2" />
                  <div>
                    <p className="font-medium">Create Position</p>
                    <p className="text-xs text-gray-400">Add liquidity to earn fees</p>
                  </div>
                </Button>
                <Button variant="ghost" className="w-full justify-start text-left" onClick={() => setActiveView('pools')}>
                  <Search className="w-4 h-4 mr-2" />
                  <div>
                    <p className="font-medium">Find Pools</p>
                    <p className="text-xs text-gray-400">Explore available pools</p>
                  </div>
                </Button>
                <Button variant="ghost" className="w-full justify-start text-left" onClick={() => setActiveView('positions')}>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  <div>
                    <p className="font-medium">My Portfolio</p>
                    <p className="text-xs text-gray-400">Track performance</p>
                  </div>
                </Button>
              </CardContent>
            </Card>

            {/* Safety Features */}
            <Card className="crypto-card border">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Info className="w-5 h-5" />
                  <span>Safety Features</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-2 h-2 bg-crypto-green rounded-full"></div>
                  <span>Smart Contract Audited</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-2 h-2 bg-crypto-blue rounded-full"></div>
                  <span>Decentralized Protocol</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-2 h-2 bg-crypto-purple rounded-full"></div>
                  <span>Non-Custodial</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-2 h-2 bg-crypto-green rounded-full"></div>
                  <span>Community Governed</span>
                </div>
              </CardContent>
            </Card>

            {/* Learn More */}
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
      </div>
    </div>
  );
}

export default function LiquidityPage() {
  return <LiquidityContent />;
}

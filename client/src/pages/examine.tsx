import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation } from 'wouter';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  BarChart3, 
  PieChart, 
  ArrowUpDown, 
  Search, 
  Settings,
  ArrowLeftRight
} from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, BarChart, Bar } from 'recharts';
import { useTokens } from '@/hooks/use-token-data';
import type { Token as TokenType } from '@shared/schema';

// Token interface for form handling
interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logo: string;
  price: number;
  balance?: number;
}

// Generate mock price history data
const generateMockPriceHistory = (basePrice: number, days: number = 30) => {
  const data = [];
  let price = basePrice;
  const now = Date.now();
  
  for (let i = days; i >= 0; i--) {
    const timestamp = now - (i * 24 * 60 * 60 * 1000);
    const change = (Math.random() - 0.5) * 0.1; // ±5% daily change
    price = Math.max(0.001, price * (1 + change));
    
    data.push({
      timestamp: Math.floor(timestamp / 1000),
      price: Number(price.toFixed(6))
    });
  }
  
  return data;
};

// Mock liquidity pools data
const mockPools = [
  {
    id: '1',
    token0: { symbol: 'BTC', name: 'Bitcoin', logo: '/api/placeholder/32/32' },
    token1: { symbol: 'ETH', name: 'Ethereum', logo: '/api/placeholder/32/32' },
    fee: 0.30,
    tvl: 45000000,
    volume24h: 2800000,
    apr: 12.5,
    myLiquidity: 0,
    priceHistory: generateMockPriceHistory(0.065)
  },
  {
    id: '2',
    token0: { symbol: 'ETH', name: 'Ethereum', logo: '/api/placeholder/32/32' },
    token1: { symbol: 'USDC', name: 'USD Coin', logo: '/api/placeholder/32/32' },
    fee: 0.25,
    tvl: 38000000,
    volume24h: 1950000,
    apr: 8.2,
    myLiquidity: 1250.50,
    priceHistory: generateMockPriceHistory(2400)
  },
  {
    id: '3',
    token0: { symbol: 'BNB', name: 'BNB', logo: '/api/placeholder/32/32' },
    token1: { symbol: 'BUSD', name: 'Binance USD', logo: '/api/placeholder/32/32' },
    fee: 0.25,
    tvl: 28000000,
    volume24h: 1420000,
    apr: 15.8,
    myLiquidity: 0,
    priceHistory: generateMockPriceHistory(310)
  },
  {
    id: '4',
    token0: { symbol: 'USDT', name: 'Tether', logo: '/api/placeholder/32/32' },
    token1: { symbol: 'USDC', name: 'USD Coin', logo: '/api/placeholder/32/32' },
    fee: 0.05,
    tvl: 125000000,
    volume24h: 8500000,
    apr: 3.2,
    myLiquidity: 0,
    priceHistory: generateMockPriceHistory(1.0001)
  },
  {
    id: '5',
    token0: { symbol: 'MATIC', name: 'Polygon', logo: '/api/placeholder/32/32' },
    token1: { symbol: 'ETH', name: 'Ethereum', logo: '/api/placeholder/32/32' },
    fee: 0.30,
    tvl: 12000000,
    volume24h: 850000,
    apr: 22.4,
    myLiquidity: 0,
    priceHistory: generateMockPriceHistory(0.0003)
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
      setPoolsSortDirection('desc');
    }
  };

  const handleTokensSort = (field: string) => {
    if (tokensSortField === field) {
      setTokensSortDirection(tokensSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setTokensSortField(field);
      setTokensSortDirection('desc');
    }
  };

  // Load tokens data
  const { data: tokensList } = useTokens();
  const tokens = tokensList || [];

  // Filter and sort pools
  const filteredPools = mockPools
    .filter(pool => 
      pool.token0.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pool.token1.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pool.token0.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pool.token1.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (!poolsSortField) return 0;
      
      let aValue, bValue;
      switch (poolsSortField) {
        case 'pair':
          aValue = `${a.token0.symbol}/${a.token1.symbol}`;
          bValue = `${b.token0.symbol}/${b.token1.symbol}`;
          break;
        case 'tvl':
          aValue = a.tvl;
          bValue = b.tvl;
          break;
        case 'volume24h':
          aValue = a.volume24h;
          bValue = b.volume24h;
          break;
        case 'apr':
          aValue = a.apr;
          bValue = b.apr;
          break;
        case 'fee':
          aValue = a.fee;
          bValue = b.fee;
          break;
        default:
          return 0;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return poolsSortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return poolsSortDirection === 'asc' 
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });

  // Filter and sort tokens
  const filteredTokens = tokens
    .filter(token => 
      token && (
        token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        token.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
    .sort((a, b) => {
      if (!a || !b) return 0;
      if (!tokensSortField) return 0;
      
      let aValue, bValue;
      switch (tokensSortField) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'symbol':
          aValue = a.symbol;
          bValue = b.symbol;
          break;
        case 'price':
          aValue = a.price;
          bValue = b.price;
          break;
        case 'marketCap':
          aValue = a.marketCap || 0;
          bValue = b.marketCap || 0;
          break;
        case 'volume24h':
          aValue = a.volume24h || 0;
          bValue = b.volume24h || 0;
          break;
        case 'change24h':
          aValue = a.priceChangePercent24h || 0;
          bValue = b.priceChangePercent24h || 0;
          break;
        default:
          return 0;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return tokensSortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return tokensSortDirection === 'asc' 
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });

  // My positions (filtered pools where user has liquidity)
  const myPositions = mockPools.filter(pool => pool.myLiquidity > 0);

  // Format number utility
  const formatNumber = (num: number, decimals: number = 2) => {
    if (num >= 1e9) return (num / 1e9).toFixed(decimals) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(decimals) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(decimals) + 'K';
    return num.toFixed(decimals);
  };

  // Handle position expansion
  const togglePositionExpansion = (positionId: string) => {
    const newExpanded = new Set(expandedPositions);
    if (newExpanded.has(positionId)) {
      newExpanded.delete(positionId);
    } else {
      newExpanded.add(positionId);
    }
    setExpandedPositions(newExpanded);
  };

  // Handle token selection for liquidity creation
  const handleTokenSelect = (token: TokenType, isToken0: boolean) => {
    const formattedToken: Token = {
      symbol: token.symbol,
      name: token.name,
      address: `0x${token.id}`, // Mock address
      decimals: 18,
      logo: token.logo,
      price: token.price,
      balance: 1000 // Mock balance
    };

    if (isToken0) {
      setSelectedToken0(formattedToken);
    } else {
      setSelectedToken1(formattedToken);
    }
  };

  // Handle create liquidity
  const handleCreateLiquidity = async () => {
    if (!selectedToken0 || !selectedToken1 || !amount0 || !amount1) {
      return;
    }

    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsLoading(false);
    
    // Reset form and redirect to positions
    setSelectedToken0(null);
    setSelectedToken1(null);
    setAmount0("");
    setAmount1("");
    setActiveView('positions');
  };

  // Handle token click to navigate to detail page
  const handleTokenClick = (token: TokenType) => {
    if (token && token.id) {
      setLocation(`/token/${token.id}`);
    }
  };

  // Handle add liquidity from pools view
  const handleAddLiquidity = (pool: typeof mockPools[0]) => {
    // Convert pool tokens to form format
    const token0: Token = {
      symbol: pool.token0.symbol,
      name: pool.token0.name,
      address: `0x${pool.id}-token0`, // Mock address
      decimals: 18,
      logo: pool.token0.logo,
      price: 50000, // Mock price
      balance: 1000
    };

    const token1: Token = {
      symbol: pool.token1.symbol,
      name: pool.token1.name,
      address: `0x${pool.id}-token1`, // Mock address
      decimals: 18,
      logo: pool.token1.logo,
      price: 3000, // Mock price
      balance: 1000
    };

    setSelectedToken0(token0);
    setSelectedToken1(token1);
    setSelectedFee(pool.fee);
    setActiveView('create');
  };

  const renderChart = (data: any[], height: number = 60) => (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <Line 
          type="monotone" 
          dataKey="price" 
          stroke="#10b981" 
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );

  const renderMyPositions = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">My Positions</h3>
        <Button onClick={() => setActiveView('create')} size="sm">
          + Add Liquidity
        </Button>
      </div>

      {myPositions.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                <PieChart className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h4 className="font-medium">No liquidity positions</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Start earning fees by providing liquidity to trading pairs
                </p>
              </div>
              <Button onClick={() => setActiveView('create')}>
                Create Your First Position
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {myPositions.map(position => {
            const isExpanded = expandedPositions.has(position.id);
            const totalValue = position.myLiquidity;
            const dailyFees = (totalValue * position.apr / 365 / 100);

            return (
              <Collapsible key={position.id} open={isExpanded} onOpenChange={() => togglePositionExpansion(position.id)}>
                <Card className="overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex -space-x-2">
                            <Avatar className="w-10 h-10 border-2 border-background">
                              <AvatarImage src={position.token0.logo} />
                              <AvatarFallback>{position.token0.symbol[0]}</AvatarFallback>
                            </Avatar>
                            <Avatar className="w-10 h-10 border-2 border-background">
                              <AvatarImage src={position.token1.logo} />
                              <AvatarFallback>{position.token1.symbol[0]}</AvatarFallback>
                            </Avatar>
                          </div>
                          <div>
                            <div className="font-semibold">
                              {position.token0.symbol}/{position.token1.symbol}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {position.fee}% Fee Tier
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="font-semibold">${formatNumber(totalValue)}</div>
                          <div className="text-sm text-green-500">+${dailyFees.toFixed(2)}/day</div>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <Separator className="mb-4" />
                      
                      {/* Position Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">My Liquidity</p>
                          <p className="font-semibold">${formatNumber(totalValue)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Pool Share</p>
                          <p className="font-semibold">{((totalValue / position.tvl) * 100).toFixed(4)}%</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Unclaimed Fees</p>
                          <p className="font-semibold text-green-500">${(dailyFees * 3).toFixed(2)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">APR</p>
                          <p className="font-semibold text-blue-500">{position.apr}%</p>
                        </div>
                      </div>

                      {/* Position Composition */}
                      <div className="space-y-4 mb-6">
                        <h5 className="font-medium">Position Composition</h5>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={position.token0.logo} />
                                <AvatarFallback className="text-xs">{position.token0.symbol[0]}</AvatarFallback>
                              </Avatar>
                              <span>{position.token0.symbol}</span>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{(totalValue / 2 / 50000).toFixed(6)}</p>
                              <p className="text-sm text-muted-foreground">${formatNumber(totalValue / 2)}</p>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={position.token1.logo} />
                                <AvatarFallback className="text-xs">{position.token1.symbol[0]}</AvatarFallback>
                              </Avatar>
                              <span>{position.token1.symbol}</span>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{(totalValue / 2 / 3000).toFixed(6)}</p>
                              <p className="text-sm text-muted-foreground">${formatNumber(totalValue / 2)}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Price Range */}
                      <div className="space-y-4 mb-6">
                        <h5 className="font-medium">Price Range</h5>
                        <div className="bg-muted/50 rounded-lg p-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-muted-foreground">Min Price</span>
                            <span className="text-sm text-muted-foreground">Max Price</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-medium">16.5 {position.token1.symbol}</span>
                            <span className="font-medium">18.2 {position.token1.symbol}</span>
                          </div>
                          <div className="text-center mt-2">
                            <span className="text-xs text-muted-foreground">per {position.token0.symbol}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-center space-x-2">
                          <Badge variant="outline" className="text-green-500 border-green-500">
                            In Range
                          </Badge>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex space-x-2">
                        <Button size="sm" className="flex-1">
                          Collect Fees
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          Add Liquidity
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          Remove Liquidity
                        </Button>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderCreatePosition = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Add Liquidity</h2>
        <p className="text-muted-foreground">
          Provide liquidity to earn trading fees from swaps
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Pair</CardTitle>
          <CardDescription>
            Choose the trading pair you want to provide liquidity for
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Token Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Token A</label>
              <Select 
                value={selectedToken0?.symbol || ""} 
                onValueChange={(value) => {
                  const token = tokens.find(t => t?.symbol === value);
                  if (token) handleTokenSelect(token, true);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select first token">
                    {selectedToken0 && (
                      <div className="flex items-center space-x-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={selectedToken0.logo} />
                          <AvatarFallback className="text-xs">{selectedToken0.symbol[0]}</AvatarFallback>
                        </Avatar>
                        <span>{selectedToken0.symbol}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {tokens.slice(0, 20).map(token => token && (
                    <SelectItem key={token.id} value={token.symbol}>
                      <div className="flex items-center space-x-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={token.logo} />
                          <AvatarFallback className="text-xs">{token.symbol[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{token.symbol}</div>
                          <div className="text-xs text-muted-foreground">{token.name}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Token B</label>
              <Select 
                value={selectedToken1?.symbol || ""} 
                onValueChange={(value) => {
                  const token = tokens.find(t => t?.symbol === value);
                  if (token) handleTokenSelect(token, false);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select second token">
                    {selectedToken1 && (
                      <div className="flex items-center space-x-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={selectedToken1.logo} />
                          <AvatarFallback className="text-xs">{selectedToken1.symbol[0]}</AvatarFallback>
                        </Avatar>
                        <span>{selectedToken1.symbol}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {tokens.slice(0, 20).map(token => token && (
                    <SelectItem key={token.id} value={token.symbol}>
                      <div className="flex items-center space-x-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={token.logo} />
                          <AvatarFallback className="text-xs">{token.symbol[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{token.symbol}</div>
                          <div className="text-xs text-muted-foreground">{token.name}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fee Tier Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Fee Tier</label>
            <div className="grid grid-cols-3 gap-2">
              {[0.05, 0.25, 1.0].map(fee => (
                <Button
                  key={fee}
                  variant={selectedFee === fee ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedFee(fee)}
                  className="flex flex-col space-y-1 h-auto py-3"
                >
                  <span className="font-semibold">{fee}%</span>
                  <span className="text-xs opacity-70">
                    {fee === 0.05 && "Stable pairs"}
                    {fee === 0.25 && "Most pairs"}
                    {fee === 1.0 && "Exotic pairs"}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          {/* Amount Inputs */}
          {selectedToken0 && selectedToken1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{selectedToken0.symbol} Amount</label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={amount0}
                    onChange={(e) => setAmount0(e.target.value)}
                    className="pr-16"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {selectedToken0.symbol}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Balance: {selectedToken0.balance || 0} {selectedToken0.symbol}
                </div>
              </div>

              <div className="flex justify-center">
                <ArrowLeftRight className="w-4 h-4 mr-2" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{selectedToken1.symbol} Amount</label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={amount1}
                    onChange={(e) => setAmount1(e.target.value)}
                    className="pr-16"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {selectedToken1.symbol}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Balance: {selectedToken1.balance || 0} {selectedToken1.symbol}
                </div>
              </div>
            </div>
          )}

          {/* Price Range (Simplified) */}
          {selectedToken0 && selectedToken1 && amount0 && amount1 && (
            <Card className="bg-muted/50">
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Price Range</span>
                  <Badge variant="outline">Full Range</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Min Price</label>
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Max Price</label>
                    <Input
                      type="number"
                      placeholder="∞"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                    />
                  </div>
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  {selectedToken1.symbol} per {selectedToken0.symbol}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {selectedToken0 && selectedToken1 && amount0 && amount1 && (
            <Card className="bg-muted/50">
              <CardContent className="p-4 space-y-3">
                <div className="font-medium">Position Summary</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{selectedToken0.symbol} Amount</span>
                    <span>{amount0} {selectedToken0.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{selectedToken1.symbol} Amount</span>
                    <span>{amount1} {selectedToken1.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fee Tier</span>
                    <span>{selectedFee}%</span>
                  </div>
                  <div className="flex justify-between font-medium pt-2 border-t">
                    <span>Estimated Value</span>
                    <span>${formatNumber(
                      (parseFloat(amount0) || 0) * selectedToken0.price + 
                      (parseFloat(amount1) || 0) * selectedToken1.price
                    )}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              onClick={() => setActiveView('positions')}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateLiquidity}
              disabled={!selectedToken0 || !selectedToken1 || !amount0 || !amount1 || isLoading}
              className="flex-1"
            >
              {isLoading ? "Adding..." : "Add Liquidity"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderPools = () => (
    <div className="space-y-6">
      {/* Header with Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Liquidity Pools</h2>
          <p className="text-muted-foreground">Provide liquidity to earn trading fees</p>
        </div>
        <Button onClick={() => setActiveView('create')} size="sm">
          + New Position
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'pools' | 'tokens')}>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <TabsList>
            <TabsTrigger value="pools">Pools</TabsTrigger>
            <TabsTrigger value="tokens">Tokens</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search pools or tokens..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-[300px]"
              />
            </div>
          </div>
        </div>

        <TabsContent value="pools" className="space-y-4">
          {/* Pools Table */}
          <Card>
            <CardContent className="p-0">
              {/* Table Header */}
              <div className="grid grid-cols-5 gap-4 p-4 border-b bg-muted/50 text-sm font-medium">
                <button 
                  onClick={() => handlePoolsSort('pair')}
                  className="text-left hover:text-foreground transition-colors flex items-center space-x-1"
                >
                  <span>Pool</span>
                  {poolsSortField === 'pair' && (
                    <TrendingUp className={`w-3 h-3 ${poolsSortDirection === 'desc' ? 'rotate-180' : ''}`} />
                  )}
                </button>
                <button 
                  onClick={() => handlePoolsSort('tvl')}
                  className="text-left hover:text-foreground transition-colors flex items-center space-x-1"
                >
                  <span>TVL</span>
                  {poolsSortField === 'tvl' && (
                    <TrendingUp className={`w-3 h-3 ${poolsSortDirection === 'desc' ? 'rotate-180' : ''}`} />
                  )}
                </button>
                <button 
                  onClick={() => handlePoolsSort('volume24h')}
                  className="text-left hover:text-foreground transition-colors flex items-center space-x-1"
                >
                  <span>24h Volume</span>
                  {poolsSortField === 'volume24h' && (
                    <TrendingUp className={`w-3 h-3 ${poolsSortDirection === 'desc' ? 'rotate-180' : ''}`} />
                  )}
                </button>
                <button 
                  onClick={() => handlePoolsSort('apr')}
                  className="text-left hover:text-foreground transition-colors flex items-center space-x-1"
                >
                  <span>APR</span>
                  {poolsSortField === 'apr' && (
                    <TrendingUp className={`w-3 h-3 ${poolsSortDirection === 'desc' ? 'rotate-180' : ''}`} />
                  )}
                </button>
                <div className="text-left">7d Chart</div>
              </div>

              {/* Table Body */}
              <div className="divide-y">
                {filteredPools.map(pool => (
                  <div key={pool.id} className="grid grid-cols-5 gap-4 p-4 hover:bg-muted/50 transition-colors">
                    {/* Pool Info */}
                    <div className="flex items-center space-x-3">
                      <div className="flex -space-x-2">
                        <Avatar className="w-8 h-8 border-2 border-background">
                          <AvatarImage src={pool.token0.logo} />
                          <AvatarFallback className="text-xs">{pool.token0.symbol[0]}</AvatarFallback>
                        </Avatar>
                        <Avatar className="w-8 h-8 border-2 border-background">
                          <AvatarImage src={pool.token1.logo} />
                          <AvatarFallback className="text-xs">{pool.token1.symbol[0]}</AvatarFallback>
                        </Avatar>
                      </div>
                      <div>
                        <div className="font-medium">
                          {pool.token0.symbol}/{pool.token1.symbol}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {pool.fee}%
                        </Badge>
                      </div>
                    </div>

                    {/* TVL */}
                    <div className="flex items-center">
                      <div>
                        <div className="font-medium">${formatNumber(pool.tvl)}</div>
                      </div>
                    </div>

                    {/* Volume */}
                    <div className="flex items-center">
                      <div>
                        <div className="font-medium">${formatNumber(pool.volume24h)}</div>
                      </div>
                    </div>

                    {/* APR */}
                    <div className="flex items-center">
                      <div>
                        <div className="font-medium text-green-500">{pool.apr}%</div>
                      </div>
                    </div>

                    {/* Chart */}
                    <div className="flex items-center justify-between">
                      <div className="w-24">
                        {renderChart(pool.priceHistory)}
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleAddLiquidity(pool)}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tokens" className="space-y-4">
          {/* Tokens Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTokens.slice(0, 50).map(token => token && (
              <Card key={token.id} className="hover:bg-muted/50 transition-colors cursor-pointer group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={token.logo} />
                        <AvatarFallback>{token.symbol[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold">{token.symbol}</div>
                        <div className="text-sm text-muted-foreground">{token.name}</div>
                        <div className="text-sm font-medium">${formatNumber(token.price, 6)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${
                        (token.priceChangePercent24h || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {token.priceChangePercent24h !== null ? 
                          `${token.priceChangePercent24h >= 0 ? '+' : ''}${token.priceChangePercent24h.toFixed(2)}%` 
                          : 'N/A'
                        }
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Market Cap</div>
                      <div className="font-medium">
                        {token.marketCap ? `$${formatNumber(token.marketCap)}` : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Volume 24h</div>
                      <div className="font-medium">
                        {token.volume24h ? `$${formatNumber(token.volume24h)}` : 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleTokenClick(token)}
                    >
                      View Details
                    </Button>
                    <Button 
                      size="sm" 
                      className="flex-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setLocation(`/liquidity?create=true&token=${token.id}`)}
                    >
                      Add Liquidity
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <Layout>
      <div className="space-y-6">
        {/* Navigation */}
        <div className="flex items-center space-x-1">
          {['positions', 'pools', 'create'].map((view) => (
            <Button
              key={view}
              variant={activeView === view ? "default" : "ghost"}
              onClick={() => setActiveView(view as any)}
              size="sm"
            >
              {view === 'positions' && 'My Positions'}
              {view === 'pools' && 'Browse Pools'}
              {view === 'create' && 'Add Liquidity'}
            </Button>
          ))}
        </div>

        {/* Content */}
        {activeView === 'positions' && renderMyPositions()}
        {activeView === 'pools' && renderPools()}
        {activeView === 'create' && renderCreatePosition()}
      </div>
    </Layout>
  );
}

export default function Examine() {
  return <LiquidityContent />;
}
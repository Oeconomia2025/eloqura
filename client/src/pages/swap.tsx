import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { usePriceHistory, useTokenData } from "@/hooks/use-token-data";

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
  BarChart3
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
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [chartTimeframe, setChartTimeframe] = useState("1D");
  const [hideSidebar, setHideSidebar] = useState(false);
  const [activeTab, setActiveTab] = useState("Swap");
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [tokenSelectionFor, setTokenSelectionFor] = useState<'from' | 'to' | 'priceCondition'>('from');
  const [tokenSearchQuery, setTokenSearchQuery] = useState("");
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
          tokens.find(t => t.symbol === 'WETH') || tokens[1] : 
          tokens.find(t => t.symbol === 'OEC') || tokens[0];

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
          tokens.find(t => t.symbol === 'WETH') || tokens[1] : 
          tokens.find(t => t.symbol === 'OEC') || tokens[0];

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
          tokens.find(t => t.symbol === 'WETH') || tokens[1] : 
          tokens.find(t => t.symbol === 'OEC') || tokens[0];

        setFromToken(defaultToken);
        setPriceConditionTokens({
          from: defaultToken,
          to: token
        });
      }
    }
    setIsTokenModalOpen(false);
  };

  // Mock token list - in real implementation, this would come from API
  const tokens: Token[] = [
    {
      symbol: "OEC",
      name: "Oeconomia",
      address: "0x0000000000000000000000000000000000000000",
      decimals: 18,
      logo: "/oec-logo.png",
      price: 7.37374,
      balance: 1250.50
    },
    {
      symbol: "USDT",
      name: "Tether USD",
      address: "0x55d398326f99059fF775485246999027B3197955",
      decimals: 18,
      logo: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
      price: 1.00,
      balance: 485.25
    },
    {
      symbol: "BNB",
      name: "BNB",
      address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
      decimals: 18,
      logo: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
      price: 645.50,
      balance: 2.15
    },
    {
      symbol: "WETH",
      name: "Wrapped Ethereum",
      address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
      decimals: 18,
      logo: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
      price: 3850.75,
      balance: 0.085
    },
    {
      symbol: "BTCB",
      name: "Bitcoin BEP2",
      address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
      decimals: 18,
      logo: "https://assets.coingecko.com/coins/images/14108/small/Binance-bitcoin.png",
      price: 98500.25,
      balance: 0.0015
    }
  ];

  // Filter tokens based on search query
  const filteredTokens = tokens.filter(token => 
    token.symbol.toLowerCase().includes(tokenSearchQuery.toLowerCase()) ||
    token.name.toLowerCase().includes(tokenSearchQuery.toLowerCase()) ||
    token.address.toLowerCase().includes(tokenSearchQuery.toLowerCase())
  );

  // Format number with commas and smart decimals
  const formatNumber = (num: number, decimals = 2): string => {
    if (num === 0) return '0';
    if (num < 0.01) return num.toFixed(6).replace(/\.?0+$/, '');
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: decimals 
    });
  };

  // Simulate getting swap quote (from amount to output)
  const getSwapQuote = async (from: Token, to: Token, amount: string, direction: 'from' | 'to' = 'from') => {
    if (!amount || parseFloat(amount) === 0) return null;

    setIsLoading(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const inputAmount = parseFloat(amount);
    let outputAmount, fee, minimumReceived;

    let exchangeRate = from.price / to.price;
    if (direction === 'to') {
      exchangeRate = to.price / from.price;
    }

    if (direction === 'from') {
      outputAmount = inputAmount * exchangeRate;
      fee = inputAmount * 0.003; // 0.3% fee on input
      minimumReceived = outputAmount * (1 - slippage / 100);

      setToAmount(outputAmount.toFixed(6));
    } else {
      const requiredInput = inputAmount * exchangeRate;
      fee = requiredInput * 0.003; // 0.3% fee on input
      const totalRequired = requiredInput + fee;
      minimumReceived = inputAmount * (1 - slippage / 100);

      setFromAmount(totalRequired.toFixed(6));
      outputAmount = inputAmount;
    }

    const priceImpact = Math.random() * 2; // 0-2% random impact

    const mockQuote: SwapQuote = {
      inputAmount: direction === 'from' ? amount : fromAmount,
      outputAmount: direction === 'from' ? outputAmount.toString() : amount,
      exchangeRate: direction === 'from' ? (from.price / to.price) : (to.price / from.price),
      priceImpact,
      minimumReceived: minimumReceived.toString(),
      fee,
      route: [from.symbol, to.symbol]
    };

    setQuote(mockQuote);
    setIsLoading(false);
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

  const handleSwapExecution = async () => {
    if (!fromToken || !toToken || (!fromAmount && !toAmount)) return;

    setIsLoading(true);

    // Simulate swap execution
    setTimeout(() => {
      setFromAmount("");
      setToAmount("");
      setQuote(null);
      setIsLoading(false);
      // Here you would integrate with actual swap contract
    }, 2000);
  };

  // Handle amount changes for both fields
  useEffect(() => {
    if (fromToken && toToken) {
      if (lastEditedField === 'from' && fromAmount) {
        getSwapQuote(fromToken, toToken, fromAmount, 'from');
      } else if (lastEditedField === 'to' && toAmount) {
        getSwapQuote(fromToken, toToken, toAmount, 'to');
      } else {
        setQuote(null);
      }
    } else {
      setQuote(null);
    }
  }, [fromToken, toToken, fromAmount, toAmount, lastEditedField, slippage]);

  // Get price history for the selected token pair
  const chartContractAddress = fromToken?.address || "0x55d398326f99059fF775485246999027B3197955"; // Default to USDT
  const { data: tokenData } = useTokenData(chartContractAddress);
  const { data: priceHistory } = usePriceHistory(chartContractAddress, chartTimeframe);

  // Generate realistic OEC price progression for chart display
  const generateOECPriceHistory = (timeframe: string) => {
    const now = Date.now();

    const getTimeframeConfig = (tf: string) => {
      switch (tf) {
        case "1H":
          return {
            points: 60,
            intervalMs: 60 * 1000, // 1 minute
            startPrice: 7.30, // Close to current
            endPrice: 7.37,
            daysCovered: 1/24 // 1 hour
          };
        case "1D":
          return {
            points: 48,
            intervalMs: 30 * 60 * 1000, // 30 minutes
            startPrice: 7.10, // Yesterday's close
            endPrice: 7.37,
            daysCovered: 1 // 1 day
          };
        case "7D":
          return {
            points: 84,
            intervalMs: 2 * 60 * 60 * 1000, // 2 hours
            startPrice: 5.80, // 7 days ago
            endPrice: 7.37,
            daysCovered: 7 // 7 days
          };
        case "30D":
          return {
            points: 120,
            intervalMs: 6 * 60 * 60 * 1000, // 6 hours
            startPrice: 0.73, // 30 days ago
            endPrice: 7.37,
            daysCovered: 30 // 30 days
          };
        default:
          return {
            points: 48,
            intervalMs: 30 * 60 * 1000,
            startPrice: 7.10,
            endPrice: 7.37,
            daysCovered: 1
          };
      }
    };

    const config = getTimeframeConfig(timeframe);

    return Array.from({ length: config.points }, (_, i) => {
      const progress = i / (config.points - 1);
      const timestamp = Math.floor((now - (config.points - 1 - i) * config.intervalMs) / 1000);

      let basePrice;

      if (timeframe === "30D") {
        // Special 30-day journey: 0.73 → 4.749 (halfway) → 3.00 → 7.37
        if (progress <= 0.5) {
          // First half: 0.73 to 4.749 (peak)
          const halfProgress = progress / 0.5;
          basePrice = 0.73 + (4.749 - 0.73) * halfProgress;
          // Add volatility for initial growth
          const volatility = (Math.random() - 0.5) * 0.15 * halfProgress;
          basePrice *= (1 + volatility);
        } else if (progress <= 0.67) {
          // Correction phase: 4.749 down to ~3.00 over 4-5 days
          const correctionProgress = (progress - 0.5) / 0.17; // 0.5 to 0.67 range
          basePrice = 4.749 - (4.749 - 3.00) * correctionProgress;
          // Add selling pressure volatility
          const volatility = (Math.random() - 0.5) * 0.12;
          basePrice *= (1 + volatility);
        } else {
          // Recovery phase: 3.00 to 7.37
          const recoveryProgress = (progress - 0.67) / 0.33; // 0.67 to 1.0 range
          basePrice = 3.00 + (7.37 - 3.00) * Math.pow(recoveryProgress, 0.8); // Slight curve
          // Add recovery volatility
          const volatility = (Math.random() - 0.5) * 0.08;
          basePrice *= (1 + volatility);
        }
      } else {
        // For shorter timeframes, use smoother progression
        const totalGrowth = config.endPrice / config.startPrice;
        basePrice = config.startPrice * Math.pow(totalGrowth, progress);

        // Add appropriate volatility based on timeframe
        const volatilityScale = timeframe === "1H" ? 0.02 : 
                               timeframe === "1D" ? 0.04 :
                               timeframe === "7D" ? 0.06 : 0.08;
        const volatility = (Math.random() - 0.5) * volatilityScale;
        basePrice *= (1 + volatility);
      }

      // Ensure we end close to target price for all timeframes
      if (i === config.points - 1) {
        basePrice = config.endPrice + (Math.random() - 0.5) * 0.01;
      }

      return {
        timestamp,
        price: Math.max(0.1, basePrice),
        volume: Math.random() * 2000000 + 500000,
      };
    });
  };



  // Set initial tokens based on active tab
  useEffect(() => {
    if (activeTab === "Buy") {
      setFromToken(null); // No from token for buy mode
      setToToken(tokens[0]); // OEC
    } else if (activeTab === "Sell") {
      setFromToken(tokens[0]); // OEC
      setToToken(tokens[1]); // USDT
    } else if (activeTab === "Bridge") {
      // Initialize with default tokens for bridge, or leave null
      setFromToken(tokens[0]); // Example: Start with OEC
      setToToken(tokens[1]);   // Example: Bridge to USDT
    } else {
      setFromToken(tokens[1]); // USDT
      setToToken(tokens[0]); // OEC
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
  };

  const handleSwapPercentage = (percentage: number) => {
    if (!fromToken) return;

    setSwapPercentage(percentage);
    const balance = fromToken.balance || 0;
    const amount = (balance * percentage / 100).toString();
    setFromAmount(amount);
    setLastEditedField('from');
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

  // Check if a token is a stablecoin
  const isStablecoin = (token: Token | null) => {
    if (!token) return false;
    const stablecoins = ['USDT', 'USDC', 'BUSD', 'DAI', 'UST', 'FRAX'];
    return stablecoins.includes(token.symbol.toUpperCase());
  };

  // Determine which chart data to show
  const getChartData = () => {
    if (!showChart) return priceHistory;

    // Show OEC mock data for any pair involving OEC
    if (fromToken?.symbol === 'OEC' || toToken?.symbol === 'OEC') {
      return generateOECPriceHistory(chartTimeframe);
    }

    // For other pairs, use real API data
    return priceHistory;
  };

  const chartPriceHistory = getChartData();

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
                  {["Swap", "Limit", "Buy", "Sell", "Bridge"].map((tab) => (
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

              {/* Standard Swap Interface (Swap tab only) */}
              {activeTab === "Swap" && (
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

              {/* Swap Arrow - Only for Swap tab */}
              {activeTab === "Swap" && (
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

              {/* To Token - Only for Swap tab */}
              {activeTab === "Swap" && (
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



              {/* Action Button - Show for all tabs except Bridge */}
              {activeTab !== "Bridge" && (
                <Button
                  onClick={handleSwapExecution}
                  disabled={
                    isLoading || 
                    (activeTab === "Swap" && (!fromToken || !toToken || (!fromAmount && !toAmount))) ||
                    (activeTab === "Limit" && (!fromToken || !toToken || !fromAmount || !limitOrder.triggerPrice)) ||
                    (activeTab === "Buy" && (!toToken || !fiatAmount)) ||
                    (activeTab === "Sell" && (!fromToken || !fromAmount))
                  }
                  className="w-full bg-gradient-to-r from-crypto-blue to-crypto-green hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-6 text-lg"
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Processing...</span>
                    </div>
                  ) : activeTab === "Swap" ? (
                    !fromToken || !toToken ? "Select Tokens" : 
                    (!fromAmount && !toAmount) ? "Enter Amount" : 
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
              {activeTab === "Swap" && fromToken && toToken && (fromAmount || toAmount) && (
                <div className="bg-[var(--crypto-card)] rounded-lg p-4 border border-[var(--crypto-border)] space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Exchange Rate</span>
                    <span className="text-white">
                      1 {fromToken?.symbol} = {formatNumber(quote?.exchangeRate || (fromToken.price / toToken.price), 6)} {toToken?.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Protocol Fee (0.25%)</span>
                    <span className="text-white">
                      ~${formatNumber((parseFloat(fromAmount) || 0) * (fromToken?.price || 0) * 0.0025, 2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Network Cost</span>
                    <span className="text-white">~$2.50</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Price Impact</span>
                    <span className="text-green-400">&lt; 0.01%</span>
                  </div>
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

              {/* Bridge Mode Interface */}
              {activeTab === "Bridge" && (
                <>
                  <div className="bg-[var(--crypto-dark)] rounded-lg p-4 border border-[var(--crypto-border)]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-sm">From</span>
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

                    {/* Network Selection */}
                    <div className="flex items-center space-x-3 mb-4">
                      <Button
                        variant="outline"
                        onClick={() => openNetworkModal('from')}
                        className="w-40 bg-[var(--crypto-card)] border-[var(--crypto-border)] text-white hover:bg-[var(--crypto-dark)] px-3 py-2 h-auto"
                      >
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                            O
                          </div>
                          <span>OEC Chain</span>
                        </div>
                      </Button>
                    </div>

                    {/* Token Amount */}
                    <div className="flex items-center space-x-3">
                      <Input
                        type="number"
                        value={fromAmount}
                        onChange={(e) => {
                          setFromAmount(e.target.value);
                          setSwapPercentage(null);
                          setLastEditedField('from');
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

                  {/* Bridge Arrow - positioned to match swap arrow */}
                  <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-6 z-30">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {}}
                      className="bg-[var(--crypto-dark)] border-2 border-[var(--crypto-border)] rounded-full w-12 h-12 p-0 hover:bg-[var(--crypto-card)]/80 shadow-xl"
                    >
                      <div className="transform rotate-90">
                        <ArrowUpDown className="w-5 h-5 text-gray-400" />
                      </div>
                    </Button>
                  </div>

                  {/* To Network and Token */}
                  <div className="bg-[var(--crypto-dark)] rounded-lg p-4 border border-[var(--crypto-border)]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-sm">To</span>
                      {toToken && (
                        <span className="text-gray-400 text-sm">
                          Balance: {formatNumber(toToken.balance || 0, 2)} {toToken.symbol}
                        </span>
                      )}
                    </div>

                    {/* Network Selection */}
                    <div className="flex items-center space-x-3 mb-4">
                      <Button
                        variant="outline"
                        onClick={() => openNetworkModal('to')}
                        className="w-40 bg-[var(--crypto-card)] border-[var(--crypto-border)] text-white hover:bg-[var(--crypto-dark)] px-3 py-2 h-auto"
                      >
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                            P
                          </div>
                          <span>Polygon</span>
                        </div>
                      </Button>
                    </div>

                    {/* Received Amount Display */}
                    <div className="flex items-center space-x-3">
                      <Input
                        type="number"
                        value={fromAmount || "0.0"}
                        readOnly
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

                    {/* Estimated Value or Default */}
                    <div className="text-right text-gray-400 text-sm mt-2">
                      {toToken && fromAmount && parseFloat(fromAmount) > 0 ? (
                        `≈ $${formatNumber(parseFloat(fromAmount) * toToken.price, 2)}`
                      ) : (
                        "≈ $0"
                      )}
                    </div>
                  </div>

                  {/* Bridge Button (moved below "To" field) */}
                  <div className="mt-4">
                    <Button
                      onClick={handleSwapExecution} // Reusing handleSwapExecution for bridge action
                      disabled={
                        isLoading ||
                        !fromToken || !toToken || !fromAmount
                      }
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-6 text-lg"
                    >
                      {isLoading ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Bridging...</span>
                        </div>
                      ) : (
                        `Bridge ${fromToken?.symbol || ''}`
                      )}
                    </Button>
                  </div>
                </>
              )}

              {/* Bridge Information */}
              {activeTab === "Bridge" && fromToken && toToken && fromAmount && (
                <div className="bg-[var(--crypto-card)] rounded-lg p-4 border border-[var(--crypto-border)] space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">You Send</span>
                    <span className="text-white">{formatNumber(parseFloat(fromAmount), 6)} {fromToken.symbol}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">You Receive</span>
                    <span className="text-white">{formatNumber(parseFloat(fromAmount), 6)} {toToken.symbol}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Bridge Fee</span>
                    <span className="text-white">$2.50</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Gas Fee</span>
                    <span className="text-white">~$8.75</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Estimated Time</span>
                    <span className="text-white">~2-5 minutes</span>
                  </div>
                  <div className="text-xs text-yellow-400 mt-2 flex items-center">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Bridge transactions are irreversible. Ensure destination address is correct.
                  </div>
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
                            <stop offset="0%" stopColor={getTokenColor(fromToken)} stopOpacity={1.0}/>
                            <stop offset="25%" stopColor={getTokenColor(fromToken)} stopOpacity={1.0}/>
                            <stop offset="75%" stopColor={getTokenColor(fromToken)} stopOpacity={0.5}/>
                            <stop offset="100%" stopColor={getTokenColor(fromToken)} stopOpacity={0}/>
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
                          stroke={getTokenColor(fromToken)}
                          strokeWidth={2}
                          fill={`url(#areaGradient-${fromToken?.symbol || 'default'})`}
                          dot={false}
                          activeDot={{ r: 4, stroke: getTokenColor(fromToken), strokeWidth: 2 }}
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
          {/* Bridge Status */}
          <Card className="crypto-card border">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <div className="w-5 h-5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <ArrowUpDown className="w-3 h-3 text-white transform rotate-90" />
                </div>
                <span>Bridge Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Outgoing Bridge Transaction */}
              <div className="bg-[var(--crypto-dark)] rounded-lg p-3 border border-purple-500/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                      O
                    </div>
                    <span className="text-sm font-medium text-white">OEC Chain</span>
                  </div>
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                    Pending
                  </Badge>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount:</span>
                    <span className="text-white">125.5 OEC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">To:</span>
                    <span className="text-white">Polygon</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className="text-yellow-400">Confirming...</span>
                  </div>
                </div>
                <div className="mt-2 bg-gray-700 rounded-full h-1.5">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 rounded-full w-3/4 animate-pulse"></div>
                </div>
                <div className="text-xs text-gray-400 mt-1">Estimated: 2-5 minutes</div>
              </div>

              {/* Incoming Bridge - Ready to Claim */}
              <div className="bg-[var(--crypto-dark)] rounded-lg p-3 border border-green-500/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                      P
                    </div>
                    <span className="text-sm font-medium text-white">Polygon</span>
                  </div>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    Ready
                  </Badge>
                </div>
                <div className="space-y-1 text-xs mb-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount:</span>
                    <span className="text-white">485.25 USDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">From:</span>
                    <span className="text-white">BSC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className="text-green-400">Complete</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium"
                >
                  <div className="flex items-center space-x-1">
                    <span>Claim</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </Button>
              </div>

              {/* No Active Bridges State */}
              {/* Uncomment this section and comment above when no bridges are active
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2">
                  <ArrowUpDown className="w-6 h-6 text-gray-400 transform rotate-90" />
                </div>
                <p className="text-gray-400 text-sm">No active bridges</p>
              </div>
              */}
            </CardContent>
          </Card>

          {/* Market Stats */}
          <Card className="crypto-card border">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <TrendingUp className="w-5 h-5" />
                <span>Market Stats</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">24h Volume</span>
                  <span className="text-white font-medium">$2.85M</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Total Liquidity</span>
                  <span className="text-white font-medium">$18.9M</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Active Pairs</span>
                  <span className="text-white font-medium">247</span>
                </div>
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
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                  <span className="text-sm text-gray-300">MEV Protection</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                  <span className="text-sm text-gray-300">Slippage Control</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                  <span className="text-sm text-gray-300">Price Impact Warning</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                  <span className="text-sm text-gray-300">Contract Verification</span>
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
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-300">USDT → OEC</span>
                  </div>
                  <span className="text-green-400">+125.50 OEC</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-300">BNB → USDT</span>
                  </div>
                  <span className="text-green-400">+645.00 USDT</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-300">OEC → WETH</span>
                  </div>
                  <span className="text-green-400">+0.085 WETH</span>
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

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filteredTokens.map((token) => (
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

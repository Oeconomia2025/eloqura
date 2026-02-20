import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ReferenceLine 
} from "recharts";
import { getTokenColor, getChartGradientId } from "@/utils/token-colors";
import { Button } from "@/components/ui/button";

interface PriceHistory {
  timestamp: number;
  price: number;
}

export function ETHHistoricalChart() {
  const [timeframe, setTimeframe] = useState("1D");
  
  // PRODUCTION-READY: Use ONLY database cache for complete independence
  const { data: rawPriceHistory, isLoading } = useQuery<PriceHistory[]>({
    queryKey: ["eth-history-database", timeframe],
    queryFn: async () => {
      // Use only database endpoint - never Live Coin Watch API
      const endpoint = window.location.hostname === 'localhost' 
        ? `/api/tokens/historical/ETH/${timeframe}`
        : `/.netlify/functions/token-historical-data?token=ETH&timeframe=${timeframe}`;
        
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Database fetch failed: ${response.status}`);
      }
      const data = await response.json();
      
      // Transform database format to expected format
      return data.map((point: any) => ({
        timestamp: point.timestamp || new Date(point.date).getTime(),
        price: parseFloat(point.price)
      })).sort((a: any, b: any) => a.timestamp - b.timestamp);
    },
    refetchInterval: 10 * 60 * 1000, // Refresh every 10 minutes from database
    retry: 2,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Get ETH's authentic brand color
  const tokenColor = getTokenColor("ETH");
  const gradientId = getChartGradientId("ETH");

  // Smooth the data by reducing data points for cleaner curves
  const smoothPriceData = (data: PriceHistory[] | undefined): PriceHistory[] => {
    if (!data || data.length === 0) return [];
    
    // Ensure we always return meaningful data
    if (data.length <= 5) return data; // Don't filter if we have very few points
    
    // For shorter timeframes, reduce data points more aggressively
    const targetPoints = timeframe === "1H" ? 15 : timeframe === "1D" ? 24 : timeframe === "7D" ? 28 : 30;
    const interval = Math.max(1, Math.floor(data.length / targetPoints));
    
    const filtered = data.filter((_, index) => index % interval === 0 || index === data.length - 1);
    
    // Ensure we have at least 2 points for a line
    return filtered.length < 2 ? data.slice(0, Math.min(data.length, 10)) : filtered;
  };

  const priceHistory = smoothPriceData(rawPriceHistory);

  // Calculate evenly spaced Y-axis ticks
  const calculateYTicks = (data: PriceHistory[]) => {
    if (!data || data.length === 0) return [];
    
    const prices = data.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const padding = (maxPrice - minPrice) * 0.1; // 10% padding
    const adjustedMin = minPrice - padding;
    const adjustedMax = maxPrice + padding;
    const range = adjustedMax - adjustedMin;
    const tickCount = 5;
    const step = range / (tickCount - 1);
    
    return Array.from({ length: tickCount }, (_, i) => adjustedMin + (step * i));
  };

  const yTicks = calculateYTicks(priceHistory);

  const formatXAxis = (tickItem: any) => {
    // Handle different timestamp formats properly
    let date;
    if (typeof tickItem === 'string') {
      // ISO string format
      date = new Date(tickItem);
    } else if (tickItem > 1e12) {
      // Already in milliseconds
      date = new Date(tickItem);
    } else {
      // Unix timestamp in seconds, convert to milliseconds
      date = new Date(tickItem * 1000);
    }
    
    if (isNaN(date.getTime())) {
      return 'Invalid';
    }
    
    switch (timeframe) {
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
      return [`$${Number(value).toFixed(2)}`, 'ETH Price'];
    }
    return [value, name];
  };

  const timeframes = [
    { key: "1H", label: "1H" },
    { key: "1D", label: "24H" },
    { key: "7D", label: "7D" },
    { key: "30D", label: "30D" },
  ];

  // Calculate price change
  const priceChange = priceHistory.length > 1 
    ? ((priceHistory[priceHistory.length - 1].price - priceHistory[0].price) / priceHistory[0].price) * 100 
    : 0;

  const formatPercentage = (percent: number) => {
    return percent >= 0 ? `+${percent.toFixed(2)}%` : `${percent.toFixed(2)}%`;
  };

  const getChangeColor = (percent: number) => {
    return percent >= 0 ? 'text-green-500' : 'text-red-500';
  };

  if (!priceHistory || priceHistory.length === 0) {
    return (
      <div className="bg-crypto-card p-8 rounded-lg border border-crypto-border">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <img 
              src="https://s2.coinmarketcap.com/static/img/coins/32x32/1027.png" 
              alt="ETH"
              className="w-8 h-8"
            />
          </div>
          <div className="flex space-x-2">
            {timeframes.map((tf) => (
              <Button
                key={tf.key}
                variant={timeframe === tf.key ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeframe(tf.key)}
                className={timeframe === tf.key 
                  ? "bg-crypto-blue text-white border-crypto-blue" 
                  : "border-gray-600 text-gray-400 hover:text-white hover:border-gray-400"
                }
                disabled
              >
                {tf.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center h-80 text-gray-400">
          <div className="text-center">
            <p>Live ETH data unavailable</p>
            <p className="text-sm mt-2">Historical data will be available after the next sync</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-crypto-card p-8 rounded-lg border border-crypto-border">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <img 
            src="https://s2.coinmarketcap.com/static/img/coins/32x32/1027.png" 
            alt="ETH"
            className="w-8 h-8"
          />
        </div>
        <div className="flex space-x-2">
          {timeframes.map((tf) => (
            <Button
              key={tf.key}
              variant={timeframe === tf.key ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeframe(tf.key)}
              className={timeframe === tf.key 
                ? "bg-crypto-blue text-white border-crypto-blue" 
                : "border-gray-600 text-gray-400 hover:text-white hover:border-gray-400"
              }
            >
              {tf.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-80">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crypto-blue mx-auto mb-4"></div>
            <p className="text-gray-400">Loading live ETH data...</p>
          </div>
        </div>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={priceHistory} margin={{ top: 20, right: 20, bottom: 5, left: 20 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tokenColor} stopOpacity={1.0}/>
                  <stop offset="25%" stopColor={tokenColor} stopOpacity={1.0}/>
                  <stop offset="100%" stopColor={tokenColor} stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="chartBackground" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#374151" stopOpacity={0.3}/>
                  <stop offset="100%" stopColor="#1F2937" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="100%" height="100%" fill="url(#chartBackground)" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatXAxis}
                stroke="#9CA3AF"
                fontSize={12}
              />
              <YAxis 
                domain={['dataMin * 0.99', 'dataMax * 1.01']}
                ticks={yTicks}
                tickFormatter={(value) => {
                  // Better formatting based on value range
                  if (value >= 1000) return `$${(value/1000).toFixed(1)}k`;
                  if (value >= 100) return `$${value.toFixed(0)}`;
                  if (value >= 1) return `$${value.toFixed(2)}`;
                  return `$${value.toFixed(4)}`;
                }}
                stroke="#9CA3AF"
                fontSize={12}
                tickMargin={12}
              />
              <Tooltip 
                formatter={formatTooltip}
                labelFormatter={(value) => {
                  // Handle different timestamp formats properly
                  let date;
                  if (typeof value === 'string') {
                    // ISO string format
                    date = new Date(value);
                  } else if (value > 1e12) {
                    // Already in milliseconds
                    date = new Date(value);
                  } else {
                    // Unix timestamp in seconds, convert to milliseconds
                    date = new Date(value * 1000);
                  }
                  
                  // Ensure valid date
                  if (isNaN(date.getTime())) {
                    return 'Invalid Date';
                  }
                  
                  return date.toLocaleString();
                }}
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
                stroke={tokenColor} 
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4, fill: tokenColor }}
                connectNulls={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      

    </div>
  );
}
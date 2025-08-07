import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, BarChart3, ArrowUpDown, Droplets, DollarSign } from "lucide-react";
import type { TokenData } from "@shared/schema";

interface TokenOverviewProps {
  tokenData?: any; // Accept both TokenData and Live Coin Watch format
  isLoading: boolean;
}

export function TokenOverview({ tokenData, isLoading }: TokenOverviewProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="crypto-card p-6">
            <Skeleton className="h-4 w-20 mb-4" />
            <Skeleton className="h-8 w-24 mb-2" />
            <Skeleton className="h-4 w-32" />
          </Card>
        ))}
      </div>
    );
  }

  if (!tokenData) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="crypto-card p-6 text-center">
          <p className="text-gray-400">Live data unavailable on static deployment</p>
          <p className="text-gray-500 text-sm mt-2">Connect to a development environment for real-time token data</p>
        </Card>
      </div>
    );
  }

  const formatNumber = (num: number) => {
    const fixed = num.toFixed(5);
    return parseFloat(fixed).toLocaleString('en-US', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 5 
    });
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };
  const formatMarketCap = (cap: number) => formatNumber(cap);
  const formatVolume = (vol: number) => formatNumber(vol);  
  const formatLiquidity = (liq: number) => formatNumber(liq);
  // Handle both database format (Live Coin Watch) and TokenData format
  const price = tokenData.rate || tokenData.price || 0;
  const symbol = tokenData.code || tokenData.symbol || 'ETH';
  const name = tokenData.name || 'Ethereum';
  const marketCap = tokenData.cap || tokenData.marketCap || 0;
  const volume24h = tokenData.volume || tokenData.volume24h || 0;
  const priceChange24h = tokenData.delta?.day || tokenData.priceChangePercent24h || 0;
  const totalSupply = tokenData.totalSupply || 0;
  const circulatingSupply = tokenData.circulatingSupply || 0;
  
  const formatSupply = (supply: number) => `${formatNumber(supply)} ${symbol}`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Price Card */}
      <Card className="p-6 border bg-gradient-to-br from-gray-950 via-gray-950 to-black border-gray-700 hover:border-gray-600 transition-all duration-300 shadow-xl shadow-black/70 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-200 text-sm font-medium">Current Price</h3>
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
              priceChange24h >= 0 
                ? 'bg-green-600/70 text-green-100' 
                : 'bg-red-600/70 text-red-100'
            }`}>
              {priceChange24h >= 0 ? '+' : ''}
              {priceChange24h.toFixed(1)}%
            </span>
          </div>
          <div className="text-2xl font-bold text-white drop-shadow-sm">${formatPrice(price)}</div>
          <div className="text-sm text-gray-400 mt-2">
            24h Change
          </div>
        </div>
      </Card>

      {/* Market Cap Card */}
      <Card className="p-6 border bg-gradient-to-br from-gray-950 via-gray-950 to-black border-gray-700 hover:border-gray-600 transition-all duration-300 shadow-xl shadow-black/70 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-200 text-sm font-medium">Market Cap</h3>
            <BarChart3 className="text-gray-300 w-5 h-5" />
          </div>
          <div className="text-2xl font-bold text-white drop-shadow-sm">${formatMarketCap(marketCap)}</div>
          <div className="text-sm text-gray-400 mt-2">
            Total Supply: {totalSupply ? formatNumber(totalSupply) : 'N/A'} {symbol}
          </div>
        </div>
      </Card>

      {/* Volume Card */}
      <Card className="p-6 border bg-gradient-to-br from-gray-950 via-gray-950 to-black border-gray-700 hover:border-gray-600 transition-all duration-300 shadow-xl shadow-black/70 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-200 text-sm font-medium">24h Volume</h3>
            <ArrowUpDown className="text-gray-300 w-5 h-5" />
          </div>
          <div className="text-2xl font-bold text-white drop-shadow-sm">${formatVolume(volume24h)}</div>
          <div className="text-sm text-gray-400 mt-2">
            Volume Statistics
          </div>
        </div>
      </Card>

      {/* Circulating Supply Card */}
      <Card className="p-6 border bg-gradient-to-br from-gray-950 via-gray-950 to-black border-gray-700 hover:border-gray-600 transition-all duration-300 shadow-xl shadow-black/70 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-200 text-sm font-medium">Circulating Supply</h3>
            <DollarSign className="text-gray-300 w-5 h-5" />
          </div>
          <div className="text-2xl font-bold text-white drop-shadow-sm">{formatNumber(circulatingSupply)}</div>
          <div className="text-sm text-gray-400 mt-2">{symbol} in circulation</div>
        </div>
      </Card>
    </div>
  );
}

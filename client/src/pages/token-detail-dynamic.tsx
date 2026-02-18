import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PriceChart } from "@/components/price-chart";
import { ArrowLeft, ExternalLink, Plus, Copy, Check, DollarSign, BarChart3, Activity, TrendingUp, TrendingDown, Coins } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getCryptoLogo, cleanCoinName } from "@/utils/crypto-logos";
import type { TokenData } from "@shared/schema";

export default function TokenDetailDynamic() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const tokenCode = params.code as string;

  const [copied, setCopied] = useState(false);

  const { data: tokenData, isLoading, error } = useQuery<TokenData & {
    deltaHour?: number,
    deltaWeek?: number,
    deltaMonth?: number,
    deltaQuarter?: number,
    deltaYear?: number,
    logo?: string,
    website?: string
  }>({
    queryKey: [`/api/live-coin-watch/token/${tokenCode}`],
    enabled: !!tokenCode,
    refetchInterval: 15 * 1000,
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncateAddress = (address: string) => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return "0";
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const formatPrice = (price: number | undefined) => {
    if (price === undefined || price === null) return "0.00";
    if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(4);
    if (price >= 0.01) return price.toFixed(6);
    return price.toFixed(8);
  };

  const formatPercentage = (percent: number | undefined) => {
    if (percent === undefined || percent === null) return "0.00%";
    const formatted = Math.abs(percent).toFixed(2);
    return `${percent >= 0 ? '+' : '-'}${formatted}%`;
  };

  const getChangeColor = (percent: number | undefined) => {
    if (percent === undefined || percent === null) return "text-gray-400";
    return percent >= 0 ? "text-crypto-green" : "text-crypto-red";
  };

  if (isLoading || !tokenData) {
    return (
      <Layout>
        <div className="container mx-auto p-6 space-y-6">
          <LoadingSpinner text="Loading token details" size="lg" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <Card className="crypto-card p-8 text-center">
            <h2 className="text-xl font-semibold mb-4">Token Not Found</h2>
            <p className="text-gray-400 mb-4">
              The token "{tokenCode}" was not found in our database.
            </p>
            <Button
              variant="outline"
              onClick={() => setLocation("/liquidity?tab=tokens")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              View Available Tokens
            </Button>
          </Card>
        </div>
      </Layout>
    );
  }

  const resolvedLogo = getCryptoLogo(tokenCode, tokenData.symbol);
  const priceChangePercent = tokenData.priceChangePercent24h ?? 0;
  const isPositive = priceChangePercent >= 0;

  return (
    <Layout
      tokenLogo={resolvedLogo}
      tokenWebsite={tokenData.website}
      tokenTicker={tokenData.symbol || tokenCode}
      tokenName={cleanCoinName(tokenData.name)}
    >
      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/liquidity?tab=tokens")}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Tokens
            </Button>

            <Button
              size="sm"
              onClick={() => setLocation("/liquidity?tab=add")}
              className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Liquidity
            </Button>
          </div>

          {/* Token Identity */}
          <div className="flex items-center space-x-4">
            <img
              src={resolvedLogo}
              alt={tokenData.symbol}
              className="w-12 h-12 rounded-full"
            />
            <div>
              <h1 className="text-2xl font-bold text-white">
                {cleanCoinName(tokenData.name)}
              </h1>
              <span className="text-gray-400 text-sm">{tokenData.symbol || tokenCode}</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card className="crypto-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-xs">Price</span>
                <DollarSign className="w-3 h-3 text-white" />
              </div>
              <div className="text-lg font-bold text-white mb-1">
                ${formatPrice(tokenData.price)}
              </div>
              <div className={`flex items-center space-x-1 text-xs ${isPositive ? 'text-crypto-green' : 'text-red-400'}`}>
                {isPositive ? (
                  <TrendingUp className="w-2 h-2" />
                ) : (
                  <TrendingDown className="w-2 h-2" />
                )}
                <span className="font-medium">
                  {formatPercentage(priceChangePercent)}
                </span>
              </div>
            </Card>

            <Card className="crypto-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-xs">Market Cap</span>
                <BarChart3 className="w-3 h-3 text-crypto-blue" />
              </div>
              <div className="text-lg font-bold text-crypto-blue">
                ${formatNumber(tokenData.marketCap)}
              </div>
            </Card>

            <Card className="crypto-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-xs">24H Volume</span>
                <Activity className="w-3 h-3 text-crypto-green" />
              </div>
              <div className="text-lg font-bold text-crypto-green">
                ${formatNumber(tokenData.volume24h)}
              </div>
            </Card>

            <Card className="crypto-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-xs">Circulating Supply</span>
                <Coins className="w-3 h-3 text-crypto-purple" />
              </div>
              <div className="text-lg font-bold text-crypto-purple">
                {formatNumber(tokenData.circulatingSupply)}
              </div>
            </Card>

            <Card className="crypto-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-xs">Total Supply</span>
                <DollarSign className="w-3 h-3 text-gray-400" />
              </div>
              <div className="text-lg font-bold text-white">
                {formatNumber(tokenData.totalSupply)}
              </div>
            </Card>
          </div>

          {/* Chart + Info Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart (2/3 width) */}
            <div className="lg:col-span-2">
              <PriceChart
                contractAddress={tokenData.contractAddress}
                tokenSymbol={tokenData.symbol}
                tokenData={tokenData}
                formatPercentage={formatPercentage}
                getChangeColor={getChangeColor}
              />
            </div>

            {/* Side Info (1/3 width) */}
            <div className="space-y-6">
              {/* Token Information */}
              <Card className="crypto-card p-6">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-white text-lg">Token Information</CardTitle>
                </CardHeader>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Contract</span>
                    {tokenData.contractAddress ? (
                      <button
                        onClick={() => copyToClipboard(tokenData.contractAddress)}
                        className={`flex items-center space-x-2 font-mono text-sm transition-colors cursor-pointer group ${
                          copied ? 'text-green-400' : 'text-white hover:text-crypto-blue'
                        }`}
                        title="Click to copy full contract address"
                      >
                        <span>{truncateAddress(tokenData.contractAddress)}</span>
                        {copied ? (
                          <Check className="w-3 h-3 text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-400 group-hover:text-crypto-blue transition-colors" />
                        )}
                      </button>
                    ) : (
                      <span className="text-white font-mono text-sm">N/A</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Supply</span>
                    <span className="text-white">
                      {tokenData.totalSupply ? formatNumber(tokenData.totalSupply) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Network</span>
                    <span className="text-white">BSC</span>
                  </div>
                </div>
              </Card>

              {/* About */}
              <Card className="crypto-card p-6">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-white text-lg">About</CardTitle>
                </CardHeader>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Real-time {cleanCoinName(tokenData.name)} ({tokenData.symbol}) pricing data powered by Live Coin Watch.
                </p>
              </Card>

              {/* Quick Actions */}
              <Card className="crypto-card p-6">
                <CardHeader className="p-0 pb-4">
                  <CardTitle className="text-white text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <div className="space-y-3">
                  <Button
                    onClick={() => setLocation("/liquidity?tab=add")}
                    className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Liquidity
                  </Button>

                  {tokenData.website && (
                    <Button
                      variant="outline"
                      onClick={() => window.open(tokenData.website, '_blank')}
                      className="w-full border-gray-600 hover:bg-gray-600/10"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Official Website
                    </Button>
                  )}
                </div>
              </Card>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}

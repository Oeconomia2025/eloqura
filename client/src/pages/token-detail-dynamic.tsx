import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PriceChart } from "@/components/price-chart";
import { ArrowLeft, ExternalLink, Plus, Copy, Check } from "lucide-react";
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

  return (
    <Layout
      tokenLogo={resolvedLogo}
      tokenWebsite={tokenData.website}
      tokenTicker={tokenData.symbol || tokenCode}
      tokenName={cleanCoinName(tokenData.name)}
    >
      <div className="container mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/liquidity?tab=tokens")}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Tokens
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (tokenData.contractAddress) {
                  copyToClipboard(tokenData.contractAddress);
                }
              }}
              className={`border-gray-600 hover:border-gray-500 ${
                copied
                  ? 'text-green-400 border-green-400/50'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {copied ? <Check className="w-4 h-4 mr-2 text-green-400" /> : <Copy className="w-4 h-4 mr-2" />}
              <span className={copied ? 'text-green-400' : ''}>{tokenData.contractAddress}</span>
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
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Card className="crypto-card p-3">
            <div>
              <p className="text-xs text-gray-400">Current Price</p>
              <p className="text-base font-semibold">${formatPrice(tokenData.price)}</p>
            </div>
          </Card>

          <Card className="crypto-card p-3">
            <div>
              <p className="text-xs text-gray-400">24h Volume</p>
              <p className="text-base font-semibold">${formatNumber(tokenData.volume24h)}</p>
            </div>
          </Card>

          <Card className="crypto-card p-3">
            <div>
              <p className="text-xs text-gray-400">Market Cap</p>
              <p className="text-base font-semibold">${formatNumber(tokenData.marketCap)}</p>
            </div>
          </Card>

          <Card className="crypto-card p-3">
            <div>
              <p className="text-xs text-gray-400">Circulating Supply</p>
              <p className="text-base font-semibold">{formatNumber(tokenData.circulatingSupply)}</p>
            </div>
          </Card>

          <Card className="crypto-card p-3">
            <div>
              <p className="text-xs text-gray-400">Total Supply</p>
              <p className="text-base font-semibold">{formatNumber(tokenData.totalSupply)}</p>
            </div>
          </Card>
        </div>

        {/* Chart Section */}
        <PriceChart
          contractAddress={tokenData.contractAddress}
          tokenSymbol={tokenData.symbol}
          tokenData={tokenData}
          formatPercentage={formatPercentage}
          getChangeColor={getChangeColor}
        />

        {/* Actions */}
        <div className="flex flex-wrap gap-4">
          <Button
            onClick={() => setLocation("/liquidity?tab=tokens")}
            className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Liquidity
          </Button>

          <Button
            variant="outline"
            onClick={() => copyToClipboard(tokenData.contractAddress)}
            className="border-crypto-blue text-crypto-blue hover:bg-crypto-blue/10"
          >
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? 'Copied!' : truncateAddress(tokenData.contractAddress)}
          </Button>

          {tokenData.website && (
            <Button
              variant="outline"
              onClick={() => window.open(tokenData.website, '_blank')}
              className="border-gray-600 hover:bg-gray-600/10"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Official Website
            </Button>
          )}
        </div>
      </div>
    </Layout>
  );
}

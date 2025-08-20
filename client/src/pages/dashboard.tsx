import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { TokenOverview } from "@/components/token-overview";
import { PriceChart } from "@/components/price-chart";
import { ETHHistoricalChart } from "@/components/eth-historical-chart";
import { TokenInfoPanel } from "@/components/token-info-panel";
import { VolumeLiquidityAnalytics } from "@/components/volume-liquidity-analytics";
import { HistoricalPerformance } from "@/components/historical-performance";
import { TransactionsTable } from "@/components/transactions-table";
import { HolderStatistics } from "@/components/holder-statistics";
import { QuickActions } from "@/components/quick-actions";
import { useTokenData } from "@/hooks/use-token-data";
import { useQuery } from "@tanstack/react-query";
import { TONE_TOKEN_CONFIG } from "@shared/schema";
import { Layout } from "@/components/layout";
import { formatCryptoData } from "@/utils/crypto-logos";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function Dashboard() {
  const [contractAddress, setContractAddress] = useState(TONE_TOKEN_CONFIG.contractAddress);
  const [inputAddress, setInputAddress] = useState(contractAddress);
  const [selectedToken, setSelectedToken] = useState("ETH");

  const { data: tokenData, isLoading } = useTokenData(contractAddress);

  // PRODUCTION-READY: Fetch data from database only - no Live Coin Watch API
  const { data: liveCoinData, isLoading: isLiveCoinLoading } = useQuery({
    queryKey: ['/api/tokens/coins-database'],
    queryFn: async () => {
      const endpoint = window.location.hostname === 'localhost' 
        ? '/api/tokens/coins'
        : '/.netlify/functions/token-coins-data';

      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Database fetch failed: ${response.status}`);
      }
      return response.json();
    },
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
    retry: 2,
  }) as { data: { coins: any[] } | undefined; isLoading: boolean };

  // Get selected token data from Live Coin Watch
  const selectedTokenData = liveCoinData?.coins?.find((coin: any) => 
    coin.code === selectedToken
  );

  const handleAddressUpdate = () => {
    if (inputAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setContractAddress(inputAddress);
    }
  };

  // PRODUCTION-READY: Use database ETH data only - no Live Coin Watch API
  const { data: ethTokenData, isLoading: isEthLoading } = useQuery({
    queryKey: ['/api/tokens/eth-database'],
    queryFn: async () => {
      const endpoint = window.location.hostname === 'localhost' 
        ? '/api/tokens/ETH'
        : '/.netlify/functions/token-data?token=ETH';

      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`ETH database fetch failed: ${response.status}`);
      }
      return response.json();
    },
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
    retry: 2,
  });

  const defaultTokenData = ethTokenData as any;



  return (
    <Layout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Token Overview Cards - Use Live Data */}
          {isEthLoading ? <LoadingSpinner /> : <TokenOverview tokenData={defaultTokenData} />}

  <div className="grid grid-cols-1 gap-8">
    {/* Charts block (full width) */}
    <div>
            <ETHHistoricalChart />

            {/* Volume and Liquidity Analytics */}
            <VolumeLiquidityAnalytics contractAddress={contractAddress} />

            {/* Historical Performance Charts */}
            <HistoricalPerformance contractAddress={contractAddress} />
          </div>

    {/* Token Information (now below the charts) */}
    {isEthLoading ? <LoadingSpinner /> : <TokenInfoPanel tokenData={defaultTokenData} />}
          </div>

          {/* Recent Transactions Table */}
          <TransactionsTable contractAddress={contractAddress} />

          {/* Holder Statistics */}
          <HolderStatistics contractAddress={contractAddress} tokenData={defaultTokenData} />

          {/* Quick Actions */}
          <QuickActions contractAddress={contractAddress} />

          
        </div>
      </div>
    </Layout>
  );
}

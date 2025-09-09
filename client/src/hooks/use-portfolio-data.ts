
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

interface PortfolioData {
  totalNetWorth: number;
  oecBalance: number;
  eloqBalance: number;
  oecValue: number;
  eloqValue: number;
  totalTVL: number;
  activePoolsCount: number;
  stakingPositions: number;
  totalRewards: number;
  portfolioChange24h: number;
}

interface Pool {
  id: string;
  name: string;
  token0: string;
  token1: string;
  liquidity: number;
  volume24h: number;
  apr: number;
  userLiquidity?: number;
}

interface StakingPosition {
  id: string;
  token: string;
  amount: number;
  rewards: number;
  apr: number;
  lockPeriod?: string;
}

// Mock data - replace with actual API calls
const mockPortfolioData: PortfolioData = {
  totalNetWorth: 12450.50,
  oecBalance: 1500.75,
  eloqBalance: 2500.25,
  oecValue: 7500.25,
  eloqValue: 4950.25,
  totalTVL: 8750.50,
  activePoolsCount: 3,
  stakingPositions: 2,
  totalRewards: 145.75,
  portfolioChange24h: 5.67
};

const mockPools: Pool[] = [
  {
    id: "1",
    name: "OEC/USDC",
    token0: "OEC",
    token1: "USDC",
    liquidity: 125000,
    volume24h: 45000,
    apr: 12.5,
    userLiquidity: 2500
  },
  {
    id: "2", 
    name: "ELOQ/ETH",
    token0: "ELOQ",
    token1: "ETH",
    liquidity: 89000,
    volume24h: 32000,
    apr: 18.7,
    userLiquidity: 3750
  },
  {
    id: "3",
    name: "OEC/ELOQ",
    token0: "OEC", 
    token1: "ELOQ",
    liquidity: 67000,
    volume24h: 28000,
    apr: 22.3,
    userLiquidity: 2500
  }
];

const mockStakingPositions: StakingPosition[] = [
  {
    id: "1",
    token: "OEC",
    amount: 500,
    rewards: 25.75,
    apr: 15.2,
    lockPeriod: "30 days"
  },
  {
    id: "2",
    token: "ELOQ", 
    amount: 750,
    rewards: 42.50,
    apr: 18.9
  }
];

export function usePortfolioData() {
  const { address, isConnected } = useAccount();

  return useQuery({
    queryKey: ["portfolio", address],
    queryFn: async () => {
      if (!isConnected || !address) {
        throw new Error("Wallet not connected");
      }

      // TODO: Replace with actual API calls
      // const response = await fetch(`/api/portfolio/${address}`);
      // const data = await response.json();
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        stats: mockPortfolioData,
        pools: mockPools,
        stakingPositions: mockStakingPositions
      };
    },
    enabled: isConnected && !!address,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useLiquidityPools() {
  const { address, isConnected } = useAccount();

  return useQuery({
    queryKey: ["liquidity-pools", address],
    queryFn: async () => {
      if (!isConnected || !address) {
        throw new Error("Wallet not connected");
      }

      // TODO: Replace with actual API call to get user's liquidity positions
      // const response = await fetch(`/api/liquidity-pools/${address}`);
      // return response.json();
      
      await new Promise(resolve => setTimeout(resolve, 500));
      return mockPools.filter(pool => pool.userLiquidity && pool.userLiquidity > 0);
    },
    enabled: isConnected && !!address,
    refetchInterval: 15000,
  });
}

export function useStakingPositions() {
  const { address, isConnected } = useAccount();

  return useQuery({
    queryKey: ["staking-positions", address],
    queryFn: async () => {
      if (!isConnected || !address) {
        throw new Error("Wallet not connected");
      }

      // TODO: Replace with actual API call to get user's staking positions
      // const response = await fetch(`/api/staking-positions/${address}`);
      // return response.json();
      
      await new Promise(resolve => setTimeout(resolve, 500));
      return mockStakingPositions;
    },
    enabled: isConnected && !!address,
    refetchInterval: 30000,
  });
}

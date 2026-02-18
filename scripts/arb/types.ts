import type { Address } from "viem";

export interface TokenInfo {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
}

export interface PoolInfo {
  address: Address;
  token0: TokenInfo;
  token1: TokenInfo;
  reserve0: bigint;
  reserve1: bigint;
  /** Price of token0 in terms of token1, adjusted for decimals */
  price0in1: number;
  /** Price of token1 in terms of token0, adjusted for decimals */
  price1in0: number;
}

export interface UniswapQuote {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  feeTier: number;
  /** Price = amountOut/amountIn adjusted for decimals */
  price: number;
}

export type ArbType = "intra-eloqura" | "cross-dex";

export interface ArbOpportunity {
  type: ArbType;
  /** Human-readable description, e.g. "OEC/USDC: Eloqura cheap, Uniswap expensive" */
  description: string;
  /** Spread as a fraction (0.01 = 1%) */
  spread: number;
  /** Optimal input amount for leg 1 */
  inputAmount: bigint;
  /** Token to start with */
  inputToken: TokenInfo;
  /** Expected profit in inputToken units */
  estimatedProfit: bigint;
  /** Leg 1: buy cheap */
  leg1: ArbLeg;
  /** Leg 2: sell expensive */
  leg2: ArbLeg;
}

export interface ArbLeg {
  venue: "eloqura" | "uniswap";
  action: "buy" | "sell";
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  expectedAmountOut: bigint;
  /** For Eloqura: router address. For Uniswap: SwapRouter02 address */
  routerAddress: Address;
  /** Eloqura: swap path. Uniswap: fee tier */
  path?: Address[];
  feeTier?: number;
}

export interface BotConfig {
  dryRun: boolean;
  verbose: boolean;
  once: boolean;
  /** Minimum spread to act on (0.005 = 0.5%) */
  minSpread: number;
  /** Max trade size as fraction of pool reserves (0.05 = 5%) */
  maxReserveFraction: number;
  /** Slippage tolerance (0.005 = 0.5%) */
  slippage: number;
  /** Swap deadline in seconds */
  deadlineSeconds: number;
  /** Polling interval in ms */
  intervalMs: number;
}

export interface CycleStats {
  cycle: number;
  poolsChecked: number;
  opportunitiesFound: number;
  tradesExecuted: number;
  totalProfit: Map<string, bigint>; // symbol -> profit
  errors: number;
}

import type { Address } from "viem";
import { publicClient } from "./clients.js";
import { UNISWAP, UNISWAP_FEE_TIERS } from "./config.js";
import { log } from "./logger.js";
import type { PoolInfo, TokenInfo, UniswapQuote } from "./types.js";

const QUOTER_ABI = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
] as const;

/**
 * Get a Uniswap V3 quote for a token pair, trying all fee tiers.
 * Returns the best quote (highest output) or null if no pool exists.
 */
export async function getUniswapQuote(
  tokenIn: TokenInfo,
  tokenOut: TokenInfo,
  amountIn: bigint,
  verbose: boolean,
): Promise<UniswapQuote | null> {
  let bestQuote: UniswapQuote | null = null;

  for (const feeTier of UNISWAP_FEE_TIERS) {
    try {
      const result = await publicClient.simulateContract({
        address: UNISWAP.QuoterV2,
        abi: QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            amountIn,
            fee: feeTier,
            sqrtPriceLimitX96: 0n,
          },
        ],
      });

      const amountOut = result.result[0] as bigint;

      if (amountOut > 0n && (!bestQuote || amountOut > bestQuote.amountOut)) {
        const price =
          (Number(amountOut) / 10 ** tokenOut.decimals) /
          (Number(amountIn) / 10 ** tokenIn.decimals);

        bestQuote = {
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amountIn,
          amountOut,
          feeTier,
          price,
        };
      }
    } catch {
      // No pool at this fee tier — expected, skip silently
    }
  }

  if (bestQuote) {
    log.verbose(
      `  Uniswap ${tokenIn.symbol}→${tokenOut.symbol}: ` +
      `${(Number(amountIn) / 10 ** tokenIn.decimals).toFixed(4)} → ` +
      `${(Number(bestQuote.amountOut) / 10 ** tokenOut.decimals).toFixed(4)} ` +
      `(fee tier ${bestQuote.feeTier / 10000}%)`,
      verbose,
    );
  } else {
    log.verbose(`  Uniswap ${tokenIn.symbol}→${tokenOut.symbol}: no pool found`, verbose);
  }

  return bestQuote;
}

/**
 * For each Eloqura pool, compute the price and try to get a Uniswap quote
 * for comparison. Returns a map of token pair key -> { eloqura price, uniswap price }.
 */
export interface PriceComparison {
  pool: PoolInfo;
  eloquraPrice: number; // price of token0 in token1
  uniswapQuote: UniswapQuote | null;
  uniswapPrice: number | null; // same direction as eloquraPrice
}

export async function getPriceComparisons(
  pools: PoolInfo[],
  verbose: boolean,
): Promise<PriceComparison[]> {
  const comparisons: PriceComparison[] = [];

  for (const pool of pools) {
    // Use 1 unit of token0 as the reference amount for price comparison
    const refAmount = 10n ** BigInt(pool.token0.decimals);

    // Try Uniswap quote: token0 → token1
    const uniQuote = await getUniswapQuote(pool.token0, pool.token1, refAmount, verbose);

    comparisons.push({
      pool,
      eloquraPrice: pool.price0in1,
      uniswapQuote: uniQuote,
      uniswapPrice: uniQuote?.price ?? null,
    });
  }

  return comparisons;
}

/**
 * Print a price summary table for all pools.
 */
export function printPriceSummary(comparisons: PriceComparison[]): void {
  log.separator();
  log.info("Price Summary:");
  log.info(`${"Pair".padEnd(20)} ${"Eloqura".padEnd(16)} ${"Uniswap".padEnd(16)} ${"Spread".padEnd(10)}`);
  log.separator();

  for (const c of comparisons) {
    const pair = `${c.pool.token0.symbol}/${c.pool.token1.symbol}`;
    const ePrice = c.eloquraPrice.toFixed(6);
    const uPrice = c.uniswapPrice?.toFixed(6) ?? "—";

    let spread = "—";
    if (c.uniswapPrice !== null && c.uniswapPrice > 0) {
      const s = ((c.eloquraPrice - c.uniswapPrice) / c.uniswapPrice) * 100;
      spread = `${s >= 0 ? "+" : ""}${s.toFixed(2)}%`;
    }

    log.info(`${pair.padEnd(20)} ${ePrice.padEnd(16)} ${uPrice.padEnd(16)} ${spread.padEnd(10)}`);
  }

  log.separator();
}

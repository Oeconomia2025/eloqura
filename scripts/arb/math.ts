/**
 * AMM math utilities for Uniswap V2-style constant product pools.
 * Eloqura uses the same x*y=k formula with 0.3% fee.
 */

const FEE_NUMERATOR = 997n;   // 0.3% fee: (1000 - 3) = 997
const FEE_DENOMINATOR = 1000n;

/**
 * Calculate output amount for a given input, accounting for 0.3% fee.
 * Mirrors the Uniswap V2 getAmountOut formula.
 */
export function getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const amountInWithFee = amountIn * FEE_NUMERATOR;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * FEE_DENOMINATOR + amountInWithFee;
  return numerator / denominator;
}

/**
 * Calculate input amount needed to get a desired output.
 */
export function getAmountIn(amountOut: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (amountOut <= 0n || reserveIn <= 0n || reserveOut <= amountOut) return 0n;
  const numerator = reserveIn * amountOut * FEE_DENOMINATOR;
  const denominator = (reserveOut - amountOut) * FEE_NUMERATOR;
  return numerator / denominator + 1n;
}

/**
 * Calculate the spot price of tokenA in terms of tokenB,
 * adjusted for different decimal places.
 */
export function spotPrice(reserveA: bigint, decimalsA: number, reserveB: bigint, decimalsB: number): number {
  if (reserveA === 0n) return 0;
  // price = (reserveB / 10^decimalsB) / (reserveA / 10^decimalsA)
  const adjustedA = Number(reserveA) / 10 ** decimalsA;
  const adjustedB = Number(reserveB) / 10 ** decimalsB;
  return adjustedB / adjustedA;
}

/**
 * Binary search for optimal trade size that maximizes profit.
 *
 * For a cross-DEX arb (buy on cheap venue, sell on expensive venue):
 *   profit(x) = sellOutput(buyOutput(x)) - x
 *
 * We search for the x that maximizes this.
 *
 * @param maxInput - Maximum input to consider (e.g. 5% of reserves)
 * @param profitFn - Function that returns profit for a given input amount
 * @returns Optimal input amount and expected profit
 */
export function findOptimalTradeSize(
  maxInput: bigint,
  profitFn: (input: bigint) => bigint,
): { optimalInput: bigint; profit: bigint } {
  // Minimum step: don't go below 1000 wei to avoid dust
  const MIN_STEP = 1000n;

  let lo = MIN_STEP;
  let hi = maxInput;
  let bestInput = 0n;
  let bestProfit = 0n;

  // Golden section search (more efficient for unimodal functions)
  const PHI = 1.618033988749895;
  const RESPHI = 2 - PHI;

  // Use ternary search: split range into thirds, keep the better third
  for (let i = 0; i < 64; i++) {
    if (hi - lo < MIN_STEP * 3n) break;

    const range = hi - lo;
    const mid1 = lo + bigintMul(range, 1n, 3n);
    const mid2 = lo + bigintMul(range, 2n, 3n);

    const p1 = profitFn(mid1);
    const p2 = profitFn(mid2);

    if (p1 > bestProfit) { bestProfit = p1; bestInput = mid1; }
    if (p2 > bestProfit) { bestProfit = p2; bestInput = mid2; }

    if (p1 < p2) {
      lo = mid1;
    } else {
      hi = mid2;
    }
  }

  // Check edges
  const pLo = profitFn(lo);
  const pHi = profitFn(hi);
  if (pLo > bestProfit) { bestProfit = pLo; bestInput = lo; }
  if (pHi > bestProfit) { bestProfit = pHi; bestInput = hi; }

  return { optimalInput: bestInput, profit: bestProfit };
}

/** Multiply a bigint by a fraction (num/den) without overflow for moderate values */
function bigintMul(value: bigint, num: bigint, den: bigint): bigint {
  return (value * num) / den;
}

/**
 * Format a bigint token amount as a human-readable string with decimals.
 */
export function formatAmount(amount: bigint, decimals: number, precision: number = 6): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const frac = amount % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, precision);
  // Trim trailing zeros
  const trimmed = fracStr.replace(/0+$/, "") || "0";
  return `${whole}.${trimmed}`;
}

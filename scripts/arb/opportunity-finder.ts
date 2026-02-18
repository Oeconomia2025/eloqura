import type { Address } from "viem";
import { ELOQURA, UNISWAP } from "./config.js";
import { log } from "./logger.js";
import { getAmountOut, findOptimalTradeSize, formatAmount } from "./math.js";
import type { PriceComparison } from "./price-monitor.js";
import type { ArbOpportunity, BotConfig, PoolInfo, TokenInfo } from "./types.js";

/**
 * Detect cross-DEX arbitrage opportunities by comparing Eloqura vs Uniswap prices.
 *
 * If Eloqura price for token0/token1 is LOWER than Uniswap:
 *   → Buy token0 on Eloqura (cheap), sell token0 on Uniswap (expensive)
 *
 * If Eloqura price is HIGHER:
 *   → Buy token0 on Uniswap (cheap), sell token0 on Eloqura (expensive)
 */
export function findCrossDexOpportunities(
  comparisons: PriceComparison[],
  config: BotConfig,
): ArbOpportunity[] {
  const opportunities: ArbOpportunity[] = [];

  for (const c of comparisons) {
    if (c.uniswapPrice === null || !c.uniswapQuote) continue;

    const spread = Math.abs(c.eloquraPrice - c.uniswapPrice) / Math.min(c.eloquraPrice, c.uniswapPrice);

    if (spread < config.minSpread) {
      log.verbose(
        `  ${c.pool.token0.symbol}/${c.pool.token1.symbol}: spread ${(spread * 100).toFixed(3)}% < threshold`,
        config.verbose,
      );
      continue;
    }

    // Eloqura cheaper → buy on Eloqura, sell on Uniswap
    const eloquraCheaper = c.eloquraPrice < c.uniswapPrice;
    const cheapVenue = eloquraCheaper ? "eloqura" : "uniswap";
    const expensiveVenue = eloquraCheaper ? "uniswap" : "eloqura";

    // For cross-DEX: we buy token0 on the cheap venue using token1, then sell token0 on the expensive venue for token1
    // So the input/output token is token1 (we start and end with token1)
    const inputToken = c.pool.token1;
    const tradeToken = c.pool.token0;

    // Max trade: 5% of Eloqura pool reserves (the smaller venue)
    const maxInputByReserve = (c.pool.reserve1 * BigInt(Math.floor(config.maxReserveFraction * 10000))) / 10000n;

    if (maxInputByReserve === 0n) continue;

    // Profit function: buy tradeToken on cheap venue, sell on expensive venue
    // For simplicity, use Eloqura AMM math for the Eloqura leg
    // For Uniswap, scale linearly from the quote (approximation for small amounts)
    const profitFn = (inputAmount: bigint): bigint => {
      if (eloquraCheaper) {
        // Buy on Eloqura: input token1 → get token0
        const token0Got = getAmountOut(inputAmount, c.pool.reserve1, c.pool.reserve0);
        if (token0Got === 0n) return 0n;

        // Sell on Uniswap: token0 → token1 (scale from quote)
        // quote was for 1 unit of token0 → uniswapPrice token1
        // so for token0Got, expected output ≈ token0Got * uniswapPrice * 10^decimals1 / 10^decimals0
        const uniOut = scaleQuoteOutput(token0Got, c.uniswapQuote!);
        return uniOut > inputAmount ? uniOut - inputAmount : 0n;
      } else {
        // Buy on Uniswap: input token1 → get token0 via Uniswap
        // Approximate: token0Got ≈ inputAmount / uniswapQuote.price * 10^decimals0 / 10^decimals1
        // But we need the reverse direction. Quote was token0→token1, we need token1→token0
        // Use inverse: for inputAmount of token1, get ≈ inputAmount / price in token0 units
        const token0Got = scaleQuoteReverse(inputAmount, c.uniswapQuote!, c.pool.token0, c.pool.token1);
        if (token0Got === 0n) return 0n;

        // Sell on Eloqura: token0 → token1
        const eloquraOut = getAmountOut(token0Got, c.pool.reserve0, c.pool.reserve1);
        return eloquraOut > inputAmount ? eloquraOut - inputAmount : 0n;
      }
    };

    const { optimalInput, profit } = findOptimalTradeSize(maxInputByReserve, profitFn);

    if (profit <= 0n) {
      log.verbose(
        `  ${c.pool.token0.symbol}/${c.pool.token1.symbol}: spread ${(spread * 100).toFixed(2)}% but no profit after fees`,
        config.verbose,
      );
      continue;
    }

    // Compute leg details
    let leg1AmountOut: bigint;
    let leg2AmountOut: bigint;

    if (eloquraCheaper) {
      leg1AmountOut = getAmountOut(optimalInput, c.pool.reserve1, c.pool.reserve0);
      leg2AmountOut = scaleQuoteOutput(leg1AmountOut, c.uniswapQuote!);
    } else {
      leg1AmountOut = scaleQuoteReverse(optimalInput, c.uniswapQuote!, c.pool.token0, c.pool.token1);
      leg2AmountOut = getAmountOut(leg1AmountOut, c.pool.reserve0, c.pool.reserve1);
    }

    const opportunity: ArbOpportunity = {
      type: "cross-dex",
      description: `${tradeToken.symbol}/${inputToken.symbol}: ${cheapVenue} cheap → ${expensiveVenue} expensive`,
      spread,
      inputAmount: optimalInput,
      inputToken,
      estimatedProfit: profit,
      leg1: {
        venue: cheapVenue as "eloqura" | "uniswap",
        action: "buy",
        tokenIn: inputToken.address,
        tokenOut: tradeToken.address,
        amountIn: optimalInput,
        expectedAmountOut: leg1AmountOut,
        routerAddress: eloquraCheaper ? ELOQURA.Router : UNISWAP.SwapRouter02,
        ...(eloquraCheaper
          ? { path: [inputToken.address, tradeToken.address] }
          : { feeTier: c.uniswapQuote!.feeTier }),
      },
      leg2: {
        venue: expensiveVenue as "eloqura" | "uniswap",
        action: "sell",
        tokenIn: tradeToken.address,
        tokenOut: inputToken.address,
        amountIn: leg1AmountOut,
        expectedAmountOut: leg2AmountOut,
        routerAddress: eloquraCheaper ? UNISWAP.SwapRouter02 : ELOQURA.Router,
        ...(eloquraCheaper
          ? { feeTier: c.uniswapQuote!.feeTier }
          : { path: [tradeToken.address, inputToken.address] }),
      },
    };

    opportunities.push(opportunity);

    log.opportunity(
      `${opportunity.description} | spread: ${(spread * 100).toFixed(2)}% | ` +
      `input: ${formatAmount(optimalInput, inputToken.decimals)} ${inputToken.symbol} | ` +
      `profit: ~${formatAmount(profit, inputToken.decimals)} ${inputToken.symbol}`,
    );
  }

  return opportunities;
}

/**
 * Detect intra-Eloqura arbitrage (triangular arb through shared tokens).
 *
 * Example: If pools A/B and B/C and A/C all exist, check if:
 *   A → B → C gives more C than going A → C directly
 */
export function findIntraEloquraOpportunities(
  pools: PoolInfo[],
  config: BotConfig,
): ArbOpportunity[] {
  const opportunities: ArbOpportunity[] = [];

  // Build adjacency: token -> list of pools containing that token
  const tokenPools = new Map<string, PoolInfo[]>();
  for (const pool of pools) {
    const key0 = pool.token0.address.toLowerCase();
    const key1 = pool.token1.address.toLowerCase();
    if (!tokenPools.has(key0)) tokenPools.set(key0, []);
    if (!tokenPools.has(key1)) tokenPools.set(key1, []);
    tokenPools.get(key0)!.push(pool);
    tokenPools.get(key1)!.push(pool);
  }

  // For each pair of pools sharing a token, look for triangular arb
  // A/B pool + B/C pool → can we profit by going A→B→C vs A→C direct?
  for (const [sharedToken, sharedPools] of tokenPools) {
    if (sharedPools.length < 2) continue;

    for (let i = 0; i < sharedPools.length; i++) {
      for (let j = i + 1; j < sharedPools.length; j++) {
        const pool1 = sharedPools[i];
        const pool2 = sharedPools[j];

        // Get the non-shared tokens
        const other1 = pool1.token0.address.toLowerCase() === sharedToken ? pool1.token1 : pool1.token0;
        const other2 = pool2.token0.address.toLowerCase() === sharedToken ? pool2.token1 : pool2.token0;

        // Skip if both "other" tokens are the same (same pool pair)
        if (other1.address.toLowerCase() === other2.address.toLowerCase()) continue;

        // Check if there's a direct pool for other1/other2
        const directPool = pools.find(
          (p) =>
            (p.token0.address.toLowerCase() === other1.address.toLowerCase() &&
              p.token1.address.toLowerCase() === other2.address.toLowerCase()) ||
            (p.token0.address.toLowerCase() === other2.address.toLowerCase() &&
              p.token1.address.toLowerCase() === other1.address.toLowerCase()),
        );

        if (!directPool) continue;

        // Compare: other1 → shared → other2 (via 2 hops) vs other1 → other2 (direct)
        const sharedTokenInfo = pool1.token0.address.toLowerCase() === sharedToken ? pool1.token0 : pool1.token1;
        const refAmount = 10n ** BigInt(other1.decimals);
        const maxInput = getMaxInput(pool1, other1, config.maxReserveFraction);

        const profitFn = (inputAmount: bigint): bigint => {
          // Hop 1: other1 → sharedToken via pool1
          const [r1In, r1Out] = getReservesForDirection(pool1, other1.address, sharedTokenInfo.address);
          const midAmount = getAmountOut(inputAmount, r1In, r1Out);
          if (midAmount === 0n) return 0n;

          // Hop 2: sharedToken → other2 via pool2
          const [r2In, r2Out] = getReservesForDirection(pool2, sharedTokenInfo.address, other2.address);
          const twoHopOut = getAmountOut(midAmount, r2In, r2Out);

          // Direct: other1 → other2 via directPool
          const [rDIn, rDOut] = getReservesForDirection(directPool, other1.address, other2.address);
          const directOut = getAmountOut(inputAmount, rDIn, rDOut);

          // Try both directions — maybe direct is cheaper and we should go reverse
          if (twoHopOut > directOut) {
            // Two-hop gives more: buy on direct (cheap), sell via two-hop (expensive)
            // But wait — that means we'd sell other2 back to other1 via two-hop
            // This is getting complex — for Phase 1, just report the spread
            return twoHopOut > directOut ? twoHopOut - directOut : 0n;
          }
          return 0n;
        };

        if (maxInput === 0n) continue;
        const { optimalInput, profit } = findOptimalTradeSize(maxInput, profitFn);

        if (profit <= 0n) continue;

        // Calculate the spread
        const [rDIn, rDOut] = getReservesForDirection(directPool, other1.address, other2.address);
        const directForRef = getAmountOut(refAmount, rDIn, rDOut);
        const [r1In, r1Out] = getReservesForDirection(pool1, other1.address, sharedTokenInfo.address);
        const midForRef = getAmountOut(refAmount, r1In, r1Out);
        const [r2In, r2Out] = getReservesForDirection(pool2, sharedTokenInfo.address, other2.address);
        const twoHopForRef = getAmountOut(midForRef, r2In, r2Out);

        if (directForRef === 0n) continue;
        const spread = Number(twoHopForRef - directForRef) / Number(directForRef);

        if (spread < config.minSpread) continue;

        opportunities.push({
          type: "intra-eloqura",
          description: `${other1.symbol}→${sharedTokenInfo.symbol}→${other2.symbol} vs ${other1.symbol}→${other2.symbol} direct`,
          spread,
          inputAmount: optimalInput,
          inputToken: other1,
          estimatedProfit: profit,
          leg1: {
            venue: "eloqura",
            action: "buy",
            tokenIn: other1.address,
            tokenOut: other2.address,
            amountIn: optimalInput,
            expectedAmountOut: getAmountOut(optimalInput, rDIn, rDOut),
            routerAddress: ELOQURA.Router,
            path: [other1.address, sharedTokenInfo.address, other2.address],
          },
          leg2: {
            venue: "eloqura",
            action: "sell",
            tokenIn: other2.address,
            tokenOut: other1.address,
            amountIn: 0n, // will be computed at execution time
            expectedAmountOut: 0n,
            routerAddress: ELOQURA.Router,
            path: [other2.address, other1.address],
          },
        });

        log.opportunity(
          `Triangular: ${other1.symbol}→${sharedTokenInfo.symbol}→${other2.symbol} | ` +
          `spread: ${(spread * 100).toFixed(2)}% | ` +
          `profit: ~${formatAmount(profit, other2.decimals)} ${other2.symbol}`,
        );
      }
    }
  }

  return opportunities;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getReservesForDirection(pool: PoolInfo, tokenIn: Address, tokenOut: Address): [bigint, bigint] {
  if (pool.token0.address.toLowerCase() === tokenIn.toLowerCase()) {
    return [pool.reserve0, pool.reserve1];
  }
  return [pool.reserve1, pool.reserve0];
}

function getMaxInput(pool: PoolInfo, inputToken: TokenInfo, fraction: number): bigint {
  const reserve = pool.token0.address.toLowerCase() === inputToken.address.toLowerCase()
    ? pool.reserve0
    : pool.reserve1;
  return (reserve * BigInt(Math.floor(fraction * 10000))) / 10000n;
}

/**
 * Scale a Uniswap quote linearly.
 * Given a quote for X token0 → Y token1, estimate output for `amount` token0.
 */
function scaleQuoteOutput(amount: bigint, quote: { amountIn: bigint; amountOut: bigint }): bigint {
  if (quote.amountIn === 0n) return 0n;
  return (amount * quote.amountOut) / quote.amountIn;
}

/**
 * Reverse a Uniswap quote: given token1 input, estimate token0 output.
 * Original quote: token0 → token1 at rate amountOut/amountIn.
 * Reverse: token1 → token0 at rate amountIn/amountOut.
 */
function scaleQuoteReverse(
  token1Amount: bigint,
  quote: { amountIn: bigint; amountOut: bigint },
  _token0: TokenInfo,
  _token1: TokenInfo,
): bigint {
  if (quote.amountOut === 0n) return 0n;
  return (token1Amount * quote.amountIn) / quote.amountOut;
}

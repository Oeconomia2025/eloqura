/**
 * Eloqura Arbitrage Bot
 *
 * Monitors Eloqura DEX pool prices and compares against Uniswap V3.
 * Detects and (optionally) executes arbitrage trades when price
 * discrepancies exceed the configured threshold.
 *
 * Usage:
 *   npx tsx scripts/arbitrage-bot.ts --dry-run --verbose   # detect only
 *   npx tsx scripts/arbitrage-bot.ts --verbose              # live trading
 *   npx tsx scripts/arbitrage-bot.ts --dry-run --once       # single cycle
 */

import "dotenv/config";

import { parseFlags } from "./arb/config.js";
import { publicClient, getAccount } from "./arb/clients.js";
import { log } from "./arb/logger.js";
import { discoverPools, refreshReserves } from "./arb/pool-discovery.js";
import { getPriceComparisons, printPriceSummary } from "./arb/price-monitor.js";
import { findCrossDexOpportunities, findIntraEloquraOpportunities } from "./arb/opportunity-finder.js";
import { executeTrade } from "./arb/trade-executor.js";
import { formatAmount } from "./arb/math.js";
import type { ArbOpportunity, BotConfig, CycleStats, PoolInfo } from "./arb/types.js";

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const config = parseFlags(process.argv.slice(2));

  log.banner("Eloqura Arbitrage Bot");

  log.info(`Mode: ${config.dryRun ? "DRY RUN (no trades)" : "LIVE TRADING"}`);
  log.info(`Min spread: ${(config.minSpread * 100).toFixed(1)}%`);
  log.info(`Max reserve fraction: ${(config.maxReserveFraction * 100).toFixed(0)}%`);
  log.info(`Slippage tolerance: ${(config.slippage * 100).toFixed(1)}%`);
  log.info(`Polling interval: ${config.intervalMs / 1000}s`);
  if (config.once) log.info("Single cycle mode — will exit after one pass");

  // Validate wallet (even in dry-run, to verify .env is set)
  if (!config.dryRun) {
    try {
      const account = getAccount();
      log.info(`Wallet: ${account.address}`);

      const balance = await publicClient.getBalance({ address: account.address });
      log.info(`ETH balance: ${formatAmount(balance, 18)} ETH`);

      if (balance === 0n) {
        log.warn("Wallet has 0 ETH — transactions will fail without gas!");
      }
    } catch (err) {
      log.error(`Wallet setup failed: ${(err as Error).message}`);
      log.info("Set ARBITRAGE_PRIVATE_KEY in .env or use --dry-run mode");
      process.exit(1);
    }
  } else {
    log.info("Wallet: skipped (dry-run mode)");
  }

  log.separator();

  // ── Discover pools ────────────────────────────────────────────────────

  log.info("Discovering Eloqura pools...");
  let pools = await discoverPools(config.verbose);

  if (pools.length === 0) {
    log.warn("No active pools found on Eloqura Factory. Nothing to monitor.");
    process.exit(0);
  }

  log.success(`Found ${pools.length} active pool(s):`);
  for (const p of pools) {
    const r0 = formatAmount(p.reserve0, p.token0.decimals);
    const r1 = formatAmount(p.reserve1, p.token1.decimals);
    log.info(`  ${p.token0.symbol}/${p.token1.symbol} — reserves: ${r0} / ${r1}`);
  }

  // ── Monitoring loop ───────────────────────────────────────────────────

  let cycleNum = 0;

  const runCycle = async (): Promise<CycleStats> => {
    cycleNum++;
    const stats: CycleStats = {
      cycle: cycleNum,
      poolsChecked: pools.length,
      opportunitiesFound: 0,
      tradesExecuted: 0,
      totalProfit: new Map(),
      errors: 0,
    };

    log.separator();
    log.info(`Cycle #${cycleNum} — ${new Date().toLocaleTimeString()}`);

    // Refresh reserves
    try {
      pools = await refreshReserves(pools, config.verbose);
    } catch (err) {
      log.error(`Failed to refresh reserves: ${(err as Error).message}`);
      stats.errors++;
      return stats;
    }

    // Get price comparisons
    let comparisons;
    try {
      comparisons = await getPriceComparisons(pools, config.verbose);
    } catch (err) {
      log.error(`Failed to get price comparisons: ${(err as Error).message}`);
      stats.errors++;
      return stats;
    }

    if (config.verbose) {
      printPriceSummary(comparisons);
    }

    // Find opportunities
    const crossDex = findCrossDexOpportunities(comparisons, config);
    const intraEloqura = findIntraEloquraOpportunities(pools, config);
    const allOpps = [...crossDex, ...intraEloqura];

    stats.opportunitiesFound = allOpps.length;

    if (allOpps.length === 0) {
      log.info("No arbitrage opportunities detected this cycle.");
      return stats;
    }

    log.info(`Found ${allOpps.length} opportunity(ies)`);

    // Sort by estimated profit (descending)
    allOpps.sort((a, b) => {
      // Compare normalized profit (crude: just compare raw bigint)
      if (b.estimatedProfit > a.estimatedProfit) return 1;
      if (b.estimatedProfit < a.estimatedProfit) return -1;
      return 0;
    });

    // Execute trades (or just log in dry-run)
    for (const opp of allOpps) {
      if (config.dryRun) {
        log.trade(
          `[DRY RUN] Would execute: ${opp.description} | ` +
          `input: ${formatAmount(opp.inputAmount, opp.inputToken.decimals)} ${opp.inputToken.symbol} | ` +
          `est. profit: ${formatAmount(opp.estimatedProfit, opp.inputToken.decimals)} ${opp.inputToken.symbol}`,
        );
        continue;
      }

      try {
        const result = await executeTrade(opp, config);
        if (result) {
          stats.tradesExecuted++;
          const key = opp.inputToken.symbol;
          const prev = stats.totalProfit.get(key) ?? 0n;
          stats.totalProfit.set(key, prev + opp.estimatedProfit);
        }
      } catch (err) {
        log.error(`Trade execution error: ${(err as Error).message}`);
        stats.errors++;
      }
    }

    return stats;
  };

  // ── Run ───────────────────────────────────────────────────────────────

  if (config.once) {
    const stats = await runCycle();
    printStats(stats);
    process.exit(0);
  }

  // Continuous monitoring loop
  log.info(`Starting monitoring loop (every ${config.intervalMs / 1000}s)...`);
  log.info("Press Ctrl+C to stop.\n");

  // Handle graceful shutdown
  let running = true;
  process.on("SIGINT", () => {
    log.info("\nShutting down...");
    running = false;
  });
  process.on("SIGTERM", () => {
    log.info("\nShutting down...");
    running = false;
  });

  while (running) {
    try {
      const stats = await runCycle();
      if (config.verbose) printStats(stats);
    } catch (err) {
      log.error(`Cycle error: ${(err as Error).message}`);
    }

    if (!running) break;

    // Wait for next cycle
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, config.intervalMs);
      // Allow interrupt during sleep
      const check = setInterval(() => {
        if (!running) {
          clearTimeout(timer);
          clearInterval(check);
          resolve();
        }
      }, 500);
    });
  }

  log.banner("Bot stopped");
}

function printStats(stats: CycleStats) {
  log.separator();
  log.info(
    `Cycle #${stats.cycle} summary: ` +
    `${stats.poolsChecked} pools, ${stats.opportunitiesFound} opportunities, ` +
    `${stats.tradesExecuted} trades, ${stats.errors} errors`,
  );
  if (stats.totalProfit.size > 0) {
    for (const [symbol, profit] of stats.totalProfit) {
      log.success(`  Cumulative profit: ${symbol} +${profit.toString()}`);
    }
  }
}

// ── Entry point ─────────────────────────────────────────────────────────

main().catch((err) => {
  log.error(`Fatal: ${err.message}`);
  console.error(err);
  process.exit(1);
});

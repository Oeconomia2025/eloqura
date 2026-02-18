import { type Address, type Hash, maxUint256, parseAbi } from "viem";
import { publicClient, getWalletClient, getAccount } from "./clients.js";
import { ELOQURA, UNISWAP } from "./config.js";
import { log } from "./logger.js";
import { formatAmount } from "./math.js";
import type { ArbLeg, ArbOpportunity, BotConfig } from "./types.js";

const ERC20_ABI = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

const ELOQURA_ROUTER_ABI = parseAbi([
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])",
]);

const UNISWAP_ROUTER_ABI = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
]);

/**
 * Execute a full arbitrage trade: leg1 (buy cheap) → leg2 (sell expensive).
 * Returns the transaction hashes or null if anything fails.
 */
export async function executeTrade(
  opp: ArbOpportunity,
  config: BotConfig,
): Promise<{ leg1Hash: Hash; leg2Hash: Hash } | null> {
  const account = getAccount();
  const wallet = getWalletClient();

  log.trade(`Executing: ${opp.description}`);
  log.trade(`  Input: ${formatAmount(opp.inputAmount, opp.inputToken.decimals)} ${opp.inputToken.symbol}`);

  // ── Pre-flight checks ────────────────────────────────────────────────

  // Check balance
  const balance = await publicClient.readContract({
    address: opp.leg1.tokenIn,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });

  if (balance < opp.leg1.amountIn) {
    log.error(
      `Insufficient balance: have ${formatAmount(balance, opp.inputToken.decimals)} ` +
      `${opp.inputToken.symbol}, need ${formatAmount(opp.leg1.amountIn, opp.inputToken.decimals)}`,
    );
    return null;
  }

  // ── Leg 1: Buy on cheap venue ────────────────────────────────────────

  log.trade(`  Leg 1: ${opp.leg1.venue} — ${formatAmount(opp.leg1.amountIn, opp.inputToken.decimals)} ${opp.inputToken.symbol} → ?`);

  await ensureApproval(opp.leg1.tokenIn, opp.leg1.routerAddress, opp.leg1.amountIn);

  const minOut1 = applySlippage(opp.leg1.expectedAmountOut, config.slippage);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + config.deadlineSeconds);

  let leg1Hash: Hash;
  try {
    leg1Hash = await executeSwapLeg(opp.leg1, minOut1, deadline, account.address);
    log.success(`  Leg 1 tx: ${leg1Hash}`);
  } catch (err) {
    log.error(`  Leg 1 failed: ${(err as Error).message}`);
    return null;
  }

  // Wait for leg 1 to confirm
  const receipt1 = await publicClient.waitForTransactionReceipt({ hash: leg1Hash });
  if (receipt1.status !== "success") {
    log.error(`  Leg 1 reverted! Hash: ${leg1Hash}`);
    return null;
  }

  // ── Get actual output from leg 1 ────────────────────────────────────

  // Check how much of the intermediate token we received
  const intermediateBalance = await publicClient.readContract({
    address: opp.leg2.tokenIn,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });

  // Use actual balance for leg 2 (might differ from estimate due to slippage)
  const leg2Input = intermediateBalance < opp.leg2.amountIn ? intermediateBalance : opp.leg2.amountIn;

  // ── Leg 2: Sell on expensive venue ───────────────────────────────────

  log.trade(`  Leg 2: ${opp.leg2.venue} — selling intermediate tokens`);

  await ensureApproval(opp.leg2.tokenIn, opp.leg2.routerAddress, leg2Input);

  // For leg 2, accept more slippage since we already bought — we need to sell
  const minOut2 = applySlippage(opp.leg2.expectedAmountOut, config.slippage * 2);

  let leg2Hash: Hash;
  try {
    const updatedLeg2 = { ...opp.leg2, amountIn: leg2Input };
    leg2Hash = await executeSwapLeg(updatedLeg2, minOut2, deadline, account.address);
    log.success(`  Leg 2 tx: ${leg2Hash}`);
  } catch (err) {
    log.error(`  Leg 2 failed: ${(err as Error).message}`);
    log.warn(`  WARNING: Leg 1 succeeded but leg 2 failed! You hold intermediate tokens.`);
    return null;
  }

  const receipt2 = await publicClient.waitForTransactionReceipt({ hash: leg2Hash });
  if (receipt2.status !== "success") {
    log.error(`  Leg 2 reverted! Hash: ${leg2Hash}`);
    log.warn(`  WARNING: You hold intermediate tokens from leg 1.`);
    return null;
  }

  // ── Report result ────────────────────────────────────────────────────

  const finalBalance = await publicClient.readContract({
    address: opp.inputToken.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });

  const profit = finalBalance - (balance - opp.leg1.amountIn);
  const profitFormatted = formatAmount(profit > 0n ? profit : 0n, opp.inputToken.decimals);

  if (profit > 0n) {
    log.success(`  Profit: +${profitFormatted} ${opp.inputToken.symbol}`);
  } else {
    log.warn(`  Loss: ${profitFormatted} ${opp.inputToken.symbol} (slippage exceeded estimate)`);
  }

  return { leg1Hash, leg2Hash };
}

// ── Internal helpers ──────────────────────────────────────────────────────

async function ensureApproval(token: Address, spender: Address, amount: bigint): Promise<void> {
  const account = getAccount();
  const wallet = getWalletClient();

  const allowance = await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account.address, spender],
  });

  if (allowance >= amount) return;

  log.info(`  Approving ${spender.slice(0, 10)}... to spend tokens`);

  const hash = await wallet.writeContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spender, maxUint256],
    chain: (await import("viem/chains")).sepolia,
    account: account,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  log.verbose(`  Approval tx: ${hash}`, true);
}

async function executeSwapLeg(
  leg: ArbLeg,
  minAmountOut: bigint,
  deadline: bigint,
  recipient: Address,
): Promise<Hash> {
  const wallet = getWalletClient();
  const account = getAccount();
  const { sepolia } = await import("viem/chains");

  if (leg.venue === "eloqura") {
    if (!leg.path || leg.path.length < 2) {
      throw new Error("Eloqura leg missing swap path");
    }

    return wallet.writeContract({
      address: leg.routerAddress,
      abi: ELOQURA_ROUTER_ABI,
      functionName: "swapExactTokensForTokens",
      args: [leg.amountIn, minAmountOut, leg.path, recipient, deadline],
      chain: sepolia,
      account,
    });
  }

  if (leg.venue === "uniswap") {
    if (leg.feeTier === undefined) {
      throw new Error("Uniswap leg missing fee tier");
    }

    return wallet.writeContract({
      address: leg.routerAddress,
      abi: UNISWAP_ROUTER_ABI,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn: leg.tokenIn,
          tokenOut: leg.tokenOut,
          fee: leg.feeTier,
          recipient,
          amountIn: leg.amountIn,
          amountOutMinimum: minAmountOut,
          sqrtPriceLimitX96: 0n,
        },
      ],
      chain: sepolia,
      account,
    });
  }

  throw new Error(`Unknown venue: ${leg.venue}`);
}

function applySlippage(amount: bigint, slippage: number): bigint {
  const factor = BigInt(Math.floor((1 - slippage) * 10000));
  return (amount * factor) / 10000n;
}

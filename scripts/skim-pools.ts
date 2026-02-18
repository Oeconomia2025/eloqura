/**
 * Recover excess tokens from Eloqura pools using skim().
 *
 * skim() sends any tokens held by the pair contract that are ABOVE
 * the recorded reserves to a specified recipient address.
 *
 * Usage:
 *   npx tsx scripts/skim-pools.ts --dry-run     # show what would be recovered
 *   npx tsx scripts/skim-pools.ts               # execute skim transactions
 */
import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  fallback,
  formatUnits,
  parseAbi,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const transport = fallback([
  http("https://sepolia.gateway.tenderly.co"),
  http("https://rpc2.sepolia.org"),
  http("https://ethereum-sepolia-rpc.publicnode.com"),
]);

const publicClient = createPublicClient({ chain: sepolia, transport });

const FACTORY = "0x1a4C7849Dd8f62AefA082360b3A8D857952B3b8e" as Address;

const FACTORY_ABI = parseAbi([
  "function allPairsLength() view returns (uint256)",
  "function allPairs(uint256) view returns (address)",
]);

const PAIR_ABI = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112, uint112, uint32)",
  "function skim(address to) external",
  "function sync() external",
]);

const ERC20_ABI = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
]);

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const doSync = process.argv.includes("--sync");

  console.log(`\n=== Eloqura Pool Skim Tool ===`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}\n`);

  // Set up wallet
  let account: ReturnType<typeof privateKeyToAccount> | null = null;
  let wallet: ReturnType<typeof createWalletClient> | null = null;

  if (!dryRun) {
    const pk = process.env.ARBITRAGE_PRIVATE_KEY;
    if (!pk) {
      console.error("ERROR: Set ARBITRAGE_PRIVATE_KEY in .env to execute transactions.");
      console.log("Run with --dry-run to preview without a wallet.\n");
      process.exit(1);
    }
    account = privateKeyToAccount(pk as `0x${string}`);
    wallet = createWalletClient({ account, chain: sepolia, transport });
    console.log(`Wallet: ${account.address}\n`);
  }

  const pairCount = await publicClient.readContract({
    address: FACTORY,
    abi: FACTORY_ABI,
    functionName: "allPairsLength",
  });

  let totalRecovered: { symbol: string; amount: bigint; decimals: number }[] = [];

  for (let i = 0; i < Number(pairCount); i++) {
    const pairAddr = await publicClient.readContract({
      address: FACTORY,
      abi: FACTORY_ABI,
      functionName: "allPairs",
      args: [BigInt(i)],
    });

    const [token0Addr, token1Addr, reserves] = await Promise.all([
      publicClient.readContract({ address: pairAddr, abi: PAIR_ABI, functionName: "token0" }),
      publicClient.readContract({ address: pairAddr, abi: PAIR_ABI, functionName: "token1" }),
      publicClient.readContract({ address: pairAddr, abi: PAIR_ABI, functionName: "getReserves" }),
    ]);

    const [sym0, dec0, sym1, dec1, bal0, bal1] = await Promise.all([
      publicClient.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: "symbol" }),
      publicClient.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: "decimals" }),
      publicClient.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: "symbol" }),
      publicClient.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: "decimals" }),
      publicClient.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: "balanceOf", args: [pairAddr] }),
      publicClient.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: "balanceOf", args: [pairAddr] }),
    ]);

    const excess0 = bal0 - reserves[0];
    const excess1 = bal1 - reserves[1];

    console.log(`Pool ${i}: ${sym0}/${sym1} (${pairAddr.slice(0, 10)}...)`);
    console.log(`  Reserves:  ${formatUnits(reserves[0], dec0)} ${sym0} / ${formatUnits(reserves[1], dec1)} ${sym1}`);
    console.log(`  Balances:  ${formatUnits(bal0, dec0)} ${sym0} / ${formatUnits(bal1, dec1)} ${sym1}`);

    if (excess0 <= 0n && excess1 <= 0n) {
      console.log(`  Excess:    none — nothing to skim\n`);
      continue;
    }

    if (excess0 > 0n) {
      console.log(`  Excess ${sym0}: ${formatUnits(excess0, dec0)} (${excess0.toString()} wei)`);
      totalRecovered.push({ symbol: sym0, amount: excess0, decimals: dec0 });
    }
    if (excess1 > 0n) {
      console.log(`  Excess ${sym1}: ${formatUnits(excess1, dec1)} (${excess1.toString()} wei)`);
      totalRecovered.push({ symbol: sym1, amount: excess1, decimals: dec1 });
    }

    if (!dryRun && wallet && account) {
      try {
        console.log(`  Calling skim()...`);
        const hash = await wallet.writeContract({
          address: pairAddr,
          abi: PAIR_ABI,
          functionName: "skim",
          args: [account.address],
          chain: sepolia,
          account,
        });
        console.log(`  skim() tx: ${hash}`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`  Status: ${receipt.status === "success" ? "SUCCESS" : "FAILED"}`);

        if (doSync) {
          console.log(`  Calling sync() to reset reserves...`);
          const syncHash = await wallet.writeContract({
            address: pairAddr,
            abi: PAIR_ABI,
            functionName: "sync",
            chain: sepolia,
            account,
          });
          console.log(`  sync() tx: ${syncHash}`);
          await publicClient.waitForTransactionReceipt({ hash: syncHash });
        }
      } catch (err: any) {
        console.error(`  ERROR: ${err.message?.slice(0, 200)}`);
      }
    } else {
      console.log(`  [DRY RUN] Would call skim() to recover these tokens`);
    }

    console.log();
  }

  // Summary
  console.log("=== Recovery Summary ===");
  if (totalRecovered.length === 0) {
    console.log("No excess tokens found in any pool.");
  } else {
    for (const t of totalRecovered) {
      console.log(`  ${t.symbol}: ${formatUnits(t.amount, t.decimals)}`);
    }
    if (dryRun) {
      console.log("\nRun without --dry-run to execute the recovery.");
    }
  }
  console.log();
}

main().catch(console.error);

/**
 * Diagnostic script: inspect all Eloqura pools for dust and check
 * if WETH/USDC pair exists.
 */
import "dotenv/config";
import { createPublicClient, http, fallback, formatUnits, type Address, parseAbi } from "viem";
import { sepolia } from "viem/chains";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: fallback([
    http("https://sepolia.gateway.tenderly.co"),
    http("https://rpc2.sepolia.org"),
    http("https://ethereum-sepolia-rpc.publicnode.com"),
  ]),
});

const FACTORY = "0x1a4C7849Dd8f62AefA082360b3A8D857952B3b8e" as Address;
const ELOQURA_WETH = "0x34b11F6b8f78fa010bBCA71bC7FE79dAa811b89f" as Address;
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as Address;

const FACTORY_ABI = parseAbi([
  "function allPairsLength() view returns (uint256)",
  "function allPairs(uint256) view returns (address)",
  "function getPair(address, address) view returns (address)",
]);

const PAIR_ABI = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112, uint112, uint32)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

const ERC20_ABI = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
]);

// Check if skim exists on pair contracts
const SKIM_ABI = parseAbi([
  "function skim(address to) external",
]);

const DEAD = "0x000000000000000000000000000000000000dEaD" as Address;
const ZERO = "0x0000000000000000000000000000000000000000" as Address;

async function main() {
  console.log("=== Eloqura Pool Diagnostics ===\n");

  // 1. Check all pools
  const pairCount = await publicClient.readContract({
    address: FACTORY,
    abi: FACTORY_ABI,
    functionName: "allPairsLength",
  });
  console.log(`Factory has ${pairCount} pairs\n`);

  for (let i = 0; i < Number(pairCount); i++) {
    const pairAddr = await publicClient.readContract({
      address: FACTORY,
      abi: FACTORY_ABI,
      functionName: "allPairs",
      args: [BigInt(i)],
    });

    const [token0Addr, token1Addr, reserves, totalSupply] = await Promise.all([
      publicClient.readContract({ address: pairAddr, abi: PAIR_ABI, functionName: "token0" }),
      publicClient.readContract({ address: pairAddr, abi: PAIR_ABI, functionName: "token1" }),
      publicClient.readContract({ address: pairAddr, abi: PAIR_ABI, functionName: "getReserves" }),
      publicClient.readContract({ address: pairAddr, abi: PAIR_ABI, functionName: "totalSupply" }),
    ]);

    const [sym0, dec0, sym1, dec1] = await Promise.all([
      publicClient.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: "symbol" }),
      publicClient.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: "decimals" }),
      publicClient.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: "symbol" }),
      publicClient.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: "decimals" }),
    ]);

    // Check actual token balances held by the pair contract
    const [bal0, bal1] = await Promise.all([
      publicClient.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: "balanceOf", args: [pairAddr] }),
      publicClient.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: "balanceOf", args: [pairAddr] }),
    ]);

    // Check LP token balance at address(0) (MINIMUM_LIQUIDITY lock)
    const lpLocked = await publicClient.readContract({
      address: pairAddr,
      abi: PAIR_ABI,
      functionName: "balanceOf",
      args: [ZERO],
    });

    console.log(`--- Pool ${i}: ${sym0}/${sym1} ---`);
    console.log(`  Pair address: ${pairAddr}`);
    console.log(`  Token0: ${token0Addr} (${sym0}, ${dec0} decimals)`);
    console.log(`  Token1: ${token1Addr} (${sym1}, ${dec1} decimals)`);
    console.log(`  Reserves: ${formatUnits(reserves[0], dec0)} ${sym0} / ${formatUnits(reserves[1], dec1)} ${sym1}`);
    console.log(`  Raw reserves: ${reserves[0].toString()} / ${reserves[1].toString()}`);
    console.log(`  Actual balances: ${formatUnits(bal0, dec0)} ${sym0} / ${formatUnits(bal1, dec1)} ${sym1}`);
    console.log(`  Raw balances: ${bal0.toString()} / ${bal1.toString()}`);
    console.log(`  Balance vs reserve mismatch: ${bal0 !== reserves[0] || bal1 !== reserves[1] ? "YES" : "no"}`);
    console.log(`  LP totalSupply: ${totalSupply.toString()} (${formatUnits(totalSupply, 18)} LP tokens)`);
    console.log(`  LP locked at address(0): ${lpLocked.toString()}`);
    console.log(`  Is dust pool: ${reserves[0] < 10000n && reserves[1] < 10000n ? "YES" : "no"}`);

    // Check if skim() is callable
    try {
      await publicClient.simulateContract({
        address: pairAddr,
        abi: SKIM_ABI,
        functionName: "skim",
        args: [DEAD],
      });
      console.log(`  skim() available: YES`);
    } catch (e: any) {
      const msg = e.message?.slice(0, 100) || "unknown";
      console.log(`  skim() available: ${msg.includes("revert") ? "YES (would revert - no excess)" : "NO (not in ABI)"}`);
    }

    console.log();
  }

  // 2. Check if WETH/USDC pair exists
  console.log("=== WETH/USDC Pair Check ===\n");
  const wethUsdcPair = await publicClient.readContract({
    address: FACTORY,
    abi: FACTORY_ABI,
    functionName: "getPair",
    args: [ELOQURA_WETH, USDC],
  });

  if (wethUsdcPair === ZERO) {
    console.log("WETH/USDC pair does NOT exist yet on Eloqura Factory.");
    console.log("Pool creation should work. The issue might be elsewhere.");
  } else {
    console.log(`WETH/USDC pair EXISTS at: ${wethUsdcPair}`);
    const [r0, r1] = await publicClient.readContract({
      address: wethUsdcPair,
      abi: PAIR_ABI,
      functionName: "getReserves",
    }) as [bigint, bigint, number];
    console.log(`  Reserves: ${r0.toString()} / ${r1.toString()}`);
    console.log(`  This pair has ${r0 === 0n && r1 === 0n ? "ZERO" : "existing"} reserves.`);
    if (r0 > 0n || r1 > 0n) {
      console.log(`  DUST in existing pair is likely causing addLiquidity to fail!`);
    }
  }
}

main().catch(console.error);

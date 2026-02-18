import type { Address } from "viem";
import { publicClient } from "./clients.js";
import { ELOQURA } from "./config.js";
import { log } from "./logger.js";
import type { PoolInfo, TokenInfo } from "./types.js";

// ABIs needed for pool discovery
const FACTORY_ABI = [
  {
    name: "allPairsLength",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "allPairs",
    type: "function",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

const PAIR_ABI = [
  {
    name: "token0",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    name: "token1",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    name: "getReserves",
    type: "function",
    inputs: [],
    outputs: [
      { name: "reserve0", type: "uint112" },
      { name: "reserve1", type: "uint112" },
      { name: "blockTimestampLast", type: "uint32" },
    ],
    stateMutability: "view",
  },
] as const;

const ERC20_ABI = [
  {
    name: "symbol",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    name: "name",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    name: "decimals",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
] as const;

// Cache token info to avoid re-fetching
const tokenCache = new Map<string, TokenInfo>();

async function fetchTokenInfo(address: Address): Promise<TokenInfo> {
  const key = address.toLowerCase();
  if (tokenCache.has(key)) return tokenCache.get(key)!;

  const [symbol, name, decimals] = await Promise.all([
    publicClient.readContract({ address, abi: ERC20_ABI, functionName: "symbol" }),
    publicClient.readContract({ address, abi: ERC20_ABI, functionName: "name" }),
    publicClient.readContract({ address, abi: ERC20_ABI, functionName: "decimals" }),
  ]);

  const info: TokenInfo = {
    address,
    symbol: symbol as string,
    name: name as string,
    decimals: decimals as number,
  };
  tokenCache.set(key, info);
  return info;
}

/**
 * Discover all Eloqura DEX pools by enumerating the Factory contract.
 * Returns pool info with token details and current reserves.
 */
export async function discoverPools(verbose: boolean): Promise<PoolInfo[]> {
  const pairCount = await publicClient.readContract({
    address: ELOQURA.Factory,
    abi: FACTORY_ABI,
    functionName: "allPairsLength",
  }) as bigint;

  log.info(`Factory reports ${pairCount} pairs`);

  const pools: PoolInfo[] = [];

  for (let i = 0; i < Number(pairCount); i++) {
    try {
      const pairAddress = await publicClient.readContract({
        address: ELOQURA.Factory,
        abi: FACTORY_ABI,
        functionName: "allPairs",
        args: [BigInt(i)],
      }) as Address;

      const [token0Addr, token1Addr, reserves] = await Promise.all([
        publicClient.readContract({ address: pairAddress, abi: PAIR_ABI, functionName: "token0" }) as Promise<Address>,
        publicClient.readContract({ address: pairAddress, abi: PAIR_ABI, functionName: "token1" }) as Promise<Address>,
        publicClient.readContract({ address: pairAddress, abi: PAIR_ABI, functionName: "getReserves" }) as Promise<[bigint, bigint, number]>,
      ]);

      const [token0, token1] = await Promise.all([
        fetchTokenInfo(token0Addr),
        fetchTokenInfo(token1Addr),
      ]);

      const [reserve0, reserve1] = reserves;

      // Skip empty or dust-level pools (< 0.001 of either token)
      const MIN_RESERVE_THRESHOLD = 0.001;
      const adj0 = Number(reserve0) / 10 ** token0.decimals;
      const adj1 = Number(reserve1) / 10 ** token1.decimals;
      if (reserve0 === 0n || reserve1 === 0n || adj0 < MIN_RESERVE_THRESHOLD || adj1 < MIN_RESERVE_THRESHOLD) {
        log.verbose(`  Pool ${i}: ${token0.symbol}/${token1.symbol} — empty/dust (${adj0.toFixed(6)} / ${adj1.toFixed(6)}), skipping`, verbose);
        continue;
      }

      const price0in1 = (Number(reserve1) / 10 ** token1.decimals) / (Number(reserve0) / 10 ** token0.decimals);
      const price1in0 = (Number(reserve0) / 10 ** token0.decimals) / (Number(reserve1) / 10 ** token1.decimals);

      pools.push({
        address: pairAddress,
        token0,
        token1,
        reserve0,
        reserve1,
        price0in1,
        price1in0,
      });

      log.verbose(
        `  Pool ${i}: ${token0.symbol}/${token1.symbol} @ ${pairAddress.slice(0, 10)}... ` +
        `reserves: ${(Number(reserve0) / 10 ** token0.decimals).toFixed(2)} / ${(Number(reserve1) / 10 ** token1.decimals).toFixed(2)}`,
        verbose,
      );
    } catch (err) {
      log.warn(`  Pool ${i}: Failed to read — ${(err as Error).message}`);
    }
  }

  return pools;
}

/**
 * Refresh reserves for already-discovered pools (faster than full discovery).
 */
export async function refreshReserves(pools: PoolInfo[], verbose: boolean): Promise<PoolInfo[]> {
  const updated: PoolInfo[] = [];

  const results = await Promise.allSettled(
    pools.map(async (pool) => {
      const reserves = await publicClient.readContract({
        address: pool.address,
        abi: PAIR_ABI,
        functionName: "getReserves",
      }) as [bigint, bigint, number];

      const [reserve0, reserve1] = reserves;
      const price0in1 = (Number(reserve1) / 10 ** pool.token1.decimals) / (Number(reserve0) / 10 ** pool.token0.decimals);
      const price1in0 = (Number(reserve0) / 10 ** pool.token0.decimals) / (Number(reserve1) / 10 ** pool.token1.decimals);

      return { ...pool, reserve0, reserve1, price0in1, price1in0 };
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      updated.push(result.value);
    }
  }

  log.verbose(`Refreshed ${updated.length}/${pools.length} pools`, verbose);
  return updated;
}

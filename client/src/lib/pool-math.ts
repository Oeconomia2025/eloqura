/**
 * Shared helpers for reading Eloqura pair history straight from the chain.
 *
 * A snapshot is the pair's state at one block: reserves, LP supply and the pair's
 * cumulative fee counters (feeGrowthGlobal0/1X128 = fees per LP token, scaled by 2^128).
 * The difference in fee counters between two snapshots gives the exact fees the pool
 * earned in between; dividing by the swap fee rate gives the swap volume.
 */
import type { Abi } from "viem";

export const Q128 = 2n ** 128n;
export const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;
export const SEPOLIA_BLOCKS_PER_DAY = 7200; // 12s slots

export const SNAPSHOT_ABI = [
  { name: "getReserves", type: "function", stateMutability: "view", inputs: [],
    outputs: [{ type: "uint112" }, { type: "uint112" }, { type: "uint32" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "feeGrowthGlobal0X128", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "feeGrowthGlobal1X128", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "swapFeeBps", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export const MULTICALL_TS_ABI = [
  { name: "getCurrentBlockTimestamp", type: "function", stateMutability: "view", inputs: [],
    outputs: [{ type: "uint256" }] },
] as const;

export interface PairSnapshot {
  time: number; // unix seconds
  reserve0: bigint;
  reserve1: bigint;
  supply: bigint;
  fg0: bigint | null; // null if the pair contract has no fee counters
  fg1: bigint | null;
  feeBps: number | null;
}

export const CALLS_PER_PAIR = 5;

/** The 5 multicall entries that make up one pair snapshot. */
export function snapshotCalls(pairAddress: `0x${string}`) {
  const c = { address: pairAddress, abi: SNAPSHOT_ABI as Abi };
  return [
    { ...c, functionName: "getReserves" },
    { ...c, functionName: "totalSupply" },
    { ...c, functionName: "feeGrowthGlobal0X128" },
    { ...c, functionName: "feeGrowthGlobal1X128" },
    { ...c, functionName: "swapFeeBps" },
  ];
}

export const timestampCall = { address: MULTICALL3, abi: MULTICALL_TS_ABI as Abi, functionName: "getCurrentBlockTimestamp" };

type CallResult = { status: "success"; result: unknown } | { status: "failure"; error: unknown };

/** Turn 5 multicall results into a snapshot, or null if the pair didn't exist at that block. */
export function parseSnapshot(r: CallResult[], time: number): PairSnapshot | null {
  if (r[0]?.status !== "success" || r[1]?.status !== "success") return null;
  const [reserve0, reserve1] = r[0].result as readonly [bigint, bigint, number];
  return {
    time,
    reserve0,
    reserve1,
    supply: r[1].result as bigint,
    fg0: r[2]?.status === "success" ? (r[2].result as bigint) : null,
    fg1: r[3]?.status === "success" ? (r[3].result as bigint) : null,
    feeBps: r[4]?.status === "success" ? Number(r[4].result as bigint) : null,
  };
}

/** Fees the whole pool earned between two snapshots, in raw token units. Null if unknown. */
export function feesBetween(prev: PairSnapshot | null | undefined, cur: PairSnapshot | null | undefined) {
  if (!prev || !cur || prev.fg0 === null || prev.fg1 === null || cur.fg0 === null || cur.fg1 === null) return null;
  if (cur.fg0 < prev.fg0 || cur.fg1 < prev.fg1) return null;
  const avgSupply = (cur.supply + prev.supply) / 2n;
  return {
    fees0: ((cur.fg0 - prev.fg0) * avgSupply) / Q128,
    fees1: ((cur.fg1 - prev.fg1) * avgSupply) / Q128,
  };
}

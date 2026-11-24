import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import {
  CALLS_PER_PAIR, MULTICALL3, SEPOLIA_BLOCKS_PER_DAY,
  parseSnapshot, snapshotCalls, timestampCall, type PairSnapshot,
} from "@/lib/pool-math";

export const SNAPSHOT_OFFSETS = { now: 0, d1: 1, d2: 2, d7: 7 } as const; // days ago
export type SnapshotKey = keyof typeof SNAPSHOT_OFFSETS;
export type PoolsSnapshots = Record<SnapshotKey, Record<string, PairSnapshot | null>>;

/**
 * Snapshots of every pair now, 1, 2 and 7 days ago: 4 multicalls total, however many pools.
 * Keys of the inner records are lowercase pair addresses.
 */
export function usePoolsSnapshots(pairAddresses: string[]) {
  const publicClient = usePublicClient();
  const addrs = pairAddresses.map((a) => a.toLowerCase()).sort();

  return useQuery({
    queryKey: ["pools-snapshots", addrs.join(",")],
    enabled: !!publicClient && addrs.length > 0,
    staleTime: 25_000,
    refetchInterval: 30_000,
    queryFn: async (): Promise<PoolsSnapshots> => {
      const latest = await publicClient!.getBlockNumber();
      const contracts = [
        ...addrs.flatMap((a) => snapshotCalls(a as `0x${string}`)),
        timestampCall,
      ];

      const entries = await Promise.all(
        (Object.entries(SNAPSHOT_OFFSETS) as [SnapshotKey, number][]).map(async ([key, days]) => {
          const blockNumber = latest - BigInt(days * SEPOLIA_BLOCKS_PER_DAY);
          const byPair: Record<string, PairSnapshot | null> = {};
          try {
            const r = await publicClient!.multicall({
              allowFailure: true,
              blockNumber,
              multicallAddress: MULTICALL3,
              contracts,
            });
            const ts = r[r.length - 1];
            const time = ts.status === "success" ? Number(ts.result as bigint) : Math.floor(Date.now() / 1000) - days * 86_400;
            addrs.forEach((a, i) => {
              byPair[a] = parseSnapshot(r.slice(i * CALLS_PER_PAIR, (i + 1) * CALLS_PER_PAIR) as any, time);
            });
          } catch {
            addrs.forEach((a) => (byPair[a] = null));
          }
          return [key, byPair] as const;
        })
      );
      return Object.fromEntries(entries) as PoolsSnapshots;
    },
  });
}

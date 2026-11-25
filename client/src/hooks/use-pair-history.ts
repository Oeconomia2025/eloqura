import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import {
  MULTICALL3, SEPOLIA_BLOCKS_PER_DAY, parseSnapshot, snapshotCalls,
  timestampCall, type PairSnapshot,
} from "@/lib/pool-math";

/** Chart ranges: how far back and how many snapshots to take. */
export const RANGES = {
  "7D": { days: 7, points: 28 },
  "30D": { days: 30, points: 30 },
  "90D": { days: 90, points: 30 },
} as const;
export type RangeKey = keyof typeof RANGES;

/**
 * Snapshots of one pair across a time range (one multicall per point), oldest first.
 * Points from before the pair existed are skipped.
 */
export function usePairHistory(pairAddress: `0x${string}`, range: RangeKey, enabled: boolean) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["pool-history", pairAddress, range],
    enabled: !!publicClient && enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PairSnapshot[]> => {
      if (!publicClient) return [];
      const latest = await publicClient.getBlockNumber();
      const { days, points } = RANGES[range];
      const step = BigInt(Math.floor((days * SEPOLIA_BLOCKS_PER_DAY) / points));
      const blocks = Array.from({ length: points + 1 }, (_, i) => latest - step * BigInt(points - i))
        .filter((b) => b > 0n);

      const contracts = [...snapshotCalls(pairAddress), timestampCall];
      const results = await Promise.all(
        blocks.map((blockNumber) =>
          publicClient
            .multicall({ allowFailure: true, blockNumber, multicallAddress: MULTICALL3, contracts })
            .catch(() => null)
        )
      );

      const snaps: PairSnapshot[] = [];
      for (const r of results) {
        // Pair didn't exist yet at this block, or the read failed: skip the point.
        if (!r || r[5].status !== "success") continue;
        const snap = parseSnapshot(r.slice(0, 5) as any, Number(r[5].result as bigint));
        if (snap) snaps.push(snap);
      }
      return snaps;
    },
  });
}

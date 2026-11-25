import { useQueries } from "@tanstack/react-query";

/** Real holder data for a Sepolia ERC-20, from the holders Netlify function. */

export interface HolderRow {
  rank: number;
  address: string;
  balance: number;
  percentage: number;
  isContract: boolean | null;
}

export interface HoldersResponse {
  totalSupply: number;
  holderCount: number;
  holders: HolderRow[];
  updatedAt: string;
}

async function fetchHolders(address: string): Promise<HoldersResponse> {
  const res = await fetch(`/.netlify/functions/holders?contract=${address}`);
  if (!res.ok) throw new Error(`holders ${res.status}`);
  return res.json();
}

/** One holders query per token, in the same order as `addresses`. */
export function useTokensHolders(addresses: string[]) {
  return useQueries({
    queries: addresses.map((a) => ({
      queryKey: ["holders", a.toLowerCase()],
      queryFn: () => fetchHolders(a),
      staleTime: 60_000,
      refetchInterval: 120_000,
      retry: 1,
    })),
  });
}

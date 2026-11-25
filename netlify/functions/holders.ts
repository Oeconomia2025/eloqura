import type { Handler } from '@netlify/functions';
import { createPublicClient, http, getAddress, isAddress, formatUnits, type Address } from 'viem';
import { sepolia } from 'viem/chains';

/**
 * Real token holders for an ERC-20 on Sepolia.
 *
 * 1. alchemy_getAssetTransfers lists every transfer of the token; every address that ever
 *    received it is a possible holder.
 * 2. One multicall reads each address's current balanceOf; zero balances are dropped.
 * 3. The top holders are checked for contract code so pools/staking contracts are labeled.
 *
 * GET /.netlify/functions/holders?contract=0x...   (also accepts /api/holders/0x...)
 */

const RPC_URL =
  process.env.ALCHEMY_SEPOLIA_URL || 'https://eth-sepolia.g.alchemy.com/v2/esuQ5PPGg8-Sr5-X-P-JT';
const TOP_N = 100;
const CONTRACT_CHECK_N = 25;
const CACHE_MS = 60_000;
const ZERO = '0x0000000000000000000000000000000000000000';

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
] as const;

const client = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
const cache = new Map<string, { at: number; body: string }>();

async function allRecipients(contract: Address): Promise<Set<string>> {
  const recipients = new Set<string>();
  let pageKey: string | undefined;
  for (let page = 0; page < 50; page++) {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        params: [{
          fromBlock: '0x0',
          toBlock: 'latest',
          contractAddresses: [contract],
          category: ['erc20'],
          excludeZeroValue: true,
          withMetadata: false,
          maxCount: '0x3e8',
          ...(pageKey ? { pageKey } : {}),
        }],
      }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || 'alchemy_getAssetTransfers failed');
    for (const t of json.result.transfers as { to: string | null }[]) {
      if (t.to && t.to.toLowerCase() !== ZERO) recipients.add(t.to.toLowerCase());
    }
    pageKey = json.result.pageKey;
    if (!pageKey) break;
  }
  return recipients;
}

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ message: 'Method not allowed' }) };
  }

  const raw = event.queryStringParameters?.contract || event.path.split('/').pop() || '';
  if (!isAddress(raw)) {
    return { statusCode: 400, headers, body: JSON.stringify({ message: 'A valid contract address is required' }) };
  }
  const contract = getAddress(raw);

  const hit = cache.get(contract);
  if (hit && Date.now() - hit.at < CACHE_MS) return { statusCode: 200, headers, body: hit.body };

  try {
    const [recipients, totalSupply, decimals] = await Promise.all([
      allRecipients(contract),
      client.readContract({ address: contract, abi: ERC20_ABI, functionName: 'totalSupply' }),
      client.readContract({ address: contract, abi: ERC20_ABI, functionName: 'decimals' }),
    ]);

    const addresses = [...recipients] as Address[];
    const balances: bigint[] = [];
    for (let i = 0; i < addresses.length; i += 500) {
      const chunk = addresses.slice(i, i + 500);
      const results = await client.multicall({
        allowFailure: true,
        contracts: chunk.map((a) => ({ address: contract, abi: ERC20_ABI, functionName: 'balanceOf' as const, args: [a] as const })),
      });
      results.forEach((r) => balances.push(r.status === 'success' ? (r.result as bigint) : 0n));
    }

    const held = addresses
      .map((address, i) => ({ address, raw: balances[i] }))
      .filter((h) => h.raw > 0n)
      .sort((a, b) => (b.raw > a.raw ? 1 : b.raw < a.raw ? -1 : 0));

    const top = held.slice(0, TOP_N);
    const codes = await Promise.all(
      top.slice(0, CONTRACT_CHECK_N).map((h) => client.getCode({ address: h.address }).catch(() => undefined))
    );

    const supply = Number(formatUnits(totalSupply, decimals));
    const holders = top.map((h, i) => {
      const balance = Number(formatUnits(h.raw, decimals));
      return {
        rank: i + 1,
        address: getAddress(h.address),
        balance,
        percentage: supply > 0 ? (balance / supply) * 100 : 0,
        isContract: i < CONTRACT_CHECK_N ? !!codes[i] && codes[i] !== '0x' : null,
      };
    });

    const body = JSON.stringify({
      contract,
      decimals,
      totalSupply: supply,
      holderCount: held.length,
      holders,
      updatedAt: new Date().toISOString(),
    });
    cache.set(contract, { at: Date.now(), body });
    return { statusCode: 200, headers: { ...headers, 'Cache-Control': 'public, max-age=60' }, body };
  } catch (error) {
    console.error('Error fetching holders:', error);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        message: 'Failed to fetch holders',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

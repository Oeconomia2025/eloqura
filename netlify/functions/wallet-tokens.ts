import type { Handler } from '@netlify/functions';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const address = event.queryStringParameters?.address;
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid address required' }) };
  }

  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Alchemy API key not configured' }) };
  }

  try {
    // Call Alchemy's getTokenBalances (returns ALL ERC-20 tokens with non-zero balances)
    const alchemyUrl = `https://eth-sepolia.g.alchemy.com/v2/${apiKey}`;

    const balancesRes = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'alchemy_getTokenBalances',
        params: [address, 'erc20'],
      }),
    });
    const balancesData = await balancesRes.json();

    if (balancesData.error) {
      throw new Error(balancesData.error.message || 'Alchemy RPC error');
    }

    const tokenBalances = balancesData.result?.tokenBalances || [];

    // Filter to non-zero balances
    const nonZero = tokenBalances.filter(
      (t: any) => t.tokenBalance && t.tokenBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000' && t.tokenBalance !== '0x'
    );

    // Fetch metadata for each token (batched)
    const tokens = await Promise.all(
      nonZero.map(async (t: any) => {
        try {
          const metaRes = await fetch(alchemyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'alchemy_getTokenMetadata',
              params: [t.contractAddress],
            }),
          });
          const metaData = await metaRes.json();
          const meta = metaData.result || {};

          return {
            address: t.contractAddress.toLowerCase(),
            symbol: meta.symbol || 'UNKNOWN',
            name: meta.name || 'Unknown Token',
            decimals: meta.decimals ?? 18,
            logo: meta.logo || null,
            balance: t.tokenBalance, // hex string
          };
        } catch {
          return {
            address: t.contractAddress.toLowerCase(),
            symbol: 'UNKNOWN',
            name: 'Unknown Token',
            decimals: 18,
            logo: null,
            balance: t.tokenBalance,
          };
        }
      })
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ tokens }),
    };
  } catch (error) {
    console.error('Error fetching wallet tokens:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
    };
  }
};

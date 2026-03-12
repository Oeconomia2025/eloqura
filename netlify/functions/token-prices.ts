import type { Handler } from '@netlify/functions';

// ── Constants ────────────────────────────────────────────────
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const UNISWAP_WETH = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
const ELOQURA_WETH = '0x34b11F6b8f78fa010bBCA71bC7FE79dAa811b89f';
const UNISWAP_QUOTER = '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3';
const ELOQURA_FACTORY = '0x1a4C7849Dd8f62AefA082360b3A8D857952B3b8e';

const FEE_TIERS = [3000, 500, 10000];

// Tokens only on Eloqura DEX (skip Uniswap quoter entirely)
const SKIP_QUOTER = new Set([
  '0x00904218319a045a96d776ec6a970f54741208e6', // OEC
  '0x5cdbed8ed63554fde6653f02ae1c4d6d5ae71ad3', // ALUR
  '0x41b07704b9d671615a3e9f83c06d85cb38bbf4d9', // ALUD
  '0x4feb15d0644e5c7bb64dcd85744f0f2ab5f7a253', // ELOQ
]);

// Tokens to always price (even if wallet doesn't hold them)
const BASE_TOKENS = [
  { address: '0x00904218319a045a96d776ec6a970f54741208e6', symbol: 'OEC', decimals: 18 },
  { address: USDC.toLowerCase(), symbol: 'USDC', decimals: 6 },
  { address: '0x779877a7b0d9e8603169ddbd7836e478b4624789', symbol: 'LINK', decimals: 18 },
  { address: UNISWAP_WETH.toLowerCase(), symbol: 'WETH', decimals: 18 },
  { address: ELOQURA_WETH.toLowerCase(), symbol: 'WETH_ELOQURA', decimals: 18 },
  { address: '0x5cdbed8ed63554fde6653f02ae1c4d6d5ae71ad3', symbol: 'ALUR', decimals: 18 },
  { address: '0x41b07704b9d671615a3e9f83c06d85cb38bbf4d9', symbol: 'ALUD', decimals: 18 },
  { address: '0x4feb15d0644e5c7bb64dcd85744f0f2ab5f7a253', symbol: 'ELOQ', decimals: 18 },
  { address: '0x3e622317f8c93f7328350cf0b56d9ed4c620c5d6', symbol: 'DAI', decimals: 18 },
  { address: '0x5bb220afc6e2e008cb2302a83536a019ed245aa2', symbol: 'AAVE', decimals: 18 },
];

// ── Cache ────────────────────────────────────────────────────
let cachedPrices: Record<string, number> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 60 seconds

// ── ABI encoders (manual — no ethers/viem dependency needed) ─
// quoteExactInputSingle((address,address,uint256,uint24,uint160))
const QUOTE_SELECTOR = '0xc6a5026a';
// getPair(address,address)
const GET_PAIR_SELECTOR = '0xe6a43905';
// getReserves()
const GET_RESERVES_SELECTOR = '0x0902f1ac';
// token0()
const TOKEN0_SELECTOR = '0x0dfe1681';

function padAddress(addr: string): string {
  return addr.toLowerCase().replace('0x', '').padStart(64, '0');
}

function padUint256(val: bigint): string {
  return val.toString(16).padStart(64, '0');
}

function encodeQuote(tokenIn: string, tokenOut: string, amountIn: bigint, fee: number): string {
  // Encode as tuple: (tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96=0)
  return QUOTE_SELECTOR +
    padAddress(tokenIn) +
    padAddress(tokenOut) +
    padUint256(amountIn) +
    padUint256(BigInt(fee)) +
    padUint256(0n);
}

function encodeGetPair(tokenA: string, tokenB: string): string {
  return GET_PAIR_SELECTOR + padAddress(tokenA) + padAddress(tokenB);
}

function decodeUint256(hex: string): bigint {
  if (!hex || hex === '0x') return 0n;
  return BigInt(hex.slice(0, 66)); // first 32 bytes
}

function decodeAddress(hex: string): string {
  if (!hex || hex === '0x' || hex.length < 66) return '0x0000000000000000000000000000000000000000';
  return '0x' + hex.slice(26, 66);
}

function decodeReserves(hex: string): [bigint, bigint] {
  if (!hex || hex.length < 130) return [0n, 0n];
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return [
    BigInt('0x' + clean.slice(0, 64)),
    BigInt('0x' + clean.slice(64, 128)),
  ];
}

function formatUnits(val: bigint, decimals: number): number {
  const str = val.toString();
  if (str.length <= decimals) {
    return parseFloat('0.' + str.padStart(decimals, '0'));
  }
  const intPart = str.slice(0, str.length - decimals);
  const fracPart = str.slice(str.length - decimals);
  return parseFloat(intPart + '.' + fracPart);
}

// ── RPC helper ───────────────────────────────────────────────
async function rpcCall(alchemyUrl: string, to: string, data: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to, data }, 'latest'],
      }),
      signal: controller.signal,
    });
    const json = await res.json();
    clearTimeout(timer);
    if (json.error || !json.result || json.result === '0x') return null;
    return json.result;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ── Pricing logic ────────────────────────────────────────────
async function fetchAllPrices(alchemyUrl: string): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};

  // Stablecoins
  prices[USDC.toLowerCase()] = 1;
  prices['USDC'] = 1;
  prices['DAI'] = 1;
  prices['0x3e622317f8c93f7328350cf0b56d9ed4c620c5d6'] = 1;
  prices['ALUD'] = 1;
  prices['0x41b07704b9d671615a3e9f83c06d85cb38bbf4d9'] = 1;

  // ── Tier 1 & 2: Uniswap V3 Quoter (parallel for all non-skip tokens) ──
  const quoterTokens = BASE_TOKENS.filter(t =>
    !SKIP_QUOTER.has(t.address) && t.symbol !== 'USDC' && t.symbol !== 'DAI' && t.symbol !== 'ALUD'
  );

  // Get ETH price first (needed for multi-hop and WETH pair fallback)
  const ethPrice = await getUniswapPrice(alchemyUrl, UNISWAP_WETH, 18);
  if (ethPrice > 0) {
    prices['ETH'] = ethPrice;
    prices['eth'] = ethPrice;
    prices['WETH'] = ethPrice;
    prices['WETH_ELOQURA'] = ethPrice;
    prices[UNISWAP_WETH.toLowerCase()] = ethPrice;
    prices[ELOQURA_WETH.toLowerCase()] = ethPrice;
  }

  // Price all other quoter tokens in parallel
  const quoterResults = await Promise.all(
    quoterTokens.filter(t => t.symbol !== 'WETH' && t.symbol !== 'WETH_ELOQURA').map(async (token) => {
      const addr = token.address.toLowerCase();
      // Tier 1: Direct token → USDC
      const directPrice = await getUniswapPrice(alchemyUrl, token.address, token.decimals);
      if (directPrice > 0) return { symbol: token.symbol, addr, price: directPrice };

      // Tier 2: token → WETH → USDC
      if (ethPrice > 0) {
        const wethAmount = await getUniswapQuote(alchemyUrl, token.address, UNISWAP_WETH, token.decimals);
        if (wethAmount > 0) return { symbol: token.symbol, addr, price: wethAmount * ethPrice };
      }

      return { symbol: token.symbol, addr, price: 0 };
    })
  );
  for (const { symbol, addr, price } of quoterResults) {
    if (price > 0) { prices[symbol] = price; prices[addr] = price; }
  }

  // ── Tier 3: Eloqura DEX pool reserves (parallel for unpriced tokens) ──
  const unpricedTokens = BASE_TOKENS.filter(t => {
    const addr = t.address.toLowerCase();
    return !prices[addr] && t.symbol !== 'USDC' && t.symbol !== 'DAI' && t.symbol !== 'ALUD' &&
           t.symbol !== 'WETH' && t.symbol !== 'WETH_ELOQURA';
  });

  if (unpricedTokens.length > 0) {
    const eloquraResults = await Promise.all(
      unpricedTokens.map(async (token) => {
        const addr = token.address.toLowerCase();
        // Try USDC pair
        const usdcPrice = await getEloquraPrice(alchemyUrl, token.address, USDC, token.decimals, 6, 1);
        if (usdcPrice > 0) return { symbol: token.symbol, addr, price: usdcPrice };

        // Try WETH pair
        if (ethPrice > 0) {
          const wethPrice = await getEloquraPrice(alchemyUrl, token.address, ELOQURA_WETH, token.decimals, 18, ethPrice);
          if (wethPrice > 0) return { symbol: token.symbol, addr, price: wethPrice };
        }

        return { symbol: token.symbol, addr, price: 0 };
      })
    );
    for (const { symbol, addr, price } of eloquraResults) {
      if (price > 0) { prices[symbol] = price; prices[addr] = price; }
    }
  }

  return prices;
}

// Get USD price via direct Uniswap V3 quote (token → USDC, all fee tiers parallel)
async function getUniswapPrice(alchemyUrl: string, tokenAddr: string, decimals: number): Promise<number> {
  const amountIn = 10n ** BigInt(decimals); // 1 unit
  const results = await Promise.all(
    FEE_TIERS.map(fee =>
      rpcCall(alchemyUrl, UNISWAP_QUOTER, encodeQuote(tokenAddr, USDC, amountIn, fee))
    )
  );
  for (const result of results) {
    if (result) {
      const amount = decodeUint256(result);
      const price = formatUnits(amount, 6);
      if (price > 0) return price;
    }
  }
  return 0;
}

// Get raw quote amount (token → otherToken, all fee tiers parallel)
async function getUniswapQuote(alchemyUrl: string, tokenIn: string, tokenOut: string, decimalsIn: number): Promise<number> {
  const amountIn = 10n ** BigInt(decimalsIn);
  const results = await Promise.all(
    FEE_TIERS.map(fee =>
      rpcCall(alchemyUrl, UNISWAP_QUOTER, encodeQuote(tokenIn, tokenOut, amountIn, fee))
    )
  );
  for (const result of results) {
    if (result) {
      const amount = decodeUint256(result);
      const val = formatUnits(amount, 18);
      if (val > 0) return val;
    }
  }
  return 0;
}

// Get price from Eloqura DEX pool reserves
async function getEloquraPrice(
  alchemyUrl: string, tokenAddr: string, quoteAddr: string,
  tokenDecimals: number, quoteDecimals: number, quotePrice: number
): Promise<number> {
  const pairResult = await rpcCall(alchemyUrl, ELOQURA_FACTORY, encodeGetPair(tokenAddr, quoteAddr));
  if (!pairResult) return 0;
  const pairAddress = decodeAddress(pairResult);
  if (pairAddress === '0x0000000000000000000000000000000000000000') return 0;

  const [reservesResult, token0Result] = await Promise.all([
    rpcCall(alchemyUrl, pairAddress, GET_RESERVES_SELECTOR),
    rpcCall(alchemyUrl, pairAddress, TOKEN0_SELECTOR),
  ]);
  if (!reservesResult || !token0Result) return 0;

  const [reserve0, reserve1] = decodeReserves(reservesResult);
  const token0 = decodeAddress(token0Result);
  const isToken0 = token0.toLowerCase() === tokenAddr.toLowerCase();

  const tokenReserve = formatUnits(isToken0 ? reserve0 : reserve1, tokenDecimals);
  const quoteReserve = formatUnits(isToken0 ? reserve1 : reserve0, quoteDecimals);

  if (tokenReserve > 0 && quoteReserve > 0) {
    return (quoteReserve / tokenReserve) * quotePrice;
  }
  return 0;
}

// ── Handler ──────────────────────────────────────────────────
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=60',
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Return cached prices if fresh
  if (cachedPrices && Date.now() - cacheTimestamp < CACHE_TTL) {
    return { statusCode: 200, headers, body: JSON.stringify({ prices: cachedPrices, cached: true }) };
  }

  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Alchemy API key not configured' }) };
  }

  try {
    const alchemyUrl = `https://eth-sepolia.g.alchemy.com/v2/${apiKey}`;
    const prices = await fetchAllPrices(alchemyUrl);

    cachedPrices = prices;
    cacheTimestamp = Date.now();

    return { statusCode: 200, headers, body: JSON.stringify({ prices, cached: false }) };
  } catch (error) {
    // Return stale cache on error
    if (cachedPrices) {
      return { statusCode: 200, headers, body: JSON.stringify({ prices: cachedPrices, cached: true, stale: true }) };
    }
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to fetch prices' }) };
  }
};

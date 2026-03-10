# Uniswap V3 Integration

Eloqura uses Uniswap V3 on Sepolia as a fallback quote and swap router for tokens without Eloqura V2 pools.

## Overview

When a direct Eloqura V2 pool doesn't exist or has insufficient liquidity, the swap page falls back to Uniswap V3's QuoterV2 for price discovery and SwapRouter02 for execution.

## Fee Tiers

Uniswap V3 pools are deployed at specific fee levels. The quote system tries all four:

| Tier    | Fee (bps) | Fee %  | Typical Use              |
| ------- | --------- | ------ | ------------------------ |
| LOWEST  | 100       | 0.01%  | Stablecoin pairs         |
| LOW     | 500       | 0.05%  | Correlated pairs         |
| MEDIUM  | 3000      | 0.30%  | Most pairs               |
| HIGH    | 10000     | 1.00%  | Exotic/volatile pairs    |

## Quote Flow

```
1. Try all 4 fee tiers via QuoterV2.quoteExactInputSingle()
2. Select the tier with the best output amount
3. Store bestFeeTier in the quote object
4. Pass bestFeeTier to swap execution
```

{% hint style="warning" %}
**Fee Tier Mismatch Bug:** The swap execution MUST use the same fee tier that produced the best quote. Never hardcode a default. Different pairs use different fee tiers, and mismatches cause transaction reverts.
{% endhint %}

## Multi-Hop Fallback

If no direct pool exists on Uniswap V3 either, the system tries a multi-hop route:

```
Token → WETH → USDC
```

This catches most tokens that have WETH liquidity on Uniswap V3.

## Contract Functions Used

### QuoterV2

| Function                        | Description                    |
| ------------------------------- | ------------------------------ |
| `quoteExactInputSingle(params)` | Get output amount for input    |

### SwapRouter02

| Function                    | Description                        |
| --------------------------- | ---------------------------------- |
| `exactInputSingle(params)`  | Execute single-hop swap            |
| `multicall(data[])`         | Batch multiple operations          |

## Known Pitfalls

- **parseUnits overflow**: JavaScript floats produce excess decimals. Always `.toFixed(token.decimals)` before `parseUnits()`.
- **RPC getLogs limits**: Public Sepolia RPCs limit `eth_getLogs` to ~5000 blocks per request. Chunk larger ranges.

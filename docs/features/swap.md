# Swap

Token-to-token swaps with multi-tier routing across Eloqura V2 and Uniswap V3.

**Source:** `client/src/pages/swap.tsx`

## Overview

The Swap page is the core feature of Eloqura DEX. It finds the best price across multiple liquidity sources and executes the trade in a single transaction.

## Swap Types

| Type          | Router Function                    | When Used                |
| ------------- | ---------------------------------- | ------------------------ |
| ETH → Token   | `swapExactETHForTokens()`         | Input is native ETH      |
| Token → ETH   | `swapExactTokensForETH()`         | Output is native ETH     |
| Token → Token  | `swapExactTokensForTokens()`     | Both are ERC-20 tokens   |

## Quote Routing

The system tries four sources in order:

1. **Eloqura V2** — Direct pair reserves (best for OEC, WETH, USDC pairs)
2. **Uniswap V3 Quoter** — Tries all 4 fee tiers (100, 500, 3000, 10000 bps)
3. **Multi-hop** — Token → WETH → USDC via Uniswap V3
4. **Eloqura reserve pricing** — Fallback for OEC/Eloqura-only tokens

## UI Features

- **Token selectors** with search and known token list
- **Amount input** with percentage buttons (25%, 50%, 75%, Max)
- **Slippage tolerance** slider (0.1% to 5%)
- **Price impact** warning for large trades
- **Exchange rate** display (forward and inverse)
- **Gas estimate** before execution
- **Custom token import** — paste any ERC-20 contract address

## Swap Flow

1. User selects tokens and enters amount
2. Quote system finds best route and price
3. User reviews rate, price impact, minimum received
4. If needed, approve token spending (one-time)
5. Execute swap transaction
6. Transaction tracked via OECsplorer API

## Transaction Tracking

All swaps are reported to the OECsplorer indexer for on-chain analytics:

```typescript
trackTransaction(txHash) → POST ${VITE_EXPLORER_API_URL}/api/track-tx
```

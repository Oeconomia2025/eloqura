# Eloqura V2 AMM

UniswapV2-compatible automated market maker powering Eloqura's core swap and liquidity functions.

## Overview

Eloqura V2 is a constant-product AMM (`x * y = k`) deployed on Sepolia. The Factory creates Pair contracts for each token pair, and the Router provides user-facing swap and liquidity functions.

## Factory

**Address:** `0x1a4C7849Dd8f62AefA082360b3A8D857952B3b8e`

| Function                     | Description                          |
| ---------------------------- | ------------------------------------ |
| `getPair(tokenA, tokenB)`    | Get pair contract address            |
| `allPairs(index)`            | Get pair by index                    |
| `allPairsLength()`           | Total number of pairs created        |
| `createPair(tokenA, tokenB)` | Deploy a new pair contract           |

## Router

**Address:** `0x3f42823d998EE4759a95a42a6e3bB7736B76A7AE`

### Swap Functions

| Function                                  | Description                    |
| ----------------------------------------- | ------------------------------ |
| `swapExactTokensForTokens(amountIn, ...)`| Token → Token swap             |
| `swapExactETHForTokens(amountOutMin, ...)`| ETH → Token swap              |
| `swapExactTokensForETH(amountIn, ...)`   | Token → ETH swap              |

### Liquidity Functions

| Function                                 | Description                     |
| ---------------------------------------- | ------------------------------- |
| `addLiquidity(tokenA, tokenB, ...)`      | Provide liquidity to a pool     |
| `addLiquidityETH(token, ...)`            | Provide liquidity with ETH      |
| `removeLiquidity(tokenA, tokenB, ...)`   | Withdraw liquidity              |
| `removeLiquidityETH(token, ...)`         | Withdraw liquidity to ETH       |

## Pair Contracts

Each pair contract holds reserves and LP token balances:

| Function              | Description                              |
| --------------------- | ---------------------------------------- |
| `token0()` / `token1()` | Underlying token addresses             |
| `getReserves()`       | Current reserve balances + timestamp     |
| `totalSupply()`       | Total LP tokens minted                   |
| `balanceOf(address)`  | User's LP token balance                  |

## Fee Structure

- **0.3%** swap fee on each trade
- Fee split: LP providers receive the majority, protocol and treasury receive the remainder

## Dust Pools

Some pairs (WETH/LINK, OEC/WETH) have `MINIMUM_LIQUIDITY` (1000 LP tokens) locked with dust reserves. These cannot be removed but are harmless. The liquidity page includes a **direct mint path** that bypasses the Router for these dust pairs, with auto-skim recovery on failure.

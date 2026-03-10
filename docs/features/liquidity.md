# Liquidity

Provide and manage liquidity across Eloqura V2 pools.

**Source:** `client/src/pages/liquidity.tsx`

## Overview

The Liquidity page lets users browse all Eloqura pools, provide liquidity to earn LP tokens, withdraw positions, and create new pools for token pairs that don't exist yet.

## Features

### Pool Discovery

Pools are enumerated from the Factory contract:

1. `Factory.allPairsLength()` → total pool count
2. `Factory.allPairs(index)` → pair address for each index
3. Per pair: fetch `token0`, `token1`, `getReserves()`, `totalSupply()`, user's `balanceOf()`

### Add Liquidity

1. Select two tokens (or ETH + token)
2. Enter amounts — the other side auto-calculates to maintain pool ratio
3. Approve both tokens if needed
4. Execute `Router.addLiquidity()` or `Router.addLiquidityETH()`
5. Receive LP tokens proportional to your share

### Remove Liquidity

1. Select a pool where you hold LP tokens
2. Enter amount to withdraw (or percentage)
3. Approve LP token spending
4. Execute `Router.removeLiquidity()` or `Router.removeLiquidityETH()`
5. Receive both underlying tokens back

### Create New Pool

If a pair doesn't exist, the first liquidity provision creates it automatically via the Factory.

## Special: Direct Mint Path

For dust pairs (WETH/LINK, OEC/WETH) with minimal locked liquidity, the page supports a **direct mint path** that bypasses the Router:

1. Transfer token A to pair contract
2. Transfer token B to pair contract
3. Call `pair.mint()`

Includes auto-skim recovery on failure and ETH wrapping support.

## Pool Data Displayed

| Field          | Source                          |
| -------------- | ------------------------------- |
| Token pair     | `pair.token0()` / `token1()`   |
| Reserves       | `pair.getReserves()`           |
| Total LP supply| `pair.totalSupply()`           |
| Your LP balance| `pair.balanceOf(wallet)`       |
| Your pool share| balance / totalSupply × 100%   |

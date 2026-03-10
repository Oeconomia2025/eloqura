# Contract Addresses

All deployed contract addresses for the Eloqura DEX.

## Eloqura V2 AMM (Sepolia)

| Contract       | Address                                      | Description              |
| -------------- | -------------------------------------------- | ------------------------ |
| Factory        | `0x1a4C7849Dd8f62AefA082360b3A8D857952B3b8e` | Pair creation & registry |
| Router         | `0x3f42823d998EE4759a95a42a6e3bB7736B76A7AE` | Swap & liquidity router  |
| WETH           | `0x34b11F6b8f78fa010bBCA71bC7FE79dAa811b89f` | Wrapped ETH (Eloqura)    |
| Limit Orders   | `0x983C3a8aae77f795897fF836c94f4Dd839590567` | On-chain limit orders    |

## Uniswap V3 (Sepolia)

| Contract       | Address                                      | Description              |
| -------------- | -------------------------------------------- | ------------------------ |
| SwapRouter02   | `0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E` | Swap execution           |
| QuoterV2       | `0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3` | Price quotes             |
| Factory        | `0x0227628f3F023bb0B980b67D528571c95c6DaC1c` | V3 pool factory          |
| WETH           | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` | Wrapped ETH (Uniswap)    |

{% hint style="warning" %}
**Two WETH Addresses:** Eloqura WETH and Uniswap WETH are different contracts. Always use the correct WETH for each router. Mixing them causes swap failures.
{% endhint %}

## Known Tokens (Sepolia)

| Token | Address                                      | Decimals |
| ----- | -------------------------------------------- | -------- |
| OEC   | `0x00904218319a045a96d776ec6a970f54741208e6` | 18       |
| USDC  | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | 6        |
| LINK  | `0x779877A7B0D9E8603169DdbD7836e478b4624789` | 18       |
| DAI   | `0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6` | 18       |
| AAVE  | `0x5bB220AfC6e2e008Cb2302A83536A019eD245aA2` | 18       |

## ABI Source

All contract ABIs are defined inline in `client/src/lib/contracts.ts`.

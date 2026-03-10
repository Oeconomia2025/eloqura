# Eloqura DEX

Decentralized exchange and automated market maker for the Oeconomia ecosystem. Swap tokens, provide liquidity, and explore pools — powered by Eloqura V2 AMM with Uniswap V3 quote routing.

**Live:** [https://eloqura.oeconomia.io](https://eloqura.oeconomia.io)

## Key Features

| Feature            | Description                                                        |
| ------------------ | ------------------------------------------------------------------ |
| Token Swaps        | Multi-tier routing: Eloqura V2 → Uniswap V3 → multi-hop fallback  |
| Liquidity Pools    | Create pools, add/remove liquidity, track LP positions             |
| Custom Token Import| Paste any ERC-20 address to import and trade                      |
| Dashboard          | Portfolio tracking, token balances, price charts                   |
| Token Explorer     | Analyze pools, reserves, and token metrics                        |
| Limit Orders       | On-chain limit order contract (deployed)                          |
| 9 Wallet Providers | MetaMask, WalletConnect, Coinbase, Trust, Rabby, OKX, and more   |

## Contract Addresses (Sepolia)

| Contract        | Address                                      |
| --------------- | -------------------------------------------- |
| Eloqura Factory | `0x1a4C7849Dd8f62AefA082360b3A8D857952B3b8e` |
| Eloqura Router  | `0x3f42823d998EE4759a95a42a6e3bB7736B76A7AE` |
| Eloqura WETH    | `0x34b11F6b8f78fa010bBCA71bC7FE79dAa811b89f` |
| Limit Orders    | `0x983C3a8aae77f795897fF836c94f4Dd839590567` |

## Tech Stack

| Layer      | Technology                                              |
| ---------- | ------------------------------------------------------- |
| Frontend   | React 18, TypeScript, Vite, Tailwind CSS, Recharts      |
| Routing    | Wouter                                                  |
| Web3       | Wagmi 2, Viem 2                                         |
| State      | TanStack Query (React Query)                            |
| UI         | Radix UI (shadcn/ui), Lucide React                      |
| Backend    | Netlify Serverless Functions, Express.js                |
| Database   | PostgreSQL (Neon), Drizzle ORM                          |
| Deployment | Netlify                                                 |

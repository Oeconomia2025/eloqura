# Architecture & Scaffold

High-level overview of the Eloqura DEX architecture and swap routing.

## System Diagram

```
┌───────────────────────────────────────────────────────────┐
│                     React Frontend                         │
│  (Vite + TypeScript + Tailwind + Wagmi + Recharts)         │
│                                                            │
│  Swap │ Liquidity │ Dashboard │ Examine │ Buy/Sell │ Bridge│
└───┬───────────────────────────────┬────────────────────────┘
    │                               │
    │  Contract Reads/Writes        │  Market Data
    │  (Wagmi / Viem)               │  (Netlify Functions)
    ▼                               ▼
┌────────────────────┐   ┌──────────────────────────────────┐
│  Sepolia RPC       │   │  Netlify Serverless Functions     │
│  (Alchemy)         │   │  (26 endpoints)                   │
│                    │   │                                   │
│  Eloqura V2 AMM    │   │  - Token data & history           │
│  ┌──────────────┐  │   │  - Live Coin Watch sync           │
│  │ Factory      │  │   │  - Volume analytics               │
│  │ 0x1a4C...    │  │   │  - Portfolio tracking             │
│  └──────────────┘  │   └──────────┬────────────────────────┘
│  ┌──────────────┐  │              │
│  │ Router       │  │              ▼
│  │ 0x3f42...    │  │   ┌──────────────────────┐
│  └──────────────┘  │   │  PostgreSQL (Neon)    │
│                    │   │  Drizzle ORM          │
│  Uniswap V3       │   │                      │
│  ┌──────────────┐  │   │  - Token snapshots    │
│  │ QuoterV2     │  │   │  - Price history      │
│  │ 0xEd1f...    │  │   │  - LCW coin cache     │
│  └──────────────┘  │   └──────────────────────┘
│  ┌──────────────┐  │
│  │ SwapRouter02 │  │
│  │ 0x3bFA...    │  │
│  └──────────────┘  │
└────────────────────┘
```

## Multi-Tier Quote System

```
User enters swap amount
        │
        ▼
1. Eloqura V2 Pool exists?
   ├── YES → Quote from reserves (best for OEC/WETH/USDC)
   └── NO ▼
2. Uniswap V3 Quoter (try 4 fee tiers: 100, 500, 3000, 10000)
   ├── FOUND → Use best fee tier quote
   └── NO ▼
3. Multi-hop: Token → WETH → USDC via Uniswap V3
   ├── FOUND → Use multi-hop route
   └── NO ▼
4. Eloqura reserve-based pricing (OEC/Eloqura-only tokens)
```

{% hint style="warning" %}
**Critical:** The fee tier from the quote MUST be passed to swap execution. Never hardcode a default fee tier — different token pairs use different tiers.
{% endhint %}

## Frontend Structure

```
client/src/
├── pages/                  # Route-level page components
│   ├── swap.tsx             # Token swap interface (~3000 lines)
│   ├── liquidity.tsx        # LP provision/withdrawal (~3300 lines)
│   ├── dashboard.tsx        # Portfolio & analytics
│   ├── examine.tsx          # Token/pool explorer
│   ├── landing.tsx          # Welcome page
│   ├── buy-sell.tsx         # Fiat on/off-ramps
│   └── bridge.tsx           # Cross-chain bridging
├── components/              # Reusable UI components
│   ├── layout.tsx           # Collapsible sidebar layout
│   ├── wallet-connect.tsx   # Multi-wallet connection
│   ├── ecosystem-sidebar.tsx
│   ├── oec-loader.tsx       # Branded loading spinner
│   └── ui/                  # 100+ shadcn/ui components
├── hooks/                   # Custom React hooks
│   └── use-enforce-sepolia.ts
├── lib/                     # Contract ABIs, wagmi config
│   ├── contracts.ts         # All ABIs and addresses
│   ├── wagmi.ts             # Wallet configuration
│   └── queryClient.ts
├── utils/                   # Formatting helpers
│   ├── formatters.ts
│   ├── token-logos.ts
│   └── token-colors.ts
└── App.tsx                  # Router and providers
```

## Backend Structure

```
server/
├── index.ts                 # Express server entry
├── routes.ts                # API route definitions
├── db.ts                    # Drizzle ORM connection
└── services/                # External API integrations
    ├── live-coin-watch-api.ts
    ├── live-coin-watch-sync.ts
    ├── coingecko-api.ts
    ├── alchemy-api.ts
    └── moralis-api.ts

netlify/functions/           # 26 serverless endpoints
├── token-data.ts
├── token-historical-data.ts
├── token-coins-data.ts
├── volume-analytics.ts
├── wallet-tokens.ts
├── live-coin-watch-*.ts
└── ...

shared/
└── schema.ts                # Drizzle schema + Zod validation
```

## Key Design Decisions

- **Dual DEX routing**: Eloqura V2 for ecosystem tokens, Uniswap V3 for broader market via Quoter
- **Two WETH addresses**: Eloqura WETH (`0x34b1...`) ≠ Uniswap WETH (`0xfFf9...`) — must use correct one per router
- **Serverless production**: 26 Netlify functions handle all API traffic
- **Custom token import**: Any ERC-20 can be imported by pasting contract address
- **Transaction tracking**: All swaps/LP ops tracked via OECsplorer API integration

# Dashboard

Portfolio tracking, token balances, and market analytics.

**Source:** `client/src/pages/dashboard.tsx`

## Overview

The Dashboard shows a connected wallet's token holdings with USD valuations, price charts, and quick action buttons.

## Features

### Wallet Balances

Displays all known token balances for the connected wallet:
- OEC, WETH, USDC, LINK, DAI, AAVE, ETH
- USD valuation per token
- Total portfolio value

### Price Charts

Interactive price history charts built with Recharts:
- Multiple timeframes
- Token-specific color mapping
- Area charts with gradient fills

### Quick Actions

Shortcut buttons to navigate to:
- Swap
- Add Liquidity
- Bridge

### Holder Statistics

Top holder distribution for selected tokens.

### Recent Transactions

Transaction history sourced from Alchemy API.

## Data Sources

| Data              | Source                               |
| ----------------- | ------------------------------------ |
| Token balances    | On-chain via Wagmi                   |
| Price data        | Netlify `token-data` function        |
| Price history     | Netlify `token-historical-data`      |
| Holder stats      | Netlify `holders` function           |
| Transactions      | Alchemy SDK                          |

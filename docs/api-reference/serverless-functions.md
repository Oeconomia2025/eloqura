# Serverless Functions

Overview of the 26 Netlify serverless functions powering the Eloqura backend.

**Source:** `netlify/functions/`

## Overview

All production API traffic goes through Netlify serverless functions. Each function connects to Neon PostgreSQL via Drizzle ORM.

## Token Data

| Function                  | Method | Description                          |
| ------------------------- | ------ | ------------------------------------ |
| `token-data`              | GET    | Fetch token info by code             |
| `token-coins-data`        | GET    | Get all coins database               |
| `token-historical-data`   | GET    | Historical price data                |
| `token-supply-data`       | GET    | Supply metrics                       |
| `token`                   | GET    | Generic token endpoint               |

## Market Data

| Function              | Method | Description                          |
| --------------------- | ------ | ------------------------------------ |
| `token-history`       | GET    | Price history for charts             |
| `price-history`       | GET    | Historical pricing                   |
| `eth-history`         | GET    | ETH-specific price history           |
| `volume-analytics`    | GET    | Volume and liquidity data            |

## Portfolio & User

| Function        | Method | Description                          |
| --------------- | ------ | ------------------------------------ |
| `portfolio`     | GET    | User portfolio tracking              |
| `wallet-tokens` | GET    | Wallet token holdings                |

## Governance & Holders

| Function        | Method | Description                          |
| --------------- | ------ | ------------------------------------ |
| `holders`       | GET    | Token holder information             |
| `transactions`  | GET    | Transaction history                  |

## Live Coin Watch

| Function                       | Method | Description                    |
| ------------------------------ | ------ | ------------------------------ |
| `live-coin-watch-coins`        | GET    | All coins (cached)             |
| `live-coin-watch-token`        | GET    | Specific token data            |
| `live-coin-watch-historical`   | GET    | Historical data                |
| `live-coin-watch-status`       | GET    | Sync status                    |
| `live-coin-watch-sync`         | POST   | Trigger data sync              |

## Admin / Utilities

| Function                  | Method | Description                    |
| ------------------------- | ------ | ------------------------------ |
| `authentic-token-sync`    | POST   | Token sync service             |
| `refresh-livecoinwatch`   | POST   | Manual data refresh            |
| `network-status`          | GET    | Network health check           |

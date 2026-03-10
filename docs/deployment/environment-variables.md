# Environment Variables

Required environment variables for Eloqura DEX.

## Required

| Variable                        | Description                              |
| ------------------------------- | ---------------------------------------- |
| `DATABASE_URL`                  | Neon PostgreSQL connection string        |
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project ID           |

## Optional

| Variable                    | Description                              |
| --------------------------- | ---------------------------------------- |
| `VITE_EXPLORER_API_URL`     | OECsplorer API for tx tracking (default: localhost:3001) |
| `ALCHEMY_API_KEY`           | Alchemy API key for blockchain queries   |
| `COINGECKO_API_KEY`         | CoinGecko API key (fallback)             |
| `LIVE_COIN_WATCH_API_KEY`   | Live Coin Watch API key                  |

## Notes

- All `VITE_` prefixed variables are exposed to the frontend at build time
- `DATABASE_URL` must use the Neon serverless connection string format
- Live Coin Watch sync is currently disabled to save API usage — data served from database cache

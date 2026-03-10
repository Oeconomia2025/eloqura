# Quick Start

Get Eloqura DEX running locally for development.

## Prerequisites

- Node.js 20+
- npm
- MetaMask or compatible wallet configured for Sepolia testnet

## Installation

```bash
cd eloqura-claude-workspace
npm install
```

## Environment Setup

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://user:pass@host/dbname
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
VITE_EXPLORER_API_URL=http://localhost:3001
```

See [Environment Variables](../deployment/environment-variables.md) for the full list.

## Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5000`.

## Your First Swap

1. Connect your wallet to Sepolia testnet
2. Navigate to the **Swap** page
3. Select tokens (e.g., ETH → OEC)
4. Enter an amount — the quote system finds the best route automatically
5. Click **Swap** and confirm the transaction

## Production Build

```bash
npx vite build --config vite.config.netlify.ts
```

Outputs to `dist/public/` for Netlify deployment. See [Deploy Guide](../deployment/deploy-guide.md).

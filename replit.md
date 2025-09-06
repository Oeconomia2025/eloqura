# Overview

This is a comprehensive cryptocurrency dashboard and governance platform for the Oeconomia (OEC) token ecosystem built on the Binance Smart Chain. The platform provides real-time token analytics, portfolio tracking, DeFi management, gamified learning, and a fully decentralized governance infrastructure. It features professional-grade charts using authentic Live Coin Watch data, multi-wallet integration, staking pools with ROI calculators, and an achievement system for user engagement.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript for type-safe development
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for efficient server state management
- **UI Components**: Custom component library built with Radix UI primitives and shadcn/ui
- **Styling**: Tailwind CSS with custom crypto-themed design system featuring gradient color schemes
- **Build Tool**: Vite for fast development and optimized production builds
- **Design System**: Professional UI/UX with consistent branding, unified gradient color schemes for staking interfaces, and comprehensive responsive design

## Backend Architecture
- **Runtime**: Node.js with Express.js server framework
- **Language**: TypeScript for type safety across the stack
- **API Design**: RESTful API architecture with structured endpoints for token data, transactions, and network status
- **Deployment Strategy**: Dual deployment approach - Express server for development and Netlify serverless functions for production
- **Data Processing**: Background services for automated data synchronization and historical data management

## Data Storage Solutions
- **Primary Database**: Neon Database (serverless PostgreSQL) for scalable data persistence
- **ORM**: Drizzle ORM for type-safe database operations and schema management
- **Data Architecture**: Comprehensive schema supporting tracked tokens, historical price snapshots, user watchlists, Live Coin Watch coin data, and price history with multiple timeframes
- **Caching Strategy**: Database-driven caching with Netlify function integration for production independence

## Authentication and Authorization
- **Wallet Integration**: Multi-wallet support with @wagmi/core and @wagmi/connectors
- **Blockchain Networks**: Native Binance Smart Chain integration with BSC transaction monitoring
- **Security**: Secure wallet connection protocols with session management

## Key Architectural Decisions

### Data Authenticity Strategy
- **100% Authentic Data**: All price charts use genuine Live Coin Watch historical data with no synthetic or interpolated prices
- **Complete Token Coverage**: Authentic historical data support for 100+ tokens across all timeframes (1H, 1D, 7D, 30D)
- **Professional Accuracy**: Chart data matches TradingView precision using authentic market data sources

### Production Independence
- **Netlify Functions**: All frontend data operations handled through dedicated Netlify functions (token-coins-data.ts, token-data.ts, token-historical-data.ts)
- **Zero Direct API Calls**: Frontend components exclusively use database cache via Netlify functions with no direct Live Coin Watch API calls
- **Automated Sync**: Hourly background synchronization maintains fresh authentic data across all supported tokens

### Error Handling and Resilience
- **Graceful Degradation**: Robust error handling with database cache fallback when external APIs fail
- **Dynamic Token System**: Database-driven token routing supporting all Live Coin Watch tokens with automatic route generation

# External Dependencies

## Cryptocurrency Data Sources
- **Live Coin Watch API**: Primary source for authentic cryptocurrency market data and historical prices
  - Real-time market data for 100+ tokens with comprehensive database persistence
  - Authentic historical price data across multiple timeframes (1H, 1D, 7D, 30D)
  - Production-ready Netlify function integration for independent operation
  - Automated hourly synchronization for data freshness

## Blockchain Infrastructure
- **Alchemy SDK**: Ethereum and BSC blockchain data and transaction monitoring
- **Moralis API**: Advanced BSC token analytics and holder information
- **PancakeSwap API**: DEX data integration for liquidity and trading analytics

## Development and Deployment
- **Netlify**: Static site hosting and serverless function deployment for production
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Replit**: Development environment with integrated development tools

## UI and Experience
- **Radix UI**: Accessible component primitives for consistent user interface
- **Tailwind CSS**: Utility-first CSS framework with custom crypto design tokens
- **Wagmi**: React hooks for Ethereum and BSC wallet integration
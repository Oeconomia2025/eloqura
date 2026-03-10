# Eloqura DEX

Decentralized exchange and automated market maker for the Oeconomia ecosystem. Swap tokens, provide liquidity, and explore pools — powered by Eloqura V2 AMM with Uniswap V3 quote routing.

![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white)

## 🚀 Features

### 📊 Real-Time Analytics
- **Live Price Tracking** - Real-time OEC token price updates from multiple sources
- **Market Metrics** - Volume, liquidity, market cap, and trading analytics
- **Historical Charts** - Interactive price history with multiple timeframes
- **BSC Integration** - Direct Binance Smart Chain transaction monitoring

### 💰 DeFi Management
- **Portfolio Tracking** - Comprehensive view of all DeFi positions
- **Staking Pools** - Multiple pool options (flexible, 30-day, 90-day, 180-day)
- **ROI Calculator** - Real-time staking rewards calculation
- **Achievement System** - Gamified badges for staking milestones

### 🏛️ Governance Platform
- **Proposal Creation** - Submit governance proposals with detailed specifications
- **Voting System** - Democratic voting on protocol decisions
- **Delegation** - Delegate voting power to trusted representatives
- **Discussion Forums** - Community discussion for each proposal

### 🎓 Gamified Learning
- **Progress Tracking** - XP system with levels and achievements
- **Educational Resources** - Curated learning materials about DeFi and blockchain
- **Achievement Badges** - Unlock rewards for completing educational content
- **Progress Visualization** - Interactive dashboards showing learning progress

### 🔗 Wallet Integration
- **Multi-Wallet Support** - Connect with popular crypto wallets
- **BSC Network** - Native Binance Smart Chain integration
- **Transaction History** - View and filter transaction history
- **Security Features** - Secure wallet connection protocols

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript for type-safe development
- **Tailwind CSS** with custom crypto-themed design system
- **Radix UI** components for accessibility and consistency
- **TanStack Query** for efficient server state management
- **Wouter** for lightweight routing
- **Recharts** for interactive data visualizations

### Backend
- **Node.js** with Express.js server
- **TypeScript** throughout the entire stack
- **Drizzle ORM** for PostgreSQL database interactions
- **Session Management** with PostgreSQL-based storage

### Database & Storage
- **PostgreSQL** with Neon Database (serverless)
- **Persistent Session Storage** for user preferences
- **Historical Data** tracking for analytics and charts

### External Integrations
- **CoinGecko API** - Market data and token information
- **BSCScan API** - Blockchain transactions and network data
- **PancakeSwap API** - DEX trading data and liquidity

## ⚡ Quick Start

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database (or Neon Database account)
- API keys for external services

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/oeconomia-dashboard.git
   cd oeconomia-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL=your_postgresql_connection_string
   BSCSCAN_API_KEY=your_bscscan_api_key
   VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
   ```

4. **Set up the database**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:5000`

## 📁 Project Structure

```
oeconomia-dashboard/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Application pages/routes
│   │   └── lib/           # Utilities and helpers
├── server/                # Express.js backend
│   ├── routes.ts          # API route definitions
│   ├── storage.ts         # Database storage layer
│   └── db.ts             # Database connection
├── shared/                # Shared TypeScript types
│   └── schema.ts          # Database schema and types
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── vite.config.ts
```

## 🔧 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run db:push` - Push database schema changes
- `npm run db:generate` - Generate database migrations

## 🌟 Key Highlights

### Recent Features (2025)
- ✅ **Gamified Learning System** - XP tracking, achievements, and progress visualization
- ✅ **Enhanced Navigation** - Streamlined sidebar with social media integration
- ✅ **Staking DApp** - Multi-pool staking interface with colorful gradients
- ✅ **ROI Calculator** - Interactive calculations with collapsible interface
- ✅ **Achievement Badges** - Gamified system with 6+ badge types
- ✅ **Portfolio Analytics** - Volume & liquidity analytics with historical charts

### User Experience
- **Mobile-First Design** - Responsive across all device sizes
- **Dark Theme** - Modern dark interface optimized for crypto trading
- **Real-Time Updates** - Live data with 15-60 second refresh intervals
- **Accessibility** - Built with Radix UI for screen reader compatibility

## 🔐 Security & Privacy

- **Secure Wallet Connections** - Industry-standard wallet integration
- **Environment Variables** - Sensitive data stored securely
- **Session Management** - PostgreSQL-based session storage
- **API Rate Limiting** - Responsible external API usage

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Website**: [https://oeconomia.tech](https://oeconomia.tech)
- **Twitter**: [@Oeconomia2025](https://x.com/Oeconomia2025)
- **Discord**: [Join Community](https://discord.com/invite/XSgZgeVD)
- **Medium**: [@oeconomia2025](https://medium.com/@oeconomia2025)

## 📞 Support

For support, email admin@oeconomia.io or join our Discord community.

---

**Built with ❤️ for the Oeconomia ecosystem**
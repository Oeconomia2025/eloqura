// Static mode configuration for production deployment
export const IS_STATIC_DEPLOYMENT = !window.location.hostname.includes('replit') && 
                                   (window.location.hostname.includes('netlify') || 
                                    window.location.hostname.includes('oeconomia.io'));

// Mock data for static deployment
export const STATIC_TOKEN_DATA = {
  id: "oeconomia",
  name: "Eloqura",
  symbol: "OEC",
  price: 0.00001234,
  priceChange24h: 5.67,
  marketCap: 123456789,
  volume24h: 1234567,
  liquidity: 567890,
  circulatingSupply: 10000000000,
  maxSupply: 21000000000,
  holders: 1234,
  contractAddress: "0x55d398326f99059fF775485246999027B3197955",
  network: "BSC",
  isVerified: true,
  description: "Decentralized finance ecosystem token"
};

export const STATIC_PRICE_HISTORY = [
  { timestamp: Date.now() - 86400000, price: 0.00001200 },
  { timestamp: Date.now() - 82800000, price: 0.00001210 },
  { timestamp: Date.now() - 79200000, price: 0.00001205 },
  { timestamp: Date.now() - 75600000, price: 0.00001220 },
  { timestamp: Date.now() - 72000000, price: 0.00001234 },
];

export const STATIC_HOLDERS = [
  { address: "0x1234...5678", balance: 1000000, percentage: 10.5 },
  { address: "0x8765...4321", balance: 800000, percentage: 8.2 },
  { address: "0x9876...1234", balance: 600000, percentage: 6.1 },
];

export const STATIC_TRANSACTIONS = [
  {
    hash: "0xabc123...def456",
    type: "buy",
    amount: 10000,
    price: 0.00001234,
    timestamp: Date.now() - 300000,
    from: "0x1111...2222",
    to: "0x3333...4444"
  },
  {
    hash: "0xdef456...ghi789",
    type: "sell", 
    amount: 5000,
    price: 0.00001230,
    timestamp: Date.now() - 600000,
    from: "0x5555...6666",
    to: "0x7777...8888"
  },
];
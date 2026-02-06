import { http, createConfig, createStorage } from 'wagmi'
import { bsc, bscTestnet, sepolia } from 'wagmi/chains'
import { coinbaseWallet, metaMask, walletConnect, injected } from 'wagmi/connectors'

// Extend Window interface for wallet types
declare global {
  interface Window {
    trustWallet?: any
    rabby?: any
    okxwallet?: any
    BinanceChain?: any
    safe?: any
    phantom?: {
      ethereum?: any
    }
  }
}

// WalletConnect project ID - users can get this from https://cloud.walletconnect.com/
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'f0b928a2e4e4b0e9b5e8a2f5e3e4b0e9'

export const config = createConfig({
  chains: [sepolia, bsc, bscTestnet],
  storage: createStorage({
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  }),
  ssr: false,
  connectors: [
    metaMask(),
    walletConnect({ 
      projectId,
      metadata: {
        name: 'Oeconomia Dashboard',
        description: 'Comprehensive cryptocurrency dashboard for OEC token tracking',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://oeconomia.app',
        icons: ['https://github.com/replit.png']
      },
      showQrModal: true,
      qrModalOptions: {
        themeMode: 'dark'
      },
      disableProviderPing: false
    }),
    coinbaseWallet({
      appName: 'Oeconomia Dashboard',
    }),
    injected({
      target: {
        id: 'trust',
        name: 'Trust Wallet',
        provider: (window) => (window as any)?.trustWallet,
      },
    }),
    injected({
      target: {
        id: 'rabby',
        name: 'Rabby Wallet',
        provider: (window) => (window as any)?.rabby,
      },
    }),
    injected({
      target: {
        id: 'okx',
        name: 'OKX Wallet', 
        provider: (window) => (window as any)?.okxwallet,
      },
    }),
    injected({
      target: {
        id: 'binance',
        name: 'Binance Wallet',
        provider: (window) => (window as any)?.BinanceChain,
      },
    }),
    injected({
      target: {
        id: 'phantom',
        name: 'Phantom Wallet',
        provider: (window) => window?.phantom?.ethereum,
      },
    }),
    injected({
      target: {
        id: 'safe',
        name: 'Safe Wallet',
        provider: (window) => (window as any)?.safe,
      },
    }),
    // Generic injected for any other EVM wallets
    injected({
      target: 'metaMask',
    }),
  ],
  transports: {
    [sepolia.id]: http(),
    [bsc.id]: http(),
    [bscTestnet.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
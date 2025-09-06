import { useState } from 'react'
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, LogOut, Copy, ExternalLink } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { WalletIcon } from './wallet-icons'

export function WalletConnect({ collapsed = false }: { collapsed?: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showAllWallets, setShowAllWallets] = useState(false)
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { toast } = useToast()

  const { data: balance } = useBalance({
    address,
  })

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      toast({
        title: "Address copied",
        description: "Wallet address copied to clipboard",
      })
    }
  }

  const openInExplorer = () => {
    if (address && chain) {
      const explorerUrl = chain.blockExplorers?.default?.url
      if (explorerUrl) {
        window.open(`${explorerUrl}/address/${address}`, '_blank')
      }
    }
  }

  // Define preferred wallet order and limit
  const preferredWallets = ['MetaMask', 'WalletConnect', 'Coinbase Wallet', 'Trust Wallet']

  // Helper function to get unique, valid connectors
  const getUniqueValidConnectors = () => {
    const validConnectors = connectors.filter(c => 
      c.name && 
      c.name.trim() !== '' && 
      c.name !== 'undefined'
    )

    // Remove duplicates by name (keep first occurrence)
    return validConnectors.filter((connector, index, arr) => 
      arr.findIndex(c => c.name === connector.name) === index
    )
  }

  const getDisplayedConnectors = () => {
    const uniqueConnectors = getUniqueValidConnectors()

    if (showAllWallets) {
      return uniqueConnectors
    }

    const preferred = uniqueConnectors.filter(c => preferredWallets.includes(c.name))
    const others = uniqueConnectors.filter(c => !preferredWallets.includes(c.name))

    // Show first 6 preferred wallets, fill remaining with others if needed
    return [...preferred, ...others].slice(0, 6)
  }

  const allUniqueConnectors = getUniqueValidConnectors()
  const displayedConnectors = getDisplayedConnectors()
  const hasMoreWallets = displayedConnectors.length < allUniqueConnectors.length

  if (isConnected && address) {
    return (
      <div className="relative group">
        <Button 
          onClick={() => {
            // Clear localStorage wallet data
            if (typeof window !== 'undefined') {
              localStorage.removeItem('wagmi.store')
              localStorage.removeItem('wagmi.wallet')
              localStorage.removeItem('wagmi.connected')
              localStorage.removeItem('wagmi.recentConnectorId')
            }

            disconnect()

            // Force a small delay then reload to ensure clean state
            setTimeout(() => {
              window.location.reload()
            }, 500)

            toast({
              title: "Wallet disconnected",
              description: "Your wallet has been disconnected successfully",
            })
          }}
          className={`${collapsed ? 'w-10 h-10 p-0' : 'w-full'} text-white hover:text-white shadow-lg transition-all duration-200 font-medium border-0`}
          style={{ background: 'linear-gradient(45deg, #00d4ff, #ff00ff)' }}
        >
          <Wallet className="w-4 h-4" />
          {!collapsed && (
            <>
              <span className="ml-2">{formatAddress(address)}</span>
            </>
          )}
        </Button>
        {collapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--crypto-dark)] text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
            {formatAddress(address)}
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <div className="relative group">
          <Button 
            className={`${collapsed ? 'w-10 h-10 p-0' : 'w-full'} text-white hover:text-white shadow-lg transition-all duration-200 font-medium border-0`}
            style={{ background: 'linear-gradient(45deg, #00d4ff, #ff00ff)' }}
          >
            <Wallet className="w-4 h-4" />
            {!collapsed && <span className="ml-2">Connect Wallet</span>}
          </Button>
          {collapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--crypto-dark)] text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              Connect Wallet
            </div>
          )}
        </div>
      </DialogTrigger>
      <DialogContent className="bg-gradient-to-br from-[var(--crypto-card)] to-[var(--crypto-dark)] border-crypto-blue/20 shadow-xl max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-crypto-blue to-purple-400 bg-clip-text text-transparent">
            Connect Your Wallet
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Choose a wallet to connect to the Oeconomia dashboard
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 mt-4">
          {displayedConnectors.map((connector) => (
            <Button
              key={connector.uid}
              variant="outline"
              onClick={() => {
                try {
                  connect({ connector })
                  setIsOpen(false)
                  toast({
                    title: "Connecting wallet",
                    description: "Please check your wallet for connection request",
                  })
                } catch (error: any) {
                  console.log("Wallet connection error:", error?.message)
                  if (!error?.message?.includes("Proposal expired") && !error?.message?.includes("User rejected")) {
                    toast({
                      title: "Connection failed",
                      description: error?.message || "Failed to connect wallet",
                      variant: "destructive",
                    })
                  }
                }
              }}
              disabled={isPending}
              className="flex-col justify-center items-center h-14 w-full border-gray-700 hover:border-crypto-blue/50 hover:bg-crypto-blue/5 transition-all duration-200 group p-1 bg-white/95 hover:bg-white"
            >
              <div className="flex flex-col items-center space-y-1">
                <div className="relative">
                  <WalletIcon wallet={connector.name} className="w-5 h-5" />
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-transparent to-black/10 group-hover:from-white/5 group-hover:to-white/10 transition-all duration-200"></div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-gray-800 group-hover:text-gray-900 text-xs leading-tight">
                    {connector.name === 'WalletConnect' 
                      ? 'WalletConnect'
                      : connector.name
                          .replace(' Wallet', '')
                          .replace('Wallet', '')
                          .trim()}
                  </div>
                </div>
              </div>
            </Button>
          ))}

          {hasMoreWallets && !showAllWallets && (
            <Button
              variant="ghost"
              onClick={() => setShowAllWallets(true)}
              className="col-span-3 w-full text-xs text-gray-400 hover:text-gray-300"
            >
              Other Wallets ({allUniqueConnectors.length - displayedConnectors.length})
            </Button>
          )}
        </div>

        {showAllWallets && (
          <div className="mt-3">
            <Button
              variant="ghost"
              onClick={() => setShowAllWallets(false)}
              className="w-full text-xs text-gray-400 hover:text-gray-300"
            >
              Show Less
            </Button>
          </div>
        )}

        <div className="mt-4 p-3 bg-gradient-to-r from-[var(--crypto-dark)] to-gray-900/50 rounded-xl border border-gray-700/50">
          <p className="text-xs text-gray-400 text-center leading-relaxed">
            🔒 Secure connection to BSC network<br/>
            Supports all major EVM wallets including MetaMask, Trust, Rabby, and more
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
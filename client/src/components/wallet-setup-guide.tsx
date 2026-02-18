import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { HelpCircle, Download, Smartphone, Chrome, Shield, ArrowRight } from "lucide-react"

export function WalletSetupGuide() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline"
          className="w-full mt-3 border-gray-600 hover:border-crypto-blue/50 text-gray-300 hover:text-white transition-all duration-200"
        >
          <HelpCircle className="w-4 h-4 mr-2" />
          Need Help Getting a Wallet?
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gradient-to-br from-[var(--crypto-card)] to-[var(--crypto-dark)] border-crypto-blue/20 shadow-xl max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-sky-400 to-blue-400 bg-clip-text text-transparent">
            How to Get & Connect a Crypto Wallet
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 mt-6">
          {/* What is a Wallet */}
          <div className="p-4 bg-gradient-to-r from-sky-500/10 to-blue-600/10 rounded-xl border border-cyan-500/20">
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-cyan-400" />
              What is a Crypto Wallet?
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              A crypto wallet is like a digital bank account that lets you store, send, and receive cryptocurrency. 
              It's your key to accessing DeFi platforms like this dashboard and managing your digital assets securely.
            </p>
          </div>

          {/* Step 1: Choose a Wallet */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <div className="w-6 h-6 bg-gradient-to-r from-sky-500 to-blue-600 rounded-full flex items-center justify-center text-xs font-bold mr-3">1</div>
              Choose & Download a Wallet
            </h3>
            
            <div className="grid gap-3">
              <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-white">MetaMask (Recommended)</h4>
                    <p className="text-sm text-gray-400 mt-1">Most popular wallet, works on desktop and mobile</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => window.open('https://metamask.io/download/', '_blank')}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Get It
                  </Button>
                </div>
              </div>
              
              <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-white">Trust Wallet</h4>
                    <p className="text-sm text-gray-400 mt-1">Great mobile wallet with built-in DApp browser</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => window.open('https://trustwallet.com/download', '_blank')}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Smartphone className="w-4 h-4 mr-1" />
                    Get It
                  </Button>
                </div>
              </div>
              
              <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-white">Coinbase Wallet</h4>
                    <p className="text-sm text-gray-400 mt-1">Easy to use, good for beginners</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => window.open('https://www.coinbase.com/wallet/downloads', '_blank')}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    <Chrome className="w-4 h-4 mr-1" />
                    Get It
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Set Up Your Wallet */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <div className="w-6 h-6 bg-gradient-to-r from-sky-500 to-blue-600 rounded-full flex items-center justify-center text-xs font-bold mr-3">2</div>
              Set Up Your Wallet
            </h3>
            <div className="space-y-2 ml-9">
              <div className="flex items-center text-sm text-gray-300">
                <ArrowRight className="w-4 h-4 mr-2 text-cyan-400" />
                Install the wallet extension or app
              </div>
              <div className="flex items-center text-sm text-gray-300">
                <ArrowRight className="w-4 h-4 mr-2 text-cyan-400" />
                Create a new wallet (follow the setup wizard)
              </div>
              <div className="flex items-center text-sm text-gray-300">
                <ArrowRight className="w-4 h-4 mr-2 text-cyan-400" />
                Write down your recovery phrase (keep it safe!)
              </div>
              <div className="flex items-center text-sm text-gray-300">
                <ArrowRight className="w-4 h-4 mr-2 text-cyan-400" />
                Set a strong password
              </div>
            </div>
          </div>

          {/* Step 3: Connect */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <div className="w-6 h-6 bg-gradient-to-r from-sky-500 to-blue-600 rounded-full flex items-center justify-center text-xs font-bold mr-3">3</div>
              Connect to Oeconomia
            </h3>
            <div className="space-y-2 ml-9">
              <div className="flex items-center text-sm text-gray-300">
                <ArrowRight className="w-4 h-4 mr-2 text-cyan-400" />
                Click "Connect Wallet" on this page
              </div>
              <div className="flex items-center text-sm text-gray-300">
                <ArrowRight className="w-4 h-4 mr-2 text-cyan-400" />
                Choose your wallet from the list
              </div>
              <div className="flex items-center text-sm text-gray-300">
                <ArrowRight className="w-4 h-4 mr-2 text-cyan-400" />
                Approve the connection in your wallet
              </div>
              <div className="flex items-center text-sm text-gray-300">
                <ArrowRight className="w-4 h-4 mr-2 text-cyan-400" />
                Start using the dashboard!
              </div>
            </div>
          </div>

          {/* Security Note */}
          <div className="p-4 bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-xl border border-red-500/20">
            <h4 className="font-semibold text-white mb-2 flex items-center">
              <Shield className="w-4 h-4 mr-2 text-red-400" />
              Important Security Tips
            </h4>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Never share your recovery phrase with anyone</li>
              <li>• Always double-check website URLs before connecting</li>
              <li>• Only connect to trusted DeFi platforms</li>
              <li>• Keep your wallet software updated</li>
            </ul>
          </div>

          <div className="flex justify-center pt-4">
            <Button 
              onClick={() => setIsOpen(false)}
              className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-medium px-8"
            >
              Got it, let's get started!
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
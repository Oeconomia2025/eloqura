import { useState } from "react";
import { ArrowRightLeft, Clock, Shield, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export function Bridge() {
  const [fromChain, setFromChain] = useState("bsc");
  const [toChain, setToChain] = useState("ethereum");
  const [selectedToken, setSelectedToken] = useState("USDT");
  const [amount, setAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");

  const chains = [
    { id: "bsc", name: "Binance Smart Chain", symbol: "BSC", color: "bg-yellow-500" },
    { id: "ethereum", name: "Ethereum", symbol: "ETH", color: "bg-blue-500" },
    { id: "polygon", name: "Polygon", symbol: "MATIC", color: "bg-purple-500" },
    { id: "avalanche", name: "Avalanche", symbol: "AVAX", color: "bg-red-500" },
    { id: "arbitrum", name: "Arbitrum", symbol: "ARB", color: "bg-cyan-500" },
  ];

  const tokens = [
    { symbol: "USDT", name: "Tether USD", balance: "1,250.00" },
    { symbol: "USDC", name: "USD Coin", balance: "800.50" },
    { symbol: "ETH", name: "Ethereum", balance: "1.2345" },
    { symbol: "BNB", name: "BNB", balance: "5.678" },
  ];

  const selectedTokenData = tokens.find(t => t.symbol === selectedToken);
  const fromChainData = chains.find(c => c.id === fromChain);
  const toChainData = chains.find(c => c.id === toChain);

  const bridgeFee = "0.1%";
  const estimatedTime = "5-15 minutes";
  const networkFee = "$8.50";

  const handleSwapChains = () => {
    const temp = fromChain;
    setFromChain(toChain);
    setToChain(temp);
  };

  return (
    <div className="max-w-md mx-auto">
      <Card className="bg-[var(--crypto-card)] border-crypto-border p-6">
        <div className="flex items-center gap-2 mb-6">
          <ArrowRightLeft className="w-5 h-5 text-crypto-blue" />
          <h3 className="text-lg font-semibold">Cross-Chain Bridge</h3>
        </div>

        <div className="space-y-6">
          {/* From Chain */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400">From Network</label>
            <Select value={fromChain} onValueChange={setFromChain}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chains.map((chain) => (
                  <SelectItem key={chain.id} value={chain.id}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${chain.color}`} />
                      <span>{chain.name}</span>
                      <span className="text-gray-400 text-sm">({chain.symbol})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Swap Chains Button */}
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSwapChains}
              className="rounded-full w-10 h-10 p-0 border border-crypto-border hover:bg-gray-800"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </Button>
          </div>

          {/* To Chain */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400">To Network</label>
            <Select value={toChain} onValueChange={setToChain}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chains.map((chain) => (
                  <SelectItem key={chain.id} value={chain.id}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${chain.color}`} />
                      <span>{chain.name}</span>
                      <span className="text-gray-400 text-sm">({chain.symbol})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Token Selection */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <label>Select Token</label>
              <span>Balance: {selectedTokenData?.balance} {selectedToken}</span>
            </div>
            <Select value={selectedToken} onValueChange={setSelectedToken}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tokens.map((token) => (
                  <SelectItem key={token.symbol} value={token.symbol}>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{token.symbol}</span>
                        <span className="text-gray-400">{token.name}</span>
                      </div>
                      <span className="text-sm text-gray-400">{token.balance}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Amount to Bridge</label>
            <div className="relative">
              <Input
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-16"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                {selectedToken}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-xs">25%</Button>
              <Button variant="ghost" size="sm" className="text-xs">50%</Button>
              <Button variant="ghost" size="sm" className="text-xs">75%</Button>
              <Button variant="ghost" size="sm" className="text-xs">Max</Button>
            </div>
          </div>

          {/* Recipient Address */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Recipient Address</label>
            <Input
              placeholder={`Enter ${toChainData?.name} address`}
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              className="font-mono text-sm"
            />
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <AlertCircle className="w-3 h-3" />
              <span>Make sure this is a valid {toChainData?.name} address</span>
            </div>
          </div>

          {/* Bridge Info */}
          <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <Shield className="w-4 h-4 text-green-500" />
              <span>Bridge Details</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <div className="text-gray-400">From</div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${fromChainData?.color}`} />
                  <span>{fromChainData?.symbol}</span>
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="text-gray-400">To</div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${toChainData?.color}`} />
                  <span>{toChainData?.symbol}</span>
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="text-gray-400">Bridge Fee</div>
                <div>{bridgeFee}</div>
              </div>
              
              <div className="space-y-1">
                <div className="text-gray-400">Network Fee</div>
                <div>{networkFee}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
              <Clock className="w-4 h-4 text-crypto-gold" />
              <span className="text-sm">Estimated time: {estimatedTime}</span>
            </div>
          </div>

          {/* Security Notice */}
          <div className="bg-crypto-gold/10 border border-crypto-gold/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-crypto-gold mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-crypto-gold font-medium">Security Notice</p>
                <p className="text-gray-300 mt-1">
                  Double-check the recipient address. Cross-chain transfers cannot be reversed.
                </p>
              </div>
            </div>
          </div>

          <Button className="w-full bg-crypto-blue hover:bg-crypto-blue/80">
            Bridge {selectedToken}
          </Button>
        </div>
      </Card>
    </div>
  );
}
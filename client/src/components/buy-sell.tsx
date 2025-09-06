import { useState } from "react";
import { CreditCard, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export function BuySell() {
  const [selectedToken, setSelectedToken] = useState("ETH");
  const [amount, setAmount] = useState("");
  const [fiatAmount, setFiatAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");

  const tokens = [
    { symbol: "ETH", name: "Ethereum", price: 3602.42, change: 2.49, balance: "1.2345" },
    { symbol: "BNB", name: "BNB", price: 612.45, change: 1.85, balance: "5.678" },
    { symbol: "USDT", name: "Tether USD", price: 1.00, change: 0.01, balance: "1,250.00" },
    { symbol: "USDC", name: "USD Coin", price: 0.9992, change: -0.02, balance: "800.50" },
  ];

  const selectedTokenData = tokens.find(t => t.symbol === selectedToken);

  const paymentMethods = [
    { id: "card", name: "Credit/Debit Card", icon: CreditCard, fee: "2.5%" },
    { id: "bank", name: "Bank Transfer", icon: Wallet, fee: "0.5%" },
    { id: "crypto", name: "Crypto Wallet", icon: Wallet, fee: "0.1%" },
  ];

  return (
    <div className="max-w-md mx-auto">
      <Card className="bg-[var(--crypto-card)] border-crypto-border p-6">
        <Tabs defaultValue="buy" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy">Buy</TabsTrigger>
            <TabsTrigger value="sell">Sell</TabsTrigger>
          </TabsList>
          
          <TabsContent value="buy" className="space-y-4 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <h3 className="text-lg font-semibold">Buy Crypto</h3>
            </div>

            {/* Token Selection */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Select Token</label>
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
                        <div className="text-right">
                          <div className="text-sm">${token.price.toLocaleString()}</div>
                          <div className={`text-xs ${token.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {token.change >= 0 ? '+' : ''}{token.change}%
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Amount to Buy</label>
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
            </div>

            {/* Fiat Amount */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Pay with USD</label>
              <div className="relative">
                <Input
                  placeholder="0.00"
                  value={fiatAmount}
                  onChange={(e) => setFiatAmount(e.target.value)}
                  className="pl-8"
                />
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  $
                </span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Payment Method</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => {
                    const Icon = method.icon;
                    return (
                      <SelectItem key={method.id} value={method.id}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span>{method.name}</span>
                          <span className="text-gray-400 text-sm">({method.fee})</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Order Summary */}
            <div className="bg-gray-800/50 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Price per {selectedToken}</span>
                <span>${selectedTokenData?.price.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Processing Fee</span>
                <span>{paymentMethods.find(p => p.id === paymentMethod)?.fee}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Network Fee</span>
                <span>~$2.50</span>
              </div>
              <hr className="border-gray-700" />
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>$0.00</span>
              </div>
            </div>

            <Button className="w-full bg-green-600 hover:bg-green-700">
              Buy {selectedToken}
            </Button>
          </TabsContent>

          <TabsContent value="sell" className="space-y-4 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-5 h-5 text-red-500" />
              <h3 className="text-lg font-semibold">Sell Crypto</h3>
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
                        <div className="text-right">
                          <div className="text-sm">${token.price.toLocaleString()}</div>
                          <div className={`text-xs ${token.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {token.change >= 0 ? '+' : ''}{token.change}%
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Amount to Sell</label>
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

            {/* Receive Amount */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">You'll Receive</label>
              <div className="relative">
                <Input
                  placeholder="0.00"
                  value={fiatAmount}
                  onChange={(e) => setFiatAmount(e.target.value)}
                  className="pl-8"
                  disabled
                />
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  $
                </span>
              </div>
            </div>

            {/* Withdrawal Method */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Withdrawal Method</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => {
                    const Icon = method.icon;
                    return (
                      <SelectItem key={method.id} value={method.id}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span>{method.name}</span>
                          <span className="text-gray-400 text-sm">({method.fee})</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Order Summary */}
            <div className="bg-gray-800/50 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Price per {selectedToken}</span>
                <span>${selectedTokenData?.price.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Processing Fee</span>
                <span>{paymentMethods.find(p => p.id === paymentMethod)?.fee}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Network Fee</span>
                <span>~$2.50</span>
              </div>
              <hr className="border-gray-700" />
              <div className="flex justify-between font-medium">
                <span>Net Amount</span>
                <span>$0.00</span>
              </div>
            </div>

            <Button className="w-full bg-red-600 hover:bg-red-700">
              Sell {selectedToken}
            </Button>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
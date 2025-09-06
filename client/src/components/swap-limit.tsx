import { useState } from "react";
import { ArrowDownUp, Settings } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export function SwapLimit() {
  const [fromToken, setFromToken] = useState("ETH");
  const [toToken, setToToken] = useState("USDT");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [slippage, setSlippage] = useState("0.5");

  const tokens = [
    { symbol: "ETH", name: "Ethereum", balance: "1.2345" },
    { symbol: "USDT", name: "Tether USD", balance: "1,250.00" },
    { symbol: "BNB", name: "BNB", balance: "5.678" },
    { symbol: "USDC", name: "USD Coin", balance: "800.50" },
  ];

  const handleSwapTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  return (
    <div className="max-w-md mx-auto">
      <Card className="bg-[var(--crypto-card)] border-crypto-border p-6">
        <Tabs defaultValue="swap" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="swap">Swap</TabsTrigger>
            <TabsTrigger value="limit">Limit Order</TabsTrigger>
          </TabsList>
          
          <TabsContent value="swap" className="space-y-4 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Swap Tokens</h3>
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </div>

            {/* From Token */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>From</span>
                <span>Balance: {tokens.find(t => t.symbol === fromToken)?.balance}</span>
              </div>
              <div className="flex gap-2">
                <Select value={fromToken} onValueChange={setFromToken}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tokens.map((token) => (
                      <SelectItem key={token.symbol} value={token.symbol}>
                        {token.symbol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="0.0"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSwapTokens}
                className="rounded-full w-10 h-10 p-0 border border-crypto-border hover:bg-gray-800"
              >
                <ArrowDownUp className="w-4 h-4" />
              </Button>
            </div>

            {/* To Token */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>To</span>
                <span>Balance: {tokens.find(t => t.symbol === toToken)?.balance}</span>
              </div>
              <div className="flex gap-2">
                <Select value={toToken} onValueChange={setToToken}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tokens.map((token) => (
                      <SelectItem key={token.symbol} value={token.symbol}>
                        {token.symbol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="0.0"
                  value={toAmount}
                  onChange={(e) => setToAmount(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Trade Info */}
            <div className="bg-gray-800/50 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Rate</span>
                <span>1 {fromToken} = 2,456.78 {toToken}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Slippage Tolerance</span>
                <span>{slippage}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Network Fee</span>
                <span>~$2.50</span>
              </div>
            </div>

            <Button className="w-full bg-crypto-blue hover:bg-crypto-blue/80">
              Swap Tokens
            </Button>
          </TabsContent>

          <TabsContent value="limit" className="space-y-4 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Limit Order</h3>
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </div>

            {/* From Token */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Sell</span>
                <span>Balance: {tokens.find(t => t.symbol === fromToken)?.balance}</span>
              </div>
              <div className="flex gap-2">
                <Select value={fromToken} onValueChange={setFromToken}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tokens.map((token) => (
                      <SelectItem key={token.symbol} value={token.symbol}>
                        {token.symbol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="0.0"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Limit Price */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Limit Price</span>
                <span>Current: 2,456.78 {toToken}</span>
              </div>
              <div className="flex gap-2">
                <span className="flex items-center px-3 py-2 bg-gray-800 rounded-md text-sm">
                  {toToken}
                </span>
                <Input
                  placeholder="0.0"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Buy Token */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Buy</span>
                <span>Balance: {tokens.find(t => t.symbol === toToken)?.balance}</span>
              </div>
              <div className="flex gap-2">
                <Select value={toToken} onValueChange={setToToken}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tokens.map((token) => (
                      <SelectItem key={token.symbol} value={token.symbol}>
                        {token.symbol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="0.0"
                  value={toAmount}
                  onChange={(e) => setToAmount(e.target.value)}
                  className="flex-1"
                  disabled
                />
              </div>
            </div>

            {/* Order Info */}
            <div className="bg-gray-800/50 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Order Type</span>
                <span>Limit Order</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Expiry</span>
                <span>30 days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Network Fee</span>
                <span>~$2.50</span>
              </div>
            </div>

            <Button className="w-full bg-crypto-gold hover:bg-crypto-gold/80 text-black">
              Place Limit Order
            </Button>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
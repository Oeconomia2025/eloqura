import { useCallback, useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Clock, Shield, AlertTriangle, ExternalLink } from "lucide-react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { readContract } from "wagmi/actions";
import { formatUnits } from "viem";
import { config } from "@/lib/wagmi";
import { bridgeAbi, erc20Abi } from "@/lib/bridge-abi";
import {
  ChainKey,
  chainByKey,
  isBridgeDeployed,
  tokensForRoute,
} from "@/lib/bridge-config";
import {
  PendingTransfer,
  loadTransfers,
  parseAmount,
  saveTransfers,
  transferFromReceipt,
  upsertTransfer,
} from "@/lib/bridge-core";

type FlowState = "idle" | "approving" | "bridging" | "confirming";

function formatAmount(raw: string, decimals: number): string {
  const n = Number(formatUnits(BigInt(raw), decimals));
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function BridgeContent() {
  const [fromKey, setFromKey] = useState<ChainKey>("sepolia");
  const toKey: ChainKey = fromKey === "sepolia" ? "bscTestnet" : "sepolia";
  const from = chainByKey(fromKey);
  const to = chainByKey(toKey);

  const routeTokens = useMemo(() => tokensForRoute(fromKey, toKey), [fromKey, toKey]);
  const [tokenSymbol, setTokenSymbol] = useState<string>(routeTokens[0]?.symbol ?? "");
  const token = routeTokens.find((t) => t.symbol === tokenSymbol) ?? routeTokens[0];
  useEffect(() => {
    if (token && tokenSymbol !== token.symbol) setTokenSymbol(token.symbol);
  }, [token, tokenSymbol]);

  const [amount, setAmount] = useState("");
  const [flow, setFlow] = useState<FlowState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<PendingTransfer[]>(() => loadTransfers());

  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: from.chainId });

  const deployed = isBridgeDeployed(from) && isBridgeDeployed(to) && !!token;
  const srcToken = token?.deployments[fromKey];

  const { data: balance } = useReadContract({
    chainId: from.chainId,
    address: srcToken?.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!srcToken && deployed, refetchInterval: 15000 },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    chainId: from.chainId,
    address: srcToken?.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, from.bridge] : undefined,
    query: { enabled: !!address && !!srcToken && deployed },
  });

  const parsedAmount = useMemo(() => {
    if (!token || !amount) return null;
    try {
      const v = parseAmount(amount, token.decimals);
      return v > 0n ? v : null;
    } catch {
      return null;
    }
  }, [amount, token]);

  const needsApproval =
    parsedAmount !== null && allowance !== undefined && (allowance as bigint) < parsedAmount;
  const insufficient =
    parsedAmount !== null && balance !== undefined && (balance as bigint) < parsedAmount;

  // Poll the destination bridge until pending transfers are processed.
  useEffect(() => {
    const pending = transfers.filter((t) => t.status === "pending");
    if (pending.length === 0) return;
    const timer = setInterval(async () => {
      let changed = false;
      const updated = await Promise.all(
        transfers.map(async (t) => {
          if (t.status !== "pending") return t;
          const dest = chainByKey(t.destChain);
          if (!isBridgeDeployed(dest)) return t;
          try {
            const done = await readContract(config, {
              chainId: dest.chainId,
              address: dest.bridge,
              abi: bridgeAbi,
              functionName: "processedMessages",
              args: [t.digest],
            });
            if (done) {
              changed = true;
              return { ...t, status: "complete" as const };
            }
          } catch {
            /* transient RPC failure - retry next tick */
          }
          return t;
        })
      );
      if (changed) {
        saveTransfers(updated);
        setTransfers(loadTransfers());
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [transfers]);

  const flip = () => {
    setFromKey(toKey);
    setAmount("");
    setError(null);
  };

  const setPercent = (pct: number) => {
    if (balance !== undefined && token) {
      const value = ((balance as bigint) * BigInt(pct)) / 100n;
      setAmount(formatUnits(value, token.decimals));
    }
  };

  const handleBridge = useCallback(async () => {
    setError(null);
    if (!deployed || !token || !srcToken || !parsedAmount || !address || !publicClient) return;

    try {
      if (chainId !== from.chainId) {
        await switchChainAsync({ chainId: from.chainId });
      }

      if (needsApproval) {
        setFlow("approving");
        const approveHash = await writeContractAsync({
          chainId: from.chainId,
          address: srcToken.address,
          abi: erc20Abi,
          functionName: "approve",
          args: [from.bridge, parsedAmount],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        await refetchAllowance();
        setFlow("idle");
        return;
      }

      setFlow("bridging");
      const fn = srcToken.kind === "native" ? "lockTokens" : "burnWrapped";
      const hash = await writeContractAsync({
        chainId: from.chainId,
        address: from.bridge,
        abi: bridgeAbi,
        functionName: fn,
        args: [srcToken.address, parsedAmount, BigInt(to.chainId), address],
      });

      setFlow("confirming");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const transfer = transferFromReceipt(receipt, fromKey, toKey, token);
      if (transfer) setTransfers(upsertTransfer(transfer));
      setAmount("");
      setFlow("idle");
    } catch (err) {
      setFlow("idle");
      const message = err instanceof Error ? err.message : String(err);
      setError(message.split("\n")[0].slice(0, 160));
    }
  }, [
    deployed, token, srcToken, parsedAmount, address, publicClient, chainId,
    from, to, fromKey, toKey, needsApproval, switchChainAsync, writeContractAsync,
    refetchAllowance,
  ]);

  const buttonLabel = !isConnected
    ? "Connect Wallet First"
    : !deployed
      ? "Awaiting Testnet Deployment"
      : !parsedAmount
        ? "Enter Amount"
        : insufficient
          ? "Insufficient Balance"
          : chainId !== from.chainId
            ? `Switch to ${from.name}`
            : flow === "approving"
              ? "Approving..."
              : flow === "bridging"
                ? "Confirm in Wallet..."
                : flow === "confirming"
                  ? "Waiting for Confirmation..."
                  : needsApproval
                    ? `Approve ${token?.symbol}`
                    : `Bridge to ${to.name}`;

  const buttonDisabled =
    !isConnected || !deployed || !parsedAmount || insufficient || flow !== "idle";

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Testnet banner */}
        <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-center">
          <span className="text-lg font-semibold text-yellow-400">Testnet</span>
          <p className="text-sm text-gray-400 mt-1">
            The Oeconomia bridge runs on Sepolia and BSC Testnet. Contracts are pre-audit; do not
            bridge assets with real value.
          </p>
        </div>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Main bridge interface */}
          <div className="lg:col-span-2">
            <Card className="crypto-card border h-full">
              <CardHeader className="pb-0" />
              <CardContent className="space-y-0 relative">
                {/* From */}
                <div className="bg-gradient-to-b from-[#121315] to-black rounded-lg p-4 border border-[var(--crypto-border)]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-400 text-sm">From</span>
                    <div className="flex space-x-2">
                      {[25, 50, 75, 100].map((percentage) => (
                        <Button
                          key={percentage}
                          variant="outline"
                          size="sm"
                          onClick={() => setPercent(percentage)}
                          disabled={!deployed || balance === undefined}
                          className="text-crypto-blue border-crypto-blue hover:bg-crypto-blue hover:text-white"
                        >
                          {percentage === 100 ? "Max" : `${percentage}%`}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-40 flex items-center space-x-2 bg-[var(--crypto-card)] border border-[var(--crypto-border)] rounded-md px-3 py-2">
                      <img src={from.logo} alt={from.name} className="w-6 h-6 rounded-full" />
                      <span className="text-white">{from.name}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.0"
                      className="flex-1 bg-transparent border-none font-bold text-white placeholder-gray-500 p-0 m-0 h-12 focus-visible:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                      style={{ fontSize: "2.25rem", lineHeight: "1", fontWeight: "bold" }}
                    />
                    <div className="bg-[var(--crypto-card)] border border-[var(--crypto-border)] rounded-md px-3 py-2">
                      {token ? (
                        <div className="flex items-center space-x-2">
                          <img src={token.logo} alt={token.symbol} className="w-6 h-6 rounded-full" />
                          <span className="text-white">{token.symbol}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">No tokens</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right text-gray-400 text-sm mt-2">
                    Balance:{" "}
                    {balance !== undefined && token
                      ? formatAmount((balance as bigint).toString(), token.decimals)
                      : "0"}{" "}
                    {token?.symbol ?? ""}
                  </div>
                </div>

                {/* Direction flip */}
                <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-6 z-30">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={flip}
                    className="bg-gradient-to-b from-[#121315] to-black border-2 border-[var(--crypto-border)] rounded-full w-12 h-12 p-0 hover:bg-[var(--crypto-card)]/80 shadow-xl"
                    title="Swap direction"
                  >
                    <div className="transform rotate-90">
                      <ArrowUpDown className="w-5 h-5 text-gray-400" />
                    </div>
                  </Button>
                </div>

                {/* To */}
                <div className="bg-gradient-to-b from-[#121315] to-black rounded-lg p-4 border border-[var(--crypto-border)]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-400 text-sm">To</span>
                    <span className="text-gray-400 text-sm">~{to.estimatedMinutes} min</span>
                  </div>

                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-40 flex items-center space-x-2 bg-[var(--crypto-card)] border border-[var(--crypto-border)] rounded-md px-3 py-2">
                      <img src={to.logo} alt={to.name} className="w-6 h-6 rounded-full" />
                      <span className="text-white">{to.name}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-4xl font-bold text-gray-400">{amount || "0.0"}</span>
                    <span className="text-sm text-gray-500">
                      {token
                        ? srcToken?.kind === "native"
                          ? `w${token.symbol} (wrapped)`
                          : token.symbol
                        : ""}
                    </span>
                  </div>
                </div>

                {/* Transfer details */}
                <div className="mt-4 bg-[var(--crypto-card)] rounded-lg p-4 border border-[var(--crypto-border)] space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Transfer type</span>
                    <span className="text-white">
                      {srcToken?.kind === "native" ? "Lock and mint" : "Burn and release"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Bridge fee</span>
                    <span className="text-white">None (gas only)</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Finality</span>
                    <span className="text-white">
                      Validator quorum after {from.name} confirmations
                    </span>
                  </div>
                  <div className="text-xs text-yellow-400 mt-2 flex items-center">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Tokens arrive at your own address on {to.name}.
                  </div>
                </div>

                {error && (
                  <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400 break-words">
                    {error}
                  </div>
                )}

                {/* Bridge button */}
                <div className="mt-4">
                  <Button
                    onClick={handleBridge}
                    disabled={buttonDisabled}
                    className="w-full bg-[#5c69c2] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-6 text-lg"
                  >
                    {flow !== "idle" ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>{buttonLabel}</span>
                      </div>
                    ) : (
                      buttonLabel
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Your transfers */}
            <Card className="crypto-card border">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <div className="w-5 h-5 bg-[#5c69c2] rounded-full flex items-center justify-center">
                    <ArrowUpDown className="w-3 h-3 text-white transform rotate-90" />
                  </div>
                  <span>Your Transfers</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {transfers.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2">
                      <ArrowUpDown className="w-6 h-6 text-gray-400 transform rotate-90" />
                    </div>
                    <p className="text-gray-400 text-sm">No transfers yet</p>
                  </div>
                ) : (
                  transfers.slice(0, 6).map((t) => {
                    const tk = tokensForRoute(t.sourceChain, t.destChain).find(
                      (x) => x.symbol === t.tokenSymbol
                    );
                    const src = chainByKey(t.sourceChain);
                    const dest = chainByKey(t.destChain);
                    return (
                      <div
                        key={t.digest}
                        className={`bg-gradient-to-b from-[#121315] to-black rounded-lg p-3 border ${
                          t.status === "complete" ? "border-green-500/30" : "border-[#5c69c2]/30"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <img src={src.logo} alt={src.name} className="w-6 h-6 rounded-full" />
                            <span className="text-sm font-medium text-white">
                              {src.name} → {dest.name}
                            </span>
                          </div>
                          {t.status === "complete" ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                              Complete
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                              Pending
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Amount:</span>
                            <span className="text-white">
                              {tk ? formatAmount(t.amount, tk.decimals) : t.amount} {t.tokenSymbol}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400">Source tx:</span>
                            <a
                              href={`${src.explorer}/tx/${t.sourceTxHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-crypto-blue hover:underline flex items-center"
                            >
                              view <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          </div>
                        </div>
                        {t.status === "pending" && (
                          <div className="mt-2 bg-gray-700 rounded-full h-1.5">
                            <div className="bg-[#5c69c2] h-1.5 rounded-full w-3/4 animate-pulse" />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* How it works */}
            <Card className="crypto-card border">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Clock className="w-5 h-5" />
                  <span>How It Works</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-gray-300">
                  <p>1. Your tokens are locked in the bridge contract on the source chain.</p>
                  <p>
                    2. Independent validators confirm the deposit after chain finality and sign the
                    transfer.
                  </p>
                  <p>
                    3. A relayer submits the validator signatures on the destination chain, which
                    mints wrapped tokens to your address.
                  </p>
                  <p>Bridging back burns the wrapped tokens and releases your originals.</p>
                </div>
              </CardContent>
            </Card>

            {/* Security */}
            <Card className="crypto-card border">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Security</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    "Validator majority quorum on every transfer",
                    "Replay protection and strict message validation",
                    "Per-token outflow rate limits",
                    "Multi-party emergency pause with auto-monitoring",
                    "Timelocked configuration changes",
                  ].map((item) => (
                    <div key={item} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0" />
                      <span className="text-sm text-gray-300">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Bridge() {
  return (
    <Layout>
      <BridgeContent />
    </Layout>
  );
}

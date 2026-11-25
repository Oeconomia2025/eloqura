import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  BookOpen, Wallet, ArrowUpDown, Clock, Droplets, Percent, TrendingDown, BarChart3,
  Coins, LayoutDashboard, ArrowLeftRight, DollarSign, Shield, Search,
} from "lucide-react";

interface Topic {
  id: string;
  title: string;
  icon: typeof BookOpen;
  summary: string;
  keywords: string;
  body: ReactNode;
  action?: { label: string; path: string };
}

const P = ({ children }: { children: ReactNode }) => <p className="text-gray-300 leading-relaxed">{children}</p>;
const H = ({ children }: { children: ReactNode }) => <h4 className="text-white font-semibold pt-2">{children}</h4>;
const UL = ({ items }: { items: ReactNode[] }) => (
  <ul className="list-disc pl-5 space-y-1.5 text-gray-300">{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
);
const Note = ({ children }: { children: ReactNode }) => (
  <div className="rounded-lg border border-[#5c69c2]/40 bg-[#5c69c2]/10 px-4 py-3 text-sm text-gray-200">{children}</div>
);
const B = ({ children }: { children: ReactNode }) => <strong className="text-white">{children}</strong>;

const TOPICS: Topic[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Wallet,
    summary: "Connect a wallet and get test tokens",
    keywords: "wallet metamask connect sepolia testnet faucet eth oec start",
    action: { label: "Open Trade", path: "/swap" },
    body: (
      <>
        <Note>Eloqura runs on the <B>Sepolia testnet</B>. Testnet tokens have no real-world value, so this is a safe place to learn.</Note>
        <H>1. Connect a wallet</H>
        <P>Click <B>Connect Wallet</B> in the sidebar and choose your wallet (MetaMask, WalletConnect and others). Make sure it's set to the Sepolia network; Eloqura will ask to switch if it isn't.</P>
        <H>2. Get Sepolia ETH</H>
        <P>You need a little Sepolia ETH to pay gas (transaction fees). Get it free from any public Sepolia faucet.</P>
        <H>3. Get test tokens</H>
        <P>Claim test OEC from the OEC Faucet on the Oeconomia staking site, or swap some Sepolia ETH for tokens on the Trade page.</P>
        <H>4. Try it out</H>
        <UL items={[
          <>Make a swap on <B>Trade</B>.</>,
          <>Add liquidity to a pool under <B>Pools → Create Position</B>.</>,
          <>Look up pool and token stats under <B>Pools → Examine</B> and <B>OEC Tokens</B>.</>,
        ]} />
      </>
    ),
  },
  {
    id: "swapping",
    title: "Swapping Tokens",
    icon: ArrowUpDown,
    summary: "How trades are priced and what the numbers mean",
    keywords: "swap trade exchange slippage price impact minimum received route approve gas custom token import",
    action: { label: "Open Trade", path: "/swap" },
    body: (
      <>
        <P>The <B>Trade</B> tab swaps one token for another in a single transaction. Eloqura looks for the best price automatically:</P>
        <UL items={[
          <><B>Eloqura pools</B> first, the best source for OEC, ALUD and other Oeconomia tokens.</>,
          <><B>Uniswap V3</B> on Sepolia, checking all of its fee tiers.</>,
          <><B>Multi-hop</B> routes (for example token → WETH → USDC) when no direct pool exists.</>,
        ]} />
        <H>Reading a quote</H>
        <UL items={[
          <><B>Price impact</B>: how much your trade moves the pool's price. Big trades in small pools have high impact and get a worse rate.</>,
          <><B>Slippage tolerance</B>: how far the price may move between quoting and executing before the trade cancels itself (default 0.5%).</>,
          <><B>Minimum received</B>: the least you'll get once slippage is applied. If the market moves past that, the swap fails and you keep your tokens, minus gas.</>,
        ]} />
        <H>Approvals</H>
        <P>The first time you trade a token, your wallet asks you to <B>approve</B> it. That lets the Eloqura router move that token for you. It's a one-time step per token.</P>
        <H>Custom tokens</H>
        <P>Paste any token contract address into the token selector to import it. Imported tokens are marked <B>unverified</B>: anyone can create a token, so double-check the address before trading.</P>
      </>
    ),
  },
  {
    id: "limit-orders",
    title: "Limit Orders",
    icon: Clock,
    summary: "Trade automatically at a price you choose",
    keywords: "limit order trigger price expiry cancel claim expired executor",
    action: { label: "Open Trade", path: "/swap" },
    body: (
      <>
        <P>Under <B>Trade → Limit</B>, set the price you want and how long the order lasts (1 day, 1 week, 1 month or 1 year).</P>
        <UL items={[
          <>When you place the order, your tokens move into the <B>Eloqura Limit Orders</B> contract, which holds them until the order fills, is cancelled or expires.</>,
          <>Once the market reaches your price, anyone can trigger the order. Whoever triggers it earns a small <B>0.1%</B> fee from the order, which is what keeps orders filling without a central operator.</>,
          <>You can <B>cancel</B> an open order at any time and get your tokens back.</>,
          <>If an order <B>expires</B> unfilled, you can claim your tokens back.</>,
        ]} />
      </>
    ),
  },
  {
    id: "liquidity-pools",
    title: "About Liquidity Pools",
    icon: Droplets,
    summary: "How AMMs work and how you earn fees",
    keywords: "amm automated market maker liquidity pool lp token add remove provide create position share x*y=k",
    action: { label: "Create a Position", path: "/liquidity?view=create" },
    body: (
      <>
        <P>Eloqura is an <B>automated market maker (AMM)</B>. Instead of an order book, each pool holds two tokens, and the price comes from the ratio between them.</P>
        <H>How pricing works</H>
        <P>A pool keeps <B>reserve A × reserve B</B> constant. When someone buys token A, they add B and take out A, so A becomes scarcer in the pool and its price rises. Bigger pools move less per trade, which means better prices for traders.</P>
        <H>Providing liquidity</H>
        <UL items={[
          <>Deposit both tokens at the pool's current ratio. Enter one amount and Eloqura fills in the other.</>,
          <>You receive <B>LP tokens</B>, a receipt for your share of the pool.</>,
          <>Every swap pays a fee that stays in the pool, so your share grows as people trade. Fees are paid out automatically when you withdraw.</>,
          <>Withdraw anytime under <B>My Positions</B> to get both tokens back, plus your fees.</>,
        ]} />
        <H>Creating a new pool</H>
        <P>If a pair doesn't exist yet, your first deposit creates it, and your deposit ratio sets its starting price. Make sure that ratio matches the real market price, or arbitrage traders will profit at your expense.</P>
        <Note>Clicking any pool under <B>Examine</B> opens Create Position with both tokens selected and shows the pool's performance charts.</Note>
      </>
    ),
  },
  {
    id: "fee-tiers",
    title: "Fee Tier Guide",
    icon: Percent,
    summary: "What swap fees are and how much LPs earn",
    keywords: "fee tier swap fee 0.30% 0.3 earn lp fees stable exotic",
    body: (
      <>
        <P>Every swap pays a fee to the pool's liquidity providers, split by share of the pool.</P>
        <H>Eloqura's fee</H>
        <P>Each Eloqura pool has one swap fee, set in the pool contract. Pools currently charge <B>0.30%</B> per swap. You can see each pool's fee in the <B>Fee</B> column under Examine.</P>
        <H>How fee levels compare across DEXs</H>
        <UL items={[
          <><B>Low (0.01% to 0.05%)</B>: stablecoin pairs that barely move, like USDC/ALUD. Thin margins, high volume.</>,
          <><B>Standard (0.25% to 0.30%)</B>: most pairs. A balance between attracting trades and paying LPs.</>,
          <><B>High (0.5% to 1%)</B>: volatile or rarely traded pairs, where LPs take more price risk.</>,
        ]} />
        <H>What you earn</H>
        <P>Your fee income depends on trading <B>volume</B> relative to pool size. The <B>Fee APR</B> on Examine and in each pool's performance card shows what the pool actually earned recently, annualized. Past fees don't guarantee future ones.</P>
      </>
    ),
  },
  {
    id: "impermanent-loss",
    title: "Impermanent Loss",
    icon: TrendingDown,
    summary: "The main risk of providing liquidity",
    keywords: "impermanent loss il risk divergence price change hodl",
    body: (
      <>
        <P>When the prices of a pool's two tokens move apart, the pool rebalances. It ends up holding more of the token that fell and less of the one that rose. Compared with simply holding both tokens, your position is worth less. That gap is <B>impermanent loss</B>.</P>
        <H>How big it gets</H>
        <div className="overflow-x-auto">
          <table className="text-sm text-gray-300 min-w-[320px]">
            <thead><tr className="text-gray-400 text-left"><th className="pr-8 py-1 font-medium">One token's price changes by</th><th className="py-1 font-medium">Loss vs. holding</th></tr></thead>
            <tbody className="font-mono">
              {[["1.25×", "0.6%"], ["1.5×", "2.0%"], ["2×", "5.7%"], ["3×", "13.4%"], ["5×", "25.5%"]].map(([r, l]) => (
                <tr key={r} className="border-t border-white/5"><td className="pr-8 py-1">{r}</td><td className="py-1">{l}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>The same applies when a price falls by the matching amount; for example, halving is the same as 2×.</P>
        <H>Why "impermanent"</H>
        <P>If prices return to where they were when you deposited, the loss disappears. It only becomes permanent if you withdraw while prices are apart.</P>
        <H>Reducing the risk</H>
        <UL items={[
          <>Pairs that move together, like two stablecoins, have little impermanent loss.</>,
          <>Fees earned over time can outweigh it. Compare a pool's Fee APR with how volatile the pair is.</>,
        ]} />
      </>
    ),
  },
  {
    id: "pool-stats",
    title: "Reading Pool Stats",
    icon: BarChart3,
    summary: "TVL, volume, APR and the performance charts",
    keywords: "examine tvl volume apr fee apr 24h 7d charts pool performance liquidity price stats",
    action: { label: "Open Examine", path: "/liquidity?view=pools" },
    body: (
      <>
        <P>All pool stats are read directly from the pool contracts on Sepolia. There's no separate database that could drift out of date.</P>
        <UL items={[
          <><B>TVL</B> (total value locked): the dollar value of both tokens in the pool.</>,
          <><B>Volume</B>: how much was swapped. Eloqura pools record every fee they collect, so volume is worked out exactly from fees ÷ fee rate.</>,
          <><B>Fee APR</B>: fees the pool earned over the last 7 days, compared with its size and annualized. It covers trading fees only.</>,
          <><B>24H %</B>: how much the pool's price moved in the last day.</>,
        ]} />
        <H>Pool Performance charts</H>
        <P>Open any pool to see its liquidity, volume, fee APR and price over 7, 30 or 90 days. Collapse the card with the arrow if you just want the deposit form.</P>
        <Note>Dollar values use <B>today's</B> token prices, so a chart of liquidity shows how the token amounts changed, valued at current prices.</Note>
      </>
    ),
  },
  {
    id: "oec-tokens",
    title: "OEC Tokens",
    icon: Coins,
    summary: "OEC, ALUR, ALUD and ELOQ: holders and charts",
    keywords: "oec alur alud eloq oeconomia tokens holders distribution market cap supply",
    action: { label: "Open OEC Tokens", path: "/liquidity?view=oec" },
    body: (
      <>
        <P>The <B>OEC Tokens</B> tab lists Oeconomia's own tokens with live on-chain data. Click a token to open its details:</P>
        <UL items={[
          <><B>Price and market cap</B>, priced from Eloqura pools.</>,
          <><B>Holders</B>: every wallet currently holding the token. New wallets appear within about 2 minutes of receiving tokens.</>,
          <><B>Holder distribution</B>: how much of the supply the top 10 holders own. Addresses tagged <B>Contract</B> are pools or protocol contracts, not people.</>,
          <><B>Pools trading the token</B>: click one to add liquidity.</>,
        ]} />
      </>
    ),
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    summary: "Your balances, portfolio value and recent activity",
    keywords: "dashboard portfolio balance wallet transactions history",
    action: { label: "Open Dashboard", path: "/dashboard" },
    body: (
      <>
        <P>The Dashboard shows the connected wallet's token balances with dollar values, total portfolio value, price charts and recent transactions, plus shortcuts to Trade, Pools and Bridge.</P>
      </>
    ),
  },
  {
    id: "bridge",
    title: "Bridge",
    icon: ArrowLeftRight,
    summary: "Move tokens between Sepolia and BSC Testnet",
    keywords: "bridge cross chain bsc testnet sepolia wrapped lock mint burn validators",
    action: { label: "Open Bridge", path: "/bridge" },
    body: (
      <>
        <P>The Bridge moves tokens between <B>Sepolia</B> and <B>BSC Testnet</B>:</P>
        <UL items={[
          <>Your tokens are <B>locked</B> in the bridge contract on the source chain.</>,
          <>Independent validators confirm the deposit and sign the transfer.</>,
          <>A relayer submits those signatures on the other chain, which <B>mints wrapped tokens</B> to your address.</>,
          <>Bridging back <B>burns</B> the wrapped tokens and releases your originals.</>,
        ]} />
        <P>Protections include a validator majority on every transfer, replay protection, per-token rate limits, an emergency pause and timelocked settings changes. You'll need a little gas on both networks.</P>
      </>
    ),
  },
  {
    id: "buy-sell",
    title: "Buy / Sell",
    icon: DollarSign,
    summary: "Fiat on-ramp (coming soon)",
    keywords: "buy sell fiat on-ramp off-ramp card bank",
    body: <P>Buying and selling crypto with regular money (a fiat on-ramp and off-ramp) is in development and not available yet.</P>,
  },
  {
    id: "safety",
    title: "Staying Safe",
    icon: Shield,
    summary: "Protect your wallet and avoid scams",
    keywords: "safety security seed phrase private key scam phishing verify address approvals",
    body: (
      <UL items={[
        <><B>Never share your seed phrase or private key.</B> Eloqura and the Oeconomia team will never ask for them or DM you first.</>,
        <>Check token addresses against official Oeconomia sources before trading. Anyone can create a token with any name.</>,
        <>Read what your wallet asks you to sign. Only approve transactions you started.</>,
        <>Start with small amounts while you learn, and use the testnet to practice.</>,
      ]} />
    ),
  },
];

const COLS = "grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)] 2xl:grid-cols-[200px_minmax(0,1fr)_200px] gap-6 xl:gap-8";
const CONTENT = "w-full min-w-0 max-w-[1100px] mx-auto";

export default function Learn() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");

  // Jump to a topic from a link like /learn#impermanent-loss
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    return () => clearTimeout(t);
  }, []);

  const term = query.trim().toLowerCase();
  const topics = useMemo(
    () => TOPICS.filter((t) => !term || `${t.title} ${t.summary} ${t.keywords}`.toLowerCase().includes(term)),
    [term]
  );

  const goTo = (id: string) => {
    history.replaceState(null, "", `/learn#${id}`);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Layout>
      <div className="p-4 pt-16 sm:p-6 sm:pt-16 lg:p-8">
        {/* Topic index sits at the far left; the content column is centered in the page.
            On very wide screens an empty right column mirrors the index so the cards stay centered. */}
        <div className="space-y-6">
          <div className={COLS}>
            <div className="hidden lg:block" />
            <div className={CONTENT}>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                    <BookOpen className="w-7 h-7 text-[#5c69c2]" /> Learn
                  </h1>
                  <p className="text-gray-400 mt-1">How Eloqura works, from your first swap to providing liquidity.</p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search topics..."
                    className="pl-10 bg-[#1a1b23] border-[var(--crypto-border)] text-white" />
                </div>
              </div>
            </div>
          </div>

          <div className={COLS}>
            {/* Topic index: chips on phones, sticky list on desktop */}
            <nav className="lg:sticky lg:top-6 lg:self-start lg:-ml-2">
              <div className="flex lg:flex-col gap-1 overflow-x-auto scrollbar-hide pb-1">
                {topics.map((t) => (
                  <button key={t.id} type="button" onClick={() => goTo(t.id)}
                    className="flex items-center gap-2 shrink-0 rounded-md px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 text-left">
                    <t.icon className="w-4 h-4 shrink-0" /> {t.title}
                  </button>
                ))}
              </div>
            </nav>

            <div className={`space-y-4 ${CONTENT}`}>
              {topics.length === 0 && (
                <Card className="crypto-card border p-8 text-center text-gray-400">No topics match "{query}".</Card>
              )}
              {topics.map((t) => (
                <Card key={t.id} id={t.id} className="crypto-card border p-5 sm:p-6 scroll-mt-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#5c69c2]/15 flex items-center justify-center shrink-0">
                        <t.icon className="w-5 h-5 text-[#8b95e0]" />
                      </div>
                      <div>
                        <h2 className="text-white text-lg font-semibold">{t.title}</h2>
                        <p className="text-sm text-gray-400">{t.summary}</p>
                      </div>
                    </div>
                    {t.action && (
                      <button type="button" onClick={() => setLocation(t.action!.path)}
                        className="hidden sm:inline-flex shrink-0 text-sm text-[#8b95e0] hover:text-white">
                        {t.action.label} →
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">{t.body}</div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

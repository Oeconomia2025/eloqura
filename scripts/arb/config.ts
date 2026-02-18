import type { Address } from "viem";
import type { BotConfig } from "./types.js";

// ── Contract Addresses (Sepolia) ──────────────────────────────────────────

export const ELOQURA = {
  Factory: "0x1a4C7849Dd8f62AefA082360b3A8D857952B3b8e" as Address,
  Router: "0x3f42823d998EE4759a95a42a6e3bB7736B76A7AE" as Address,
  WETH: "0x34b11F6b8f78fa010bBCA71bC7FE79dAa811b89f" as Address,
};

export const UNISWAP = {
  SwapRouter02: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E" as Address,
  QuoterV2: "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3" as Address,
  Factory: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c" as Address,
  WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14" as Address,
};

export const KNOWN_TOKENS: Record<string, { address: Address; decimals: number }> = {
  OEC:  { address: "0x2b2fb8df4ac5d394f0d5674d7a54802e42a06aba" as Address, decimals: 18 },
  USDC: { address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as Address, decimals: 6 },
  LINK: { address: "0x779877A7B0D9E8603169DdbD7836e478b4624789" as Address, decimals: 18 },
};

export const UNISWAP_FEE_TIERS = [100, 500, 3000, 10000] as const;

// ── RPC Endpoints ─────────────────────────────────────────────────────────

export const SEPOLIA_RPCS = [
  "https://sepolia.gateway.tenderly.co",
  "https://rpc2.sepolia.org",
  "https://ethereum-sepolia-rpc.publicnode.com",
];

// ── Default Config ────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: BotConfig = {
  dryRun: false,
  verbose: false,
  once: false,
  minSpread: 0.005,          // 0.5%
  maxReserveFraction: 0.05,  // 5% of pool reserves
  slippage: 0.005,           // 0.5%
  deadlineSeconds: 600,      // 10 minutes
  intervalMs: 12_000,        // 12 seconds
};

// ── CLI Flag Parsing ──────────────────────────────────────────────────────

export function parseFlags(args: string[]): BotConfig {
  const config = { ...DEFAULT_CONFIG };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--dry-run":
        config.dryRun = true;
        break;
      case "--verbose":
      case "-v":
        config.verbose = true;
        break;
      case "--once":
        config.once = true;
        break;
      case "--min-spread":
        config.minSpread = parseFloat(args[++i]) / 100; // accept percentage
        break;
      case "--interval":
        config.intervalMs = parseInt(args[++i], 10) * 1000; // accept seconds
        break;
      case "--slippage":
        config.slippage = parseFloat(args[++i]) / 100;
        break;
    }
  }

  return config;
}

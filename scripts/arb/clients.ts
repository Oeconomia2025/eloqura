import { createPublicClient, createWalletClient, http, fallback, type PublicClient, type WalletClient } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { SEPOLIA_RPCS } from "./config.js";

const transport = fallback(SEPOLIA_RPCS.map((url) => http(url)));

export const publicClient: PublicClient = createPublicClient({
  chain: sepolia,
  transport,
});

let _walletClient: WalletClient | null = null;
let _account: PrivateKeyAccount | null = null;

export function getAccount(): PrivateKeyAccount {
  if (!_account) {
    const pk = process.env.ARBITRAGE_PRIVATE_KEY;
    if (!pk) {
      throw new Error("ARBITRAGE_PRIVATE_KEY not set in .env");
    }
    _account = privateKeyToAccount(pk as `0x${string}`);
  }
  return _account;
}

export function getWalletClient(): WalletClient {
  if (!_walletClient) {
    const account = getAccount();
    _walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport,
    });
  }
  return _walletClient;
}

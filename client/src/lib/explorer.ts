// OECsplorer integration — track transactions from Oeconomia sites
// so they appear in the blockchain explorer.

const EXPLORER_API_URL =
  import.meta.env.VITE_EXPLORER_API_URL || "http://localhost:3001";

/**
 * Notify OECsplorer that a transaction was performed on an Oeconomia site.
 * The explorer will fetch, decode, and store the transaction.
 * Fire-and-forget — failures are silently ignored so they never
 * block the user experience.
 */
export function trackTransaction(txHash: string): void {
  if (!txHash) return;

  fetch(`${EXPLORER_API_URL}/api/track-tx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHash }),
  }).catch(() => {
    // Silent — explorer tracking is non-critical
  });
}

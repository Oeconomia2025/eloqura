import { db } from "../db";
import { liveCoinWatchCoins, type InsertLiveCoinWatchCoin } from "@shared/schema";
import { liveCoinWatchApiService } from "./live-coin-watch-api";
import { eq, desc } from "drizzle-orm";

class LiveCoinWatchSyncService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL = 30 * 1000; // 30 seconds

  async start() {
    console.log('🚫 Live Coin Watch sync service DISABLED - no usage consumption');
    console.log('📊 App will serve data from database cache only');
    return;
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Live Coin Watch sync service stopped');
  }

  private async syncData(): Promise<void> {
    console.log('🚫 Sync disabled - no API calls or usage consumption');
    return;
  }

  async getStoredCoins() {
    try {
      const result = await db.select().from(liveCoinWatchCoins);
      
      if (result.length > 0) {
        // Sort by market cap in descending order (highest first)
        return result.sort((a, b) => (b.cap || 0) - (a.cap || 0));
      }
      
      // Return fallback static data if database is empty
      return [
        {
          id: 1,
          code: 'BTC',
          name: 'Bitcoin',
          rate: 88400.00,
          volume: 28000000000,
          cap: 1750000000000,
          deltaHour: 1.001,
          deltaDay: 1.025,
          deltaWeek: 1.045,
          deltaMonth: 1.089,
          deltaQuarter: 1.234,
          deltaYear: 2.456,
          lastUpdated: new Date(),
        },
        {
          id: 2,
          code: 'ETH',
          name: 'Ethereum',
          rate: 3602.42,
          volume: 15000000000,
          cap: 433000000000,
          deltaHour: 1.005,
          deltaDay: 1.035,
          deltaWeek: 1.025,
          deltaMonth: 1.156,
          deltaQuarter: 1.789,
          deltaYear: 3.234,
          lastUpdated: new Date(),
        },
        {
          id: 3,
          code: 'USDT',
          name: 'Tether USD',
          rate: 1.00,
          volume: 45000000000,
          cap: 119000000000,
          deltaHour: 1.0,
          deltaDay: 1.001,
          deltaWeek: 0.999,
          deltaMonth: 1.002,
          deltaQuarter: 0.998,
          deltaYear: 1.005,
          lastUpdated: new Date(),
        }
      ];
    } catch (error) {
      console.error('Error fetching stored coins:', error);
      // Return minimal fallback data on error
      return [
        {
          id: 1,
          code: 'BTC',
          name: 'Bitcoin',
          rate: 88400.00,
          volume: 28000000000,
          cap: 1750000000000,
          deltaHour: 1.001,
          deltaDay: 1.025,
          deltaWeek: 1.045,
          deltaMonth: 1.089,
          deltaQuarter: 1.234,
          deltaYear: 2.456,
          lastUpdated: new Date(),
        }
      ];
    }
  }

  isServiceRunning() {
    return this.isRunning;
  }
}

export const liveCoinWatchSyncService = new LiveCoinWatchSyncService();
import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { pgTable, serial, text, real, bigint, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

// Inline table definitions
const liveCoinWatchCoins = pgTable("live_coin_watch_coins", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  rate: real("rate").notNull(),
  volume: real("volume"),
  cap: real("cap"),
  deltaHour: real("delta_hour"),
  deltaDay: real("delta_day"),
  deltaWeek: real("delta_week"),
  deltaMonth: real("delta_month"),
  deltaQuarter: real("delta_quarter"),
  deltaYear: real("delta_year"),
  totalSupply: real("total_supply"),
  circulatingSupply: real("circulating_supply"),
  maxSupply: real("max_supply"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

const priceHistoryData = pgTable("price_history_data", {
  id: serial("id").primaryKey(),
  tokenCode: text("token_code").notNull(),
  contractAddress: text("contract_address"),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  price: real("price").notNull(),
  volume: real("volume"),
  marketCap: real("market_cap"),
  timeframe: text("timeframe").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueEntry: uniqueIndex("unique_price_entry").on(table.tokenCode, table.timestamp, table.timeframe),
}));

const coinNames: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', XRP: 'XRP', USDT: 'Tether', BNB: 'BNB', SOL: 'Solana',
  USDC: 'USD Coin', TRX: 'TRON', ADA: 'Cardano', DOGE: 'Dogecoin', AVAX: 'Avalanche',
  LINK: 'Chainlink', DOT: 'Polkadot', MATIC: 'Polygon', LTC: 'Litecoin', SHIB: 'Shiba Inu',
  LEO: 'LEO Token', UNI: 'Uniswap', ATOM: 'Cosmos Hub', TON: 'Toncoin'
};

const supplyMap: Record<string, { total: number; circulating: number }> = {
  BTC: { total: 21000000, circulating: 19800000 },
  ETH: { total: 120300000, circulating: 120300000 },
  XRP: { total: 100000000000, circulating: 57000000000 },
  USDT: { total: 119000000000, circulating: 119000000000 },
  BNB: { total: 147220000, circulating: 147220000 },
  SOL: { total: 588000000, circulating: 470000000 },
  USDC: { total: 25400000000, circulating: 25400000000 },
  ADA: { total: 45000000000, circulating: 36700000000 },
  DOGE: { total: 150000000000, circulating: 150000000000 },
  LINK: { total: 1000000000, circulating: 541000000 },
  DOT: { total: 1210000000, circulating: 1380000000 },
  LTC: { total: 84000000, circulating: 74700000 },
  MATIC: { total: 10000000000, circulating: 9320000000 },
  UNI: { total: 1000000000, circulating: 754000000 },
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const apiKey = process.env.LIVE_COIN_WATCH_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'LIVE_COIN_WATCH_API_KEY not set' }) };
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'DATABASE_URL not set' }) };
    }

    // Fetch coins from LCW API
    const response = await fetch('https://api.livecoinwatch.com/coins/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ currency: 'USD', sort: 'rank', order: 'ascending', offset: 0, limit: 100, meta: false }),
    });

    if (!response.ok) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: `LCW API ${response.status}` }) };
    }

    const coins = await response.json() as any[];
    const pool = new Pool({ connectionString: dbUrl });
    const db = drizzle({ client: pool });

    let syncedCount = 0;
    const nowMs = Date.now();

    for (const coin of coins) {
      if (!coin?.code || coin.rate == null) continue;
      const supply = supplyMap[coin.code] || { total: 0, circulating: 0 };

      try {
        await db.insert(liveCoinWatchCoins).values({
          code: coin.code,
          name: coinNames[coin.code] || coin.code,
          rate: coin.rate, volume: coin.volume ?? 0, cap: coin.cap ?? null,
          deltaHour: coin.delta?.hour ?? null, deltaDay: coin.delta?.day ?? null,
          deltaWeek: coin.delta?.week ?? null, deltaMonth: coin.delta?.month ?? null,
          deltaQuarter: coin.delta?.quarter ?? null, deltaYear: coin.delta?.year ?? null,
          totalSupply: supply.total, circulatingSupply: supply.circulating,
          lastUpdated: new Date(),
        }).onConflictDoUpdate({
          target: liveCoinWatchCoins.code,
          set: {
            rate: coin.rate, volume: coin.volume ?? 0, cap: coin.cap ?? null,
            deltaHour: coin.delta?.hour ?? null, deltaDay: coin.delta?.day ?? null,
            deltaWeek: coin.delta?.week ?? null, deltaMonth: coin.delta?.month ?? null,
            deltaQuarter: coin.delta?.quarter ?? null, deltaYear: coin.delta?.year ?? null,
            totalSupply: supply.total, circulatingSupply: supply.circulating,
            lastUpdated: new Date(),
          },
        });

        await db.insert(priceHistoryData).values({
          tokenCode: coin.code, contractAddress: null, timestamp: nowMs,
          price: coin.rate ?? 0, volume: coin.volume ?? null, marketCap: coin.cap ?? null,
          timeframe: '1D',
        }).onConflictDoNothing();

        syncedCount++;
      } catch (dbErr) {
        console.error(`DB error for ${coin.code}:`, dbErr);
      }
    }

    await pool.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, syncedCount, timestamp: new Date().toISOString() }),
    };
  } catch (error) {
    console.error('Sync error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
    };
  }
};

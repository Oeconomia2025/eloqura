import type { Handler } from '@netlify/functions';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../../shared/schema.js';
import { eq, and, gte, desc } from 'drizzle-orm';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

// Map requested timeframe to milliseconds lookback
const TIMEFRAME_MS: Record<string, number> = {
  '1H':  60 * 60 * 1000,
  '1D':  24 * 60 * 60 * 1000,
  '7D':  7 * 24 * 60 * 60 * 1000,
  '30D': 30 * 24 * 60 * 60 * 1000,
};

// Target number of points per timeframe for smooth chart rendering
const TARGET_POINTS: Record<string, number> = {
  '1H':  120,
  '1D':  288,
  '7D':  500,
  '30D': 720,
};

// Fallback point count when primary window is empty (e.g. 1H with stale data)
const FALLBACK_POINTS: Record<string, number> = {
  '1H':  60,
  '1D':  288,
  '7D':  500,
  '30D': 720,
};

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: 'Method not allowed' }),
    };
  }

  try {
    const tokenCode = event.queryStringParameters?.token;
    const timeframe = event.queryStringParameters?.timeframe || '1D';

    if (!tokenCode) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Token code is required' }),
      };
    }

    const upperCode = tokenCode.toUpperCase();
    const lookbackMs = TIMEFRAME_MS[timeframe] || TIMEFRAME_MS['1D'];
    const cutoffTimestamp = Date.now() - lookbackMs;

    // Query all data in the time range across all stored timeframe labels
    let historicalData = await db
      .select({
        timestamp: schema.priceHistoryData.timestamp,
        price: schema.priceHistoryData.price
      })
      .from(schema.priceHistoryData)
      .where(and(
        eq(schema.priceHistoryData.tokenCode, upperCode),
        gte(schema.priceHistoryData.timestamp, cutoffTimestamp)
      ))
      .orderBy(schema.priceHistoryData.timestamp);

    // If the time window returned nothing (e.g. 1H but sync is stale),
    // fall back to the most recent N points regardless of time
    if (historicalData.length === 0) {
      const fallbackCount = FALLBACK_POINTS[timeframe] || 60;
      historicalData = await db
        .select({
          timestamp: schema.priceHistoryData.timestamp,
          price: schema.priceHistoryData.price
        })
        .from(schema.priceHistoryData)
        .where(eq(schema.priceHistoryData.tokenCode, upperCode))
        .orderBy(desc(schema.priceHistoryData.timestamp))
        .limit(fallbackCount);

      // Reverse to chronological order
      historicalData.reverse();
    }

    // Deduplicate by timestamp (same timestamp may exist under different timeframe labels)
    const seen = new Set<number>();
    const deduped = historicalData.filter(d => {
      if (seen.has(d.timestamp)) return false;
      seen.add(d.timestamp);
      return true;
    });

    if (deduped.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify([]),
      };
    }

    // Append current live price so chart always extends to "now"
    const [currentCoin] = await db
      .select({ rate: schema.liveCoinWatchCoins.rate })
      .from(schema.liveCoinWatchCoins)
      .where(eq(schema.liveCoinWatchCoins.code, upperCode))
      .limit(1);

    if (currentCoin?.rate) {
      const nowTs = Date.now();
      const lastTs = deduped[deduped.length - 1].timestamp;
      // Only append if there's a meaningful gap (> 30 seconds)
      if (nowTs - lastTs > 30_000) {
        deduped.push({ timestamp: nowTs, price: currentCoin.rate });
      }
    }

    // Downsample to target points if we have too many, preserving first and last
    const target = TARGET_POINTS[timeframe] || 500;
    let result = deduped;

    if (deduped.length > target) {
      const sampled: typeof deduped = [deduped[0]];
      const step = (deduped.length - 1) / (target - 1);

      for (let i = 1; i < target - 1; i++) {
        const idx = Math.round(i * step);
        sampled.push(deduped[idx]);
      }

      sampled.push(deduped[deduped.length - 1]);
      result = sampled;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('Error fetching token historical data:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'Failed to fetch token historical data',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};

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

    // Calculate the timestamp cutoff based on requested timeframe
    const lookbackMs = TIMEFRAME_MS[timeframe] || TIMEFRAME_MS['1D'];
    const cutoffTimestamp = Date.now() - lookbackMs;

    // Query ALL data across all stored timeframe labels in the time range
    const historicalData = await db
      .select({
        timestamp: schema.priceHistoryData.timestamp,
        price: schema.priceHistoryData.price
      })
      .from(schema.priceHistoryData)
      .where(and(
        eq(schema.priceHistoryData.tokenCode, tokenCode.toUpperCase()),
        gte(schema.priceHistoryData.timestamp, cutoffTimestamp)
      ))
      .orderBy(schema.priceHistoryData.timestamp);

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

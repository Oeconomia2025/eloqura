import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Get the correct API base URL
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // In browser - use current origin for API calls
    return window.location.origin;
  }
  // Fallback for SSR
  return 'http://localhost:5000';
};

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // FORCE NETLIFY FUNCTIONS: Convert all API calls to use Netlify functions
  let fullUrl = url;
  if (!url.startsWith('http')) {
    if (url.startsWith('/api/')) {
      const cleanPath = url.replace('/api/', '');
      if (cleanPath.startsWith('price-history/')) {
        // Handle price-history with contract and timeframe
        const parts = cleanPath.split('/');
        const contract = parts[1];
        const timeframe = parts[2] || '1D';
        fullUrl = `/.netlify/functions/price-history?contract=${contract}&timeframe=${timeframe}`;
      } else if (cleanPath.startsWith('live-coin-watch/token/')) {
        // Handle live-coin-watch token endpoints: /api/live-coin-watch/token/BTC -> /live-coin-watch-token?token=BTC
        const tokenCode = cleanPath.split('/')[2];
        fullUrl = `/.netlify/functions/live-coin-watch-token?token=${tokenCode}`;
      } else if (cleanPath.startsWith('live-coin-watch/')) {
        // Handle other live-coin-watch endpoints
        fullUrl = `/.netlify/functions/${cleanPath.replace(/\//g, '-')}`;
      } else {
        // Handle other endpoints
        fullUrl = `/.netlify/functions/${cleanPath.replace(/\//g, '-')}`;
      }
    } else {
      fullUrl = url;
    }
  }

  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
import { getApiBaseUrl } from './environment.js';

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const apiPath = queryKey.join("/") as string;
      // FORCE NETLIFY FUNCTIONS: Convert all API calls to use Netlify functions
      let url = apiPath;
      if (apiPath.startsWith('/api/')) {
        const cleanPath = apiPath.replace('/api/', '');
        if (cleanPath.startsWith('price-history/')) {
          // Handle price-history with contract and timeframe
          const parts = cleanPath.split('/');
          const contract = parts[1];
          const timeframe = parts[2] || '1D';
          url = `/.netlify/functions/price-history?contract=${contract}&timeframe=${timeframe}`;
        } else if (cleanPath.startsWith('live-coin-watch/token/')) {
          // Handle live-coin-watch token endpoints: /api/live-coin-watch/token/BTC -> /live-coin-watch-token?token=BTC
          const tokenCode = cleanPath.split('/')[2];
          url = `/.netlify/functions/live-coin-watch-token?token=${tokenCode}`;
        } else if (cleanPath.startsWith('live-coin-watch/')) {
          // Handle other live-coin-watch endpoints
          url = `/.netlify/functions/${cleanPath.replace(/\//g, '-')}`;
        } else {
          // Handle other endpoints
          url = `/.netlify/functions/${cleanPath.replace(/\//g, '-')}`;
        }
      }

      const res = await fetch(url, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      // Handle 404s gracefully for static deployments
      if (res.status === 404 && url.includes('/api/')) {
        console.warn(`API endpoint not available: ${url}`);
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      // Log error but still throw for React Query to handle properly
      console.warn(`API call failed: ${queryKey.join("/")}`, error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30000, // 30 seconds
      retry: (failureCount, error) => {
        // Retry up to 2 times for network errors, but not for 404s
        if (failureCount < 2 && !error.message.includes('404')) {
          return true;
        }
        return false;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
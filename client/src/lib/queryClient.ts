import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { isLocalhost } from './environment';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function rewriteToNetlify(apiPath: string): string {
  const cleanPath = apiPath.replace('/api/', '');
  if (cleanPath.startsWith('price-history/')) {
    const parts = cleanPath.split('/');
    const contract = parts[1];
    const timeframe = parts[2] || '1D';
    return `/.netlify/functions/price-history?contract=${contract}&timeframe=${timeframe}`;
  } else if (cleanPath.startsWith('live-coin-watch/token/')) {
    const tokenCode = cleanPath.split('/')[2];
    return `/.netlify/functions/live-coin-watch-token?token=${tokenCode}`;
  } else if (cleanPath.startsWith('live-coin-watch/')) {
    return `/.netlify/functions/${cleanPath.replace(/\//g, '-')}`;
  } else {
    return `/.netlify/functions/${cleanPath.replace(/\//g, '-')}`;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  let fullUrl = url;
  if (!url.startsWith('http') && url.startsWith('/api/') && !isLocalhost()) {
    fullUrl = rewriteToNetlify(url);
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

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const apiPath = queryKey.join("/") as string;
      // On localhost, use Express routes directly; on production, rewrite to Netlify functions
      let url = apiPath;
      if (apiPath.startsWith('/api/') && !isLocalhost()) {
        url = rewriteToNetlify(apiPath);
      }

      const res = await fetch(url, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      if (res.status === 404 && url.includes('/api/')) {
        console.warn(`API endpoint not available: ${url}`);
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
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
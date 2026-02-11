import { Route, Switch, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { liveCoinWatchSyncService } from "@/services/live-coin-watch-sync";
import Landing from '@/pages/landing'
import Swap from '@/pages/swap'
import BuySell from '@/pages/buy-sell'
import Bridge from '@/pages/bridge'
import Liquidity from '@/pages/liquidity'
import Dashboard from '@/pages/dashboard'
import NotFound from '@/pages/not-found'

function Router() {
  const [location] = useLocation();

  useEffect(() => {
    // Scroll to top when route changes
    window.scrollTo(0, 0);
  }, [location]);

  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/landing" component={Landing} />
      <Route path="/swap" component={Swap} />
      <Route path="/buy-sell" component={BuySell} />
      <Route path="/bridge" component={Bridge} />
      <Route path="/liquidity" component={Liquidity} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="*" component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    // Initialize Live Coin Watch sync for production environment
    liveCoinWatchSyncService.initializeProductionSync().catch(error => {
      console.warn('Could not initialize production sync:', error);
    });

    // Cleanup on unmount
    return () => {
      liveCoinWatchSyncService.stopSync();
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
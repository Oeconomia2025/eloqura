import { Route, Switch, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy, useEffect } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { OECLoader } from "@/components/oec-loader";
import { liveCoinWatchSyncService } from "@/services/live-coin-watch-sync";

const Landing = lazy(() => import('@/pages/landing'));
const Swap = lazy(() => import('@/pages/swap'));
const BuySell = lazy(() => import('@/pages/buy-sell'));
const Bridge = lazy(() => import('@/pages/bridge'));
const Liquidity = lazy(() => import('@/pages/liquidity'));
const Dashboard = lazy(() => import('@/pages/dashboard'));
const TokenDetailDynamic = lazy(() => import('@/pages/token-detail-dynamic'));
const NotFound = lazy(() => import('@/pages/not-found'));

function Router() {
  const [location] = useLocation();

  useEffect(() => {
    // Scroll to top when route changes
    window.scrollTo(0, 0);
  }, [location]);

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-black"><OECLoader size="lg" text="Loading..." /></div>}>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/landing" component={Landing} />
        <Route path="/swap" component={Swap} />
        <Route path="/buy-sell" component={BuySell} />
        <Route path="/bridge" component={Bridge} />
        <Route path="/liquidity" component={Liquidity} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/coin/:code" component={TokenDetailDynamic} />
        <Route path="*" component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// Auto-switch wallet to Sepolia when connected on wrong chain
function useEnforceSepolia() {
  const { chainId, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    if (isConnected && chainId && chainId !== sepolia.id) {
      switchChain({ chainId: sepolia.id });
    }
  }, [isConnected, chainId, switchChain]);
}

function App() {
  useEnforceSepolia();

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
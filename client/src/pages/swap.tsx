import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { TradingNav } from "@/components/trading-nav";
import { SwapLimit } from "@/components/swap-limit";
import { BuySell } from "@/components/buy-sell";
import { Bridge } from "@/components/bridge";

export default function Swap() {
  const params = useParams();
  const [, setLocation] = useLocation();
  
  // Determine active tab from URL
  const getActiveTabFromUrl = (): 'swap' | 'buysell' | 'bridge' => {
    const subpage = params.subpage;
    switch (subpage) {
      case 'limit':
      case 'swap':
        return 'swap';
      case 'buysell':
      case 'buy':
      case 'sell':
        return 'buysell';
      case 'bridge':
        return 'bridge';
      default:
        return 'swap'; // Default to swap/limit
    }
  };

  const [activeTab, setActiveTab] = useState<'swap' | 'buysell' | 'bridge'>(getActiveTabFromUrl);

  // Update URL when tab changes
  const handleTabChange = (tab: 'swap' | 'buysell' | 'bridge') => {
    setActiveTab(tab);
    
    // Update URL based on selected tab
    switch (tab) {
      case 'swap':
        setLocation('/');
        break;
      case 'buysell':
        setLocation('/swap/buysell');
        break;
      case 'bridge':
        setLocation('/swap/bridge');
        break;
    }
  };

  // Update active tab when URL changes
  useEffect(() => {
    setActiveTab(getActiveTabFromUrl());
  }, [params.subpage]);

  // Render the appropriate component based on active tab
  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'swap':
        return <SwapLimit />;
      case 'buysell':
        return <BuySell />;
      case 'bridge':
        return <Bridge />;
      default:
        return <SwapLimit />;
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Trading Navigation */}
        <TradingNav activeTab={activeTab} onTabChange={handleTabChange} />
        
        {/* Active Trading Component */}
        {renderActiveComponent()}
      </div>
    </Layout>
  );
}
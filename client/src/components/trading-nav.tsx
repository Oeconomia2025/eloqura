import { Button } from "./ui/button";

interface TradingNavProps {
  activeTab: 'swap' | 'buysell' | 'bridge';
  onTabChange: (tab: 'swap' | 'buysell' | 'bridge') => void;
}

export function TradingNav({ activeTab, onTabChange }: TradingNavProps) {
  const tabs = [
    { id: 'swap', label: 'Swap/Limit', description: 'Exchange tokens and set limit orders' },
    { id: 'buysell', label: 'Buy/Sell', description: 'Buy and sell tokens directly' },
    { id: 'bridge', label: 'Bridge', description: 'Move tokens across blockchains' }
  ] as const;

  return (
    <div className="w-full bg-[var(--crypto-card)] border border-crypto-border rounded-xl p-6 mb-6">
      <div className="flex flex-col sm:flex-row gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "ghost"}
            onClick={() => onTabChange(tab.id as 'swap' | 'buysell' | 'bridge')}
            className={`flex-1 flex flex-col items-center space-y-1 py-4 px-6 h-auto ${
              activeTab === tab.id
                ? 'bg-crypto-blue hover:bg-crypto-blue/80 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <span className="font-semibold text-sm">{tab.label}</span>
            <span className="text-xs opacity-75 text-center leading-tight">
              {tab.description}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
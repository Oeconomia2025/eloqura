import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Calendar, Target, Percent } from "lucide-react";
import { formatPrice, formatNumber } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PerformanceData {
  period: string;
  priceChange: number;
  priceChangePercent: number;
  high: number;
  low: number;
  avgVolume: number;
  volatility: number;
  returns: number;
}

interface HistoricalPerformanceProps {
  contractAddress: string;
}

export function HistoricalPerformance({ contractAddress }: HistoricalPerformanceProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("7d");

  // Mock performance data for different time periods
  const performanceData: Record<string, PerformanceData> = {
    "24h": {
      period: "24 Hours",
      priceChange: 0.024,
      priceChangePercent: 2.4,
      high: 1.045,
      low: 0.987,
      avgVolume: 2850000,
      volatility: 12.5,
      returns: 2.4
    },
    "7d": {
      period: "7 Days", 
      priceChange: 0.087,
      priceChangePercent: 8.7,
      high: 1.124,
      low: 0.945,
      avgVolume: 2675000,
      volatility: 18.3,
      returns: 8.7
    },
    "30d": {
      period: "30 Days",
      priceChange: 0.156,
      priceChangePercent: 15.6,
      high: 1.298,
      low: 0.823,
      avgVolume: 3120000,
      volatility: 24.7,
      returns: 15.6
    },
    "90d": {
      period: "90 Days",
      priceChange: -0.034,
      priceChangePercent: -3.4,
      high: 1.456,
      low: 0.789,
      avgVolume: 2890000,
      volatility: 31.2,
      returns: -3.4
    }
  };

  // Mock chart data for the selected period
  const getChartData = (period: string) => {
    const basePrice = 1.00;
    const days = period === "24h" ? 1 : period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const points = period === "24h" ? 24 : days;
    
    return Array.from({ length: points }, (_, i) => {
      const variation = (Math.random() - 0.5) * 0.1;
      const trend = performanceData[period].priceChangePercent / 100;
      const progress = i / (points - 1);
      
      return {
        time: period === "24h" ? `${i}:00` : `Day ${i + 1}`,
        price: basePrice + (basePrice * trend * progress) + variation,
        volume: 2000000 + Math.random() * 2000000
      };
    });
  };

  const chartData = getChartData(selectedPeriod);
  const data = performanceData[selectedPeriod];

  const periods = [
    { key: "24h", label: "24H" },
    { key: "7d", label: "7D" },
    { key: "30d", label: "30D" },
    { key: "90d", label: "90D" }
  ];

  const PerformanceCard = ({ 
    title, 
    value, 
    icon: Icon, 
    format = "currency",
    colorClass = "" 
  }: {
    title: string;
    value: number;
    icon: any;
    format?: "currency" | "number" | "percentage";
    colorClass?: string;
  }) => {
    const formatValue = () => {
      switch (format) {
        case "currency":
          return formatPrice(value);
        case "number":
          return formatNumber(value);
        case "percentage":
          return `${value.toFixed(2)}%`;
        default:
          return value;
      }
    };

    return (
      <div className="flex items-center justify-between p-4 bg-crypto-dark/30 rounded-lg border border-crypto-border/20">
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            colorClass || 'bg-crypto-blue/20'
          }`}>
            <Icon className={`w-4 h-4 ${
              colorClass ? colorClass.includes('red') ? 'text-crypto-red' : 'text-crypto-green' : 'text-crypto-blue'
            }`} />
          </div>
          <div>
            <p className="text-xs text-gray-400">{title}</p>
            <p className="text-sm font-semibold">{formatValue()}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="crypto-card p-6 mb-0">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-sky-400" />
          <h3 className="text-lg font-semibold">Historical Performance</h3>
        </div>
        
        <div className="flex space-x-2">
          {periods.map((period) => (
            <Button
              key={period.key}
              variant={selectedPeriod === period.key ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPeriod(period.key)}
              className={selectedPeriod === period.key 
                ? "bg-crypto-blue hover:bg-crypto-blue/80" 
                : "border-crypto-border text-gray-400 hover:text-white hover:border-crypto-blue"
              }
            >
              {period.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Chart */}
        <div className="lg:col-span-2">
          <div className="mb-4">
            <div className="flex items-center space-x-4">
              <h4 className="text-sm font-medium">Price Performance - {data.period}</h4>
              <Badge variant={data.priceChangePercent >= 0 ? "default" : "destructive"} className={
                data.priceChangePercent >= 0 
                  ? "bg-crypto-green/20 text-crypto-green border-crypto-green/30"
                  : "bg-crypto-red/20 text-crypto-red border-crypto-red/30"
              }>
                <div className="flex items-center space-x-1">
                  {data.priceChangePercent >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span>{Math.abs(data.priceChangePercent).toFixed(2)}%</span>
                </div>
              </Badge>
            </div>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="time" 
                  stroke="#9CA3AF"
                  fontSize={12}
                  tick={{ fill: '#9CA3AF' }}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  fontSize={12}
                  tick={{ fill: '#9CA3AF' }}
                  tickFormatter={(value) => `$${value.toFixed(3)}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  formatter={(value: number) => [`$${value.toFixed(4)}`, 'Price']}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#3B82F6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium mb-3">Key Metrics</h4>
          
          <PerformanceCard
            title="Price Change"
            value={data.priceChange}
            icon={data.priceChangePercent >= 0 ? TrendingUp : TrendingDown}
            colorClass={data.priceChangePercent >= 0 ? "bg-crypto-green/20" : "bg-crypto-red/20"}
          />
          
          <PerformanceCard
            title="High"
            value={data.high}
            icon={TrendingUp}
            colorClass="bg-crypto-green/20"
          />
          
          <PerformanceCard
            title="Low"
            value={data.low}
            icon={TrendingDown}
            colorClass="bg-crypto-red/20"
          />
          
          <PerformanceCard
            title="Avg Volume"
            value={data.avgVolume}
            icon={Target}
          />
          
          <PerformanceCard
            title="Volatility"
            value={data.volatility}
            icon={Percent}
            format="percentage"
          />
        </div>
      </div>
    </Card>
  );
}
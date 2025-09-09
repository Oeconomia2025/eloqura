import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  BarChart3, 
  DollarSign,
  Activity,
  Star,
  Zap,
  ArrowUpRight,
  Eye,
  Users,
  Target
} from "lucide-react";

export default function Dashboard() {
  // Mock portfolio data
  const portfolioValue = 12450.75;
  const portfolioChange = 8.5;
  const totalPositions = 6;
  const activeStaking = 3;

  // Mock recent activity
  const recentActivities = [
    {
      id: 1,
      type: "swap",
      description: "Swapped 100 OEC for 0.15 BNB",
      time: "2 hours ago",
      value: "+$91.50"
    },
    {
      id: 2,
      type: "liquidity",
      description: "Added liquidity to OEC/USDT pool",
      time: "5 hours ago",
      value: "+$250.00"
    },
    {
      id: 3,
      type: "stake",
      description: "Staked 500 OEC tokens",
      time: "1 day ago",
      value: "+$425.00"
    }
  ];

  // Mock top tokens
  const topTokens = [
    {
      symbol: "OEC",
      name: "Oeconomia",
      price: 0.85,
      change: 12.4,
      logo: "/oec-logo.png",
      balance: 1250.00
    },
    {
      symbol: "BNB",
      name: "Binance Coin", 
      price: 610.50,
      change: -2.1,
      logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png",
      balance: 8.5
    },
    {
      symbol: "USDT",
      name: "Tether USD",
      price: 1.00,
      change: 0.1,
      logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png",
      balance: 2450.00
    }
  ];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  return (
    <Layout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Portfolio Dashboard</h1>
            <p className="text-gray-400">Track your DeFi positions and portfolio performance</p>
          </div>

          {/* Portfolio Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="crypto-card border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Total Portfolio Value</p>
                    <p className="text-2xl font-bold text-white">{formatPrice(portfolioValue)}</p>
                    <div className="flex items-center mt-2">
                      {portfolioChange >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400 mr-1" />
                      )}
                      <span className={`text-sm font-medium ${portfolioChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatChange(portfolioChange)}
                      </span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-cyan-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="crypto-card border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Active Positions</p>
                    <p className="text-2xl font-bold text-white">{totalPositions}</p>
                    <p className="text-sm text-gray-400 mt-2">Across 3 protocols</p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-violet-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="crypto-card border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Staking Rewards</p>
                    <p className="text-2xl font-bold text-white">$284.50</p>
                    <div className="flex items-center mt-2">
                      <Zap className="w-4 h-4 text-yellow-400 mr-1" />
                      <span className="text-sm text-yellow-400 font-medium">18.5% APY</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg flex items-center justify-center">
                    <Star className="w-6 h-6 text-yellow-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="crypto-card border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">24h Volume</p>
                    <p className="text-2xl font-bold text-white">$1,840</p>
                    <div className="flex items-center mt-2">
                      <Activity className="w-4 h-4 text-green-400 mr-1" />
                      <span className="text-sm text-green-400 font-medium">+12.8%</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Top Holdings */}
            <Card className="crypto-card border">
              <CardHeader>
                <CardTitle className="text-xl text-white flex items-center">
                  <Eye className="w-5 h-5 mr-2" />
                  Top Holdings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-700">
                  {topTokens.map((token, index) => (
                    <div key={token.symbol} className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <img src={token.logo} alt={token.symbol} className="w-10 h-10 rounded-full" />
                          <div>
                            <h3 className="font-semibold text-white">{token.symbol}</h3>
                            <p className="text-sm text-gray-400">{token.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-white">{formatPrice(token.balance)}</p>
                          <div className="flex items-center">
                            {token.change >= 0 ? (
                              <TrendingUp className="w-3 h-3 text-green-400 mr-1" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-red-400 mr-1" />
                            )}
                            <span className={`text-xs ${token.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {formatChange(token.change)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-gray-700">
                  <Button variant="outline" className="w-full border-gray-600 text-gray-300 hover:bg-gray-700">
                    View All Holdings
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="crypto-card border">
              <CardHeader>
                <CardTitle className="text-xl text-white flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-700">
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            activity.type === 'swap' ? 'bg-blue-500/20' : 
                            activity.type === 'liquidity' ? 'bg-green-500/20' : 'bg-yellow-500/20'
                          }`}>
                            {activity.type === 'swap' && <ArrowUpRight className="w-4 h-4 text-blue-400" />}
                            {activity.type === 'liquidity' && <Users className="w-4 h-4 text-green-400" />}
                            {activity.type === 'stake' && <Target className="w-4 h-4 text-yellow-400" />}
                          </div>
                          <div>
                            <p className="text-white font-medium">{activity.description}</p>
                            <p className="text-sm text-gray-400">{activity.time}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-green-400 font-semibold">{activity.value}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-gray-700">
                  <Button variant="outline" className="w-full border-gray-600 text-gray-300 hover:bg-gray-700">
                    View All Activity
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="mt-8">
            <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white h-16">
                <div className="text-center">
                  <ArrowUpRight className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-sm font-medium">Trade</div>
                </div>
              </Button>
              <Button className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white h-16">
                <div className="text-center">
                  <Users className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-sm font-medium">Add Liquidity</div>
                </div>
              </Button>
              <Button className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white h-16">
                <div className="text-center">
                  <Target className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-sm font-medium">Stake</div>
                </div>
              </Button>
              <Button className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white h-16">
                <div className="text-center">
                  <BarChart3 className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-sm font-medium">Analytics</div>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowUpDown, 
  DollarSign, 
  ArrowLeftRight, 
  Droplets, 
  BarChart3,
  Zap,
  Shield,
  TrendingUp,
  Users,
  Star,
  ChevronRight
} from "lucide-react";
import { useLocation } from "wouter";

export default function Landing() {
  const [, navigate] = useLocation();

  const features = [
    {
      icon: ArrowUpDown,
      title: "Trade",
      description: "Trade tokens instantly with best-in-class execution and minimal slippage",
      path: "/swap",
      gradient: "from-blue-500 to-purple-600"
    },
    {
      icon: DollarSign,
      title: "Buy/Sell",
      description: "Easy fiat on-ramps and off-ramps for seamless crypto transactions",
      path: "/buy-sell",
      gradient: "from-green-500 to-emerald-600"
    },
    {
      icon: ArrowLeftRight,
      title: "Bridge",
      description: "Cross-chain asset transfers with secure and fast bridging solutions",
      path: "/bridge",
      gradient: "from-orange-500 to-red-600"
    },
    {
      icon: Droplets,
      title: "Liquidity Pools",
      description: "Provide liquidity to earn fees and rewards in multiple pool options",
      path: "/liquidity",
      gradient: "from-cyan-500 to-blue-600"
    },
    {
      icon: BarChart3,
      title: "Analytics",
      description: "Deep market insights and portfolio analytics for informed decisions",
      path: "/examine",
      gradient: "from-purple-500 to-pink-600"
    }
  ];

  const stats = [
    { label: "Total Value Locked", value: "$2.4M+", icon: Shield },
    { label: "Daily Volume", value: "$180K+", icon: TrendingUp },
    { label: "Active Users", value: "5,200+", icon: Users },
    { label: "Supported Networks", value: "8+", icon: Zap }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/10 to-cyan-900/20" />
        <div className="relative max-w-7xl mx-auto px-6 py-24">
          <div className="text-center space-y-8">
            <div className="flex items-center justify-center space-x-6 mb-8">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden">
                <img 
                  src="/oec-logo.png" 
                  alt="Eloqura Logo" 
                  className="w-full h-full object-cover"
                />
              </div>
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-indigo-300 via-purple-300 to-teal-400 bg-clip-text text-transparent">
              Eloqura
            </h1>
            </div>

            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              The next-generation DeFi platform powering the Oeconomia ecosystem. 
              Trade, earn, and build wealth with cutting-edge financial tools.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
              <Button 
                size="lg" 
                onClick={() => navigate('/swap')}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-3 text-lg"
              >
                Start Trading
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate('/liquidity')}
                className="border-purple-500/50 hover:bg-purple-500/10 px-8 py-3 text-lg"
              >
                Explore Pools
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <Card key={index} className="bg-card/50 border-border/50 backdrop-blur-sm">
                <CardContent className="p-6 text-center">
                  <stat.icon className="w-8 h-8 mx-auto mb-3 text-purple-400" />
                  <div className="text-2xl font-bold text-foreground mb-1">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need for DeFi
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From trading to yield farming, Eloqura provides all the tools you need 
              to participate in the decentralized economy.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index}
                className="group cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl bg-card/30 border-border/50 backdrop-blur-sm"
                onClick={() => navigate(feature.path)}
              >
                <CardContent className="p-8">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 group-hover:text-purple-400 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                  <div className="flex items-center mt-4 text-purple-400 group-hover:translate-x-2 transition-transform duration-300">
                    <span className="text-sm font-medium">Learn more</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-r from-purple-900/20 to-cyan-900/20 border-purple-500/30 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <Star className="w-12 h-12 mx-auto mb-6 text-yellow-400 fill-current" />
              <h2 className="text-3xl font-bold mb-4">
                Ready to Start Your DeFi Journey?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join thousands of users who are already earning rewards and trading 
                efficiently on the Eloqura platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg"
                  onClick={() => navigate('/swap')}
                  className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white px-8 py-3"
                >
                  Get Started Now
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  onClick={() => window.open('https://oeconomia.tech/', '_blank')}
                  className="border-cyan-500/50 hover:bg-cyan-500/10 px-8 py-3"
                >
                  Learn More
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
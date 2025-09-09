import { useState, ReactNode, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Settings, 
  Activity, 
  BarChart3, 
  Wallet, 
  TrendingUp, 
  ArrowUpDown, 
  Bell,
  Menu,
  X,
  Lock,
  Zap,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Vote,
  MessageCircle,
  ExternalLink,
  Globe,
  BookOpen,
  MoreHorizontal,
  Droplets,
  DollarSign,
  ChevronDown,
  AlertTriangle,
  Heart,
  Image, // Added Image icon import
  ArrowLeftRight,
  Microscope // Added Microscope icon import
} from "lucide-react";
import { SiX, SiMedium, SiYoutube, SiDiscord, SiGithub, SiTelegram } from "react-icons/si";
import { WalletConnect } from "@/components/wallet-connect";
import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuContent,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

interface LayoutProps {
  children: ReactNode;
  pageTitle?: string;
  pageDescription?: string;
  pageLogo?: string;
  pageWebsite?: string;
  tokenLogo?: string;
  tokenWebsite?: string;
  contractAddress?: string;
  tokenTicker?: string;
  tokenName?: string;
}

// Page information for each route
const pageInfo = {
  '/': {
    title: 'Trade',
    description: 'Trade tokens instantly on the Oeconomia ecosystem'
  },
  '/swap': {
    title: 'Trade',
    description: 'Trade tokens instantly on the Oeconomia ecosystem'
  },
  '/liquidity': {
    title: 'Liquidity Pools',
    description: 'Provide liquidity to earn fees and rewards'
  }
} as const;

export function Layout({ 
  children, 
  pageTitle, 
  pageDescription, 
  pageLogo, 
  pageWebsite,
  tokenLogo,
  tokenWebsite,
  contractAddress,
  tokenTicker,
  tokenName
}: LayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Initialize from localStorage to persist state across navigation
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed');
      return saved === 'true';
    }
    return false;
  });
  const [supportOpen, setSupportOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [donationStep, setDonationStep] = useState<'addresses' | 'thankyou'>('addresses');
  const [selectedDonationType, setSelectedDonationType] = useState<string>('');
  const [donorName, setDonorName] = useState('');
  const [location, navigate] = useLocation();

  // Social media links data
  const socialLinks = [
    {
      name: 'Twitter/X',
      icon: SiX,
      url: 'https://x.com/Oeconomia2025',
      enabled: true
    },
    {
      name: 'Medium',
      icon: SiMedium,
      url: 'https://medium.com/@oeconomia2025',
      enabled: true
    },
    {
      name: 'YouTube',
      icon: SiYoutube,
      url: 'https://www.youtube.com/@Oeconomia2025',
      enabled: true
    },
    {
      name: 'Discord',
      icon: SiDiscord,
      url: 'https://discord.com/invite/XSgZgeVD',
      enabled: true
    },
    {
      name: 'GitHub',
      icon: SiGithub,
      url: 'https://github.com/Oeconomia2025',
      enabled: true
    },
    {
      name: 'Telegram',
      icon: SiTelegram,
      url: 'https://t.me/OeconomiaDAO',
      enabled: true
    }
  ];

  // Get current page info - use custom props if provided, otherwise use route-based info
  const routePageInfo = pageInfo[location as keyof typeof pageInfo] || pageInfo['/'];
  const currentPageInfo = {
    title: pageTitle || routePageInfo.title,
    description: pageDescription || routePageInfo.description
  };

  // Persist collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', sidebarCollapsed.toString());
  }, [sidebarCollapsed]);

  const handleNavigation = (path: string) => {
    // On mobile, just navigate and close sidebar
    if (window.innerWidth < 1024) {
      navigate(path);
      setSidebarOpen(false);
      return;
    }

    // On desktop, just navigate - let the state persist naturally
    navigate(path);
  };

  const toggleCollapsed = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
  };

  const sidebarItems = [
    { icon: BarChart3, label: 'Dashboard', path: '/dashboard', active: location === '/dashboard' },
    { icon: ArrowUpDown, label: 'Trade', path: '/swap', active: location === '/swap' },
    { icon: DollarSign, label: 'Buy/Sell', path: '/buy-sell', active: location === '/buy-sell' },
    { icon: ArrowLeftRight, label: 'Bridge', path: '/bridge', active: location === '/bridge' },
    { icon: Droplets, label: 'Pools', path: '/liquidity', active: location === '/liquidity' },
    { icon: Microscope, label: 'Examine', path: '/examine', active: location === '/examine' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-50 ${sidebarCollapsed ? 'w-16' : 'w-48'} bg-background border-r border-border transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col shadow-xl shadow-black/70`}>
        <div className="sticky top-0 z-10 bg-background flex items-center justify-between h-20 px-4">
          <div 
            className={`flex items-center cursor-pointer hover:opacity-80 transition-opacity ${sidebarCollapsed ? 'justify-center w-full' : 'space-x-3'}`}
            onClick={() => navigate('/')}
            title="Go to Home"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
              <img 
                src="/oec-logo.png" 
                alt="Eloqura Logo" 
                className="w-full h-full object-cover"
              />
            </div>
            {!sidebarCollapsed && (
              <div>
                <h2 className="text-lg font-bold">Eloqura</h2>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleCollapsed}
              className="hidden lg:flex"
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="sticky top-20 bg-background z-10">
          <nav className="p-4">
            <ul className="space-y-2">
              {sidebarItems.map((item, index) => (
                <li key={index}>
                  <button 
                    onClick={() => handleNavigation(item.path)}
                    className={`${sidebarCollapsed ? 'w-10 h-10 p-0 justify-center' : 'w-full px-3 py-2 space-x-3'} flex items-center rounded-lg text-left transition-colors group relative ${
                      item.active 
                        ? 'bg-crypto-blue text-white font-medium shadow-lg transition-all duration-200' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                    {sidebarCollapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--crypto-dark)] text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                        {item.label}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Content area */}
        </div>

        {/* Bottom section with wallet and social links */}
        <div className="sticky bottom-0 bg-background p-4 space-y-3">
          {/* Connect Wallet */}
          <div className={`${sidebarCollapsed ? 'flex justify-center' : ''}`}>
            <WalletConnect 
                  collapsed={sidebarCollapsed}
                />
          </div>

          {/* Social Media Dropdown */}
          <div className={`${sidebarCollapsed ? 'flex justify-center' : ''}`}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${sidebarCollapsed ? 'w-10 h-10 p-0 justify-center' : 'w-full justify-start'} bg-background text-foreground hover:bg-accent/50 hover:border hover:border-primary/20 hover:text-foreground transition-all duration-200 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 group relative`}
                  style={{ borderRadius: '5px' }}
                  title={sidebarCollapsed ? "Social Media Links" : undefined}
                >
                  <Globe className="w-5 h-5 text-white" />
                  {!sidebarCollapsed && <span className="ml-2">Social & Website</span>}
                  {sidebarCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--crypto-dark)] text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                      Social & Website
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align={sidebarCollapsed ? "center" : "start"} 
                side={sidebarCollapsed ? "right" : "top"}
                sideOffset={sidebarCollapsed ? 8 : 4}
                className={sidebarCollapsed ? "w-36" : "w-full"}
                style={!sidebarCollapsed ? { width: 'var(--radix-dropdown-menu-trigger-width)' } : undefined}
              >
                <DropdownMenuItem 
                  onClick={() => window.open('https://oeconomia.tech/', '_blank')}
                  className="cursor-pointer hover:bg-gradient-to-r hover:from-cyan-500/20 hover:to-purple-600/20 transition-all duration-200"
                >
                  <Globe className="w-4 h-4 mr-2" />
                  Website
                </DropdownMenuItem>
                {socialLinks.map((link) => (
                  <DropdownMenuItem
                    key={link.name}
                    onClick={() => link.enabled && window.open(link.url, '_blank')}
                    className={`cursor-pointer hover:bg-gradient-to-r hover:from-cyan-500/20 hover:to-purple-600/20 transition-all duration-200 ${!link.enabled ? 'opacity-50' : ''}`}
                    disabled={!link.enabled}
                  >
                    <link.icon className="w-4 h-4 mr-2" />
                    {link.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 lg:ml-0 relative">
        {/* Mobile menu button for when there's no header */}
        <div className="lg:hidden fixed top-4 left-4 z-50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
            className="bg-background/80 backdrop-blur-sm border border-border"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>

        {/* Page Content */}
        <main className="flex-1">
          {children}

          {/* Footer */}
          <footer className="mt-8 py-6 px-6 text-center">
            <p className="text-sm text-muted-foreground">
              © 2025 Eloqura. All rights reserved.
            </p>
          </footer>
        </main>
      </div>


      {/* Support Modal */}
      {supportOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSupportOpen(false)}
        >
          <Card 
            className="max-w-4xl w-full bg-[var(--crypto-card)] border-crypto-border p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => {
                setSupportOpen(false);
                // Reset donation flow when closing
                setTimeout(() => {
                  setDonationStep('addresses');
                  setSelectedDonationType('');
                  setDonorName('');
                }, 300);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {donationStep === 'addresses' ? (
              <div className="animate-in fade-in duration-500">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500/20 to-red-500/20 flex items-center justify-center">
                    <Heart className="w-6 h-6 text-pink-400 fill-current animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Support Development</h2>
                    <p className="text-sm text-gray-400">Help Oeconomia Grow</p>
                  </div>
                </div>

            <div className="space-y-4 mb-6">
              <p className="text-gray-300">
                Your support helps fund essential infrastructure including servers, databases, APIs, and blockchain node operations. These resources are critical for maintaining the platform's performance and reliability.
              </p>

              <p className="text-gray-300">
                Additionally, upcoming marketing initiatives will help expand the Oeconomia ecosystem and reach new users. Every contribution directly supports continued development and innovation.
              </p>

              <div className="bg-gradient-to-r from-cyan-500/10 to-purple-600/10 border border-cyan-500/30 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-cyan-400 mb-2">Donation Addresses (Click to Copy):</h3>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-400 font-medium min-w-[120px]">EVM Networks:</span>
                    <div 
                      className={`font-mono text-xs p-2 rounded break-all cursor-pointer transition-all duration-300 flex-1 ${
                        copiedAddress === 'evm' 
                          ? 'bg-green-500/30 border border-green-500/50 text-green-300' 
                          : 'bg-black/30 hover:bg-black/50'
                      }`}
                      onClick={() => {
                        navigator.clipboard.writeText('0xD02dbe54454F6FE3c2F9F1F096C5460284E418Ed');
                        setCopiedAddress('evm');
                        setSelectedDonationType('EVM Networks');
                        setTimeout(() => setCopiedAddress(null), 2000);
                        // Trigger donation flow after copy
                        setTimeout(() => {
                          setDonationStep('thankyou');
                        }, 2500);
                      }}
                      title="Click to copy address"
                    >
                      {copiedAddress === 'evm' ? '✓ Copied!' : '0xD02dbe54454F6FE3c2F9F1F096C5460284E418Ed'}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-gray-400 font-medium min-w-[120px]">Solana:</span>
                    <div 
                      className={`font-mono text-xs p-2 rounded break-all cursor-pointer transition-all duration-300 flex-1 ${
                        copiedAddress === 'sol' 
                          ? 'bg-green-500/30 border border-green-500/50 text-green-300' 
                          : 'bg-black/30 hover:bg-black/50'
                      }`}
                      onClick={() => {
                        navigator.clipboard.writeText('HkJhW2X9xYw9n4sp3e9BBh33Np6iNghpU7gtDJ5ATqYx');
                        setCopiedAddress('sol');
                        setSelectedDonationType('Solana');
                        setTimeout(() => setCopiedAddress(null), 2000);
                        // Trigger donation flow after copy
                        setTimeout(() => {
                          setDonationStep('thankyou');
                        }, 2500);
                      }}
                      title="Click to copy address"
                    >
                      {copiedAddress === 'sol' ? '✓ Copied!' : 'HkJhW2X9xYw9n4sp3e9BBh33Np6iNghpU7gtDJ5ATqYx'}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-gray-400 font-medium min-w-[120px]">Sui Network:</span>
                    <div 
                      className={`font-mono text-xs p-2 rounded break-all cursor-pointer transition-all duration-300 flex-1 ${
                        copiedAddress === 'sui' 
                          ? 'bg-green-500/30 border border-green-500/50 text-green-300' 
                          : 'bg-black/30 hover:bg-black/50'
                      }`}
                      onClick={() => {
                        navigator.clipboard.writeText('0xef000226f93506df5a3b1eaaae7835e919ff69c18d4929ed1537d656fb324dfe');
                        setCopiedAddress('sui');
                        setSelectedDonationType('Sui Network');
                        setTimeout(() => setCopiedAddress(null), 2000);
                        // Trigger donation flow after copy
                        setTimeout(() => {
                          setDonationStep('thankyou');
                        }, 2500);
                      }}
                      title="Click to copy address"
                    >
                      {copiedAddress === 'sui' ? '✓ Copied!' : '0xef000226f93506df5a3b1eaaae7835e919ff69c18d4929ed1537d656fb324dfe'}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-gray-400 font-medium min-w-[120px]">Bitcoin:</span>
                    <div 
                      className={`font-mono text-xs p-2 rounded break-all cursor-pointer transition-all duration-300 flex-1 ${
                        copiedAddress === 'btc' 
                          ? 'bg-green-500/30 border border-green-500/50 text-green-300' 
                          : 'bg-black/30 hover:bg-black/50'
                      }`}
                      onClick={() => {
                        navigator.clipboard.writeText('bc1qwtzdtx6ghfzy065wmv3xfk8tyqqr2w87tnrx9r');
                        setCopiedAddress('btc');
                        setSelectedDonationType('Bitcoin');
                        setTimeout(() => setCopiedAddress(null), 2000);
                        // Trigger donation flow after copy
                        setTimeout(() => {
                          setDonationStep('thankyou');
                        }, 2500);
                      }}
                      title="Click to copy address"
                    >
                      {copiedAddress === 'btc' ? '✓ Copied!' : 'bc1qwtzdtx6ghfzy065wmv3xfk8tyqqr2w87tnrx9r'}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-gray-400 font-medium min-w-[120px]">CashApp:</span>
                    <div 
                      className={`font-mono text-xs p-2 rounded break-all cursor-pointer transition-all duration-300 flex-1 ${
                        copiedAddress === 'cashapp' 
                          ? 'bg-green-500/30 border border-green-500/50 text-green-300' 
                          : 'bg-black/30 hover:bg-black/50'
                      }`}
                      onClick={() => {
                        navigator.clipboard.writeText('$oooJASONooo');
                        setCopiedAddress('cashapp');
                        setSelectedDonationType('CashApp');
                        setTimeout(() => setCopiedAddress(null), 2000);
                        // Trigger donation flow after copy
                        setTimeout(() => {
                          setDonationStep('thankyou');
                        }, 2500);
                      }}
                      title="Click to copy CashApp tag"
                    >
                      {copiedAddress === 'cashapp' ? '✓ Copied!' : '$oooJASONooo'}
                    </div>
                  </div>
                </div>
              </div>

                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <p className="text-sm text-green-400">
                    <strong>Thank you for your support!</strong> Every contribution is deeply appreciated and will be remembered. When the opportunity arises, I am committed to giving back to the community.
                  </p>
                </div>
              </div>

              <Button 
                onClick={() => setSupportOpen(false)}
                className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white"
              >
                Close
              </Button>
            </div>
            ) : (
              // Thank You Screen
              <div className="animate-in slide-in-from-right duration-700 ease-out">
                <div className="text-center space-y-6">
                  {/* Animated Heart */}
                  <div className="relative">
                    <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-pink-500/20 to-red-500/20 flex items-center justify-center animate-pulse">
                      <Heart className="w-10 h-10 text-pink-400 fill-current animate-bounce" />
                    </div>
                    {/* Sparkle Effect */}
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-yellow-400 rounded-full animate-ping"></div>
                    <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-cyan-400 rounded-full animate-ping" style={{animationDelay: '0.5s'}}></div>
                  </div>

                  {/* Thank You Message */}
                  <div className="space-y-3">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent animate-in slide-in-from-bottom duration-500" style={{animationDelay: '0.2s'}}>
                      Thank You!
                    </h2>
                    <p className="text-lg text-gray-300 animate-in slide-in-from-bottom duration-500" style={{animationDelay: '0.4s'}}>
                      Your {selectedDonationType} donation address has been copied
                    </p>
                  </div>

                  {/* Personalized Message */}
                  <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg p-4 space-y-3 animate-in slide-in-from-bottom duration-500" style={{animationDelay: '0.6s'}}>
                    <p className="text-gray-300">
                      Your support means the world to us! 🌟 Every contribution helps fund:
                    </p>
                    <ul className="text-sm text-gray-400 space-y-1 text-left">
                      <li>• Server infrastructure & database operations</li>
                      <li>• Live market data API subscriptions</li>
                      <li>• New feature development</li>
                      <li>• Community growth initiatives</li>
                    </ul>
                  </div>

                  {/* Optional Name Input */}
                  <div className="space-y-3 animate-in slide-in-from-bottom duration-500" style={{animationDelay: '0.8s'}}>
                    <p className="text-sm text-gray-400">Want a personal thank you message? (Optional)</p>
                    <input
                      type="text"
                      placeholder="Your name or handle"
                      value={donorName}
                      onChange={(e) => setDonorName(e.target.value)}
                      className="w-full px-3 py-2 bg-black/30 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {/* Personalized Thank You */}
                  {donorName && (
                    <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-lg p-3 animate-in slide-in-from-bottom duration-500">
                      <p className="text-green-400">
                        <span className="font-semibold">Dear {donorName},</span><br/>
                        Your generosity will be remembered. When Oeconomia thrives, supporters like you will be among the first to benefit from our success. Thank you for believing in our vision!
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 animate-in slide-in-from-bottom duration-500" style={{animationDelay: '1s'}}>
                    <Button 
                      onClick={() => {
                        setDonationStep('addresses');
                        setSelectedDonationType('');
                      }}
                      variant="outline"
                      className="flex-1 border-gray-600 hover:bg-gray-700"
                    >
                      Back to Addresses
                    </Button>
                    <Button 
                      onClick={() => {
                        setSupportOpen(false);
                        setTimeout(() => {
                          setDonationStep('addresses');
                          setSelectedDonationType('');
                          setDonorName('');
                        }, 300);
                      }}
                      className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                      Complete
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
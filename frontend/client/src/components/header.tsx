import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useSimpleWallet } from "@/hooks/use-simple-wallet";
import { 
  Search, 
  Menu, 
  ShoppingCart, 
  User, 
  Wallet,
  Activity,
  Power,
  AlertTriangle
} from "lucide-react";

export default function Header() {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Wallet connection
  const { 
    isConnected, 
    address, 
    isConnecting, 
    isOnCorrectNetwork,
    formatAddress,
    connectWallet,
    disconnectWallet,
    switchToBaseNetwork,
    usdcBalance,
    formatUSDC
  } = useSimpleWallet();

  // Mock current user query
  const { data: currentUser } = useQuery({
    queryKey: ["/api/user/current"],
  });

  // Mock cart items count
  const { data: cartItems } = useQuery({
    queryKey: ["/api/cart/user1"],
  });

  const cartItemsCount = Array.isArray(cartItems) ? cartItems.length : 0;

  const navigation = [
    { name: "Marketplace", href: "/", icon: Activity },
    { name: "Create", href: "/create", icon: User },
    { name: "Dashboard", href: "/dashboard", icon: User },
  ];

  return (
    <header className="fixed top-0 w-full z-50 glass-effect border-b border-gray-800">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center">
              <Activity className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-bold">streamRoll</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`hover:text-primary transition-colors ${
                  location === item.href ? "text-primary" : ""
                }`}
              >
                {item.name}
              </Link>
            ))}
            <Link
              href="/cart"
              className="relative hover:text-primary transition-colors"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartItemsCount > 0 && (
                <Badge className="absolute -top-2 -right-2 bg-primary text-primary-foreground w-5 h-5 flex items-center justify-center p-0 text-xs">
                  {cartItemsCount}
                </Badge>
              )}
            </Link>
          </nav>

          {/* Search Bar */}
          <div className="hidden lg:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search marketplace..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-dark-800 border-gray-700 focus:border-primary"
              />
            </div>
          </div>

          {/* Wallet Section */}
          <div className="flex items-center space-x-4">
            {!isConnected ? (
              <Button 
                onClick={connectWallet}
                disabled={isConnecting}
                className="bg-gradient-to-r from-primary to-orange-600 hover:from-primary/90 hover:to-orange-600/90"
              >
                {isConnecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect Wallet
                  </>
                )}
              </Button>
            ) : (
              <div className="hidden sm:flex items-center space-x-3">
                {!isOnCorrectNetwork && (
                  <Button
                    onClick={switchToBaseNetwork}
                    variant="destructive"
                    size="sm"
                    className="mr-2"
                  >
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    Switch to Base
                  </Button>
                )}
                <div className="bg-dark-800 rounded-lg px-4 py-2 cursor-pointer hover:bg-dark-700 transition-colors group">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center">
                      <Wallet className="text-white w-4 h-4" />
                    </div>
                    <div className="text-sm">
                      <div className="text-gray-300">{formatUSDC(usdcBalance)}</div>
                      <div className="text-xs text-gray-500">{formatAddress(address)}</div>
                    </div>
                    <Button
                      onClick={disconnectWallet}
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    >
                      <Power className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-dark-900 border-gray-800">
                <div className="flex flex-col space-y-4 mt-8">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className="flex items-center space-x-2 p-3 rounded-lg hover:bg-dark-800 transition-colors"
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </Link>
                  ))}
                  <Link
                    href="/cart"
                    className="flex items-center space-x-2 p-3 rounded-lg hover:bg-dark-800 transition-colors"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    <span>Cart ({cartItemsCount})</span>
                  </Link>
                  <div className="pt-4 border-t border-gray-700">
                    {!isConnected ? (
                      <Button 
                        onClick={connectWallet}
                        disabled={isConnecting}
                        className="w-full bg-gradient-to-r from-primary to-orange-600 hover:from-primary/90 hover:to-orange-600/90"
                      >
                        {isConnecting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Wallet className="w-4 h-4 mr-2" />
                            Connect Wallet
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        {!isOnCorrectNetwork && (
                          <Button
                            onClick={switchToBaseNetwork}
                            variant="destructive"
                            size="sm"
                            className="w-full"
                          >
                            <AlertTriangle className="w-4 h-4 mr-1" />
                            Switch to Base Network
                          </Button>
                        )}
                        <div className="flex items-center space-x-3 p-3 bg-dark-800 rounded-lg">
                          <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center">
                            <Wallet className="text-white w-4 h-4" />
                          </div>
                          <div className="text-sm flex-1">
                            <div>{formatUSDC(usdcBalance)}</div>
                            <div className="text-xs text-gray-500">{formatAddress(address)}</div>
                          </div>
                          <Button
                            onClick={disconnectWallet}
                            variant="ghost"
                            size="sm"
                          >
                            <Power className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

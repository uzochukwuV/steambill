import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MARKETPLACE_FEE_RATE, PROTOCOL_FEE_RATE } from "@/lib/types";
import { Link } from "wouter";
import { 
  ShoppingCart, 
  Minus, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  CreditCard, 
  Shield,
  Wallet
} from "lucide-react";

interface CartItemWithListing {
  id: string;
  quantity: number;
  listing: {
    id: string;
    title: string;
    price: string;
    currency: string;
    itemType: string;
    images: string[];
  };
}

export default function Cart() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState("preapproved");

  const { data: cartItems = [], isLoading } = useQuery<CartItemWithListing[]>({
    queryKey: ["/api/cart/user1"],
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const response = await apiRequest("PATCH", `/api/cart/${id}`, { quantity });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart/user1"] });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/cart/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart/user1"] });
      toast({
        title: "Item removed",
        description: "Item has been removed from your cart.",
      });
    },
  });

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) return;
    updateQuantityMutation.mutate({ id, quantity });
  };

  const removeItem = (id: string) => {
    removeItemMutation.mutate(id);
  };

  // Calculate totals
  const subtotal = cartItems.reduce((total, item) => {
    return total + (parseFloat(item.listing.price) * item.quantity);
  }, 0);

  const marketplaceFee = subtotal * MARKETPLACE_FEE_RATE;
  const protocolFee = subtotal * PROTOCOL_FEE_RATE;
  const gasEstimate = 15; // Mock gas estimate
  const total = subtotal + marketplaceFee + protocolFee + gasEstimate;

  const getItemTypeColor = (itemType: string) => {
    switch (itemType) {
      case "physical":
        return "bg-blue-500";
      case "erc721":
        return "bg-purple-500";
      case "erc1155":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const getItemTypeLabel = (itemType: string) => {
    switch (itemType) {
      case "physical":
        return "Physical";
      case "erc721":
        return "ERC721";
      case "erc1155":
        return "ERC1155";
      default:
        return itemType;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-20 pb-20 bg-dark-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-gray-700 rounded w-1/3"></div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-32 bg-gray-700 rounded"></div>
                  ))}
                </div>
                <div className="h-96 bg-gray-700 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen pt-20 pb-20 bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <ShoppingCart className="w-24 h-24 text-gray-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">Your cart is empty</h2>
          <p className="text-gray-400 mb-8">Start shopping to add items to your cart</p>
          <Link href="/">
            <Button size="lg" className="bg-primary hover:bg-primary/90">
              <ArrowLeft className="mr-2 w-4 h-4" />
              Continue Shopping
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-20 bg-dark-900">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl font-bold text-center mb-12">
              <span className="text-gradient">Shopping Cart</span>
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cart Items */}
              <div className="lg:col-span-2 space-y-4">
                {cartItems.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="bg-dark-800 border-gray-700">
                      <CardContent className="p-6">
                        <div className="flex flex-col sm:flex-row items-start space-y-4 sm:space-y-0 sm:space-x-4">
                          <img
                            src={item.listing.images[0] || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43"}
                            alt={item.listing.title}
                            className="w-20 h-20 rounded-lg object-cover"
                          />
                          <div className="flex-1">
                            <h3 className="font-semibold mb-1">{item.listing.title}</h3>
                            <div className="flex items-center space-x-4 mb-2">
                              <Badge className={`${getItemTypeColor(item.listing.itemType)} text-white text-xs`}>
                                {getItemTypeLabel(item.listing.itemType)}
                              </Badge>
                              <span className="text-primary font-medium">
                                {item.listing.price} {item.listing.currency}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            {item.listing.itemType === "physical" ? (
                              <div className="flex items-center border border-gray-700 rounded-lg">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="p-2 hover:bg-dark-900"
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  disabled={item.quantity <= 1}
                                >
                                  <Minus className="w-4 h-4" />
                                </Button>
                                <span className="px-4 py-2">{item.quantity}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="p-2 hover:bg-dark-900"
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <span className="px-4 py-2 text-gray-400">Unique</span>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="p-2 text-red-500 hover:text-red-400"
                              onClick={() => removeItem(item.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}

                {/* Continue Shopping */}
                <div className="text-center pt-4">
                  <Link href="/">
                    <Button variant="ghost" className="text-primary hover:text-primary/80">
                      <ArrowLeft className="mr-2 w-4 h-4" />
                      Continue Shopping
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <Card className="bg-dark-800 border-gray-700 sticky top-24">
                  <CardHeader>
                    <CardTitle className="text-xl">Order Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Items Summary */}
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Subtotal ({cartItems.length} items)</span>
                        <span>${subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Marketplace Fee (2.5%)</span>
                        <span>${marketplaceFee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Protocol Fee (0.25%)</span>
                        <span>${protocolFee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Gas Estimate</span>
                        <span>~${gasEstimate.toFixed(2)}</span>
                      </div>
                      <div className="border-t border-gray-700 pt-3 flex justify-between text-lg font-semibold">
                        <span>Total</span>
                        <span className="text-primary">${total.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Payment Method Selection */}
                    <div>
                      <Label className="text-sm font-medium mb-3 block">Payment Method</Label>
                      <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                        <div className="flex items-center space-x-3 p-3 border border-gray-700 rounded-lg hover:border-primary transition-colors">
                          <RadioGroupItem value="preapproved" id="preapproved" />
                          <Label htmlFor="preapproved" className="flex-1 cursor-pointer">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">Pre-approved USDC</div>
                                <div className="text-sm text-gray-400">Faster checkout</div>
                              </div>
                              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                                <Wallet className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3 p-3 border border-gray-700 rounded-lg hover:border-primary transition-colors">
                          <RadioGroupItem value="permit2" id="permit2" />
                          <Label htmlFor="permit2" className="flex-1 cursor-pointer">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">Permit2 Signature</div>
                                <div className="text-sm text-gray-400">Gas-efficient</div>
                              </div>
                              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                                <CreditCard className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Checkout Button */}
                    <Button 
                      size="lg"
                      className="w-full bg-gradient-to-r from-primary to-orange-secondary hover:from-orange-secondary hover:to-primary transition-all duration-300 hover-glow"
                    >
                      <CreditCard className="mr-2 w-4 h-4" />
                      Complete Purchase
                    </Button>

                    {/* Security Info */}
                    <div className="text-center text-sm text-gray-400">
                      <Shield className="inline w-4 h-4 mr-1" />
                      Secured by blockchain technology
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

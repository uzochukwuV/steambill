import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MARKETPLACE_FEE_RATE, PROTOCOL_FEE_RATE } from "@/lib/types";
import { 
  ShoppingCart, 
  Eye, 
  ExternalLink, 
  Share2, 
  Heart,
  Package,
  Gem,
  Layers
} from "lucide-react";
import type { Listing } from "@shared/schema";

export default function ListingDetails() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: listing, isLoading } = useQuery<Listing>({
    queryKey: ["/api/listings", params.id],
  });

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      if (!listing) throw new Error("No listing found");
      const response = await apiRequest("POST", "/api/cart", {
        userId: "user1",
        listingId: listing.id,
        quantity: 1,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart/user1"] });
      toast({
        title: "Added to cart!",
        description: "Item has been added to your cart.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add item to cart.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen pt-20 pb-20 bg-dark-900">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="animate-pulse grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="aspect-square bg-gray-700 rounded-lg"></div>
              <div className="space-y-6">
                <div className="h-8 bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                <div className="h-24 bg-gray-700 rounded"></div>
                <div className="h-12 bg-gray-700 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen pt-20 pb-20 bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Listing not found</h2>
          <p className="text-gray-400">The listing you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const price = parseFloat(listing.price);
  const marketplaceFee = price * MARKETPLACE_FEE_RATE;
  const protocolFee = price * PROTOCOL_FEE_RATE;
  const gasEstimate = 15;
  const totalCost = price + marketplaceFee + protocolFee + gasEstimate;

  const getItemTypeIcon = (itemType: string) => {
    switch (itemType) {
      case "physical":
        return Package;
      case "erc721":
        return Gem;
      case "erc1155":
        return Layers;
      default:
        return Package;
    }
  };

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

  const ItemTypeIcon = getItemTypeIcon(listing.itemType);

  return (
    <div className="min-h-screen pt-20 pb-20 bg-dark-900">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-12"
          >
            {/* Image Gallery */}
            <div className="space-y-4">
              <div className="aspect-square rounded-lg overflow-hidden bg-dark-800">
                <img
                  src={listing.images[0] || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43"}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />
              </div>
              {listing.images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {listing.images.slice(1, 5).map((image, index) => (
                    <div key={index} className="aspect-square rounded-lg overflow-hidden bg-dark-800">
                      <img
                        src={image}
                        alt={`${listing.title} ${index + 2}`}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Listing Details */}
            <div className="space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Badge className={`${getItemTypeColor(listing.itemType)} text-white`}>
                    <ItemTypeIcon className="mr-1 w-3 h-3" />
                    {getItemTypeLabel(listing.itemType)}
                  </Badge>
                  <div className="flex items-center space-x-2 text-gray-400">
                    <Eye className="w-4 h-4" />
                    <span>{listing.views} views</span>
                  </div>
                </div>
                <h1 className="text-3xl font-bold mb-2">{listing.title}</h1>
                <div className="text-2xl font-bold text-primary">
                  {listing.price} {listing.currency}
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Description</h3>
                <p className="text-gray-300 leading-relaxed">{listing.description}</p>
              </div>

              {/* NFT Details */}
              {(listing.itemType === "erc721" || listing.itemType === "erc1155") && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">NFT Details</h3>
                  <div className="bg-dark-800 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Contract Address</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm">{listing.contractAddress}</span>
                        <Button size="sm" variant="ghost" className="p-1">
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Token ID</span>
                      <span className="font-mono">{listing.tokenId}</span>
                    </div>
                    {listing.itemType === "erc1155" && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Supply</span>
                        <span>{listing.supply}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Cost Breakdown */}
              <Card className="bg-dark-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg">Cost Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Item Price</span>
                      <span>{listing.price} {listing.currency}</span>
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
                    <Separator className="bg-gray-700" />
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Total Cost</span>
                      <span className="text-primary">${totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <Button
                  size="lg"
                  className="flex-1 bg-gradient-to-r from-primary to-orange-secondary hover:from-orange-secondary hover:to-primary transition-all duration-300 hover-glow"
                  onClick={() => addToCartMutation.mutate()}
                  disabled={addToCartMutation.isPending}
                >
                  <ShoppingCart className="mr-2 w-4 h-4" />
                  {listing.itemType === "physical" ? "Add to Cart" : "Buy Now"}
                </Button>
                <Button size="lg" variant="outline" className="border-gray-700 hover:border-primary">
                  <Heart className="w-4 h-4" />
                </Button>
                <Button size="lg" variant="outline" className="border-gray-700 hover:border-primary">
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Seller Info */}
              <div className="bg-dark-800 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center">
                    <span className="text-white font-semibold">S</span>
                  </div>
                  <div>
                    <div className="font-medium">Seller</div>
                    <div className="text-sm text-gray-400">Member since 2024</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

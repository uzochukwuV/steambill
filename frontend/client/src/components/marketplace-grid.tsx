import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Eye, ShoppingCart, Package, Gem, Layers } from "lucide-react";
import type { Listing } from "@shared/schema";

const filterOptions = [
  { label: "All Items", value: "all", icon: null },
  { label: "Physical", value: "physical", icon: Package },
  { label: "ERC721 NFTs", value: "erc721", icon: Gem },
  { label: "ERC1155", value: "erc1155", icon: Layers },
];

export default function MarketplaceGrid() {
  const [activeFilter, setActiveFilter] = useState("all");

  const { data: listings = [], isLoading } = useQuery<Listing[]>({
    queryKey: ["/api/listings"],
  });

  const filteredListings = listings.filter(
    (listing) => activeFilter === "all" || listing.itemType === activeFilter
  );

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
      <section className="py-20 bg-dark-800">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="bg-dark-900 animate-pulse">
                <div className="w-full h-48 bg-gray-700 rounded-t-lg"></div>
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-700 rounded mb-2"></div>
                  <div className="h-4 bg-gray-700 rounded w-2/3 mb-4"></div>
                  <div className="h-8 bg-gray-700 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-dark-800">
      <div className="container mx-auto px-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8 justify-center">
          {filterOptions.map((option) => (
            <Button
              key={option.value}
              onClick={() => setActiveFilter(option.value)}
              variant={activeFilter === option.value ? "default" : "outline"}
              className={`${
                activeFilter === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-dark-900 border-gray-700 hover:bg-primary hover:text-primary-foreground"
              } transition-all duration-300`}
            >
              {option.icon && <option.icon className="mr-2 w-4 h-4" />}
              {option.label}
            </Button>
          ))}
        </div>

        {/* Marketplace Grid */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          layout
        >
          {filteredListings.map((listing, index) => (
            <motion.div
              key={listing.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="group"
            >
              <Card className="bg-dark-900 border-gray-800 overflow-hidden hover-glow transition-all duration-300 group-hover:border-primary/50">
                <Link href={`/listing/${listing.id}`}>
                  <div className="relative">
                    <img
                      src={listing.images[0] || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43"}
                      alt={listing.title}
                      className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute top-4 right-4 flex items-center space-x-1 bg-black/50 rounded-full px-2 py-1 text-xs">
                      <Eye className="w-3 h-3" />
                      <span>{listing.views}</span>
                    </div>
                  </div>
                </Link>
                
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={`${getItemTypeColor(listing.itemType)} text-white text-xs`}>
                      {getItemTypeLabel(listing.itemType)}
                    </Badge>
                    <span className="text-primary font-bold">
                      {listing.price} {listing.currency}
                    </span>
                  </div>
                  
                  <Link href={`/listing/${listing.id}`}>
                    <h3 className="text-lg font-semibold mb-2 hover:text-primary transition-colors cursor-pointer">
                      {listing.title}
                    </h3>
                  </Link>
                  
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                    {listing.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-400 to-pink-400"></div>
                      <span className="text-sm text-gray-400">Seller</span>
                      {listing.itemType !== "physical" && listing.supply && listing.supply > 1 && (
                        <Badge variant="secondary" className="text-xs">
                          x{listing.supply}
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90 transition-colors"
                    >
                      <ShoppingCart className="mr-1 w-3 h-3" />
                      {listing.itemType === "physical" ? "Add to Cart" : "Buy Now"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {filteredListings.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No items found for the selected filter.</p>
          </div>
        )}

        {/* Load More Button */}
        <div className="text-center mt-12">
          <Button
            variant="outline"
            size="lg"
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300"
          >
            Load More Items
          </Button>
        </div>
      </div>
    </section>
  );
}

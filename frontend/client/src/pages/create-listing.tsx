import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertListingSchema, type InsertListing } from "@shared/schema";
import { Package, Gem, Layers, Plus, CloudUpload, DollarSign } from "lucide-react";
import { useLocation } from "wouter";
import { WalletStatus } from "@/components/web3/wallet-status";
import { useSimpleWallet } from "@/hooks/use-simple-wallet";

const itemTypes = [
  { value: "physical", label: "Physical", icon: Package, description: "Physical goods" },
  { value: "erc721", label: "ERC721", icon: Gem, description: "Unique NFTs" },
  { value: "erc1155", label: "ERC1155", icon: Layers, description: "Multi-edition items" },
];

const categories = [
  "Electronics",
  "Fashion",
  "Art",
  "Gaming",
  "Collectibles",
  "Books",
  "Sports",
  "Music",
  "Other",
];

export default function CreateListing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedItemType, setSelectedItemType] = useState("physical");
  const { isConnected, isOnCorrectNetwork } = useSimpleWallet();

  const form = useForm<InsertListing>({
    resolver: zodResolver(insertListingSchema),
    defaultValues: {
      title: "",
      description: "",
      price: "0",
      currency: "USDC",
      category: "Electronics",
      itemType: "physical",
      images: [],
      contractAddress: "",
      tokenId: "",
      supply: 1,
      sellerId: "user1", // Mock user ID
    },
  });

  const createListingMutation = useMutation({
    mutationFn: async (data: InsertListing) => {
      const response = await apiRequest("POST", "/api/listings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      toast({
        title: "Success!",
        description: "Your listing has been created successfully.",
      });
      setLocation("/dashboard");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create listing. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertListing) => {
    createListingMutation.mutate(data);
  };

  const watchedValues = form.watch();
  const price = parseFloat(watchedValues.price || "0");
  const marketplaceFee = price * 0.025; // 2.5% marketplace fee
  const protocolFee = price * 0.0025; // 0.25% protocol fee
  const youReceive = price - marketplaceFee - protocolFee;

  return (
    <div className="min-h-screen pt-20 pb-20 bg-dark-900">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl font-bold text-center mb-12">
              <span className="text-gradient">Create New Listing</span>
            </h1>

            {/* Wallet Status */}
            <WalletStatus />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Form Section */}
              <Card className="bg-dark-800 border-gray-700">
                <CardContent className="p-6">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      {/* Item Type Selection */}
                      <div>
                        <FormLabel className="text-base font-medium mb-3 block">Item Type</FormLabel>
                        <div className="grid grid-cols-3 gap-3">
                          {itemTypes.map((type) => (
                            <Button
                              key={type.value}
                              type="button"
                              variant={selectedItemType === type.value ? "default" : "outline"}
                              className={`h-auto p-4 flex-col space-y-2 ${
                                selectedItemType === type.value
                                  ? "bg-primary border-primary"
                                  : "border-gray-700 hover:border-primary"
                              }`}
                              onClick={() => {
                                setSelectedItemType(type.value);
                                form.setValue("itemType", type.value);
                              }}
                            >
                              <type.icon className="w-6 h-6" />
                              <span className="text-sm font-medium">{type.label}</span>
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Basic Information */}
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter item title" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description *</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Describe your item in detail" 
                                rows={4}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="price"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Price *</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input 
                                    type="number" 
                                    placeholder="0.00" 
                                    step="0.01"
                                    {...field} 
                                  />
                                  <div className="absolute right-3 top-3 text-gray-400 text-sm">
                                    {selectedItemType === "physical" ? "USD" : "ETH"}
                                  </div>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {categories.map((category) => (
                                    <SelectItem key={category} value={category}>
                                      {category}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* NFT Specific Fields */}
                      {(selectedItemType === "erc721" || selectedItemType === "erc1155") && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="space-y-4"
                        >
                          <FormField
                            control={form.control}
                            name="contractAddress"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Contract Address</FormLabel>
                                <FormControl>
                                  <Input placeholder="0x..." {...field} value={field.value || ""} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="tokenId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Token ID</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter token ID" {...field} value={field.value || ""} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {selectedItemType === "erc1155" && (
                            <FormField
                              control={form.control}
                              name="supply"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Supply</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      placeholder="Enter supply amount" 
                                      {...field}
                                      value={field.value || 1}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </motion.div>
                      )}

                      {/* Image Upload Placeholder */}
                      <div>
                        <FormLabel className="text-base font-medium mb-2 block">Images *</FormLabel>
                        <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                          <CloudUpload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-400 mb-2">Drag and drop images here, or click to select</p>
                          <p className="text-sm text-gray-500">PNG, JPG, GIF up to 10MB</p>
                        </div>
                      </div>

                      {/* Submit Button */}
                      <Button 
                        type="submit" 
                        size="lg"
                        className="w-full bg-gradient-to-r from-primary to-orange-secondary hover:from-orange-secondary hover:to-primary transition-all duration-300 hover-glow"
                        disabled={createListingMutation.isPending || (!isConnected || !isOnCorrectNetwork)}
                      >
                        {createListingMutation.isPending ? (
                          "Creating..."
                        ) : (
                          <>
                            <Plus className="mr-2 w-4 h-4" />
                            Create Listing
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {/* Preview Section */}
              <div className="lg:sticky lg:top-24 space-y-6">
                <Card className="bg-dark-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-xl">Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-dark-900 rounded-xl overflow-hidden">
                      <img
                        src="https://images.unsplash.com/photo-1560472354-b33ff0c44a43"
                        alt="Preview"
                        className="w-full h-48 object-cover"
                      />
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={`text-white text-xs ${
                            selectedItemType === "physical" ? "bg-blue-500" :
                            selectedItemType === "erc721" ? "bg-purple-500" : 
                            "bg-green-500"
                          }`}>
                            {itemTypes.find(t => t.value === selectedItemType)?.label}
                          </Badge>
                          <span className="text-primary font-bold">
                            {watchedValues.price || "0.00"} {selectedItemType === "physical" ? "USD" : "ETH"}
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold mb-2">
                          {watchedValues.title || "Item Title"}
                        </h3>
                        <p className="text-gray-400 text-sm mb-4">
                          {watchedValues.description || "Item description will appear here..."}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 rounded-full gradient-bg"></div>
                            <span className="text-sm text-gray-400">You</span>
                          </div>
                          <Button size="sm" disabled>
                            Preview
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Fee Breakdown */}
                <Card className="bg-dark-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg">Fee Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Item Price</span>
                        <span>${price.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Marketplace Fee (2.5%)</span>
                        <span>${marketplaceFee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Protocol Fee (0.25%)</span>
                        <span>${protocolFee.toFixed(2)}</span>
                      </div>
                      <div className="border-t border-gray-700 pt-2 flex justify-between font-medium">
                        <span>You Receive</span>
                        <span className="text-primary">${youReceive.toFixed(2)}</span>
                      </div>
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

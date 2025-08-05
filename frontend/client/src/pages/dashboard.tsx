import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";
import { Plus, Edit, Trash2, TrendingUp, Eye, ShoppingBag, Star } from "lucide-react";
import type { Listing } from "@shared/schema";

const analyticsData = [
  { label: "Total Sales", value: "$4,567", change: "+12%", positive: true, icon: TrendingUp },
  { label: "Total Views", value: "2,341", change: "+8%", positive: true, icon: Eye },
  { label: "Active Listings", value: "23", change: "-3%", positive: false, icon: ShoppingBag },
  { label: "Avg Rating", value: "4.8", change: "+2%", positive: true, icon: Star },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("listings");

  const { data: userListings = [], isLoading } = useQuery<Listing[]>({
    queryKey: ["/api/listings", { sellerId: "user1" }],
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500 text-white">Active</Badge>;
      case "sold":
        return <Badge className="bg-blue-500 text-white">Sold</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500 text-white">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-20 pb-20 bg-dark-900">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-gray-700 rounded w-1/3"></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 bg-gray-700 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
              <span className="text-gradient">Dashboard</span>
            </h1>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
              <TabsList className="grid w-full grid-cols-4 bg-dark-800">
                <TabsTrigger value="listings" className="data-[state=active]:bg-primary">
                  My Listings
                </TabsTrigger>
                <TabsTrigger value="purchases" className="data-[state=active]:bg-primary">
                  Purchases
                </TabsTrigger>
                <TabsTrigger value="activity" className="data-[state=active]:bg-primary">
                  Activity
                </TabsTrigger>
                <TabsTrigger value="analytics" className="data-[state=active]:bg-primary">
                  Analytics
                </TabsTrigger>
              </TabsList>

              {/* Listings Tab */}
              <TabsContent value="listings" className="space-y-6">
                <Card className="bg-dark-800 border-gray-700">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <CardTitle className="text-xl">Your Listings</CardTitle>
                      <Link href="/create">
                        <Button className="bg-primary hover:bg-primary/90">
                          <Plus className="mr-2 w-4 h-4" />
                          New Listing
                        </Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-gray-700">
                            <TableHead>Item</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Views</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userListings.map((listing) => (
                            <TableRow key={listing.id} className="border-gray-700">
                              <TableCell>
                                <div className="flex items-center space-x-3">
                                  <img
                                    src={listing.images[0] || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43"}
                                    alt={listing.title}
                                    className="w-12 h-12 rounded-lg object-cover"
                                  />
                                  <div>
                                    <div className="font-medium">{listing.title}</div>
                                    <div className="text-sm text-gray-400 capitalize">
                                      {listing.itemType} Item
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">
                                {listing.price} {listing.currency}
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(listing.status)}
                              </TableCell>
                              <TableCell className="text-gray-400">{listing.views}</TableCell>
                              <TableCell className="text-gray-400">
                                {formatDate(listing.createdAt)}
                              </TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button size="sm" variant="ghost" className="text-primary hover:text-primary/80">
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-400">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Analytics Tab */}
              <TabsContent value="analytics" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {analyticsData.map((item, index) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <Card className="bg-dark-800 border-gray-700">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <item.icon className="w-8 h-8 text-primary" />
                            <span className={`text-sm ${
                              item.positive ? "text-green-400" : "text-red-400"
                            }`}>
                              {item.change}
                            </span>
                          </div>
                          <div className="text-2xl font-bold mb-1">{item.value}</div>
                          <div className="text-gray-400 text-sm">{item.label}</div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </TabsContent>

              {/* Purchases Tab */}
              <TabsContent value="purchases" className="space-y-6">
                <Card className="bg-dark-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-xl">Purchase History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <ShoppingBag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400 text-lg">No purchases yet</p>
                      <p className="text-gray-500 text-sm">Your purchase history will appear here</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent value="activity" className="space-y-6">
                <Card className="bg-dark-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-xl">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400 text-lg">No recent activity</p>
                      <p className="text-gray-500 text-sm">Your transaction history will appear here</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

import { type User, type InsertUser, type Listing, type InsertListing, type CartItem, type InsertCartItem, type Transaction, type InsertTransaction } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Listings
  getListing(id: string): Promise<Listing | undefined>;
  getListings(filters?: { category?: string; itemType?: string; sellerId?: string }): Promise<Listing[]>;
  createListing(listing: InsertListing): Promise<Listing>;
  updateListing(id: string, updates: Partial<Listing>): Promise<Listing | undefined>;
  deleteListing(id: string): Promise<boolean>;
  incrementListingViews(id: string): Promise<void>;
  
  // Cart
  getCartItems(userId: string): Promise<(CartItem & { listing: Listing })[]>;
  addToCart(cartItem: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: string, quantity: number): Promise<CartItem | undefined>;
  removeFromCart(id: string): Promise<boolean>;
  clearCart(userId: string): Promise<void>;
  
  // Transactions
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionsByUser(userId: string): Promise<(Transaction & { listing: Listing })[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransactionStatus(id: string, status: string, txHash?: string): Promise<Transaction | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private listings: Map<string, Listing> = new Map();
  private cartItems: Map<string, CartItem> = new Map();
  private transactions: Map<string, Transaction> = new Map();

  constructor() {
    this.initializeData();
  }

  private initializeData() {
    // Create sample users
    const user1: User = {
      id: "user1",
      username: "streamroll_user",
      email: "user@streamroll.com",
      walletAddress: "0x742d35cc6bb3c0532925a3b8b98eee5ea1234f2e",
      avatar: null,
      createdAt: new Date(),
    };
    
    this.users.set(user1.id, user1);

    // Create sample listings
    const listings: Listing[] = [
      {
        id: "listing1",
        title: "Premium Wireless Headphones",
        description: "High-quality audio with noise cancellation and 30-hour battery life.",
        price: "299.99",
        currency: "USD",
        category: "Electronics",
        itemType: "physical",
        images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e"],
        contractAddress: null,
        tokenId: null,
        supply: 1,
        sellerId: user1.id,
        status: "active",
        views: 127,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "listing2",
        title: "Cyber Dreams #4521",
        description: "Unique digital artwork exploring the intersection of technology and consciousness.",
        price: "0.5",
        currency: "ETH",
        category: "Art",
        itemType: "erc721",
        images: ["https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe"],
        contractAddress: "0x1234567890123456789012345678901234567890",
        tokenId: "4521",
        supply: 1,
        sellerId: user1.id,
        status: "active",
        views: 89,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "listing3",
        title: "Legendary Gaming Weapon",
        description: "Rare in-game weapon with unique stats and visual effects.",
        price: "45.00",
        currency: "USD",
        category: "Gaming",
        itemType: "erc1155",
        images: ["https://images.unsplash.com/photo-1593305841991-05c297ba4575"],
        contractAddress: "0x9876543210987654321098765432109876543210",
        tokenId: "123",
        supply: 500,
        sellerId: user1.id,
        status: "active",
        views: 45,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    listings.forEach(listing => this.listings.set(listing.id, listing));
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  // Listings
  async getListing(id: string): Promise<Listing | undefined> {
    return this.listings.get(id);
  }

  async getListings(filters?: { category?: string; itemType?: string; sellerId?: string }): Promise<Listing[]> {
    let listings = Array.from(this.listings.values()).filter(listing => listing.status === "active");
    
    if (filters?.category) {
      listings = listings.filter(listing => listing.category.toLowerCase() === filters.category!.toLowerCase());
    }
    
    if (filters?.itemType) {
      listings = listings.filter(listing => listing.itemType === filters.itemType);
    }
    
    if (filters?.sellerId) {
      listings = listings.filter(listing => listing.sellerId === filters.sellerId);
    }
    
    return listings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createListing(insertListing: InsertListing): Promise<Listing> {
    const id = randomUUID();
    const listing: Listing = {
      ...insertListing,
      id,
      status: "active",
      views: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.listings.set(id, listing);
    return listing;
  }

  async updateListing(id: string, updates: Partial<Listing>): Promise<Listing | undefined> {
    const listing = this.listings.get(id);
    if (!listing) return undefined;
    
    const updatedListing = {
      ...listing,
      ...updates,
      updatedAt: new Date(),
    };
    this.listings.set(id, updatedListing);
    return updatedListing;
  }

  async deleteListing(id: string): Promise<boolean> {
    return this.listings.delete(id);
  }

  async incrementListingViews(id: string): Promise<void> {
    const listing = this.listings.get(id);
    if (listing) {
      listing.views = (listing.views || 0) + 1;
      this.listings.set(id, listing);
    }
  }

  // Cart
  async getCartItems(userId: string): Promise<(CartItem & { listing: Listing })[]> {
    const userCartItems = Array.from(this.cartItems.values())
      .filter(item => item.userId === userId);
    
    const itemsWithListings = userCartItems.map(item => {
      const listing = this.listings.get(item.listingId);
      if (!listing) throw new Error(`Listing not found: ${item.listingId}`);
      return { ...item, listing };
    });
    
    return itemsWithListings;
  }

  async addToCart(insertCartItem: InsertCartItem): Promise<CartItem> {
    // Check if item already exists in cart
    const existingItem = Array.from(this.cartItems.values())
      .find(item => item.userId === insertCartItem.userId && item.listingId === insertCartItem.listingId);
    
    if (existingItem) {
      // Update quantity
      existingItem.quantity += insertCartItem.quantity;
      this.cartItems.set(existingItem.id, existingItem);
      return existingItem;
    }
    
    const id = randomUUID();
    const cartItem: CartItem = {
      ...insertCartItem,
      id,
      createdAt: new Date(),
    };
    this.cartItems.set(id, cartItem);
    return cartItem;
  }

  async updateCartItem(id: string, quantity: number): Promise<CartItem | undefined> {
    const item = this.cartItems.get(id);
    if (!item) return undefined;
    
    item.quantity = quantity;
    this.cartItems.set(id, item);
    return item;
  }

  async removeFromCart(id: string): Promise<boolean> {
    return this.cartItems.delete(id);
  }

  async clearCart(userId: string): Promise<void> {
    const userItems = Array.from(this.cartItems.entries())
      .filter(([_, item]) => item.userId === userId);
    
    userItems.forEach(([id, _]) => this.cartItems.delete(id));
  }

  // Transactions
  async getTransaction(id: string): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async getTransactionsByUser(userId: string): Promise<(Transaction & { listing: Listing })[]> {
    const userTransactions = Array.from(this.transactions.values())
      .filter(tx => tx.buyerId === userId || tx.sellerId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    const transactionsWithListings = userTransactions.map(tx => {
      const listing = this.listings.get(tx.listingId);
      if (!listing) throw new Error(`Listing not found: ${tx.listingId}`);
      return { ...tx, listing };
    });
    
    return transactionsWithListings;
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = randomUUID();
    const transaction: Transaction = {
      ...insertTransaction,
      id,
      createdAt: new Date(),
    };
    this.transactions.set(id, transaction);
    return transaction;
  }

  async updateTransactionStatus(id: string, status: string, txHash?: string): Promise<Transaction | undefined> {
    const transaction = this.transactions.get(id);
    if (!transaction) return undefined;
    
    transaction.status = status;
    if (txHash) transaction.txHash = txHash;
    this.transactions.set(id, transaction);
    return transaction;
  }
}

export const storage = new MemStorage();

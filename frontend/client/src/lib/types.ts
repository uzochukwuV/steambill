export interface MarketplaceStats {
  totalItems: number;
  totalUsers: number;
  totalVolume: string;
  totalTransactions: number;
}

export interface FilterState {
  category?: string;
  itemType?: string;
  priceRange?: [number, number];
  sortBy?: 'price' | 'date' | 'popularity';
}

export interface FeeBreakdown {
  itemPrice: number;
  marketplaceFee: number;
  protocolFee: number;
  gasEstimate: number;
  total: number;
}

export const MARKETPLACE_FEE_RATE = 0.025; // 2.5%
export const PROTOCOL_FEE_RATE = 0.0025; // 0.25%

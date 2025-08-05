import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { MarketplaceHelper, type ListingData, type PaymentIntent } from '@/lib/web3/marketplace-helper';
import { useToast } from '@/hooks/use-toast';
import { ethers } from 'ethers';

interface MarketplaceTransaction {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  type: 'create_listing' | 'purchase' | 'approve_usdc';
}

export function useMarketplace() {
  const { provider, signer, isConnected, address } = useWallet();
  const [marketplaceHelper, setMarketplaceHelper] = useState<MarketplaceHelper | null>(null);
  const [transactions, setTransactions] = useState<MarketplaceTransaction[]>([]);
  const [usdcBalance, setUsdcBalance] = useState<string>('0');
  const [usdcAllowance, setUsdcAllowance] = useState<string>('0');
  const { toast } = useToast();

  // Initialize marketplace helper when wallet connects
  useEffect(() => {
    if (provider && isConnected) {
      const helper = new MarketplaceHelper(provider, signer || undefined);
      setMarketplaceHelper(helper);
      
      // Load USDC status
      if (address) {
        loadUSDCStatus();
      }
    } else {
      setMarketplaceHelper(null);
    }
  }, [provider, signer, isConnected, address]);

  const loadUSDCStatus = async () => {
    if (!marketplaceHelper || !address) return;

    try {
      const status = await marketplaceHelper.checkUSDCStatus(address);
      setUsdcBalance(status.balance);
      setUsdcAllowance(status.allowance);
    } catch (error) {
      console.error('Failed to load USDC status:', error);
    }
  };

  const addTransaction = (hash: string, type: MarketplaceTransaction['type']) => {
    const transaction: MarketplaceTransaction = {
      hash,
      status: 'pending',
      type
    };
    
    setTransactions(prev => [...prev, transaction]);
    
    // Monitor transaction status
    if (provider) {
      provider.waitForTransaction(hash).then(receipt => {
        setTransactions(prev => 
          prev.map(tx => 
            tx.hash === hash 
              ? { ...tx, status: receipt?.status === 1 ? 'confirmed' : 'failed' }
              : tx
          )
        );
        
        if (receipt?.status === 1) {
          // Reload USDC status after successful transaction
          loadUSDCStatus();
        }
      }).catch(() => {
        setTransactions(prev => 
          prev.map(tx => 
            tx.hash === hash 
              ? { ...tx, status: 'failed' }
              : tx
          )
        );
      });
    }
  };

  const createListing = async (listingData: ListingData) => {
    if (!marketplaceHelper || !signer) {
      throw new Error('Marketplace not initialized or wallet not connected');
    }

    try {
      const tx = await marketplaceHelper.createListing(listingData);
      
      addTransaction(tx.hash, 'create_listing');
      
      toast({
        title: "Transaction Submitted",
        description: "Your listing is being created on the blockchain.",
      });

      const receipt = await tx.wait();
      
      if (receipt?.status === 1) {
        toast({
          title: "Listing Created",
          description: "Your listing has been successfully created!",
        });
        
        // Extract listing ID from transaction logs if needed
        // You could parse the logs to get the actual listing ID
        return receipt;
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error: any) {
      toast({
        title: "Failed to Create Listing",
        description: error.message || "Unknown error occurred",
        variant: "destructive"
      });
      throw error;
    }
  };

  const approveUSDC = async (amount: number) => {
    if (!marketplaceHelper || !signer) {
      throw new Error('Marketplace not initialized or wallet not connected');
    }

    try {
      const tx = await marketplaceHelper.approveUSDC(amount);
      
      addTransaction(tx.hash, 'approve_usdc');
      
      toast({
        title: "Approval Submitted",
        description: "USDC approval transaction submitted.",
      });

      const receipt = await tx.wait();
      
      if (receipt?.status === 1) {
        toast({
          title: "USDC Approved",
          description: "USDC spending has been approved!",
        });
        
        // Update allowance
        await loadUSDCStatus();
        return receipt;
      } else {
        throw new Error('Approval failed');
      }
    } catch (error: any) {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve USDC",
        variant: "destructive"
      });
      throw error;
    }
  };

  const purchaseItem = async (listingId: string, quantity: number = 1) => {
    if (!marketplaceHelper || !signer || !address) {
      throw new Error('Marketplace not initialized or wallet not connected');
    }

    try {
      const result = await marketplaceHelper.completePurchaseWithPreApproval(listingId, quantity);
      
      addTransaction(result.transaction.hash, 'purchase');
      
      toast({
        title: "Purchase Submitted",
        description: "Your purchase is being processed on the blockchain.",
      });

      const receipt = await result.transaction.wait();
      
      if (receipt?.status === 1) {
        toast({
          title: "Purchase Successful",
          description: "Your purchase has been completed!",
        });
        
        return { receipt, paymentIntent: result.paymentIntent };
      } else {
        throw new Error('Purchase failed');
      }
    } catch (error: any) {
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to complete purchase",
        variant: "destructive"
      });
      throw error;
    }
  };

  const calculateTotalCost = async (pricePerUnit: number, quantity: number = 1) => {
    if (!marketplaceHelper) {
      return null;
    }

    try {
      return await marketplaceHelper.calculateTotalCost(pricePerUnit, quantity);
    } catch (error) {
      console.error('Failed to calculate total cost:', error);
      return null;
    }
  };

  const checkCanAfford = (amount: number): boolean => {
    const balance = parseFloat(usdcBalance);
    return balance >= amount;
  };

  const checkHasAllowance = (amount: number): boolean => {
    const allowance = parseFloat(usdcAllowance);
    return allowance >= amount;
  };

  const formatUSDC = (amount: string | number): string => {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(value);
  };

  return {
    marketplaceHelper,
    isInitialized: !!marketplaceHelper && isConnected,
    transactions,
    usdcBalance,
    usdcAllowance,
    
    // Actions
    createListing,
    approveUSDC,
    purchaseItem,
    calculateTotalCost,
    loadUSDCStatus,
    
    // Utilities
    checkCanAfford,
    checkHasAllowance,
    formatUSDC,
    
    // Constants
    ITEM_TYPES: {
      PHYSICAL: 0 as const,
      ERC721: 1 as const,
      ERC1155: 2 as const
    }
  };
}
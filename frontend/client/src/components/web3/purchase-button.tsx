import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSimpleWallet } from "@/hooks/use-simple-wallet";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Wallet, AlertTriangle, Loader2 } from "lucide-react";

interface PurchaseButtonProps {
  listingId: string;
  price: number;
  currency: string;
  quantity?: number;
  disabled?: boolean;
  className?: string;
}

export function PurchaseButton({ 
  listingId, 
  price, 
  currency, 
  quantity = 1, 
  disabled = false,
  className = "" 
}: PurchaseButtonProps) {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const { isConnected, isOnCorrectNetwork, connectWallet, switchToBaseNetwork, formatUSDC } = useSimpleWallet();
  const { toast } = useToast();

  // Calculate fees (mock for now)
  const marketplaceFee = price * 0.025; // 2.5%
  const protocolFee = price * 0.0025; // 0.25%
  const totalCost = price + marketplaceFee + protocolFee;

  const handlePurchase = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }

    if (!isOnCorrectNetwork) {
      await switchToBaseNetwork();
      return;
    }

    setIsPurchasing(true);
    
    try {
      // Here we would integrate with the smart contract
      // For now, simulate the purchase process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Purchase Successful!",
        description: `You have successfully purchased the item for ${formatUSDC(totalCost.toString())}.`,
      });
      
      // In a real implementation, this would trigger a refresh of the user's balance
      // and possibly redirect to a confirmation page
      
    } catch (error: any) {
      toast({
        title: "Purchase Failed",
        description: error.message || "Something went wrong during the purchase.",
        variant: "destructive"
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  if (!isConnected) {
    return (
      <Button 
        onClick={handlePurchase}
        className={`w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 ${className}`}
        disabled={disabled}
      >
        <Wallet className="w-4 h-4 mr-2" />
        Connect Wallet to Purchase
      </Button>
    );
  }

  if (!isOnCorrectNetwork) {
    return (
      <Button 
        onClick={handlePurchase}
        variant="destructive"
        className={`w-full ${className}`}
        disabled={disabled}
      >
        <AlertTriangle className="w-4 h-4 mr-2" />
        Switch to Base Network
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      {/* Price Breakdown */}
      <div className="bg-dark-800 rounded-lg p-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Item Price</span>
          <span>{formatUSDC(price.toString())}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Marketplace Fee (2.5%)</span>
          <span>{formatUSDC(marketplaceFee.toString())}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Protocol Fee (0.25%)</span>
          <span>{formatUSDC(protocolFee.toString())}</span>
        </div>
        <hr className="border-gray-700" />
        <div className="flex justify-between font-medium">
          <span>Total</span>
          <span>{formatUSDC(totalCost.toString())}</span>
        </div>
      </div>

      {/* Purchase Button */}
      <Button 
        onClick={handlePurchase}
        className={`w-full bg-gradient-to-r from-primary to-orange-600 hover:from-primary/90 hover:to-orange-600/90 ${className}`}
        disabled={disabled || isPurchasing}
        size="lg"
      >
        {isPurchasing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing Purchase...
          </>
        ) : (
          <>
            <ShoppingCart className="w-4 h-4 mr-2" />
            Buy Now for {formatUSDC(totalCost.toString())}
          </>
        )}
      </Button>

      {currency === "USDC" && (
        <div className="text-center">
          <Badge variant="secondary" className="text-xs">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-1" />
            USDC Payment
          </Badge>
        </div>
      )}
    </div>
  );
}
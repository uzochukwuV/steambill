import { useState, useEffect } from 'react';
import { simpleWallet, type WalletInfo } from '@/lib/web3/simple-wallet';
import { useToast } from '@/hooks/use-toast';

export function useSimpleWallet() {
  const [walletInfo, setWalletInfo] = useState<WalletInfo>({
    address: '',
    chainId: 0,
    isConnected: false
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState('1,234.56'); // Mock balance for now
  const { toast } = useToast();

  useEffect(() => {
    // Check for existing connection on mount
    simpleWallet.checkConnection().then(setWalletInfo);

    // Subscribe to wallet changes
    const unsubscribe = simpleWallet.onWalletChange(setWalletInfo);

    return unsubscribe;
  }, []);

  const connectWallet = async () => {
    if (isConnecting) return;

    setIsConnecting(true);
    try {
      const info = await simpleWallet.connect();
      setWalletInfo(info);
      
      if (!simpleWallet.isOnCorrectNetwork()) {
        toast({
          title: "Wrong Network",
          description: "Please switch to Base network to use the marketplace.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Wallet Connected",
          description: `Connected to ${simpleWallet.formatAddress(info.address)}`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    simpleWallet.disconnect();
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected.",
    });
  };

  const switchToBaseNetwork = async () => {
    try {
      await simpleWallet.switchToBaseNetwork();
      toast({
        title: "Network Switched",
        description: "Successfully switched to Base network.",
      });
    } catch (error: any) {
      toast({
        title: "Network Switch Failed",
        description: error.message || "Failed to switch to Base network",
        variant: "destructive"
      });
    }
  };

  const formatUSDC = (amount: string | number): string => {
    const value = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  return {
    ...walletInfo,
    isConnecting,
    isOnCorrectNetwork: simpleWallet.isOnCorrectNetwork(),
    formatAddress: simpleWallet.formatAddress,
    connectWallet,
    disconnectWallet,
    switchToBaseNetwork,
    usdcBalance,
    formatUSDC
  };
}
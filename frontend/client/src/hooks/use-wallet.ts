import { useState, useEffect } from 'react';
import { walletConnection, type WalletInfo } from '@/lib/web3/wallet-connection';
import { useToast } from '@/hooks/use-toast';

export function useWallet() {
  const [walletInfo, setWalletInfo] = useState<WalletInfo>({
    address: '',
    chainId: 0,
    isConnected: false,
    provider: null,
    signer: null
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check for existing connection on mount
    walletConnection.checkConnection().then(setWalletInfo);

    // Subscribe to wallet changes
    const unsubscribe = walletConnection.onWalletChange(setWalletInfo);

    return unsubscribe;
  }, []);

  const connectWallet = async () => {
    if (isConnecting) return;

    setIsConnecting(true);
    try {
      const info = await walletConnection.connect();
      setWalletInfo(info);
      
      if (!walletConnection.isOnCorrectNetwork()) {
        toast({
          title: "Wrong Network",
          description: "Please switch to Base network to use the marketplace.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Wallet Connected",
          description: `Connected to ${walletConnection.formatAddress(info.address)}`,
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
    walletConnection.disconnect();
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected.",
    });
  };

  const switchToBaseNetwork = async () => {
    try {
      await walletConnection.switchToBaseNetwork();
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

  return {
    ...walletInfo,
    isConnecting,
    isOnCorrectNetwork: walletConnection.isOnCorrectNetwork(),
    formatAddress: walletConnection.formatAddress,
    connectWallet,
    disconnectWallet,
    switchToBaseNetwork
  };
}
import { ethers } from 'ethers';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface WalletInfo {
  address: string;
  chainId: number;
  isConnected: boolean;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
}

export class WalletConnection {
  private static instance: WalletConnection;
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;
  private address: string = '';
  private chainId: number = 0;
  private isConnected: boolean = false;
  private listeners: ((walletInfo: WalletInfo) => void)[] = [];

  // Base mainnet chain ID
  private readonly TARGET_CHAIN_ID = 8453;
  private readonly TARGET_CHAIN_NAME = 'Base';
  private readonly TARGET_RPC_URL = 'https://mainnet.base.org';

  private constructor() {
    this.initializeEventListeners();
  }

  static getInstance(): WalletConnection {
    if (!WalletConnection.instance) {
      WalletConnection.instance = new WalletConnection();
    }
    return WalletConnection.instance;
  }

  private initializeEventListeners() {
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', this.handleAccountsChanged.bind(this));
      window.ethereum.on('chainChanged', this.handleChainChanged.bind(this));
      window.ethereum.on('disconnect', this.handleDisconnect.bind(this));
    }
  }

  private handleAccountsChanged(accounts: string[]) {
    if (accounts.length === 0) {
      this.disconnect();
    } else if (accounts[0] !== this.address) {
      this.address = accounts[0];
      this.notifyListeners();
    }
  }

  private handleChainChanged(chainId: string) {
    this.chainId = parseInt(chainId, 16);
    this.notifyListeners();
  }

  private handleDisconnect() {
    this.disconnect();
  }

  private notifyListeners() {
    const walletInfo: WalletInfo = {
      address: this.address,
      chainId: this.chainId,
      isConnected: this.isConnected,
      provider: this.provider,
      signer: this.signer
    };
    
    this.listeners.forEach(listener => listener(walletInfo));
  }

  async connect(): Promise<WalletInfo> {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      this.address = accounts[0];
      
      const network = await this.provider.getNetwork();
      this.chainId = Number(network.chainId);
      this.isConnected = true;

      // Check if on correct network
      if (this.chainId !== this.TARGET_CHAIN_ID) {
        await this.switchToBaseNetwork();
      }

      this.notifyListeners();
      return this.getWalletInfo();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }

  async switchToBaseNetwork(): Promise<void> {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    try {
      // Try to switch to Base network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${this.TARGET_CHAIN_ID.toString(16)}` }],
      });
    } catch (switchError: any) {
      // If network doesn't exist, add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${this.TARGET_CHAIN_ID.toString(16)}`,
                chainName: this.TARGET_CHAIN_NAME,
                rpcUrls: [this.TARGET_RPC_URL],
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                blockExplorerUrls: ['https://basescan.org'],
              },
            ],
          });
        } catch (addError) {
          throw new Error('Failed to add Base network');
        }
      } else {
        throw new Error('Failed to switch to Base network');
      }
    }
  }

  disconnect(): void {
    this.provider = null;
    this.signer = null;
    this.address = '';
    this.chainId = 0;
    this.isConnected = false;
    this.notifyListeners();
  }

  getWalletInfo(): WalletInfo {
    return {
      address: this.address,
      chainId: this.chainId,
      isConnected: this.isConnected,
      provider: this.provider,
      signer: this.signer
    };
  }

  isOnCorrectNetwork(): boolean {
    return this.chainId === this.TARGET_CHAIN_ID;
  }

  onWalletChange(listener: (walletInfo: WalletInfo) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  async checkConnection(): Promise<WalletInfo> {
    if (!window.ethereum) {
      return this.getWalletInfo();
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_accounts'
      });

      if (accounts.length > 0) {
        this.provider = new ethers.BrowserProvider(window.ethereum);
        this.signer = await this.provider.getSigner();
        this.address = accounts[0];
        
        const network = await this.provider.getNetwork();
        this.chainId = Number(network.chainId);
        this.isConnected = true;
      }

      return this.getWalletInfo();
    } catch (error) {
      console.error('Failed to check wallet connection:', error);
      return this.getWalletInfo();
    }
  }

  formatAddress(address?: string): string {
    const addr = address || this.address;
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  async getBalance(): Promise<string> {
    if (!this.provider || !this.address) {
      return '0';
    }

    try {
      const balance = await this.provider.getBalance(this.address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Failed to get balance:', error);
      return '0';
    }
  }
}

export const walletConnection = WalletConnection.getInstance();
declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface WalletInfo {
  address: string;
  chainId: number;
  isConnected: boolean;
}

export class SimpleWallet {
  private static instance: SimpleWallet;
  private address: string = '';
  private chainId: number = 0;
  private isConnected: boolean = false;
  private listeners: ((walletInfo: WalletInfo) => void)[] = [];

  // Base mainnet chain ID
  private readonly TARGET_CHAIN_ID = 8453;

  private constructor() {
    this.initializeEventListeners();
  }

  static getInstance(): SimpleWallet {
    if (!SimpleWallet.instance) {
      SimpleWallet.instance = new SimpleWallet();
    }
    return SimpleWallet.instance;
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
      isConnected: this.isConnected
    };
    
    this.listeners.forEach(listener => listener(walletInfo));
  }

  async connect(): Promise<WalletInfo> {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      this.address = accounts[0];
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      this.chainId = parseInt(chainId, 16);
      this.isConnected = true;

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
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${this.TARGET_CHAIN_ID.toString(16)}` }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${this.TARGET_CHAIN_ID.toString(16)}`,
                chainName: 'Base',
                rpcUrls: ['https://mainnet.base.org'],
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
    this.address = '';
    this.chainId = 0;
    this.isConnected = false;
    this.notifyListeners();
  }

  getWalletInfo(): WalletInfo {
    return {
      address: this.address,
      chainId: this.chainId,
      isConnected: this.isConnected
    };
  }

  isOnCorrectNetwork(): boolean {
    return this.chainId === this.TARGET_CHAIN_ID;
  }

  onWalletChange(listener: (walletInfo: WalletInfo) => void): () => void {
    this.listeners.push(listener);
    
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
        this.address = accounts[0];
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        this.chainId = parseInt(chainId, 16);
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
}

export const simpleWallet = SimpleWallet.getInstance();
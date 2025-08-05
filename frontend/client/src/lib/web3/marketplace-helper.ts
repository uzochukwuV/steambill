import { ethers } from 'ethers';

// Contract ABIs
const PAYMENT_PROTOCOL_ABI = [
  "function processPaymentPreApproved((bytes32,address,address,uint256,uint256,uint256,uint256,bytes)) external",
  "function processPaymentWithPermit2((bytes32,address,address,uint256,uint256,uint256,uint256,bytes), ((address,uint256),uint256,uint256), (address,uint256), bytes) external",
  "function calculateProtocolFee(uint256) external pure returns (uint256)",
  "function getCurrentNonce(address) external view returns (uint256)",
  "function isPaymentProcessed(bytes32) external view returns (bool)",
  "function getPaymentHash((bytes32,address,address,uint256,uint256,uint256,uint256,bytes)) external view returns (bytes32)"
];

const MARKETPLACE_ABI = [
  "function createListing(uint8,address,uint256,uint256,uint256,uint256,string,bytes32[]) external returns (bytes32)",
  "function purchaseWithPreApproval(bytes32,uint256,(bytes32,address,address,uint256,uint256,uint256,uint256,bytes)) external",
  "function purchaseWithPermit2(bytes32,uint256,(bytes32,address,address,uint256,uint256,uint256,uint256,bytes),((address,uint256),uint256,uint256,(address,uint256),bytes)) external",
  "function getListing(bytes32) external view returns ((bytes32,address,uint8,address,uint256,uint256,uint256,uint256,uint8,string,bytes32[]))",
  "function getSellerListings(address) external view returns (bytes32[])",
  "function getBuyerPurchases(address) external view returns (bytes32[])",
  "function calculateTotalCost(uint256) external view returns (uint256,uint256,uint256)",
  "function cancelListing(bytes32) external",
  "function updateListing(bytes32,uint256,uint256) external"
];

const USDC_ABI = [
  "function balanceOf(address) external view returns (uint256)",
  "function allowance(address,address) external view returns (uint256)",
  "function approve(address,uint256) external returns (bool)",
  "function transfer(address,uint256) external returns (bool)"
];

// Contract addresses - Base mainnet
export const CONTRACT_ADDRESSES = {
  PAYMENT_PROTOCOL: import.meta.env.VITE_PAYMENT_PROTOCOL_ADDRESS || '',
  MARKETPLACE: import.meta.env.VITE_MARKETPLACE_ADDRESS || '',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base USDC
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' // Uniswap Permit2
};

// EIP-712 Domain for payment protocol
const EIP712_DOMAIN = {
  name: 'SimpleUSDCPaymentProtocol',
  version: '1',
  chainId: 8453, // Base mainnet
  verifyingContract: CONTRACT_ADDRESSES.PAYMENT_PROTOCOL
};

// EIP-712 Types
const PAYMENT_INTENT_TYPES = {
  PaymentIntent: [
    { name: 'id', type: 'bytes32' },
    { name: 'sender', type: 'address' },
    { name: 'recipient', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'protocolFee', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'nonce', type: 'uint256' }
  ]
};

export interface PaymentIntent {
  id: string;
  sender: string;
  recipient: string;
  amount: string;
  protocolFee: string;
  deadline: number;
  nonce: string;
  signature: string;
}

export interface ListingData {
  itemType: 0 | 1 | 2; // 0=PHYSICAL, 1=ERC721, 2=ERC1155
  tokenContract?: string;
  tokenId?: number;
  quantity: number;
  pricePerUnit: number;
  duration: number; // in seconds
  metadataURI?: string;
  tags?: string[];
}

export interface USDCStatus {
  balance: string;
  allowance: string;
  balanceWei: bigint;
  allowanceWei: bigint;
}

export class MarketplaceHelper {
  private provider: ethers.Provider;
  private signer: ethers.Signer | null = null;
  private paymentProtocol: ethers.Contract;
  private marketplace: ethers.Contract;
  private usdc: ethers.Contract;

  constructor(provider: ethers.Provider, signer?: ethers.Signer) {
    this.provider = provider;
    this.signer = signer || null;
    
    // Initialize contract instances
    this.paymentProtocol = new ethers.Contract(
      CONTRACT_ADDRESSES.PAYMENT_PROTOCOL,
      PAYMENT_PROTOCOL_ABI,
      signer || provider
    );
    
    this.marketplace = new ethers.Contract(
      CONTRACT_ADDRESSES.MARKETPLACE,
      MARKETPLACE_ABI,
      signer || provider
    );
    
    this.usdc = new ethers.Contract(
      CONTRACT_ADDRESSES.USDC,
      USDC_ABI,
      signer || provider
    );
  }

  setSigner(signer: ethers.Signer) {
    this.signer = signer;
    this.paymentProtocol = this.paymentProtocol.connect(signer);
    this.marketplace = this.marketplace.connect(signer);
    this.usdc = this.usdc.connect(signer);
  }

  generatePaymentId(sender: string, recipient: string, amount: string, timestamp: number): string {
    return ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'address', 'uint256', 'uint256'],
        [sender, recipient, amount, timestamp]
      )
    );
  }

  async createPaymentIntent(params: {
    recipient: string;
    amount: number;
    protocolFee: number;
    deadline?: number;
  }): Promise<PaymentIntent> {
    if (!this.signer) {
      throw new Error('Signer required for creating payment intent');
    }

    const {
      recipient,
      amount,
      protocolFee,
      deadline = Math.floor(Date.now() / 1000) + 3600 // 1 hour default
    } = params;

    const sender = await this.signer.getAddress();
    const nonce = await this.paymentProtocol.getCurrentNonce(sender);
    const paymentId = this.generatePaymentId(sender, recipient, amount.toString(), Date.now());

    const paymentIntent = {
      id: paymentId,
      sender,
      recipient,
      amount: ethers.parseUnits(amount.toString(), 6), // USDC has 6 decimals
      protocolFee: ethers.parseUnits(protocolFee.toString(), 6),
      deadline,
      nonce
    };

    // Sign the payment intent
    const signature = await this.signer.signTypedData(
      EIP712_DOMAIN,
      PAYMENT_INTENT_TYPES,
      paymentIntent
    );

    return {
      id: paymentIntent.id,
      sender: paymentIntent.sender,
      recipient: paymentIntent.recipient,
      amount: paymentIntent.amount.toString(),
      protocolFee: paymentIntent.protocolFee.toString(),
      deadline: paymentIntent.deadline,
      nonce: paymentIntent.nonce.toString(),
      signature
    };
  }

  async checkUSDCStatus(userAddress: string, spenderAddress?: string): Promise<USDCStatus> {
    const spender = spenderAddress || CONTRACT_ADDRESSES.MARKETPLACE;
    const balance = await this.usdc.balanceOf(userAddress);
    const allowance = await this.usdc.allowance(userAddress, spender);
    
    return {
      balance: ethers.formatUnits(balance, 6),
      allowance: ethers.formatUnits(allowance, 6),
      balanceWei: balance,
      allowanceWei: allowance
    };
  }

  async approveUSDC(amount: number, spender?: string): Promise<ethers.ContractTransactionResponse> {
    if (!this.signer) {
      throw new Error('Signer required for approval');
    }

    const spenderAddress = spender || CONTRACT_ADDRESSES.MARKETPLACE;
    const amountWei = ethers.parseUnits(amount.toString(), 6);
    const tx = await this.usdc.approve(spenderAddress, amountWei);
    return tx;
  }

  async createListing(listingData: ListingData): Promise<ethers.ContractTransactionResponse> {
    if (!this.signer) {
      throw new Error('Signer required for creating listing');
    }

    const {
      itemType,
      tokenContract = ethers.ZeroAddress,
      tokenId = 0,
      quantity,
      pricePerUnit,
      duration,
      metadataURI = '',
      tags = []
    } = listingData;

    const priceWei = ethers.parseUnits(pricePerUnit.toString(), 6);
    const tagsBytes32 = tags.map(tag => ethers.keccak256(ethers.toUtf8Bytes(tag)));
    
    const tx = await this.marketplace.createListing(
      itemType,
      tokenContract,
      tokenId,
      quantity,
      priceWei,
      duration,
      metadataURI,
      tagsBytes32
    );

    return tx;
  }

  async purchaseWithPreApproval(
    listingId: string, 
    quantity: number, 
    paymentIntent: PaymentIntent
  ): Promise<ethers.ContractTransactionResponse> {
    if (!this.signer) {
      throw new Error('Signer required for purchase');
    }

    const tx = await this.marketplace.purchaseWithPreApproval(
      listingId,
      quantity,
      paymentIntent
    );

    return tx;
  }

  async completePurchaseWithPreApproval(listingId: string, quantity: number) {
    if (!this.signer) {
      throw new Error('Signer required for purchase');
    }

    const userAddress = await this.signer.getAddress();

    // Calculate total cost
    const [, , totalCostWei] = await this.marketplace.calculateTotalCost(
      ethers.parseUnits("1", 6) // We'll multiply by actual price later
    );
    
    // Get listing details to calculate actual total
    const listing = await this.marketplace.getListing(listingId);
    const itemPrice = listing.pricePerUnit * BigInt(quantity);
    const [marketplaceFeeWei, protocolFeeWei] = await this.marketplace.calculateTotalCost(itemPrice);
    const totalCost = itemPrice + marketplaceFeeWei + protocolFeeWei;

    // Check USDC status
    const usdcStatus = await this.checkUSDCStatus(userAddress);
    const totalCostFormatted = parseFloat(ethers.formatUnits(totalCost, 6));

    if (parseFloat(usdcStatus.balance) < totalCostFormatted) {
      throw new Error(`Insufficient USDC balance. Need ${totalCostFormatted}, have ${usdcStatus.balance}`);
    }

    if (parseFloat(usdcStatus.allowance) < totalCostFormatted) {
      // Approve USDC if needed
      const approveTx = await this.approveUSDC(totalCostFormatted);
      await approveTx.wait();
    }

    // Calculate protocol fee
    const protocolFee = await this.paymentProtocol.calculateProtocolFee(itemPrice + marketplaceFeeWei);

    // Create and sign payment intent
    const paymentIntent = await this.createPaymentIntent({
      recipient: CONTRACT_ADDRESSES.MARKETPLACE,
      amount: parseFloat(ethers.formatUnits(itemPrice + marketplaceFeeWei, 6)),
      protocolFee: parseFloat(ethers.formatUnits(protocolFee, 6))
    });

    // Execute purchase
    const purchaseTx = await this.purchaseWithPreApproval(
      listingId,
      quantity,
      paymentIntent
    );

    return {
      paymentIntent,
      transaction: purchaseTx
    };
  }

  async calculateTotalCost(pricePerUnit: number, quantity: number = 1) {
    const priceWei = ethers.parseUnits(pricePerUnit.toString(), 6);
    const totalPrice = priceWei * BigInt(quantity);
    
    const [marketplaceFee, protocolFee, totalCost] = await this.marketplace.calculateTotalCost(totalPrice);
    
    return {
      itemPrice: ethers.formatUnits(totalPrice, 6),
      marketplaceFee: ethers.formatUnits(marketplaceFee, 6),
      protocolFee: ethers.formatUnits(protocolFee, 6),
      totalCost: ethers.formatUnits(totalCost, 6),
      itemPriceWei: totalPrice,
      marketplaceFeeWei: marketplaceFee,
      protocolFeeWei: protocolFee,
      totalCostWei: totalCost
    };
  }
}
// server.js
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

// Contract configuration
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL || 'https://mainnet.base.org';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Initialize provider and contract
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const contractABI = [
  "function processPaymentPreApproved((bytes32,address,address,uint256,uint256,uint256,uint256,bytes)) external",
  "function processPaymentWithPermit2((bytes32,address,address,uint256,uint256,uint256,uint256,bytes),((address,uint256),uint256,uint256),(address,uint256),bytes) external",
  "function calculateProtocolFee(uint256) public pure returns (uint256)",
  "function isPaymentProcessed(bytes32) external view returns (bool)",
  "function getCurrentNonce(address) external view returns (uint256)",
  "event PaymentProcessed(bytes32 indexed paymentId, address indexed sender, address indexed recipient, uint256 amount, uint256 protocolFee)"
];

const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);

// In-memory storage (use Redis/MongoDB in production)
const payments = new Map();
const notifications = new Map();

// Payment status enum
const PaymentStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  EXPIRED: 'expired'
};

// Utility functions
const generatePaymentId = () => {
  return '0x' + crypto.randomBytes(32).toString('hex');
};

const calculateDeadline = (minutes = 30) => {
  return Math.floor(Date.now() / 1000) + (minutes * 60);
};

// API Routes

/**
 * Create a new payment intent
 * POST /api/payments/create
 */
app.post('/api/payments/create', async (req, res) => {
  try {
    const { sender, recipient, amount, description, expiryMinutes = 30 } = req.body;

    // Validation
    if (!ethers.isAddress(sender) || !ethers.isAddress(recipient)) {
      return res.status(400).json({ error: 'Invalid wallet addresses' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Convert amount to USDC decimals (6 decimals)
    const amountInWei = ethers.parseUnits(amount.toString(), 6);
    
    // Calculate protocol fee
    const protocolFee = await contract.calculateProtocolFee(amountInWei);
    
    // Get current nonce for sender
    const nonce = await contract.getCurrentNonce(sender);
    
    // Generate payment intent
    const paymentId = generatePaymentId();
    const deadline = calculateDeadline(expiryMinutes);
    
    const paymentIntent = {
      id: paymentId,
      sender: sender,
      recipient: recipient,
      amount: amountInWei.toString(),
      protocolFee: protocolFee.toString(),
      deadline: deadline,
      nonce: nonce.toString(),
      signature: '0x' // Will be signed by frontend
    };

    // Store payment data
    const paymentData = {
      ...paymentIntent,
      description: description || '',
      status: PaymentStatus.PENDING,
      createdAt: new Date().toISOString(),
      amountUSD: amount // Original amount in USD
    };

    payments.set(paymentId, paymentData);

    // Set expiry timeout
    setTimeout(() => {
      const payment = payments.get(paymentId);
      if (payment && payment.status === PaymentStatus.PENDING) {
        payment.status = PaymentStatus.EXPIRED;
        payments.set(paymentId, payment);
        notifyPaymentUpdate(paymentId, PaymentStatus.EXPIRED);
      }
    }, expiryMinutes * 60 * 1000);

    res.json({
      success: true,
      paymentIntent: paymentIntent,
      totalAmount: ethers.formatUnits(
        BigInt(paymentIntent.amount) + BigInt(paymentIntent.protocolFee), 
        6
      )
    });

  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

/**
 * Process pre-approved payment
 * POST /api/payments/process-approved
 */
app.post('/api/payments/process-approved', async (req, res) => {
  try {
    const { paymentIntent } = req.body;

    // Validate payment exists and is pending
    const payment = payments.get(paymentIntent.id);
    if (!payment || payment.status !== PaymentStatus.PENDING) {
      return res.status(400).json({ error: 'Invalid or already processed payment' });
    }

    // Check if already processed on-chain
    const isProcessed = await contract.isPaymentProcessed(paymentIntent.id);
    if (isProcessed) {
      payment.status = PaymentStatus.COMPLETED;
      payments.set(paymentIntent.id, payment);
      return res.json({ success: true, status: PaymentStatus.COMPLETED });
    }

    // Update status to processing
    payment.status = PaymentStatus.PROCESSING;
    payments.set(paymentIntent.id, payment);
    notifyPaymentUpdate(paymentIntent.id, PaymentStatus.PROCESSING);

    // Process payment on-chain
    const tx = await contract.processPaymentPreApproved(paymentIntent);
    
    res.json({
      success: true,
      transactionHash: tx.hash,
      status: PaymentStatus.PROCESSING
    });

    // Wait for transaction confirmation
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      payment.status = PaymentStatus.COMPLETED;
      payment.transactionHash = tx.hash;
      payment.completedAt = new Date().toISOString();
      payments.set(paymentIntent.id, payment);
      
      notifyPaymentUpdate(paymentIntent.id, PaymentStatus.COMPLETED, {
        transactionHash: tx.hash
      });
    } else {
      payment.status = PaymentStatus.FAILED;
      payments.set(paymentIntent.id, payment);
      notifyPaymentUpdate(paymentIntent.id, PaymentStatus.FAILED);
    }

  } catch (error) {
    console.error('Error processing payment:', error);
    
    // Update payment status to failed
    const payment = payments.get(req.body.paymentIntent?.id);
    if (payment) {
      payment.status = PaymentStatus.FAILED;
      payment.error = error.message;
      payments.set(payment.id, payment);
      notifyPaymentUpdate(payment.id, PaymentStatus.FAILED, { error: error.message });
    }

    res.status(500).json({ error: 'Failed to process payment' });
  }
});

/**
 * Process Permit2 payment
 * POST /api/payments/process-permit2
 */
app.post('/api/payments/process-permit2', async (req, res) => {
  try {
    const { paymentIntent, permit2Data } = req.body;

    // Validate payment exists and is pending
    const payment = payments.get(paymentIntent.id);
    if (!payment || payment.status !== PaymentStatus.PENDING) {
      return res.status(400).json({ error: 'Invalid or already processed payment' });
    }

    // Update status to processing
    payment.status = PaymentStatus.PROCESSING;
    payments.set(paymentIntent.id, payment);
    notifyPaymentUpdate(paymentIntent.id, PaymentStatus.PROCESSING);

    // Process payment on-chain with Permit2
    const tx = await contract.processPaymentWithPermit2(paymentIntent, permit2Data);
    
    res.json({
      success: true,
      transactionHash: tx.hash,
      status: PaymentStatus.PROCESSING
    });

    // Wait for transaction confirmation
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      payment.status = PaymentStatus.COMPLETED;
      payment.transactionHash = tx.hash;
      payment.completedAt = new Date().toISOString();
      payments.set(paymentIntent.id, payment);
      
      notifyPaymentUpdate(paymentIntent.id, PaymentStatus.COMPLETED, {
        transactionHash: tx.hash
      });
    } else {
      payment.status = PaymentStatus.FAILED;
      payments.set(paymentIntent.id, payment);
      notifyPaymentUpdate(paymentIntent.id, PaymentStatus.FAILED);
    }

  } catch (error) {
    console.error('Error processing Permit2 payment:', error);
    
    const payment = payments.get(req.body.paymentIntent?.id);
    if (payment) {
      payment.status = PaymentStatus.FAILED;
      payment.error = error.message;
      payments.set(payment.id, payment);
      notifyPaymentUpdate(payment.id, PaymentStatus.FAILED, { error: error.message });
    }

    res.status(500).json({ error: 'Failed to process Permit2 payment' });
  }
});

/**
 * Get payment status
 * GET /api/payments/:paymentId
 */
app.get('/api/payments/:paymentId', (req, res) => {
  const { paymentId } = req.params;
  const payment = payments.get(paymentId);

  if (!payment) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  res.json({
    success: true,
    payment: {
      id: payment.id,
      status: payment.status,
      amount: payment.amountUSD,
      sender: payment.sender,
      recipient: payment.recipient,
      description: payment.description,
      createdAt: payment.createdAt,
      completedAt: payment.completedAt,
      transactionHash: payment.transactionHash,
      error: payment.error
    }
  });
});

/**
 * Get all payments for an address
 * GET /api/payments/address/:address
 */
app.get('/api/payments/address/:address', (req, res) => {
  const { address } = req.params;
  const { role = 'all' } = req.query; // 'sender', 'recipient', or 'all'

  if (!ethers.isAddress(address)) {
    return res.status(400).json({ error: 'Invalid address' });
  }

  const userPayments = Array.from(payments.values()).filter(payment => {
    if (role === 'sender') return payment.sender.toLowerCase() === address.toLowerCase();
    if (role === 'recipient') return payment.recipient.toLowerCase() === address.toLowerCase();
    return payment.sender.toLowerCase() === address.toLowerCase() || 
           payment.recipient.toLowerCase() === address.toLowerCase();
  });

  res.json({
    success: true,
    payments: userPayments.map(payment => ({
      id: payment.id,
      status: payment.status,
      amount: payment.amountUSD,
      sender: payment.sender,
      recipient: payment.recipient,
      description: payment.description,
      createdAt: payment.createdAt,
      completedAt: payment.completedAt,
      transactionHash: payment.transactionHash
    }))
  });
});

/**
 * Webhook notifications
 * GET /api/notifications/:paymentId
 */
app.get('/api/notifications/:paymentId', (req, res) => {
  const { paymentId } = req.params;
  const paymentNotifications = notifications.get(paymentId) || [];

  res.json({
    success: true,
    notifications: paymentNotifications
  });
});

/**
 * Server-Sent Events for real-time updates
 * GET /api/stream/:paymentId
 */
app.get('/api/stream/:paymentId', (req, res) => {
  const { paymentId } = req.params;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial payment status
  const payment = payments.get(paymentId);
  if (payment) {
    res.write(`data: ${JSON.stringify({
      type: 'status',
      paymentId: paymentId,
      status: payment.status,
      timestamp: new Date().toISOString()
    })}\n\n`);
  }

  // Store SSE connection for this payment
  if (!notifications.has(paymentId)) {
    notifications.set(paymentId, []);
  }

  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// Notification helper function
function notifyPaymentUpdate(paymentId, status, additionalData = {}) {
  const notification = {
    type: 'payment_update',
    paymentId: paymentId,
    status: status,
    timestamp: new Date().toISOString(),
    ...additionalData
  };

  // Store notification
  if (!notifications.has(paymentId)) {
    notifications.set(paymentId, []);
  }
  notifications.get(paymentId).push(notification);

  // Here you could add webhook calls to external services
  console.log('Payment notification:', notification);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    payments: payments.size
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Payment server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
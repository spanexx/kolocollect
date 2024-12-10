//walletRoute.js
const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');

// Wallet routes
router.get('/:userId/full', walletController.getWallet);
router.get('/:userId/balance', walletController.getWalletBalance);
router.post('/:userId/add', walletController.addFunds);
router.post('/:userId/withdraw', walletController.withdrawFunds);
router.post('/:userId/transfer', walletController.transferFunds);
router.get('/:userId/transactions', walletController.getTransactionHistory);
router.post('/:userId/fix', walletController.fixFunds);
router.get('/:userId/fixedFunds', walletController.getFixedFunds);

module.exports = router;



//walletController.js
const Wallet = require('../models/Wallet');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Stripe API key

// Fetch full wallet details for a user (balance, fixed balance, and transactions)
const getWallet = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.params.userId }).select('availableBalance fixedBalance totalBalance transactions'); 
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }
    res.json(wallet);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Fetch wallet balance for a user
const getWalletBalance = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.params.userId }).select('availableBalance totalBalance');
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }
    res.json({
      availableBalance: wallet.availableBalance,
      totalBalance: wallet.totalBalance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add funds using Stripe (via card)
const addFunds = async (req, res) => {
  const { amount, description, paymentMethodId } = req.body;

  if (amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Amount in cents
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
    });

    let wallet = await Wallet.findOne({ userId: req.params.userId });

    if (!wallet) {
      wallet = new Wallet({ userId: req.params.userId, availableBalance: 0, fixedBalance: 0, totalBalance: 0, transactions: [] });
    }

    wallet.availableBalance += amount;
    wallet.totalBalance += amount;
    wallet.transactions.push({
      amount,
      type: 'deposit',
      description: description || 'Funds added via Stripe',
    });

    await wallet.save();

    res.status(200).json({
      message: 'Funds added successfully',
      walletBalance: wallet.availableBalance,
      totalBalance: wallet.totalBalance,
      transactions: wallet.transactions,
    });
  } catch (error) {
    console.error('Error adding funds:', error);
    res.status(500).json({ message: 'Error adding funds to wallet' });
  }
};

//Withdraw funds using Stripe (for payout to external account)
  const withdrawFunds = async (req, res) => {
  const { amount, description } = req.body;

  if (amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const wallet = await Wallet.findOne({ userId: req.params.userId });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    if (wallet.availableBalance < amount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    // Create a transfer from the Stripe account (payout to user's bank account)
    const transfer = await stripe.transfers.create({
      amount: amount * 100, // Transfer amount in cents
      currency: 'usd',
      destination: 'your_stripe_account_id', // Replace with the user's connected Stripe account ID
    });

    wallet.availableBalance -= amount;
    wallet.totalBalance -= amount;
    wallet.transactions.push({
      amount,
      type: 'withdrawal',
      description: description || 'Funds withdrawn via Stripe',
    });

    await wallet.save();

    res.status(200).json({
      message: 'Funds withdrawn successfully',
      walletBalance: wallet.availableBalance,
      totalBalance: wallet.totalBalance,
      transactions: wallet.transactions,
    });
  } catch (error) {
    console.error('Error withdrawing funds:', error);
    res.status(500).json({ message: 'Error withdrawing funds from wallet' });
  }
};

// Transfer funds
const transferFunds = async (req, res) => {
  const { amount, recipientId, description } = req.body;

  if (amount <= 0 || !recipientId) {
    return res.status(400).json({ error: 'Invalid amount or recipient ID' });
  }

  try {
    const senderWallet = await Wallet.findOne({ userId: req.params.userId });
    const recipientWallet = await Wallet.findOne({ userId: recipientId });

    if (!senderWallet || !recipientWallet) {
      return res.status(404).json({ error: 'Sender or recipient wallet not found' });
    }

    if (senderWallet.availableBalance < amount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    // Deduct from sender
    senderWallet.availableBalance -= amount;
    senderWallet.totalBalance -= amount;
    senderWallet.transactions.push({
      amount,
      type: 'transfer',
      description: description || `Transferred ${amount} USD`,
      recipient: recipientId,
    });

    // Add to recipient
    recipientWallet.availableBalance += amount;
    recipientWallet.totalBalance += amount;
    recipientWallet.transactions.push({
      amount,
      type: 'deposit',
      description: description || `Received ${amount} USD`,
    });

    await senderWallet.save();
    await recipientWallet.save();

    res.status(200).json({ message: 'Funds transferred successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getTransactionHistory = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.params.userId }).select('transactions');
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }
    res.status(200).json(wallet.transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const fixFunds = async (req, res) => {
  const { amount, duration } = req.body;

  if (amount <= 0 || !duration) {
    return res.status(400).json({ error: 'Invalid amount or duration' });
  }

  try {
    const wallet = await Wallet.findOne({ userId: req.params.userId });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    if (wallet.availableBalance < amount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    wallet.availableBalance -= amount;
    wallet.fixedBalance = (wallet.fixedBalance || 0) + amount;
    wallet.transactions.push({
      amount,
      type: 'fix',
      description: `Fixed ${amount} for ${duration} days`,
    });

    await wallet.save();

    res.status(200).json({
      message: 'Funds successfully fixed',
      walletBalance: wallet.availableBalance,
      fixedBalance: wallet.fixedBalance,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getFixedFunds = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.params.userId }).select('fixedBalance');
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }
    res.status(200).json({ fixedBalance: wallet.fixedBalance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getWalletByUserId = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.params.userId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    res.status(200).json({
      id: wallet._id,
      userId: wallet.userId,
      balance: wallet.balance,
      transactions: wallet.transactions,
      fixedFunds: wallet.fixedFunds,
    });
  } catch (error) {
    console.error('Error fetching wallet by user ID:', error);
    res.status(500).json({ message: 'Server error while fetching wallet' });
  }
};



module.exports = {
  getWallet,
  getWalletBalance,
  addFunds,
  withdrawFunds,
  transferFunds,
  getTransactionHistory, 
  fixFunds,              
  getFixedFunds,   
  getWalletByUserId      
};




//wallet.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Transaction Schema to track deposits, withdrawals, and other activities
const transactionSchema = new Schema(
  {
    amount: { type: Number, required: true }, // Amount of the transaction
    type: { 
      type: String, 
      enum: ['deposit', 'withdrawal', 'fixed', 'transfer'], 
      required: true 
    }, // Type of transaction
    date: { type: Date, default: Date.now }, // Date of the transaction
    description: { type: String, required: true }, // Description of the transaction
    recipient: { type: Schema.Types.ObjectId, ref: 'User' }, // Recipient of funds (for transfers)
  },
  { timestamps: true }
);

const fixedFundsSchema = new Schema(
  {
    amount: { type: Number, required: true }, // Fixed amount
    startDate: { type: Date, default: Date.now }, // Start date of the fixed fund
    endDate: { type: Date, required: true }, // Maturity date
    isMatured: { type: Boolean, default: false }, // Indicates if funds are matured
  },
  { timestamps: true }
);

const walletSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  balance: { type: Number, default: 0 },
  transactions: [transactionSchema], // Transaction history
  fixedFunds: [fixedFundsSchema], // Array of fixed fund records
});


// Virtual property to calculate total balance (available + fixed)
walletSchema.virtual('totalBalance').get(function () {
  return this.availableBalance + this.fixedBalance;
});


const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;





// backend/config/stripe.js
const Stripe = require('stripe');

// Initialize Stripe with your secret key
const stripe = Stripe(process.env.STRIPE_SECRET_KEY); 




module.exports = stripe;





// backend/controllersController/stripe.js

const stripe = require('../config/stripe');

const createPaymentIntent = async (req, res) => {
  try {
    const { amount, currency } = req.body;

    // Create a PaymentIntent with the specified amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount, // Amount in smallest currency unit (e.g., cents for USD)
      currency,
      automatic_payment_methods: { enabled: true },
    });

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createPaymentIntent };



//backend/middlewares/webhookMiddleware.js
const bodyParser = require('body-parser');
const User = require('../models/User');

const stripeWebhook = (req, res, next) => {
  const rawBody = req.rawBody; // Stripe requires the raw request body
  const signature = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
    req.stripeEvent = event; // Attach the event to the request

    // Handle the payment_intent.succeeded event
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const userId = paymentIntent.metadata.userId; // Store userId as metadata during payment creation
      const amountReceived = paymentIntent.amount_received / 100; // Convert amount to dollars or preferred currency

      // Find the user and update their wallet balance
      User.findById(userId).then((user) => {
        if (user) {
          // Update wallet balance and add transaction history
          user.walletBalance += amountReceived;
          user.walletTransactions.push({
            amount: amountReceived,
            type: 'deposit',
          });
          user.save(); // Save the updated user object
        }
      });
    }

    next();
  } catch (err) {
    res.status(400).send(`Webhook error: ${err.message}`);
  }
};

module.exports = stripeWebhook;



const express = require('express');
const { createPaymentIntent } = require('../controllers/stripeController');
const router = express.Router();

// Route to create a PaymentIntent
router.post('/payment-intent', createPaymentIntent);

module.exports = router;

const Wallet = require('../models/Wallet');

// Fetch full wallet details for a user (balance and transactions)
const getWallet = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.params.userId }).select('balance transactions'); // Fetch only necessary fields
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
    const wallet = await Wallet.findOne({ userId: req.params.userId }).select('balance');
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }
    res.json({ walletBalance: wallet.balance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add funds to a user's wallet
const addFunds = async (req, res) => {
  const { amount, description } = req.body;
  if (amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    let wallet = await Wallet.findOne({ userId: req.params.userId });

    if (!wallet) {
      wallet = new Wallet({ userId: req.params.userId, balance: 0, transactions: [] });
    }

    wallet.balance += amount;
    wallet.transactions.push({
      amount,
      type: 'deposit',
      description: description || 'Funds added to wallet',
    });

    await wallet.save();

    res.status(200).json({
      message: 'Funds added successfully',
      walletBalance: wallet.balance,
      transactions: wallet.transactions,
    });
  } catch (error) {
    console.error('Error adding funds:', error); // Log the actual error
    res.status(500).json({ message: 'Error adding funds to wallet' });
  }
};


// Withdraw funds from a user's wallet
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

    if (wallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    wallet.balance -= amount; // Update wallet balance
    wallet.transactions.push({
      amount,
      type: 'withdrawal',
      description: description || 'Funds withdrawn from wallet',
    });

    await wallet.save();

    res.status(200).json({ 
      message: 'Funds withdrawn successfully', 
      walletBalance: wallet.balance, 
      transactions: wallet.transactions 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Fetch transaction history for a user's wallet with optional filter
const getTransactionHistory = async (req, res) => {
  const { filterType } = req.query; // Get the filterType from query params

  try {
    const wallet = await Wallet.findOne({ userId: req.params.userId }).select('transactions');
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    // If no filter is applied, return all transactions
    if (filterType === 'all' || !filterType) {
      return res.json(wallet.transactions);
    }

    // Otherwise, filter transactions based on the type
    const filteredTransactions = wallet.transactions.filter(tx => tx.type === filterType);
    res.json(filteredTransactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Fix funds (lock funds for a period)
const fixFunds = async (req, res) => {
  const { amount, duration } = req.body; // Duration in days
  if (amount <= 0 || duration <= 0) {cls

    return res.status(400).json({ error: 'Invalid amount or duration' });
  }

  try {
    const wallet = await Wallet.findOne({ userId: req.params.userId });

    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient funds or wallet not found' });
    }

    wallet.balance -= amount; // Deduct from wallet balance
    const maturityDate = new Date();
    maturityDate.setDate(maturityDate.getDate() + duration);

    wallet.fixedFunds.push({
      amount,
      startDate: new Date(),
      endDate: maturityDate,
    });

    wallet.transactions.push({
      amount,
      type: 'fixed',
      description: `Fixed ${amount} USD for ${duration} days`,
    });

    await wallet.save();

    res.status(200).json({ message: 'Funds fixed successfully', wallet });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Fetch fixed funds for a user
const getFixedFunds = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.params.userId }).select('fixedFunds'); // Select only fixedFunds field
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }
    res.json(wallet.fixedFunds); // Return the fixedFunds array
  } catch (error) {
    res.status(500).json({ message: error.message });
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

    if (senderWallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    // Deduct from sender
    senderWallet.balance -= amount;
    senderWallet.transactions.push({
      amount,
      type: 'transfer',
      description: description || `Transferred ${amount} USD`,
      recipient: recipientId,
    });

    // Add to recipient
    recipientWallet.balance += amount;
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


module.exports = { getWallet, getWalletBalance, addFunds, withdrawFunds, getTransactionHistory, fixFunds, getFixedFunds, transferFunds };

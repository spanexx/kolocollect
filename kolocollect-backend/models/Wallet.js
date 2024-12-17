const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Transaction Schema to track deposits, withdrawals, and other activities
const transactionSchema = new Schema(
  {
    amount: { type: Number, required: true },
    type: { type: String, enum: ['deposit', 'withdrawal', 'contribution', 'penalty', 'transfer'], required: true },
    description: { type: String },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Fixed Funds Schema to track funds that are locked for a specific duration
const fixedFundsSchema = new Schema(
  {
    amount: { type: Number, required: true },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    isMatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Wallet Schema to store balance, transactions, and fixed funds for each user
const walletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  availableBalance: { type: Number, default: 0 },
  fixedBalance: { type: Number, default: 0 },
  totalBalance: { type: Number, default: 0 },
  transactions: [transactionSchema],
  isFrozen: { type: Boolean, default: false },
});

// Method to add a transaction and adjust balances
walletSchema.methods.addTransaction = async function (amount, type, description, recipient, communityId) {
  if (this.isFrozen) {
    throw new Error('Wallet is frozen. No transactions allowed.');
  }

  if (type === 'withdrawal' || type === 'transfer' || type === 'penalty') {
    if (this.availableBalance < amount) {
      throw new Error('Insufficient balance for the transaction.');
    }
    this.availableBalance -= amount;
  } else if (type === 'deposit' || type === 'contribution') {
    this.availableBalance += amount;
  }

  this.transactions.push({
    amount,
    type,
    description,
    recipient,
    communityId,
  });

  this.totalBalance = this.availableBalance + this.fixedBalance;
  await this.save();
};

// Method to withdraw funds (ensures no withdrawal when wallet is frozen)
walletSchema.methods.withdrawFunds = async function (amount) {
  if (this.isFrozen) {
    throw new Error('Wallet is frozen. No withdrawals allowed.');
  }
  if (this.availableBalance < amount) {
    throw new Error('Insufficient balance for withdrawal.');
  }

  this.availableBalance -= amount;
  this.totalBalance = this.availableBalance + this.fixedBalance;

  this.transactions.push({
    amount,
    type: 'withdrawal',
    description: 'Manual withdrawal',
  });

  await this.save();
};

// Method to transfer funds (ensures no transfer when wallet is frozen)
walletSchema.methods.transferFunds = async function (amount, recipientWalletId) {
  if (this.isFrozen) {
    throw new Error('Wallet is frozen. No transfers allowed.');
  }
  if (this.availableBalance < amount) {
    throw new Error('Insufficient balance for transfer.');
  }

  this.availableBalance -= amount;
  this.totalBalance = this.availableBalance + this.fixedBalance;

  this.transactions.push({
    amount,
    type: 'transfer',
    description: `Transfer to wallet ID ${recipientWalletId}`,
    recipient: recipientWalletId,
  });

  await this.save();

  // Update the recipient's wallet
  const recipientWallet = await mongoose.model('Wallet').findById(recipientWalletId);
  if (!recipientWallet) {
    throw new Error('Recipient wallet not found.');
  }

  recipientWallet.availableBalance += amount;
  recipientWallet.totalBalance = recipientWallet.availableBalance + recipientWallet.fixedBalance;

  recipientWallet.transactions.push({
    amount,
    type: 'deposit',
    description: `Transfer from wallet ID ${this._id}`,
    recipient: this.userId,
  });

  await recipientWallet.save();
};

// Method to deduct penalties
walletSchema.methods.deductPenalty = async function (penaltyAmount) {
  if (this.isFrozen) {
    throw new Error('Wallet is frozen. No penalty deduction allowed.');
  }
  if (this.availableBalance < penaltyAmount) {
    throw new Error('Insufficient balance for penalty deduction.');
  }

  this.availableBalance -= penaltyAmount;
  this.transactions.push({
    amount: penaltyAmount,
    type: 'penalty',
    description: 'Penalty deduction',
  });

  await this.save();
};

// Method to check if fixed funds have matured
fixedFundsSchema.methods.checkMaturity = function () {
  return this.isMatured || new Date() >= this.endDate;
};

// Indexing on userId for faster lookups
walletSchema.index({ userId: 1 });

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;

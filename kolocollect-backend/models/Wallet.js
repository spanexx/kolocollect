const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Transaction Schema to track deposits, withdrawals, and other activities
const transactionSchema = new Schema(
  {
    amount: { type: Number, required: true },
    type: { 
      type: String, 
      enum: ['deposit', 'withdrawal', 'fixed', 'transfer', 'contribution'], // Added 'contribution'
      required: true 
    },
    date: { type: Date, default: Date.now },
    description: { type: String, required: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User' },
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
const walletSchema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  availableBalance: { type: Number, default: 0 },
  fixedBalance: { type: Number, default: 0 },
  transactions: [transactionSchema],
  fixedFunds: [fixedFundsSchema],
  clientSecret: { type: String, default: null },
});

// Add a virtual for total balance
walletSchema.virtual('totalBalance').get(function() {
  return this.availableBalance + this.fixedBalance;
});

// Method to add a transaction and adjust balances
walletSchema.methods.addTransaction = async function(amount, type, description, recipient = null) {
  const transaction = {
    amount,
    type,
    description,
    recipient
  };

  if (type === 'deposit') {
    this.availableBalance += amount;
  } else if (type === 'withdrawal') {
    if (this.availableBalance < amount) throw new Error('Insufficient balance');
    this.availableBalance -= amount;
  } else if (type === 'fixed') {
    this.fixedBalance += amount;
  } else if (type === 'contribution') {
    // Handle contribution withdrawal
    this.availableBalance -= amount; // Deduct from available balance
  }

  this.transactions.push(transaction);
  await this.save();
};

// Method to check if fixed funds have matured
fixedFundsSchema.methods.checkMaturity = function() {
  return this.isMatured || (new Date() >= this.endDate);
};

// Indexing on userId for faster lookups
walletSchema.index({ userId: 1 });

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;

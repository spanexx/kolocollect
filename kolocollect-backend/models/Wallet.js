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

// Fixed Funds Schema to track funds that are locked for a specific duration
const fixedFundsSchema = new Schema(
  {
    amount: { type: Number, required: true }, // Amount of funds that are fixed
    startDate: { type: Date, default: Date.now }, // When the funds were fixed
    endDate: { type: Date, required: true }, // Maturity date of the fixed funds
    isMatured: { type: Boolean, default: false }, // Whether the funds have matured or not
  },
  { timestamps: true }
);

// Wallet Schema to store balance, transactions, and fixed funds for each user
const walletSchema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  availableBalance: { type: Number, default: 0 },
  fixedBalance: { type: Number, default: 0 },
  totalBalance: { type: Number, default: 0 },
  transactions: [transactionSchema], // Track all wallet transactions
  fixedFunds: [fixedFundsSchema], // Track all fixed funds
  clientSecret: { type: String, default: null },

});


const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;

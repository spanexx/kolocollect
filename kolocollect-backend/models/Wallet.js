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

const walletSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true }, // User reference
    balance: { type: Number, default: 0 }, // Wallet balance
    transactions: [transactionSchema], // Transaction history
    fixedFunds: [fixedFundsSchema], // Array of fixed fund records
  },
  { timestamps: true }
);

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;

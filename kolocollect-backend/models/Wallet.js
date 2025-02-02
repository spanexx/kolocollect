const mongoose = require('mongoose');
const Schema = mongoose.Schema;


// Transaction Schema to track deposits, withdrawals, and other activities
const transactionSchema = new Schema(
  {
    amount: { type: Number, required: true },
    type: { 
      type: String, 
      enum: ['deposit', 'withdrawal', 'contribution', 'penalty', 'transfer', 'payout', 'fixed'], 
      required: true 
    },
    description: { type: String },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
    sUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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

// Helper function to update user notifications and activity logs
async function updateUserActivity(userId, activityMessage) {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found.');

    // Add a notification
    user.notifications.push({
      message: activityMessage,
      date: new Date(),
    });

    // Log the activity
    user.activityLog.push({
      action: activityMessage,
      date: new Date(),
    });

    await user.save();
  } catch (err) {
    console.error('Error updating user notifications or activity log:', err);
  }
}



// Method to add a transaction and adjust balances
walletSchema.methods.addTransaction = async function (amount, type, description, recipient = null, communityId = null, sUserId = null) {
  if (!['deposit', 'withdrawal', 'contribution', 'penalty', 'transfer', 'payout', 'fixed'].includes(type)) {
    throw new Error(`Invalid transaction type: ${type}`);
  }

  if (this.isFrozen) {
    throw new Error('Wallet is frozen. No transactions allowed.');
  }

  // Adjust balances
  if (['withdrawal', 'transfer', 'penalty', 'contribution'].includes(type)) {
    if (this.availableBalance < amount) {
      throw new Error('Insufficient balance for the transaction.');
    }
    this.availableBalance -= amount;
  } else if (['deposit', 'payout', 'fixed'].includes(type)) {
    this.availableBalance += type === 'fixed' ? -amount : amount;
    if (type === 'fixed') {
      this.fixedBalance += amount;
    }
  }

  // Add new transaction
  this.transactions.push({
    amount,
    type,
    description,
    recipient,
    communityId,
    sUserId,
  });

  // Save wallet with selective validation
  this.markModified('transactions'); // Ensure only the `transactions` array is validated
  this.totalBalance = this.availableBalance + this.fixedBalance;

  // console.log('Wallet document before saving:', this);
  await this.save();
};



// withdrawFunds Method
walletSchema.methods.withdrawFunds = async function (amount) {
  if (this.isFrozen) {
    throw new Error('Wallet is frozen. No withdrawals allowed.');
  }

  if (this.availableBalance < amount) {
    throw new Error('Insufficient balance for withdrawal.');
  }

  // Use addTransaction for withdrawal
  await this.addTransaction(amount, 'withdrawal', 'Manual withdrawal');
};

// transferFunds Method
walletSchema.methods.transferFunds = async function (amount, recipientWalletId, description = '') {
  if (this.isFrozen) {
    throw new Error('Wallet is frozen. No transfers allowed.');
  }

  if (this.availableBalance < amount) {
    throw new Error('Insufficient balance for transfer.');
  }

  // Deduct funds from sender's wallet
  await this.addTransaction(
    amount,
    'transfer',
    description || `Transfer to Wallet ID ${recipientWalletId}`,
    recipientWalletId
  );

  // Add funds to recipient's wallet
  const recipientWallet = await mongoose.model('Wallet').findById(recipientWalletId);
  if (!recipientWallet) {
    throw new Error('Recipient wallet not found.');
  }

  await recipientWallet.addTransaction(
    amount,
    'deposit',
    description || `Transfer from Wallet ID ${this._id}`,
    this.userId
  );
};

// deductPenalty Method
walletSchema.methods.deductPenalty = async function (penaltyAmount) {
  if (this.isFrozen) {
    throw new Error('Wallet is frozen. No penalty deduction allowed.');
  }

  if (this.availableBalance < penaltyAmount) {
    throw new Error('Insufficient balance for penalty deduction.');
  }

  // Use addTransaction for penalty
  await this.addTransaction(penaltyAmount, 'penalty', 'Penalty deduction');
};



// Method to check if fixed funds have matured
fixedFundsSchema.methods.checkMaturity = function () {
  return this.isMatured || new Date() >= this.endDate;
};

// Method to add funds to the wallet
walletSchema.methods.addFunds = async function (amount, description = 'Funds added') {
  if (amount <= 0) {
    throw new Error('Amount to be added must be greater than zero.');
  }

  // Use addTransaction for adding funds
  await this.addTransaction(amount, 'deposit', description);

  console.log(`Funds added successfully: €${amount}`);
};



// Indexing on userId for faster lookups
walletSchema.index({ userId: 1 });

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;

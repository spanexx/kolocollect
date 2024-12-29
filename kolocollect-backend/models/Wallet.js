const mongoose = require('mongoose');
const Schema = mongoose.Schema;


// Transaction Schema to track deposits, withdrawals, and other activities
const transactionSchema = new Schema(
  {
    amount: { type: Number, required: true },
    enum: ['deposit', 'withdrawal', 'contribution', 'penalty', 'transfer', 'payout'], // Added 'payout'
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
walletSchema.methods.addTransaction = async function (amount, type, description, recipient = null, communityId = null) {
  if (this.isFrozen) {
    throw new Error('Wallet is frozen. No transactions allowed.');
  }

  // Adjust balances based on transaction type
  if (['withdrawal', 'transfer', 'penalty'].includes(type)) {
    if (this.availableBalance < amount) {
      throw new Error('Insufficient balance for the transaction.');
    }
    this.availableBalance -= amount;
  } else if (['deposit', 'contribution', 'payout'].includes(type)) {
    this.availableBalance += amount;
  } else {
    throw new Error(`Invalid transaction type: ${type}`);
  }

  // Record the transaction
  this.transactions.push({
    amount,
    type,
    description,
    recipient,
    communityId,
  });

  // Recalculate total balance
  this.totalBalance = this.availableBalance + this.fixedBalance;
  await this.save();

  console.log(`Transaction of type "${type}" for €${amount} recorded successfully.`);
};

// Method to withdraw funds
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

  // Update user notifications and activity log
  const activityMessage = `Withdrawal of €${amount} processed successfully.`;
  await updateUserActivity(this.userId, activityMessage);
};

// Method to transfer funds
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

  // Update notifications for both sender and recipient
  await updateUserActivity(this.userId, `Transfer of €${amount} sent to Wallet ID ${recipientWalletId}.`);
  await updateUserActivity(recipientWallet.userId, `Transfer of €${amount} received from Wallet ID ${this._id}.`);
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

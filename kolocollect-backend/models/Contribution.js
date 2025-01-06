const mongoose = require('mongoose');

const ContributionSchema = new mongoose.Schema({
  communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  cycleNumber: { type: Number, required: true },
  midCycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'MidCycle', required: false },
  amount: {
    type: Number,
    required: true,
    validate: {
      validator: value => value >= 0,
      message: 'Contribution amount must be a positive number.',
    },
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'missed'],
    default: 'pending',
  },
  date: { type: Date, default: Date.now },
  penalty: { type: Number, default: 0 },
  missedReason: { type: String, default: null },
  paymentPlan: {
    type: { type: String, enum: ['Full', 'Incremental', 'Shortfall'], default: 'Full' },
    remainingAmount: { type: Number, default: 0 },
    installments: { type: Number, default: 0 },
  },
}, { timestamps: true });

// Static/Helper methods
ContributionSchema.statics.getUserContributions = async function (userId, communityId, cycleNumber) {
  return this.find({ userId, communityId, cycleNumber });
};

ContributionSchema.statics.getCycleTotal = async function (communityId, cycleNumber) {
  const result = await this.aggregate([
    { $match: { communityId: mongoose.Types.ObjectId(communityId), cycleNumber } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return result[0]?.total || 0;
};

ContributionSchema.statics.getMissedContributions = async function (userId, communityId) {
  return this.find({ userId, communityId, status: 'missed' });
};

// Method to create a contribution
ContributionSchema.statics.createContribution = async function (userId, communityId, amount, midCycleId) {
  try {
    // Validate community
    const community = await mongoose.model('Community').findById(communityId);
    if (!community) throw new Error('Community not found.');

    // Validate mid-cycle
    const activeMidCycle = community.midCycle.find(
      mc => mc._id.toString() === midCycleId.toString() && !mc.isComplete
    );
    if (!activeMidCycle) throw new Error('MidCycle not found or already complete.');

    // Validate minimum contribution amount
    if (amount < community.settings.minContribution) {
      throw new Error(`Contribution amount must be at least €${community.settings.minContribution.toFixed(2)}.`);
    }

    // Validate wallet balance
    const wallet = await mongoose.model('Wallet').findOne({ userId });
    if (!wallet || wallet.availableBalance < amount) {
      throw new Error('Insufficient wallet balance.');
    }

    // Deduct amount from wallet
    wallet.availableBalance -= amount;
    await wallet.save();

    // Create and save the contribution
    const newContribution = new this({
      userId,
      communityId,
      amount,
      midCycleId,
      cycleNumber: activeMidCycle.cycleNumber,
      status: 'completed',
    });

    const savedContribution = await newContribution.save();

    // Record the contribution in the community
    const recordResult = await community.record({
      contributorId: userId,
      recipientId: midCycleId,
      amount,
      contributionId: savedContribution._id, // Pass the saved contribution ID
    });

    console.log('Contribution successfully recorded:', recordResult.message);
    return savedContribution;
  } catch (error) {
    console.error('Error in createContribution method:', error);
    throw error;
  }
};


module.exports = mongoose.model('Contribution', ContributionSchema);

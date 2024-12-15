const mongoose = require('mongoose');

const ContributionSchema = new mongoose.Schema({
  communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle', required: false },
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

/**
 * Static/Helper methods to assist the `CommunitySchema`
 */

// Retrieve contributions for a user in a specific community and cycle
ContributionSchema.statics.getUserContributions = async function (userId, communityId, cycleId) {
  return this.find({ userId, communityId, cycleId });
};

// Sum total contributions for a community in a specific cycle
ContributionSchema.statics.getCycleTotal = async function (communityId, cycleId) {
  const result = await this.aggregate([
    { $match: { communityId: mongoose.Types.ObjectId(communityId), cycleId: mongoose.Types.ObjectId(cycleId) } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return result[0]?.total || 0;
};

// Retrieve all missed contributions for a user in a specific community
ContributionSchema.statics.getMissedContributions = async function (userId, communityId) {
  return this.find({ userId, communityId, status: 'missed' });
};

module.exports = mongoose.model('Contribution', ContributionSchema);

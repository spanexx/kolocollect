// models/Contribution.js

const mongoose = require('mongoose');

const contributionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  communityId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Community', index: true },
  cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle', index: true },
  midCycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'MidCycle', index: true },
  amount: {
    type: Number,
    required: true,
    validate: {
      validator: function (value) {
        return value > 0;
      },
      message: 'Contribution amount must be greater than zero.',
    },
  },
  contributionDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['Pending', 'Completed', 'Missed'], default: 'Pending' },
  penalty: {
    type: Number,
    default: 0,
    validate: {
      validator: function (value) {
        return value >= 0;
      },
      message: 'Penalty cannot be negative.',
    },
  },
});

// Virtual field for total contributions per user in a cycle
contributionSchema.virtual('totalContributions').get(function () {
  return this.amount - this.penalty;
});

// Method to link a contribution to User and Community schemas
contributionSchema.methods.linkToUserAndCommunity = async function () {
  try {
    // Update User contributions
    const user = await mongoose.model('User').findById(this.userId);
    if (user) {
      await user.updateUserContributions(this.userId, this.communityId, {
        amount: this.amount,
        cycleId: this.cycleId,
        midCycleId: this.midCycleId,
        penalty: this.penalty,
      });
    }

    // Update Community total contributions or mid-cycle data
    const community = await mongoose.model('Community').findById(this.communityId);
    if (community && this.status === 'Completed') {
      await community.updateTotalContributions(this.amount, this.cycleId, this.midCycleId);
    }
  } catch (err) {
    console.error('Error linking contribution to user and community:', err);
    throw err;
  }
};

// Method to apply penalty for missed contributions
contributionSchema.methods.applyPenalty = async function () {
  try {
    this.status = 'Missed';
    const penaltyAmount = await mongoose.model('Community').getPenaltyForCommunity(this.communityId);

    this.penalty = penaltyAmount;
    await this.save();

    // Update User penalty
    const user = await mongoose.model('User').findById(this.userId);
    if (user) {
      await user.applyPenalty(this.communityId, penaltyAmount, this.cycleId, this.midCycleId);
    }
  } catch (err) {
    console.error('Error applying penalty:', err);
    throw err;
  }
};

// Static method to calculate contributions for a user in a cycle
contributionSchema.statics.getCycleContributions = async function (userId, communityId, cycleId) {
  const contributions = await this.find({ userId, communityId, cycleId });

  const totalContributions = contributions.reduce((sum, c) => sum + c.amount, 0);
  const totalPenalties = contributions.reduce((sum, c) => sum + c.penalty, 0);

  return {
    totalContributions,
    totalPenalties,
    netContributions: totalContributions - totalPenalties,
  };
};

// Middleware: Automatically link contribution to User and Community after save
contributionSchema.post('save', async function (doc, next) {
  try {
    await doc.linkToUserAndCommunity();
    next();
  } catch (err) {
    next(err);
  }
});

// Middleware: Handle missed contributions on update
contributionSchema.post('findOneAndUpdate', async function (doc, next) {
  try {
    if (doc.status === 'Missed') {
      await doc.applyPenalty();
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Contribution', contributionSchema);

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  dateJoined: { type: Date, default: Date.now },
  communities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Community', index: true }],
  contributions: [
    {
      communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
      cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle' }, // Tracks specific cycle
      midCycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'MidCycle' }, // Tracks specific mid-cycle
      totalContributed: { 
        type: Number, 
        default: 0, 
        validate: {
          validator: function(value) {
            return value >= 0;
          },
          message: 'Total contributed amount cannot be negative.',
        },
      },
      positionInCycle: { type: Number, default: 0 },
      contributionsPaid: [
        {
          amount: { type: Number },
          date: { type: Date, default: Date.now },
        },
      ],
      missedContributions: [
        {
          cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle' },
          midCycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'MidCycle' },
          amount: { type: Number, default: 0 },
        },
      ],
      penalty: { 
        type: Number, 
        default: 0, 
        validate: {
          validator: function(value) {
            return value >= 0;
          },
          message: 'Penalty amount cannot be negative.',
        },
      },
    },
  ],
  votes: [
    {
      communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
      topic: { type: String },
      choice: { type: String },
      date: { type: Date, default: Date.now },
    },
  ],
  notifications: [
    {
      type: { type: String, enum: ['info', 'warning', 'alert', 'penalty', 'payout'], default: 'info' },
      message: { type: String },
      date: { type: Date, default: Date.now },
      read: { type: Boolean, default: false },
      communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' }, // Community-specific notifications
    },
  ],
  activityLog: [
    {
      action: { type: String }, // e.g., "joined community", "contributed", "penalized"
      details: { type: String }, // Additional details for the action
      date: { type: Date, default: Date.now },
    },
  ],
});

// Password hashing before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Match user password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Static method to update contributions for a user
userSchema.statics.updateUserContributions = async function (userId, communityId, updateData) {
  try {
    const user = await this.findById(userId);

    if (!user) throw new Error('User not found');

    const contribution = user.contributions.find(
      (c) => c.communityId.toString() === communityId.toString()
    );

    if (contribution) {
      // Update contribution details
      contribution.totalContributed += updateData.amount || 0;
      contribution.contributionsPaid.push({
        amount: updateData.amount,
        date: new Date(),
      });

      if (updateData.missed) {
        contribution.missedContributions.push({
          cycleId: updateData.cycleId,
          midCycleId: updateData.midCycleId,
          amount: updateData.amount,
        });
      }

      if (updateData.penalty) {
        contribution.penalty += updateData.penalty;
      }
    } else {
      // If no contribution exists for this community, create a new entry
      user.contributions.push({
        communityId,
        cycleId: updateData.cycleId,
        midCycleId: updateData.midCycleId,
        totalContributed: updateData.amount || 0,
        contributionsPaid: [
          { amount: updateData.amount, date: new Date() },
        ],
        missedContributions: updateData.missed
          ? [
              {
                cycleId: updateData.cycleId,
                midCycleId: updateData.midCycleId,
                amount: updateData.amount,
              },
            ]
          : [],
        penalty: updateData.penalty || 0,
      });
    }

    await user.save();
    return user;
  } catch (err) {
    console.error('Error updating user contributions:', err);
    throw err;
  }
};

// Automate penalty for missed contributions
userSchema.methods.applyPenalty = async function (communityId, penaltyAmount, missedCycleId, missedMidCycleId) {
  try {
    const contribution = this.contributions.find(
      (c) => c.communityId.toString() === communityId.toString()
    );

    if (!contribution) throw new Error('Contribution data not found for this community');

    // Add missed contribution details
    contribution.missedContributions.push({
      cycleId: missedCycleId,
      midCycleId: missedMidCycleId,
      amount: penaltyAmount,
    });

    // Update penalty
    contribution.penalty += penaltyAmount;

    // Log the action
    this.activityLog.push({
      action: 'penalized',
      details: `Penalty of ${penaltyAmount} applied for missed contribution in community ${communityId}`,
    });

    // Add notification
    this.notifications.push({
      type: 'penalty',
      message: `You have been penalized ${penaltyAmount} for missing a contribution in community ${communityId}`,
      communityId,
    });

    await this.save();
    return this;
  } catch (err) {
    console.error('Error applying penalty:', err);
    throw err;
  }
};

// Enhanced notification example
userSchema.methods.addNotification = function (type, message, communityId = null) {
  this.notifications.push({
    type,
    message,
    communityId,
  });

  return this.save();
};

// Virtual field for total communities
userSchema.virtual('totalCommunities').get(function () {
  return this.communities.length;
});

// Virtual field for total penalties
userSchema.virtual('totalPenalties').get(function () {
  return this.contributions.reduce((total, contribution) => total + contribution.penalty, 0);
});

module.exports = mongoose.model('User', userSchema);

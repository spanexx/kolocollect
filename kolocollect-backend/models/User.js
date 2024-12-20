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
      cycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle' },
      midCycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'MidCycle' },
      totalContributed: {
        type: Number,
        default: 0,
        validate: {
          validator: function (value) {
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
          validator: function (value) {
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
      communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
    },
  ],
  activityLog: [
    {
      action: { type: String }, // e.g., "joined community", "contributed", "penalized"
      details: { type: String }, // Additional details for the action
      date: { type: Date, default: Date.now },
    },
  ],
  payouts: [
    {
      communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
      amount: { type: Number },
      date: { type: Date },
    },
  ],
});

// Enable virtuals in toJSON and toObject output
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });


// Virtual field to check if the user is next in line for a payout
userSchema.virtual('nextInLineDetails').get(async function () {
  const Community = mongoose.model('Community');
  const userId = this._id;

  // Fetch all communities where the user is a member
  const communities = await Community.find({ members: { $elemMatch: { userId } } });

  // Loop through the communities to check for next-in-line status
  for (const community of communities) {
    const activeMidCycle = community.midCycle.find((mc) => mc.isReady && !mc.isComplete && mc.nextInLine?.userId.equals(userId));
    if (activeMidCycle) {
      return {
        communityId: community._id,
        communityName: community.name,
        midCycleId: activeMidCycle._id,
        cycleNumber: activeMidCycle.cycleNumber,
        payoutAmount: activeMidCycle.payoutAmount,
        missedContributions: activeMidCycle.missedContributions.filter((id) => id.equals(userId)),
        payoutDate: activeMidCycle.payoutDate,
      };
    }
  }

  return null; // User is not next in line in any community
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

// Add community to user's profile
userSchema.methods.addCommunity = async function (communityId) {
  if (!this.communities.includes(communityId)) {
    this.communities.push(communityId);

    // Log the action
    this.activityLog.push({
      action: 'joined community',
      details: `Joined community with ID: ${communityId}`,
    });

    await this.save();
  }
};

// Remove community from user's profile
userSchema.methods.removeCommunity = async function (communityId) {
  this.communities = this.communities.filter((id) => !id.equals(communityId));

  // Log the action
  this.activityLog.push({
    action: 'left community',
    details: `Left community with ID: ${communityId}`,
  });

  await this.save();
};

// Add contribution to a user
userSchema.methods.addContribution = async function (communityId, amount, cycleId = null, midCycleId = null) {
  const contribution = this.contributions.find((c) => c.communityId.toString() === communityId.toString());

  if (contribution) {
    contribution.totalContributed += amount;
    contribution.contributionsPaid.push({
      amount,
      date: new Date(),
    });
  } else {
    this.contributions.push({
      communityId,
      totalContributed: amount,
      contributionsPaid: [{ amount, date: new Date() }],
      cycleId,
      midCycleId,
    });
  }

  // Log the action
  this.activityLog.push({
    action: 'contributed',
    details: `Contributed ${amount} to community ${communityId}`,
  });

  await this.save();
};

// Apply penalty to user for missed contributions
userSchema.methods.applyPenalty = async function (communityId, penaltyAmount, cycleId, midCycleId) {
  const contribution = this.contributions.find((c) => c.communityId.toString() === communityId.toString());

  if (contribution) {
    contribution.penalty += penaltyAmount;
    contribution.missedContributions.push({
      cycleId,
      midCycleId,
      amount: penaltyAmount,
    });

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
  } else {
    throw new Error('Contribution record not found for the specified community');
  }
};

// Add a notification to the user
userSchema.methods.addNotification = async function (type, message, communityId = null) {
  try {
    // Prevent duplicate notifications of the same type and message
    const duplicateNotification = this.notifications.find(
      (n) => n.type === type && n.message === message && String(n.communityId) === String(communityId)
    );

    if (!duplicateNotification) {
      this.notifications.push({
        type,
        message,
        communityId,
        date: new Date(),
      });

      // Log the action in the user's activity log
      this.activityLog.push({
        action: 'notification',
        details: `New notification: ${message}`,
      });

      await this.save();
    }
  } catch (err) {
    console.error('Error adding notification:', err);
    throw new Error('Failed to add notification.');
  }
};


userSchema.methods.cleanUpLogs = async function (days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Filter logs and notifications older than 'days'
  this.notifications = this.notifications.filter((n) => n.date > cutoffDate);
  this.activityLog = this.activityLog.filter((log) => log.date > cutoffDate);

  await this.save();
};


userSchema.methods.getContributionSummary = function () {
  return this.contributions.map((c) => ({
    communityId: c.communityId,
    totalContributed: c.totalContributed,
    missedContributions: c.missedContributions.length,
    penalty: c.penalty,
  }));
};


// Virtual field for total penalties
userSchema.virtual('totalPenalties').get(function () {
  return this.contributions.reduce((total, contribution) => total + contribution.penalty, 0);
});

// Virtual field for total communities
userSchema.virtual('totalCommunities').get(function () {
  return this.communities.length;
});


userSchema.virtual('totalContributions').get(function () {
  return this.contributions.reduce((sum, c) => sum + c.totalContributed, 0);
});

// update payouts for a user
userSchema.methods.updateUserPayouts = async function (community) {
  try {
    const payoutDetails = community.payoutDetails;
    const existingPayout = this.payouts.find((p) =>
      p.communityId.equals(community._id)
    );

    if (payoutDetails) {
      if (existingPayout) {
        // Update existing payout
        existingPayout.amount = payoutDetails.payoutAmount;
        existingPayout.date = community.nextPayout;
      } else {
        // Add new payout
        this.payouts.push({
          communityId: community._id,
          amount: payoutDetails.payoutAmount,
          date: community.nextPayout,
        });
      }

      await this.save();
    }
  } catch (err) {
    console.error('Error updating user payouts:', err);
    throw err;
  }
};

userSchema.virtual('upcomingPayouts').get(function () {
  return this.contributions.map(contribution => {
    if (contribution.payoutDate && new Date(contribution.payoutDate) > new Date()) {
      return {
        communityId: contribution.communityId,
        payoutDate: contribution.payoutDate,
        expectedAmount: contribution.expectedAmount || 0,
      };
    }
    return null;
  }).filter(payout => payout);
});


module.exports = mongoose.model('User', userSchema);

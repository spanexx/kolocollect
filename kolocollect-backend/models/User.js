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
    this.notifications.push({
      type, // Type of notification (e.g., info, penalty, payout, etc.)
      message, // Message to display to the user
      communityId, // Optional: Link to a specific community
      date: new Date(), // Timestamp
    });

    // Save the user with the new notification
    await this.save();

    // Log the action in the user's activity log
    this.activityLog.push({
      action: 'notification',
      details: `New notification added: ${message}`,
      date: new Date(),
    });

    await this.save();
    return { message: 'Notification added successfully.' };
  } catch (err) {
    console.error('Error adding notification:', err);
    throw new Error('Failed to add notification.');
  }
};


// Virtual field for total penalties
userSchema.virtual('totalPenalties').get(function () {
  return this.contributions.reduce((total, contribution) => total + contribution.penalty, 0);
});

// Virtual field for total communities
userSchema.virtual('totalCommunities').get(function () {
  return this.communities.length;
});

module.exports = mongoose.model('User', userSchema);

const mongoose = require('mongoose');

const CommunitySchema = new mongoose.Schema({
    name: { type: String, required: true },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    totalContribution: { type: Number, default: 0 },
    backupFund: { type: Number, default: 0 },
    lockPayout: { type: Boolean, default: false },

    // Tracks individual mid-cycle contributions and payouts
    midCycle: [{
        cycleNumber: { type: Number, required: true },
        contributors: [{
            contributorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            amount: { type: Number, required: true },
        }], // Members who contributed and their amounts
        nextInLine: {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Member receiving payout
        },
        missedContributions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Members who missed contributions
        isComplete: { type: Boolean, default: false },
        payoutAmount: { type: Number },
    }],

    // Tracks full cycle data
    cycles: [{
        cycleNumber: { type: Number, required: true },
        midCycles: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MidCycle',
        }], // References to mid-cycle entries
        isComplete: { type: Boolean, default: false }, // Marks complete cycle
        startDate: { type: Date },
        endDate: { type: Date },
    }],

    members: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        position: { type: Number },
        contributionPaid: { type: Boolean, default: false },
        status: { type: String, default: 'active' }, // active, inactive
        penalty: { type: Number, default: 0 },
        missedContributions: [{
            cycleNumber: { type: Number, required: true },
            midCycles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MidCycle' }],
            amount: { type: Number },
            nextInLineMissed: {
                userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            },
        }],
    }],

    // Settings
    settings: {
        contributionFrequency: { type: String, enum: ['Daily', 'Weekly', 'Monthly'], default: 'Weekly' },
        maxMembers: { type: Number, default: 100 },
        backupFundPercentage: { type: Number, default: 10 }, // Percentage of total contributions allocated to backup fund
        isPrivate: { type: Boolean, default: false },
        minContribution: { type: Number, default: 30 },
        penalty: { type: Number, default: 10 },
        numMissContribution: { type: Number, default: 3 },
    },

    positioningMode: { type: String, enum: ['Random', 'Fixed'], default: 'Random' },
    cycleLockEnabled: { type: Boolean, default: false },
    firstCycleMin: { type: Number, default: 5 },
    cycleState: { type: String, enum: ['Active', 'Locked', 'Completed'], default: 'Active' },

    votes: [{
        topic: { type: String, required: true },
        options: [{ type: String }],
        votes: [{ userId: mongoose.Schema.Types.ObjectId, choice: String }],
        numVotes: { type: Number, default: 0 },
        resolved: { type: Boolean, default: false },
        resolution: { type: String },
    }],
}, { timestamps: true });

// Helper function to check if a full cycle is complete
CommunitySchema.methods.isCompleteCycle = function () {
    const lastCycle = this.cycles[this.cycles.length - 1];
    return lastCycle && lastCycle.isComplete;
};

// Start a new mid-cycle
CommunitySchema.methods.startMidCycle = async function () {
    const currentCycle = this.cycles.find(c => !c.isComplete);
    if (!currentCycle) throw new Error('No active cycle found.');

    const nextInLine = this.members.find(m => m.position === currentCycle.midCycles.length + 1);
    if (!nextInLine) throw new Error('No eligible member for payout.');

    this.midCycle.push({
        cycleNumber: currentCycle.cycleNumber,
        nextInLine: { userId: nextInLine.userId },
        contributors: [],
        missedContributions: [],
    });

    await this.save();
};

// Finalize a mid-cycle
CommunitySchema.methods.finalizeMidCycle = async function () {
    const currentMidCycle = this.midCycle.find(m => !m.isComplete);
    if (!currentMidCycle) throw new Error('No active mid-cycle found.');

    const totalContributed = currentMidCycle.contributors.reduce((sum, c) => sum + c.amount, 0);
    const backupDeduction = (totalContributed * this.settings.backupFundPercentage) / 100;
    const payoutAmount = totalContributed - backupDeduction;

    // Update backup fund
    this.backupFund += backupDeduction;

    // Pay the next-in-line
    const wallet = await Wallet.findOne({ userId: currentMidCycle.nextInLine.userId });
    if (!wallet) throw new Error('Wallet not found for payout member.');
    wallet.availableBalance += payoutAmount;
    await wallet.save();

    currentMidCycle.payoutAmount = payoutAmount;
    currentMidCycle.isComplete = true;

    // Handle missed contributions and penalties
    currentMidCycle.missedContributions.forEach(async (missedId) => {
        const member = this.members.find(m => m.userId.equals(missedId));
        if (member) {
            member.penalty += this.settings.penalty;
            member.missedContributions.push({
                cycleNumber: currentMidCycle.cycleNumber,
                midCycles: [currentMidCycle._id],
                amount: this.settings.penalty,
                nextInLineMissed: { userId: currentMidCycle.nextInLine.userId },
            });

            if (member.missedContributions.length >= this.settings.numMissContribution) {
                member.status = 'inactive';
            }
        }
    });

    await this.save();
};

// Finalize a complete cycle
CommunitySchema.methods.finalizeCompleteCycle = async function () {
    const currentCycle = this.cycles.find(c => !c.isComplete);
    if (!currentCycle) throw new Error('No active complete cycle found.');

    currentCycle.isComplete = true;
    currentCycle.endDate = new Date();

    if (this.positioningMode === 'Random') {
        await this.randomizePositions();
    } else {
        this.members.forEach(member => (member.contributionPaid = false));
    }

    this.cycleState = 'Completed';
    await this.save();
};

// Randomize positions for the next cycle
CommunitySchema.methods.randomizePositions = function () {
    const shuffledMembers = this.members.filter(m => m.status === 'active').sort(() => Math.random() - 0.5);
    shuffledMembers.forEach((member, index) => {
        member.position = index + 1;
    });
    this.members = shuffledMembers;
};


// Middleware to update user contributions when a mid-cycle is finalized
CommunitySchema.post('save', async function (doc, next) {
    try {
      if (doc.isModified('midCycle')) {
        const lastMidCycle = doc.midCycle[doc.midCycle.length - 1];
        if (lastMidCycle && lastMidCycle.isComplete) {
          for (const contributor of lastMidCycle.contributors) {
            await User.updateUserContributions(contributor.contributorId, doc._id, {
              amount: contributor.amount,
              cycleId: lastMidCycle.cycleNumber,
              midCycleId: lastMidCycle._id,
            });
          }
  
          // Handle penalties for missed contributions
          for (const missedContributor of lastMidCycle.missedContributions) {
            const penaltyAmount = doc.settings.penalty;
            await User.findByIdAndUpdate(missedContributor, {
              $inc: { 'contributions.$[elem].penalty': penaltyAmount },
            }, {
              arrayFilters: [{ 'elem.communityId': doc._id }],
            });
          }
        }
      }
      next();
    } catch (err) {
      console.error('Error updating user contributions from community:', err);
      next(err);
    }
  });
  
  // Middleware to handle user-community synchronization when users join or leave
  CommunitySchema.post('save', async function (doc, next) {
    try {
      if (doc.isModified('members')) {
        const updatedMembers = doc.members.map((member) => member.userId.toString());
        const existingUsers = await User.find({ communities: doc._id });
        const existingMemberIds = existingUsers.map((user) => user._id.toString());
  
        // Add community to new members
        for (const memberId of updatedMembers) {
          if (!existingMemberIds.includes(memberId)) {
            await User.findByIdAndUpdate(memberId, {
              $addToSet: { communities: doc._id },
            });
          }
        }
  
        // Remove community from users no longer part of the community
        for (const userId of existingMemberIds) {
          if (!updatedMembers.includes(userId)) {
            await User.findByIdAndUpdate(userId, {
              $pull: { communities: doc._id },
            });
          }
        }
      }
      next();
    } catch (err) {
      console.error('Error synchronizing user-community data:', err);
      next(err);
    }
  });
  

module.exports = mongoose.model('Community', CommunitySchema);

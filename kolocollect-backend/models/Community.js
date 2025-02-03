const mongoose = require('mongoose');
const Wallet = require('../models/Wallet'); // Ensure Wallet model is imported
const User = require('../models/User'); // Ensure User model is imported
const fs = require('fs');
const Contribution = require('../models/Contribution'); // Import the Contribution model


const { calculateNextPayoutDate } = require('../utils/payoutUtils');


const CommunitySchema = new mongoose.Schema({
    name: { type: String, required: true },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    totalContribution: { type: Number, default: 0 },
    description: {type: String},
    backupFund: { type: Number, default: 0 },
    lockPayout: { type: Boolean, default: false },

    // Tracks individual mid-cycle contributions and payouts
    midCycle: [{
        cycleNumber: { type: Number, required: true },
        contributors: {
            type: Map, // Use a Map-like object for better structure
            of: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contribution' }],
        },
        midCycleJoiners: [{ 
            joiners: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
            paidMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Define as an array of ObjectIds
            isComplete: { type: Boolean, default: false },
        
        }],
        nextInLine: {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        },
        defaulters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        isComplete: { type: Boolean, default: false },
        isReady: { type: Boolean, default: false },
        payoutAmount: { type: Number },
        payoutDate: { type: Date },
        contributionsToNextInLine: {
            type: Map,
            of: Number,
            default: {}
        },
    }],
    

    cycles: [{
        cycleNumber: { type: Number, required: true },
        midCycles: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MidCycle',
        }],
        isComplete: { type: Boolean, default: false },
        startDate: { type: Date },
        endDate: { type: Date },
        paidMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], 

    }],

    members: [{
        name: {type: String, required: true},
        email: {type: String, required: true},
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        position: { type: Number },
        contributionPaid: [{
            amount: {type: Number, default: 0},
            count: {type: Number, default: 0}

        }],
        status: { type: String, default: 'active' },
        penalty: { type: Number, default: 0 },
        missedContributions: [{
            cycleNumber: { type: Number, required: true },
            midCycles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MidCycle' }],
            amount: { type: Number },
            nextInLineMissed: {
                userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            },
        }],
        paymentPlan: {
            type: { type: String, enum: ['Full', 'Incremental', 'Shortfall'], default: 'Full' },
            totalPreviousContribution: { type: Number, default: 0 },
            remainingAmount: { type: Number, default: 0 },
            paidContribution: {type: Number, default: 0},
            previousContribution: { type: Number, default: 0 },
            installments: { type: Number, default: 0 },
        },
    }],

    nextPayout: { type: Date }, // Date of the next payout
  payoutDetails: {
    nextRecipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cycleNumber: { type: Number },
    payoutAmount: { type: Number, default: 0 },
    midCycleStatus: {type: String, default: "Just Started"}
  },

    // Settings
    settings: {
        contributionFrequency: { type: String, enum: ['Daily', 'Weekly', 'Monthly', 'Hourly'], default: 'Weekly' },
        maxMembers: { type: Number, default: 100 },
        backupFundPercentage: { type: Number, default: 10 },
        isPrivate: { type: Boolean, default: false },
        minContribution: { type: Number, default: 30 },
        penalty: { type: Number, default: 10 },
        numMissContribution: { type: Number, default: 3 },
        firstCycleMin: { type: Number, default: 5 }, // Add firstCycleMin to settings
    },

    positioningMode: { type: String, enum: ['Random', 'Fixed'], default: 'Random' },
    cycleLockEnabled: { type: Boolean, default: false },
    firstCycleMin: { type: Number, default: 5 }, // Root-level firstCycleMin for syncing
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


CommunitySchema.methods.syncMidCyclesToCycles = async function () {
    try {
        this.cycles.forEach((cycle) => {
            const relatedMidCycles = this.midCycle.filter(mc => mc.cycleNumber === cycle.cycleNumber);
            const validMidCycles = relatedMidCycles.filter(mc => mc && mc._id);

            if (validMidCycles.length !== relatedMidCycles.length) {
                console.warn('Some mid-cycles were invalid and excluded during synchronization.');
            }

            cycle.midCycles = validMidCycles.map(mc => mc._id);
            console.log(`Synchronized mid-cycles for cycle ${cycle.cycleNumber}:`, cycle.midCycles);
        });
        await this.save();
    } catch (err) {
        console.error('Error syncing mid-cycles to cycles:', err);
        throw err;
    }
};


CommunitySchema.methods.isMidCycleActive = function () {
    return this.midCycle.some(midCycle => !midCycle.isComplete);
  };

// Sync and Validate firstCycleMin
CommunitySchema.methods.syncFirstCycleMin = async function (newFirstCycleMin) {
    // Enforce a minimum of 5
    if (newFirstCycleMin < 5) {
        throw new Error('firstCycleMin cannot be less than 5.');
    }

    // Update both root-level and settings-level values
    this.firstCycleMin = newFirstCycleMin;
    this.settings.firstCycleMin = newFirstCycleMin;

    // Save the updated document
    await this.save();
};

// Post-save hook to check member count and start the first cycle
CommunitySchema.post('save', async function (doc, next) {
    try {
      // Ensure no cycles exist and member count matches the firstCycleMin
      if (doc.cycles.length === 0 && doc.members.length >= doc.firstCycleMin) {
        console.log('First cycle conditions met, starting first cycle...');
        const result = await doc.startFirstCycle();
        console.log(result.message); // Log success message for debugging
      }
    } catch (err) {
      console.error('Error in post-save hook for starting first cycle:', err);
      next(err); // Pass the error to Mongoose middleware chain
    } finally {
      next(); // Ensure next middleware is called to avoid hanging
    }
  });
  

// Hook to validate settings update
CommunitySchema.pre('save', function (next) {
    if (this.settings.firstCycleMin < 5) {
        this.settings.firstCycleMin = 5; // Ensure minimum value in settings
    }
    this.firstCycleMin = this.settings.firstCycleMin; // Sync root-level with settings
    next();
});


// CommunitySchema.methods.updateMidCycleStatus = async function () {
//     try {
//         // Find the active mid-cycle
//         const activeMidCycle = this.midCycle.find((c) => !c.isComplete);
//         if (!activeMidCycle) throw new Error('No active mid-cycle found.');

//         console.log('Active MidCycle Before Update:', JSON.stringify(activeMidCycle, null, 2));

//         // Get all eligible members
//         const eligibleMembers = this.members.filter((m) => m.status === 'active');

//         // Check if all eligible members have contributed
//         const allContributed = eligibleMembers.every((member) =>
//             activeMidCycle.contributors.some((contributor) => contributor.contributorId.equals(member.userId))
//         );

//         // Update the mid-cycle's readiness and payout amount
//         activeMidCycle.isReady = allContributed;
//         if (allContributed) {
//             // Calculate the total contributions and payout amount
//             const totalContributions = this.totalContribution;
//             const backupDeduction = this.backupFund;
//             const payoutAmount = totalContributions - backupDeduction;

//             activeMidCycle.payoutAmount = payoutAmount;

//             console.log(`Mid-cycle is ready. Payout of €${payoutAmount.toFixed(2)} scheduled.`);
//         } else {
//             console.log('Not all eligible members have contributed. Mid-cycle is not ready.');
//         }

//         // Save the mid-cycle updates
//         await this.save();

//         // Call updatePayoutInfo to handle payoutDetails updates if needed
//         await this.updatePayoutInfo();

//         return activeMidCycle.isReady;
//     } catch (err) {
//         console.error('Error updating mid-cycle status:', err);
//         throw err;
//     }
// };



// Centralized method to handle wallet operations for defaulters


CommunitySchema.methods.handleWalletForDefaulters = async function (userId, action = 'freeze') {
    try {
        const member = this.members.find(m => m.userId.equals(userId));
        if (!member) throw new Error('Member not found.');
        if (!this.admin.equals(currentUser._id)) {
            throw new AuthorizationError('NOT_AUTHORIZED', 'Only community admin can perform wallet operations');
        }

        const wallet = await mongoose.model('Wallet').findOne({ userId });
        if (!wallet) throw new Error('Wallet not found.');

        // Check if the member has received a payout
        const receivedPayout = this.midCycle.some(
            (midCycle) => midCycle.nextInLine.userId.equals(userId)
        );

        if (receivedPayout) {
            const totalPenalty = this.settings.penalty * member.missedContributions.length;

            if (action === 'freeze') {
                if (wallet.availableBalance > 0) {
                    wallet.isFrozen = true;
                    await wallet.save();
                }
            } else if (action === 'deduct') {
                if (wallet.availableBalance >= totalPenalty) {
                    wallet.availableBalance -= totalPenalty; // Deduct full penalty
                    member.penalty = 0; // Clear penalty
                } else {
                    wallet.availableBalance = 0; // Deduct all available funds
                    member.penalty = totalPenalty - wallet.availableBalance; // Remaining penalty
                }
                wallet.isFrozen = false; // Unfreeze wallet after deduction
                await wallet.save();
            }
        }

        await this.save();
        return { message: `Wallet handled successfully for action: ${action}.` };
    } catch (err) {
        console.error(`Error in handleWalletForDefaulters (${action}):`, err);
        throw err;
    }
};


// Helper function to check if a full cycle is complete
CommunitySchema.methods.isCompleteCycle = function () {
    const lastCycle = this.cycles[this.cycles.length - 1];
    return lastCycle && lastCycle.isComplete;
};

// Check if the first cycle can start
CommunitySchema.methods.startFirstCycle = async function () {
    try {
        // Ensure there are no cycles yet and the minimum required members have joined
        if (this.cycles.length === 0 && this.members.length >= this.firstCycleMin) {
            const firstCycle = {
                cycleNumber: 1,
                midCycles: [],
                isComplete: false,
                startDate: new Date(),
            };

            // Ensure the admin is assigned position 1
            const adminMember = this.members.find(member => member.position === 1);
            if (!adminMember) {
                throw new Error('Admin must have position 1 before the first cycle starts.');
            }

            // Assign random positions to non-admin members for the first cycle
            const nonAdminMembers = this.members.filter(member => member.position !== 1);
            const assignedPositions = [];

            nonAdminMembers.forEach(member => {
                let randomPosition;
                do {
                    randomPosition = Math.floor(Math.random() * (this.firstCycleMin - 1)) + 2;
                } while (assignedPositions.includes(randomPosition));
                member.position = randomPosition;
                assignedPositions.push(randomPosition);
            });

            // Add the first cycle to the community
            this.cycles.push(firstCycle);
            await this.save();

            // Automatically start the first mid-cycle
            await this.startMidCycle();

            await this.updatePayoutInfo()


            return { message: 'First cycle and its mid-cycle have started successfully.' };
        } else {
            throw new Error('First cycle cannot start due to insufficient members or existing cycles.');
        }
    } catch (err) {
        console.error('Error starting first cycle:', err);
        throw err;
    }
};

// Start a new cycle
CommunitySchema.methods.startNewCycle = async function () {
    try {


        // Ensure the current cycle is complete
        const activeCycle = this.cycles.find((c) => !c.isComplete);
        if (activeCycle) {
            throw new Error('Cannot start a new cycle until the current cycle is complete.');
        }

        // Determine the new cycle number
        const newCycleNumber = (this.cycles[this.cycles.length - 1]?.cycleNumber || 0) + 1;

        // Handle positioningMode based on community votes or settings only if the topic is 'positioningMode'
        const voteForPositioningMode = this.votes.find(v => v.topic === 'positioningMode' && v.resolved);
        const positioningMode = voteForPositioningMode ? voteForPositioningMode.resolution : this.positioningMode;

        if (positioningMode === 'Random') {
            const assignedPositions = [];
            this.members.forEach((member) => {
                let randomPosition;
                do {
                    randomPosition = Math.floor(Math.random() * this.members.length) + 1;
                } while (assignedPositions.includes(randomPosition));
                member.position = randomPosition;
                assignedPositions.push(randomPosition);
            });
        } else if (positioningMode === 'Fixed') {
            this.members.sort((a, b) => a.userId.toString().localeCompare(b.userId.toString()));
            this.members.forEach((member, index) => {
                member.position = index + 1;
            });
        }

        // Reset member contributions and penalties
        this.members.forEach((member) => {
            member.penalty = 0;
            member.missedContributions = [];
            member.status = 'active';
        });

        // Create a new cycle object
        const newCycle = {
            cycleNumber: newCycleNumber,
            midCycles: [],
            isComplete: false,
            startDate: new Date(),
        };

        // Add the new cycle to the cycles array
        this.cycles.push(newCycle);

        // Automatically start the first mid-cycle of the new cycle
        await this.startMidCycle();

        await this.updatePayoutInfo()


        // Save the community
        await this.save();

        return { message: `Cycle ${newCycleNumber} started successfully.` };
    } catch (err) {
        console.error('Error starting a new cycle:', err);
        throw err;
    }
};


// Handle new members joining mid-cycle (not first cycle rule)
CommunitySchema.methods.addNewMemberMidCycle = async function (userId, name, email, contributionAmount) {
  try {
    // Find the active cycle
    const activeCycle = this.cycles.find((c) => !c.isComplete);
    if (!activeCycle) throw new Error('No active cycle found.');

    // Find the active mid-cycle for the current active cycle
    const activeMidCycle = this.midCycle.find(
      (mc) => mc.cycleNumber === activeCycle.cycleNumber && !mc.isComplete
    );
    if (!activeMidCycle) throw new Error('No active mid-cycle found.');

    // Calculate missed contributions and required contribution amount
    const missedCycles = activeCycle.midCycles.length;
    const totalAmount = (missedCycles + 1) * this.settings.minContribution;
    console.log("Total Amount: ", totalAmount);

    let requiredContribution;
    if (missedCycles <= Math.floor(this.members.length / 2)) {
      requiredContribution = this.settings.minContribution + totalAmount * 0.5;
    } else {
      const missedPercentage = missedCycles / this.members.length;
      requiredContribution = missedPercentage * totalAmount;
    }

    // Validate contribution amount
    if (contributionAmount < requiredContribution) {
      throw new Error(
        `Insufficient contribution. You must contribute at least €${requiredContribution.toFixed(2)} to join mid-cycle.`
      );
    }

    // Calculate net contribution after accounting for backup fund
    const backupFund = (this.settings.backupFundPercentage / 100) * contributionAmount;
    this.backupFund += backupFund;

    // Deduct the remaining amount from the wallet
    const Wallet = mongoose.model('Wallet');
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) throw new Error('Wallet not found.');

    const remainingAmount = contributionAmount - this.settings.minContribution;
    if (wallet.availableBalance < remainingAmount) {
      throw new Error('Insufficient wallet balance for the contribution.');
    }

    // Use the addTransaction method to deduct the amount
    await wallet.addTransaction(
      remainingAmount,
      'contribution',
      `Contribution to community ${this.name}`,
      null,
      this._id
    );

    // Ensure activeCycle.paidMembers is initialized
    if (!Array.isArray(activeCycle.paidMembers)) {
      activeCycle.paidMembers = [];
    }

    // Add the new member to the community
    const newMember = {
      userId,
      name,
      email,
      position: this.members.length + 1,
      status: 'active',
      penalty: 0,
      missedContributions: [],
      paymentPlan: {
        type: 'Incremental',
        totalPreviousContribution: this.settings.minContribution * activeCycle.paidMembers.length,
        remainingAmount: (totalAmount - this.settings.minContribution) - (contributionAmount - this.settings.minContribution),
        paidContribution: this.settings.minContribution,
        previousContribution: contributionAmount - this.settings.minContribution,
        installments: 1,
      },
    };

    this.members.push(newMember);

    // Push userId inside midCycleJoiners along with a snapshot of current paidMembers
    activeMidCycle.midCycleJoiners.push({
      joiners: new mongoose.Types.ObjectId(userId),
      paidMembers: activeCycle.paidMembers.map(id => new mongoose.Types.ObjectId(id))
    });

    await this.save();

    // Use the appropriate Contribution method to handle the contribution logic
    const Contribution = mongoose.model('Contribution');
    await Contribution.createContribution(userId, this._id, this.settings.minContribution, activeMidCycle._id);

    console.log(`Member ${name} successfully added and contributed during mid-cycle.`);
    return { message: `Member successfully added during mid-cycle.` };
  } catch (err) {
    throw new Error(`Failed to add new member mid-cycle: ${err.message}`);
  }
};



// Apply resolved votes after the current cycle ends
CommunitySchema.methods.applyResolvedVotes = async function () {
    try {
        /// Check if there is an active cycle (a cycle that is not completed).
        const activeCycle = this.cycles.find(c => !c.isComplete);

        /// Only proceed with applying votes if there is no active cycle.
        /// Resolved votes can only be applied between cycles to prevent mid-cycle disruptions.
        if (!activeCycle) {
            /// Filter all resolved votes and apply the resolutions to the community settings.
            this.votes
                .filter(vote => vote.resolved) /// Only process votes that have been resolved.
                .forEach(vote => {
                    if (vote.topic === 'positioningMode') {
                        /// If the topic is 'positioningMode', update the community's positioning mode.
                        this.positioningMode = vote.resolution;
                    }

                    if (vote.topic === 'lockPayout') {
                        /// If the topic is 'lockPayout', ensure resolution is handled as a boolean.
                        this.lockPayout = vote.resolution === 'true' || vote.resolution === true;
                    }

                    if (vote.topic === 'paymentPlan') {
                        /// If the topic is 'paymentPlan', apply the new payment plan setting to all members.
                        this.members.forEach(m => {
                            m.paymentPlan.type = vote.resolution;
                        });
                    }

                    if (vote.topic === 'custom') {
                        /// Handle any custom settings or additional functionality as needed.
                        console.log(`Custom vote topic "${vote.topic}" with resolution: ${vote.resolution}`);
                    }
                });

            /// Clear resolved votes from the community to prevent re-application.
            this.votes = this.votes.filter(vote => !vote.resolved);

            /// Save the updated community with the applied vote resolutions.
            await this.save();
        }
    } catch (err) {
        /// Log any errors that occur during the application of resolved votes for debugging.
        console.error('Error applying resolved votes:', err);
        throw err; /// Propagate the error to the caller.
    }
};


// Start a new mid-cycle
CommunitySchema.methods.startMidCycle = async function () {
    try {
        const activeCycle = this.cycles.find((c) => !c.isComplete);
        if (!activeCycle) throw new Error('No active cycle found.');

        const activeMembers = this.members
            .filter((m) => m.status === 'active' && m.position !== null)
            .sort((a, b) => a.position - b.position);

        if (!Array.isArray(activeCycle.midCycles)) {
            activeCycle.midCycles = [];
        }

        const nextInLine = activeMembers.find(
            (m) => !activeCycle.paidMembers.some((paidMemberId) => paidMemberId.equals(m.userId))
        );

        if (!nextInLine) {
            throw new Error('No eligible member found for payout.');
        }

        const newMidCycle = {
            cycleNumber: activeCycle.cycleNumber,
            nextInLine: { userId: nextInLine.userId },
            contributors: new Map(),
            missedContributions: [],
            isComplete: false,
            isReady: false,
            payoutAmount: 0,
            contributionsToNextInLine: new Map(),
            payoutDate: calculateNextPayoutDate(this.settings.contributionFrequency) // Calculate and set payoutDate
        };

        if (newMidCycle && newMidCycle.cycleNumber && newMidCycle.nextInLine?.userId) {
            this.midCycle.push(newMidCycle);
            if (newMidCycle._id) {
                activeCycle.midCycles.push(newMidCycle._id);
                console.log('Mid-cycle added successfully:', newMidCycle);
            } else {
                console.error('Invalid mid-cycle _id:', newMidCycle);
            }
        } else {
            console.error('Invalid mid-cycle data:', newMidCycle);
            throw new Error('Failed to create a valid mid-cycle.');
        }
        
        await this.updatePayoutInfo()

        this.markModified('midCycle');
        this.markModified('cycles');
        await this.save();

        console.log(`Next in line for payout: User ID ${nextInLine.userId}`);
        return { message: 'Mid-cycle started successfully.', midCycle: newMidCycle };
    } catch (err) {
        console.error('Error starting mid-cycle:', err);
        throw err;
    }
};


// RECORDS
CommunitySchema.methods.record = async function (contribution) {
    let retries = 3;
    while (retries-- > 0) {
        try {
            // Get fresh community instance
            const freshCommunity = await this.model('Community').findById(this._id);
            if (!freshCommunity) throw new Error('Community not found');

            const { contributorId, recipientId, amount, contributionId } = contribution;
            const activeMidCycle = freshCommunity.midCycle.find(mc => !mc.isComplete);
            
            // Validate inputs
            if (!contributorId || !recipientId || !contributionId) {
                throw new Error('Contributor ID, Recipient ID, and Contribution ID are required.');
            }
            if (!amount || amount <= 0) {
                throw new Error('Contribution amount must be greater than zero.');
            }
            if (!activeMidCycle) {
                throw new Error('No active mid-cycle found.');
            }

            // Update contributors map
            if (!activeMidCycle.contributors.has(contributorId)) {
                activeMidCycle.contributors.set(contributorId, []);
            }
            activeMidCycle.contributors.get(contributorId).push(contributionId);

            // Update contributionsToNextInLine
            const currentTotal = activeMidCycle.contributionsToNextInLine.get(contributorId) || 0;
            activeMidCycle.contributionsToNextInLine.set(contributorId, currentTotal + amount);

            // Calculate totals using fresh data
            const midCycleTotal = await mongoose.model('Contribution').aggregate([
                { $match: { midCycleId: activeMidCycle._id } },
                { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
            ]);

            const midCycleTotalAmount = midCycleTotal[0]?.totalAmount || 0;
            const midCycleBackupFund = (freshCommunity.settings.backupFundPercentage / 100) * midCycleTotalAmount;
            
            // Update community stats
            freshCommunity.backupFund += midCycleBackupFund;
            freshCommunity.totalContribution += amount;
            activeMidCycle.payoutAmount = midCycleTotalAmount - midCycleBackupFund;

            // Validate and update
            const validationResult = await freshCommunity.validateMidCycleAndContributions();
            await freshCommunity.updatePayoutInfo();

            // Save with version tracking
            freshCommunity.markModified('midCycle');
            await freshCommunity.save();

            return {
                message: 'Contribution recorded successfully.',
                totalContribution: freshCommunity.totalContribution,
                backupFund: freshCommunity.backupFund,
                midCycleBackupFund,
                validationMessage: validationResult.message,
                isMidCycleReady: activeMidCycle.isReady,
            };

        } catch (err) {
            if (err.name === 'VersionError' && retries > 0) {
                console.log(`Retrying record operation (${retries} retries left)`);
                continue;
            }
            throw err;
        }
    }
};



// Update next payout details
CommunitySchema.methods.updatePayoutInfo = async function () {
    try {
        // Get the active cycle and mid-cycle
        const activeCycle = this.cycles.find((cycle) => !cycle.isComplete);
        const activeMidCycle = this.midCycle.find((midCycle) => !midCycle.isComplete);

        let nextRecipient = null;
        let payoutAmount = 0;
        let payoutDate = null;

        if (activeMidCycle) {
            // If there is an active mid-cycle, use its details for payout
            nextRecipient = activeMidCycle.nextInLine?.userId;
            payoutAmount = activeMidCycle.payoutAmount || 0;
            payoutDate = activeMidCycle.payoutDate || calculateNextPayoutDate(this.settings.contributionFrequency);

            // Validate next recipient
            if (!nextRecipient) {
                console.warn('No next-in-line user for payout.');
            }
        }

        // Determine mid-cycle status based on active mid-cycle and cycle details
        const midCycleStatus = activeMidCycle
            ? activeMidCycle.isReady
                ? "Ready for Payout"
                : `In Progress, Length => ${this.midCycle.length}, `
            : activeCycle
            ? "Cycle In Progress"
            : "No Active Cycle";

        // Update payout details
        this.payoutDetails = {
            nextRecipient,
            cycleNumber: activeCycle?.cycleNumber || 0,
            payoutAmount,
            midCycleStatus,
        };

        // Update next payout date if applicable
        this.nextPayout = payoutDate;

        // If a recipient exists, update their payout information
        if (nextRecipient) {
            const User = mongoose.model('User');
            const recipient = await User.findById(nextRecipient);
            if (recipient) {
                await recipient.updateUserPayouts(this);
            }
        }

        // Save the updated community state
        await this.save();
        console.log('Payout info updated successfully:', this.payoutDetails);
    } catch (err) {
        console.error('Error updating payout info:', err);
        throw err;
    }
};


CommunitySchema.methods.validateMidCycleAndContributions = async function () {
    try {
        const activeMidCycle = this.midCycle.find((mc) => !mc.isComplete);
        if (!activeMidCycle) {
            throw new Error('No active mid-cycle found.');
        }

        const activeCycle = this.cycles.find((c) => !c.isComplete);
        if (!activeCycle) {
            throw new Error('No active cycle found.');
        }

        if (!activeCycle.midCycles.includes(activeMidCycle._id)) {
            activeCycle.midCycles.push(activeMidCycle._id);
            console.log(`Linked mid-cycle ${activeMidCycle._id} to cycle ${activeCycle.cycleNumber}.`);
        }

        const eligibleMembers = this.members.filter((m) => m.status === 'active');
        const allContributed = eligibleMembers.every((member) => {
            const contributionIds = activeMidCycle.contributors.get(member.userId.toString());
            return contributionIds && contributionIds.length > 0;
        });

        activeMidCycle.isReady = allContributed;
        console.log(
            allContributed
                ? 'All contributions validated. Mid-cycle is ready.'
                : 'Not all members have contributed. Mid-cycle is not ready.'
        );

        this.markModified('midCycle');
        this.markModified('cycles');
        await this.save();

        return {
            message: allContributed
                ? 'Mid-cycle is validated and ready for payout.'
                : 'Mid-cycle validated. Waiting for remaining contributions.',
            isReady: activeMidCycle.isReady,
        };
    } catch (err) {
        console.error('Error validating mid-cycle and contributions:', err.message);
        throw err;
    }
};

// Distribute payouts to the next in line
CommunitySchema.methods.distributePayouts = async function () {
    try {
        // Find the active mid-cycle
        const activeMidCycle = this.midCycle.find((mc) => mc.isReady && !mc.isComplete);
        if (!activeMidCycle) {
            throw new Error('No mid-cycle ready for payout distribution.');
        }

        // Retrieve the next recipient
        const nextRecipientId = activeMidCycle.nextInLine.userId;
        const recipient = this.members.find((m) => m.userId.equals(nextRecipientId));
        if (!recipient || recipient.status !== 'active') {
            throw new Error('Next-in-line recipient is not eligible for payout.');
        }

        // Use the payout amount from the mid-cycle
        let payoutAmount = activeMidCycle.payoutAmount;
        if (payoutAmount <= 0) {
            throw new Error('Invalid payout amount.');
        }

        // Deduct the recipient's penalty from the payout amount
        const penalty = this.getMemberPenalty(nextRecipientId);
        payoutAmount -= penalty;
        this.backupFund += penalty;

        // Transfer funds to the recipient's wallet
        const Wallet = mongoose.model('Wallet');
        const recipientWallet = await Wallet.findOne({ userId: nextRecipientId });
        if (!recipientWallet) {
            throw new Error('Recipient wallet not found.');
        }
        await recipientWallet.addTransaction(
            payoutAmount,
            'payout',
            `Payout from community \"${this.name}\" mid-cycle.`,
            null,
            this._id
        );
        console.log(`Payout of €${payoutAmount} distributed to ${recipient.name}.`);

        // Mark the mid-cycle as complete
        activeMidCycle.isComplete = true;

        // Add the recipient to the paidMembers array in the active cycle
        const activeCycle = this.cycles.find((c) => !c.isComplete);
        if (activeCycle && !activeCycle.paidMembers.includes(nextRecipientId)) {
            activeCycle.paidMembers.push(nextRecipientId);
        }

        // Check if all active members have been paid
        const activeMembers = this.members.filter((m) => m.status === 'active').map((m) => m.userId.toString());
        const paidMembers = activeCycle.paidMembers.map((id) => id.toString());
        const allPaid = activeMembers.every((id) => paidMembers.includes(id));

        // Finalize the cycle if all members are paid
        if (allPaid) {
            await this.backPaymentDistribute();
            activeCycle.isComplete = true;
            activeCycle.endDate = new Date();

            // Start a new cycle
            const newCycleResult = await this.startNewCycle();
            console.log(newCycleResult.message);
        } else {
            // Start the next mid-cycle if cycle is not complete
            const newMidCycleResult = await this.startMidCycle();
            const newMidCycle = this.midCycle.find((mc) => !mc.isComplete);

            await this.updatePayoutInfo()

            // Recalculate `nextPayout`
            this.nextPayout = calculateNextPayoutDate(this.settings.contributionFrequency);

            console.log('New mid-cycle started:', newMidCycleResult.message);
        }

        // Save changes
        this.markModified('midCycle');
        this.markModified('payoutDetails');
        await this.save();

        return { message: `Payout of €${payoutAmount} distributed to ${recipient.name}.` };
    } catch (err) {
        console.error('Error distributing payouts:', err);
        throw err;
    }
};



CommunitySchema.methods.reactivateMember = async function (userId, contributionAmount) {
    try {
        const member = this.members.find(m => m.userId.equals(userId));
        if (!member) throw new Error('Member not found.');

        // Ensure the member is inactive
        if (member.status !== 'inactive') {
            throw new Error('Member is already active.');
        }

        // Calculate the required amount to reactivate
        const requiredContribution = this.settings.minContribution + (this.settings.penalty * this.settings.numMissContribution);


        // Check if the contribution is sufficient
        if (contributionAmount < requiredContribution) {
            throw new Error(
                `Insufficient contribution. You must pay at least €${(requiredContribution).toFixed(2)} to reactivate your membership.`
            );
        }





        // Reactivate the member
        member.status = 'active';
        member.penalty = 0; // Reset penalties
        member.missedContributions = []; // Clear missed contributions
        // member.contributionPaid = true; // Mark as contributed for the current cycle


        //update the backupFund 
        this.backupFund += contributionAmount;

        await this.save();

        return { message: 'Membership reactivated successfully!' };
    } catch (err) {
        console.error('Error reactivating member:', err);
        throw err;
    }
};


CommunitySchema.methods.calculateTotalOwed = function (userId) {
    try {
        // Find all mid-cycles where the user was the recipient
        const defaulterMidCycles = this.midCycle.filter(midCycle => 
            midCycle.nextInLine.userId.equals(userId)
        );

        if (!defaulterMidCycles || defaulterMidCycles.length === 0) {
            throw new Error('No payout records found for this user.');
        }

        let totalOwed = 0;

        // Calculate total owed for the mid-cycle in which the user received payout
        defaulterMidCycles.forEach(midCycle => {
            const totalContributions = this.members.length * this.settings.minContribution; // Total contributions from all members
            const backupDeduction = totalContributions * (this.settings.backupFundPercentage / 100); // Backup fund deduction
            const payoutReceived = totalContributions - backupDeduction; // Actual payout received by the user

            const minContributionPaid = this.settings.minContribution - 
                (this.settings.minContribution * (this.settings.backupFundPercentage / 100)); // Amount the user contributed

            const amountOwedForCycle = payoutReceived - minContributionPaid; // What they owe for the payout
            totalOwed += amountOwedForCycle; // Add to total owed
        });

        // Add penalties for missed contributions
        const defaulter = this.members.find(m => m.userId.equals(userId));
        if (!defaulter) {
            throw new Error('Member not found in the community.');
        }

        const penaltyAmount = this.settings.penalty * defaulter.missedContributions.length;
        totalOwed += penaltyAmount;

        return totalOwed;
    } catch (err) {
        console.error('Error calculating total owed:', err);
        throw err;
    }
};

CommunitySchema.methods.skipPayoutForDefaulters = async function (midCycleId) {
    try {
        const midCycle = this.midCycle.find(c => c._id.equals(midCycleId));
        if (!midCycle) throw new Error('MidCycle not found.');

        const defaulter = this.members.find(m => m.userId.equals(midCycle.nextInLine.userId));
        if (!defaulter) throw new Error('Defaulter not found.');

        if (defaulter.status === 'inactive') {
            // Skip payout and reassign to the next eligible member
            const nextEligible = this.members.find(m => m.status === 'active' && !midCycle.missedContributions.includes(m.userId));
            if (!nextEligible) {
                console.log('No eligible member found to reassign payout.');
                return { message: 'Payout skipped, but no eligible member found for reassignment.' };
            }

            midCycle.missedContributions.push(defaulter.userId); // Add to missed contributions
            midCycle.nextInLine.userId = nextEligible.userId; // Update next in line

            await this.updatePayoutInfo(); // Update payout details for reassignment
            await this.save();
            return { message: `Payout skipped for defaulter ${defaulter.userId} and reassigned to ${nextEligible.userId}.` };
        }

        return { message: 'No defaulters to skip payout for.' };
    } catch (err) {
        console.error('Error in skipPayoutForDefaulters:', err);
        throw err;
    }
};

CommunitySchema.methods.updateWalletForMissedContributions = async function (userId) {
    try {
        const member = this.members.find(m => m.userId.equals(userId));
        if (!member) throw new Error('Member not found.');

        // Check if the member has received a payout
        const receivedPayout = this.midCycle.some(
            (midCycle) => midCycle.nextInLine.userId.equals(userId)
        );

        if (member.missedContributions.length >= this.settings.numMissContribution) {
            member.status = 'inactive'; // Mark member as inactive

            // Freeze wallet only if the member has received a payout
            if (receivedPayout) {
                const wallet = await mongoose.model('Wallet').findOne({ userId });
                if (wallet && wallet.availableBalance > 0) {
                    wallet.isFrozen = true; // Freeze the wallet
                    await wallet.save();
                }
            }
        }

        await this.save();
        return { message: 'Member status updated. Wallet frozen if necessary.' };
    } catch (err) {
        console.error('Error in updateWalletForMissedContributions:', err);
        throw err;
    }
};

CommunitySchema.methods.deductPenaltiesFromWallet = async function (userId) {
    try {
        const member = this.members.find(m => m.userId.equals(userId));
        if (!member) throw new Error('Member not found.');

        // Check if the member has received a payout
        const receivedPayout = this.midCycle.some(
            (midCycle) => midCycle.nextInLine.userId.equals(userId)
        );

        if (receivedPayout) {
            const wallet = await mongoose.model('Wallet').findOne({ userId });
            if (!wallet) throw new Error('Wallet not found.');

            const totalPenalty = this.settings.penalty * member.missedContributions.length;

            if (wallet.availableBalance >= totalPenalty) {
                wallet.availableBalance -= totalPenalty; // Deduct full penalty
                member.penalty = 0; // Clear penalties
            } else {
                wallet.availableBalance = 0; // Deduct all available funds
                member.penalty = totalPenalty - wallet.availableBalance; // Remaining penalty
            }

            wallet.isFrozen = false; // Unfreeze wallet after deduction
            await wallet.save();
        }

        member.missedContributions = []; // Clear missed contributions
        member.status = 'active'; // Reactivate member
        await this.save();

        return { message: 'Penalties successfully deducted, and member reactivated.' };
    } catch (err) {
        console.error('Error in deductPenaltiesFromWallet:', err);
        throw err;
    }
};

// Method to update backup, total contribution, and related fields in CommunitySchema
CommunitySchema.methods.updateContributionStats = async function () {
    try {
        // Calculate the total contributions across all contributors in the active mid-cycle
        const activeMidCycle = this.midCycle.find((c) => !c.isComplete);
        if (!activeMidCycle) throw new Error('No active mid-cycle found.');

        let totalContributions = 0;
        activeMidCycle.contributors.forEach((contributor) => {
            contributor.contributions.forEach((contribution) => {
                totalContributions += contribution.amount;
            });
        });

        // Update the total contribution for the community
        this.totalContribution = totalContributions;

        // Calculate the backup fund based on the backupFundPercentage
        const backupPercentage = this.settings.backupFundPercentage || 0;
        this.backupFund = (backupPercentage / 100) * totalContributions;

        // Update the payout amount for the active mid-cycle
        const payoutAmount = totalContributions - this.backupFund;
        activeMidCycle.payoutAmount = payoutAmount;

        // Mark the mid-cycle as ready if all active members have contributed
        const eligibleMembers = this.members.filter((m) => m.status === 'active');
        const allContributed = eligibleMembers.every((member) =>
            activeMidCycle.contributors.some((contributor) => contributor.contributorId.equals(member.userId))
        );

        activeMidCycle.isReady = allContributed;

        // Save the updated community state
        this.markModified('midCycle');
        await this.save();

        console.log('Community stats updated successfully:', {
            totalContribution: this.totalContribution,
            backupFund: this.backupFund,
            payoutAmount: activeMidCycle.payoutAmount,
            isMidCycleReady: activeMidCycle.isReady,
        });

        return { message: 'Community contribution stats updated successfully.' };
    } catch (err) {
        console.error('Error updating contribution stats:', err);
        throw err;
    }
};

CommunitySchema.methods.backPaymentDistribute = async function () {
    try {
        // Loop through each cycle that is not complete
        for (const cycle of this.cycles.filter(c => !c.isComplete)) {
            // Loop through each paid member in the cycle
            for (const memberId of cycle.paidMembers) {
                const member = this.members.find(m => m.userId.equals(memberId));
                if (!member) {
                    console.warn(`Member not found for user ID: ${memberId}`);
                    continue;
                }

                const wallet = await mongoose.model('Wallet').findOne({ userId: memberId });
                if (!wallet) {
                    console.warn(`Wallet not found for user ID: ${memberId}`);
                    continue;
                }

                // Calculate the real amount to distribute
                const realAmount = member.paymentPlan.previousContribution * (1 + (this.settings.backupFundPercentage / 100));

                // Distribute the real amount evenly to each paid member
                const amountPerMember = realAmount / cycle.paidMembers.length;

                // Add the amount to the wallet
                await wallet.addTransaction(
                    amountPerMember,
                    'deposit',
                    `Back payment distribution from community ${this.name}`,
                    memberId,
                    this._id
                );

                console.log(`Back payment of €${amountPerMember} distributed to ${member.name}.`);
            }
        }

        // Save the updated community state
        await this.save();

        return { message: 'Back payment distribution completed successfully.' };
    } catch (err) {
        console.error('Error in backPaymentDistribute:', err);
        throw err;
    }
};

CommunitySchema.methods.remainder = function (userId) {
    try {
        const ObjectId = mongoose.Types.ObjectId;
        const userIdObj = new ObjectId(userId); // Convert to ObjectId
        const member = this.members.find(m => m.userId.equals(userIdObj));
        
        if (!member) {
            throw new Error('Member not found.');
        }

        // Return remaining amount only if installments are greater than 0
        if (member.paymentPlan.installments > 0) {
            return {
                message: `You owe €${member.paymentPlan.remainingAmount}.`,
                remainingAmount: member.paymentPlan.remainingAmount,
                installments: member.paymentPlan.installments
            };
        } else {
            return {
                message: 'No remaining amount.',
                remainingAmount: 0,
                installments: 0
            };
        }
    } catch (err) {
        console.error('Error in remainder method:', err);
        throw err;
    }
};


CommunitySchema.methods.markMidCycleCompleteForJoiner = async function (userId) {
  const session = await this.db.startSession();
  try {
    session.startTransaction();

    // Get fresh document in session to prevent VersionError
    const freshCommunity = await this.model('Community')
      .findById(this._id)
      .session(session)
      .exec();

    // Idempotency check
    const member = freshCommunity.members.find(m => m.userId.equals(userId));
    if (!member || member.paymentPlan.remainingAmount > 0) {
      await session.abortTransaction();
      return { message: 'Not eligible for completion' };
    }

    let found = false;
    for (const midCycle of freshCommunity.midCycle) {
      for (const joinerEntry of midCycle.midCycleJoiners) {
        if (joinerEntry.joiners?.equals(userId)) {
          joinerEntry.isComplete = true;
          found = true;
          freshCommunity.markModified('midCycle');
        }
      }
    }

    // Save the modified document using the session
    await freshCommunity.save({ session });

    await session.commitTransaction();
    return { message: 'Joiner marked complete successfully' };

  } catch (error) {
    await session.abortTransaction();
    console.error('Error in markMidCycleCompleteForJoiner:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

CommunitySchema.methods.payNextInLine = async function (contributorId, midCycleId, contributionAmount) {
    try {
        // Find the active cycle
        const activeCycle = this.cycles.find((c) => !c.isComplete);
        if (!activeCycle) {
            throw new Error('No active cycle found.');
        }

        // Find the mid-cycle with the given midCycleId that belongs to the active cycle
        const midCycle = this.midCycle.find(
            (mc) => mc._id.toString() === midCycleId.toString() && mc.cycleNumber === activeCycle.cycleNumber
        );
        if (!midCycle) {
            throw new Error('MidCycle not found or does not belong to the active cycle.');
        }

        // Retrieve the user ID of the current next in line
        const nextInLineId = midCycle.nextInLine?.userId;
        if (!nextInLineId) {
            throw new Error('No next in line found.');
        }

        // Handle the case where the contributor is the nextInLine
        if (contributorId.toString() === nextInLineId.toString()) {
            return {
                message: `The contributor is the next in line and cannot owe themselves.`,
                amountToDeduct: 0,
            };
        }

        let totalAmountOwed = 0;

        // Check if the contributor was previously a nextInLine and received payment from the current nextInLine
        if (this.cycles.some((cycle) => cycle.paidMembers.includes(contributorId))) {
            // Find the mid-cycle where the contributor was the next in line
            const previousMidCycle = this.midCycle.find(
                (mc) =>
                    mc.nextInLine?.userId?.toString() === contributorId.toString() &&
                    mc.cycleNumber === activeCycle.cycleNumber
            );

            if (previousMidCycle) {
                // Fetch how much the current nextInLine paid the contributor
                const nextInLineContribution = await mongoose.model('Contribution').findOne({
                    userId: nextInLineId,
                    midCycleId: previousMidCycle._id,
                });

                if (!nextInLineContribution) {
                    throw new Error('No contribution found for the next in line to the contributor.');
                }

                // Set the total amount owed to the amount paid by the nextInLine
                totalAmountOwed = nextInLineContribution.amount;
            }
        }

        // Calculate the difference between the total owed and the contributor's current contribution amount
        const amountToDeduct = Math.max(0, totalAmountOwed - contributionAmount);

        // If no payment is required (the contributor already covers the amount owed), return a success message
        if (amountToDeduct === 0) {
            return {
                message: `No payment required as the contribution amount (€${contributionAmount}) covers the total owed (€${totalAmountOwed}).`,
                amountToDeduct: 0,
            };
        }

        // Record the payment in the mid-cycle's contributors map
        midCycle.contributors.set(
            contributorId,
            (midCycle.contributors.get(contributorId) || []).concat(nextInLineId)
        );

        // Mark the midCycle as modified and save the changes to the community
        this.markModified('midCycle');
        await this.save();

        // Return a success message with the payment details
        return {
            message: `Amount to deduct: €${amountToDeduct}.`,
            amountToDeduct,
        };
    } catch (error) {
        console.error('Error in payNextInLine:', error);
        throw error;
    }
};

CommunitySchema.methods.startPayoutMonitor = function () {
    const checkInterval = 60 * 1000; // Check every minute

    setInterval(async () => {
        
        try {
            
            // Get fresh community instance
            const freshCommunity = await mongoose.model('Community').findById(this._id);
            if (!freshCommunity) return;

            // Find the active mid-cycle
            const activeMidCycle = freshCommunity.midCycle.find(mc => !mc.isComplete);
            if (!activeMidCycle?.payoutDate) {
                return;
            }

            // Check if the current date is past the payout date
            const now = new Date();
            if (now >= new Date(activeMidCycle.payoutDate)) {
                console.log(`Processing payout for midCycle ${activeMidCycle._id}`);

                // Handle unready mid-cycle logic using FRESH instance
                if (!activeMidCycle.isReady) {
                    const minContribution = freshCommunity.settings.minContribution;
                    const backupFundPercentage = freshCommunity.settings.backupFundPercentage / 100;
                    const additionalAmount = minContribution - (minContribution * backupFundPercentage);
                    let defaulterCount = 0;
                    const defaulters = [];

                    // Track defaulters and count them
                    freshCommunity.members.forEach(member => {
                        if (!activeMidCycle.contributors.has(member.userId.toString())) {
                            defaulters.push(member.userId);
                            defaulterCount++;
                        }
                    });

                    const totalAdditionalAmount = additionalAmount * defaulterCount;
                    
                    // Ensure the backup fund has enough money
                    if (freshCommunity.backupFund >= totalAdditionalAmount) {
                        // Update the fresh community instance
                        freshCommunity.backupFund -= totalAdditionalAmount;
                        activeMidCycle.payoutAmount += totalAdditionalAmount;
                        activeMidCycle.isReady = true;
                        activeMidCycle.defaulters = defaulters;
                    } else {
                        console.warn('Insufficient backup fund for additional amount.');
                    }

                    // Update the missed contributions for members
                    freshCommunity.members.forEach(member => {
                        if (!activeMidCycle.contributors.has(member.userId.toString())) {
                            member.missedContributions.push({
                                cycleNumber: activeMidCycle.cycleNumber,
                                midCycles: [activeMidCycle._id],
                                amount: minContribution,
                                nextInLineMissed: { userId: activeMidCycle.nextInLine.userId }
                            });

                            // Check if the member has missed too many contributions
                            if (member.missedContributions.length >= freshCommunity.settings.numMissContribution) {
                                member.status = 'inactive';
                            }else{
                                member.penalty += freshCommunity.settings.penalty;

                            }
                        }
                    });

                }

                // Distribute payouts using the fresh instance
                await freshCommunity.distributePayouts();
                console.log(`Payout successful for midCycle ${activeMidCycle._id}`);

                // Save the fresh instance
                await freshCommunity.save();
            }
        } catch (err) {
            console.error('Payout monitor error:', err);
        }
    }, checkInterval);
};

CommunitySchema.methods.payPenaltyAndMissedContribution = async function (userId, amount) {
    try {
        // Find the member by userId
        const member = this.members.find(m => m.userId.equals(userId));
        if (!member) throw new Error('Member not found.');

        // Calculate the total penalty based on missed contributions
        const totalPenalty = this.settings.penalty * member.missedContributions.length;

        // Initialize the total amount due with the total penalty
        let totalAmountDue = totalPenalty;

        // Check if the user has received a payout in any cycle
        if (this.cycles.some((cycle) => cycle.paidMembers.includes(userId))) {
            // Find all mid-cycles where the user was the next in line
            const defaulterMidCycles = this.midCycle.filter(midCycle => 
                midCycle.nextInLine.userId.equals(userId)
            );

            // Calculate the total amount owed based on contributions from next in line
            defaulterMidCycles.forEach(midCycle => {
                const nextInLineContribution = midCycle.contributors.get(userId.toString());
                if (nextInLineContribution) {
                    totalAmountDue += nextInLineContribution.reduce((sum, contributionId) => {
                        const contribution = this.contributions.id(contributionId);
                        return sum + (contribution ? contribution.amount : 0);
                    }, 0);
                }
            });
        } else {
            // If no payout received, add the minimum contribution to the total amount due
            totalAmountDue += this.settings.minContribution;
        }

        // Check if the provided amount is sufficient to cover the total amount due
        if (amount < totalAmountDue) {
            throw new Error(`Insufficient amount. You must pay at least €${totalAmountDue.toFixed(2)}.`);
        }

        // Update the backup fund and reset member's penalty and missed contributions
        this.backupFund += totalPenalty;
        member.penalty = 0;
        member.missedContributions = [];

        // Save the updated community state
        await this.save();
        return { message: 'Penalty and missed contributions paid successfully.' };
    } catch (err) {
        console.error('Error in payPenaltyAndMissedContribution:', err);
        throw err;
    }
};

CommunitySchema.methods.skipContributionAndMarkReady = async function (midCycleId, userIds = []) {
    try {
        const midCycle = this.midCycle.find(mc => mc._id.equals(midCycleId));
        if (!midCycle) throw new Error('MidCycle not found.');

        const activeMembers = this.members.filter(m => m.status === 'active');
        const allContributed = activeMembers.every(member =>
            userIds.includes(member.userId.toString()) || midCycle.contributors.has(member.userId.toString())
        );

        if (allContributed) {
            midCycle.isReady = true;
            await this.save();
            return { message: 'Mid-cycle marked as ready.' };
        } else {
            return { message: 'Not all active members have contributed.' };
        }
    } catch (err) {
        console.error('Error in skipContributionAndMarkReady:', err);
        throw err;
    }
};

CommunitySchema.statics.filterCommunity = function (criteria) {
    return this.model('Community').find(criteria);
};

CommunitySchema.statics.searchCommunity = function (keyword) {
    return this.find({
        $text: { $search: keyword }
    });
};

// Ensure text indexes are created on the name and description fields
CommunitySchema.index({ name: 'text', description: 'text' });

CommunitySchema.methods.getMemberPenalty = function (userId) {
    const member = this.members.find(m => m.userId.equals(userId));
    if (!member) throw new Error('Member not found.');
    return member.penalty;
};

module.exports = mongoose.model('Community', CommunitySchema);

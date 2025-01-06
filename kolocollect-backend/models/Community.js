const mongoose = require('mongoose');
const Wallet = require('../models/Wallet'); // Ensure Wallet model is imported
const User = require('../models/User'); // Ensure User model is imported
const fs = require('fs');

const { calculateNextPayoutDate } = require('../utils/payoutUtils');


const CommunitySchema = new mongoose.Schema({
    name: { type: String, required: true },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    totalContribution: { type: Number, default: 0 },
    backupFund: { type: Number, default: 0 },
    lockPayout: { type: Boolean, default: false },

    // Tracks individual mid-cycle contributions and payouts
    midCycle: [{
        cycleNumber: { type: Number, required: true },
        contributors: {
            type: Map, // Use a Map-like object for better structure
            of: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contribution' }],
        },
        nextInLine: {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        },
        missedContributions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        isComplete: { type: Boolean, default: false },
        isReady: { type: Boolean, default: false },
        payoutAmount: { type: Number },
        payoutDate: { type: Date },
    }],
    

    cycles: [{
        cycleNumber: { type: Number, requirepuserd: true },
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
        contributionPaid: { type: Boolean, default: false },
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
            type: { type: String, enum: ['Full', 'Incremental', 'Shortfall'], default: 'Incremental' },
            remainingAmount: { type: Number, default: 0 },
            installments: { type: Number, default: 0 },
        },
    }],

    nextPayout: { type: Date }, // Date of the next payout
  payoutDetails: {
    nextRecipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cycleNumber: { type: Number },
    payoutAmount: { type: Number, default: 0 },
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


CommunitySchema.methods.updateMidCycleStatus = async function () {
    try {
        // Find the active mid-cycle
        const activeMidCycle = this.midCycle.find((c) => !c.isComplete);
        if (!activeMidCycle) throw new Error('No active mid-cycle found.');

        console.log('Active MidCycle Before Update:', JSON.stringify(activeMidCycle, null, 2));

        // Get all eligible members
        const eligibleMembers = this.members.filter((m) => m.status === 'active');

        // Check if all eligible members have contributed
        const allContributed = eligibleMembers.every((member) =>
            activeMidCycle.contributors.some((contributor) => contributor.contributorId.equals(member.userId))
        );

        if (allContributed) {
            activeMidCycle.isReady = true;

            // Calculate total contributions from the community
            const totalContributions = this.totalContribution;
            const backupDeduction = this.backupFund;
            const payoutAmount = totalContributions - backupDeduction;

            activeMidCycle.payoutAmount = payoutAmount;

            console.log(
                `Mid-cycle is ready. Payout of €${payoutAmount.toFixed(
                    2
                )} scheduled.`
            );

            // Update community's next payout details
            const rawPayoutDate = calculateNextPayoutDate(this.settings.contributionFrequency);

            // Format the payout date
            const formattedPayoutDate = rawPayoutDate.toLocaleString('en-GB', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });

            this.payoutDetails = {
                nextRecipient: activeMidCycle.nextInLine?.userId,
                cycleNumber: activeMidCycle.cycleNumber,
                payoutAmount,
            };
            this.nextPayout = rawPayoutDate;
            activeMidCycle.payoutDate = rawPayoutDate;

            console.log(`Next payout scheduled for: ${formattedPayoutDate}`);
        } else {
            activeMidCycle.isReady = false;
            console.log('Not all eligible members have contributed. Mid-cycle is not ready.');
        }

        // Save the community
        await this.save();
        return activeMidCycle.isReady;
    } catch (err) {
        console.error('Error updating mid-cycle status:', err);
        throw err;
    }
};


// Centralized method to handle wallet operations for defaulters
CommunitySchema.methods.handleWalletForDefaulters = async function (userId, action = 'freeze') {
    try {
        const member = this.members.find(m => m.userId.equals(userId));
        if (!member) throw new Error('Member not found.');

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
            member.contributionPaid = false;
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
        const activeCycle = this.cycles.find(c => !c.isComplete);
        if (!activeCycle) throw new Error('No active cycle found.');

        // Find the active mid-cycle for the current active cycle
        const activeMidCycle = this.midCycle.find(mc => mc.cycleNumber === activeCycle.cycleNumber && !mc.isComplete);
        if (!activeMidCycle) throw new Error('No active mid-cycle found.');

        // Calculate missed contributions and the required contribution amount
        const missedCycles = activeCycle.midCycles.length;
        const missedAmount = missedCycles * this.settings.minContribution;

        let requiredContribution;
        if (missedCycles <= Math.floor(this.members.length / 2)) {
            requiredContribution = this.settings.minContribution + (missedAmount * 0.5);
        } else {
            const missedPercentage = missedCycles / this.members.length;
            requiredContribution = this.settings.minContribution + (missedPercentage * missedAmount);
        }

        // Validate the contribution amount
        if (contributionAmount < requiredContribution) {
            throw new Error(`Insufficient contribution. You must contribute at least €${requiredContribution.toFixed(2)} to join mid-cycle.`);
        }

        // Prepare the new member object
        const newMember = {
            userId,
            name,
            email,
            position: this.members.length + 1,
            status: 'active',
            contributionPaid: false,
            penalty: 0,
            missedContributions: [],
            paymentPlan: {
                type: 'Full',
                remainingAmount: missedAmount > contributionAmount ? missedAmount - contributionAmount : 0,
                installments: 0,
            },
        };

        // Add the new member to the community
        this.members.push(newMember);

        // Use the Contribution's createContribution method to handle the contribution logic
        const Contribution = mongoose.model('Contribution');
        const contributionData = {
            userId,
            communityId: this._id,
            amount: contributionAmount,
            midCycleId: activeMidCycle._id,
            cycleNumber: activeMidCycle.cycleNumber,
            status: 'completed',
        };

        // Call createContribution to handle contribution creation and validation
        const newContribution = new Contribution(contributionData);
        await newContribution.createContribution();

        // Save the updated community
        await this.save();

        return { message: `Member successfully added during mid-cycle.` };
    } catch (err) {
        console.error('Error adding new member mid-cycle:', err);
        throw err;
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
    try {
        const { contributorId, recipientId, amount, contributionId } = contribution;

        // Validate inputs
        if (!contributorId || !recipientId || !contributionId) {
            throw new Error('Contributor ID, Recipient ID, and Contribution ID are required.');
        }
        if (!amount || amount <= 0) {
            throw new Error('Contribution amount must be greater than zero.');
        }

        // Find the active mid-cycle
        const activeMidCycle = this.midCycle.find((mc) => !mc.isComplete);
        if (!activeMidCycle) {
            throw new Error('No active mid-cycle found.');
        }

        // Add the contribution ID to the mid-cycle contributors
        if (!activeMidCycle.contributors.has(contributorId)) {
            activeMidCycle.contributors.set(contributorId, []);
        }
        activeMidCycle.contributors.get(contributorId).push(contributionId);

        // Calculate total contributions for this mid-cycle
        const midCycleTotal = await mongoose.model('Contribution').aggregate([
            { $match: { midCycleId: activeMidCycle._id } },
            { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
        ]);

        const midCycleTotalAmount = midCycleTotal[0]?.totalAmount || 0;

        // Calculate backup fund and update stats
        const midCycleBackupFund = (this.settings.backupFundPercentage / 100) * midCycleTotalAmount;
        this.backupFund += midCycleBackupFund;
        this.totalContribution += amount;
        activeMidCycle.payoutAmount = midCycleTotalAmount - midCycleBackupFund;

        // Validate if the mid-cycle is ready for payout
        const validationResult = await this.validateMidCycleAndContributions();
        if (validationResult.isReady) {
            await this.updatePayoutInfo();
        }

        // Save the updated community
        this.markModified('midCycle');
        await this.save();

        return {
            message: 'Contribution recorded successfully.',
            totalContribution: this.totalContribution,
            backupFund: this.backupFund,
            midCycleBackupFund,
            validationMessage: validationResult.message,
            isMidCycleReady: validationResult.isReady,
        };
    } catch (err) {
        console.error('Error recording contribution:', err);
        throw err;
    }
};


// Update next payout details
CommunitySchema.methods.updatePayoutInfo = async function () {
    try {
        const activeMidCycle = this.midCycle.find(mc => mc.isReady && !mc.isComplete);
        if (!activeMidCycle) throw new Error('No mid-cycle ready for payout.');

        const nextRecipient = activeMidCycle.nextInLine?.userId;
        if (!nextRecipient) throw new Error('No next-in-line user for payout.');

        const payoutAmount = activeMidCycle.payoutAmount;
        const payoutDate = activeMidCycle.payoutDate || calculateNextPayoutDate(this.settings.contributionFrequency);
        if(payoutAmount>0){
            this.payoutDetails = {
                nextRecipient,
                cycleNumber: activeMidCycle.cycleNumber,
                payoutAmount,
            }
        }else{
            payoutAmount = 0;
        }

        this.nextPayout = payoutDate;

        // Update the payout information for the next recipient
        const User = mongoose.model('User');
        const recipient = await User.findById(nextRecipient);
        if (recipient) {
            await recipient.updateUserPayouts(this);
        }

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
        const payoutAmount = activeMidCycle.payoutAmount;
        if (payoutAmount <= 0) {
            throw new Error('Invalid payout amount.');
        }

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
            activeCycle.isComplete = true;
            activeCycle.endDate = new Date();

            // Start a new cycle
            const newCycleResult = await this.startNewCycle();
            console.log(newCycleResult.message);
        } else {
            // Start the next mid-cycle if cycle is not complete
            const newMidCycleResult = await this.startMidCycle();
            const newMidCycle = this.midCycle.find((mc) => !mc.isComplete);

            // Update `payoutDetails`
            this.payoutDetails = {
                payoutAmount: 0,
                cycleNumber: activeCycle.cycleNumber,
                nextRecipient: newMidCycle?.nextInLine?.userId || null,
            };

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

// Handle new members joining mid-cycle
// CommunitySchema.methods.addNewMemberMidCycle = async function (userId) {
//     try {
//         const activeCycle = this.cycles.find(c => !c.isComplete);
//         if (!activeCycle) throw new Error('No active cycle found.');

//         const missedCycles = activeCycle.midCycles.length;
//         const missedAmount = missedCycles * this.settings.minContribution;

//         const newMember = {
//             userId,
//             position: this.members.length + 1,
//             status: 'active',
//             penalty: 0,
//             missedContributions: [],
//             paymentPlan: {
//                 type: 'Full',
//                 remainingAmount: missedAmount,
//                 installments: 0,
//             },
//         };

//         this.members.push(newMember);
//         await this.save();
//     } catch (err) {
//         console.error('Error adding new member mid-cycle:', err);
//         throw err;
//     }
// };

// Process back payments
CommunitySchema.methods.processBackPayment = async function (userId, paymentAmount) {
    try {
        // Find the member in the community using their userId
        const member = this.members.find(m => m.userId.equals(userId));
        
        // If the member is not found, throw an error
        if (!member) throw new Error('Member not found.');

        // Check if the payment amount is enough to clear the remaining balance
        if (paymentAmount >= member.paymentPlan.remainingAmount) {
            // If the payment is sufficient to cover all outstanding balance:
            member.paymentPlan.remainingAmount = 0; // Clear the remaining balance
            member.paymentPlan.type = 'Full'; // Mark the payment plan as "Full" (all dues cleared)
        } else {
            // If the payment is partial:
            member.paymentPlan.remainingAmount -= paymentAmount; // Reduce the remaining balance
            member.paymentPlan.type = 'Incremental'; // Mark the payment plan as "Incremental" (partial payment ongoing)
            member.paymentPlan.installments += 1; // Increment the number of installments made
        }

        // Save the updated community with the member's new payment plan
        await this.save();
    } catch (err) {
        // Log any errors that occur during processing for debugging purposes
        console.error('Error processing back payment:', err);

        // Re-throw the error to ensure the caller is aware of the failure
        throw err;
    }
};


// Adjust payout for members with shortfalls
CommunitySchema.methods.adjustPayoutForShortfall = async function (userId) {
    try {
        const member = this.members.find(m => m.userId.equals(userId));
        if (!member) throw new Error('Member not found.');

        if (member.paymentPlan.remainingAmount > 0) {
            const shortfall = member.paymentPlan.remainingAmount;
            const adjustedPayout = this.settings.minContribution - shortfall;
            member.paymentPlan.remainingAmount = 0;
            return adjustedPayout > 0 ? adjustedPayout : 0;
        }

        return this.settings.minContribution;
    } catch (err) {
        console.error('Error adjusting payout for shortfall:', err);
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
                `Insufficient contribution. You must pay at least €${requiredContribution.toFixed(2)} to reactivate your membership.`
            );
        }

        // Reactivate the member
        member.status = 'active';
        member.penalty = 0; // Reset penalties
        member.missedContributions = []; // Clear missed contributions
        member.contributionPaid = true; // Mark as contributed for the current cycle

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




module.exports = mongoose.model('Community', CommunitySchema);

const mongoose = require('mongoose');
const Wallet = require('../models/Wallet'); // Ensure Wallet model is imported
const User = require('../models/User'); // Ensure User model is imported


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
            contributions: [{
                recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                amount: { type: Number, required: true },
            }],
        }],
        nextInLine: {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        },
        missedContributions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        isComplete: { type: Boolean, default: false },
        payoutAmount: { type: Number },
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
    }],

    members: [{
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

    // Settings
    settings: {
        contributionFrequency: { type: String, enum: ['Daily', 'Weekly', 'Monthly'], default: 'Weekly' },
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
            const relatedMidCycles = this.midCycle.filter((mc) => mc.cycleNumber === cycle.cycleNumber);
            cycle.midCycles = relatedMidCycles.map((mc) => mc._id); // Sync only the relevant mid-cycles
        });
        await this.save();
    } catch (err) {
        console.error('Error syncing mid-cycles to cycles:', err);
        throw err;
    }
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


// Handle new members joining mid-cycle (first cycle rule)
CommunitySchema.methods.addNewMemberMidCycle = async function (userId, contributionAmount) {
    try {
        const activeCycle = this.cycles.find(c => !c.isComplete);

        // Error if no active cycle is found
        if (!activeCycle) throw new Error('No active cycle found.');

        const missedCycles = activeCycle.midCycles.length; // Number of missed cycles
        const missedAmount = missedCycles * this.settings.minContribution; // Total missed contributions
        const memberCount = this.members.length;

        let requiredContribution;

        // If missed cycles <= half the members
        if (missedCycles <= Math.floor(memberCount / 2)) {
            requiredContribution = this.settings.minContribution + (missedAmount * 0.5); // 50% of missed contributions
        } else {
            // If missed cycles > half the members
            const missedPercentage = missedCycles / memberCount; // Percentage of members missed
            requiredContribution = this.settings.minContribution + (missedPercentage * missedAmount);
        }

        // Check if the user has contributed enough to participate
        if (contributionAmount < requiredContribution) {
            throw new Error(
                `Insufficient contribution. You must contribute at least €${requiredContribution.toFixed(2)} to join mid-cycle.`
            );
        }

        // If the user has contributed enough, assign them a position
        const newMember = {
            userId,
            position: this.members.length + 1, // Assign next available position
            status: 'active', // Mark as active
            penalty: 0,
            missedContributions: [], // Initialize missed contributions
            paymentPlan: {
                type: 'Full',
                remainingAmount: missedAmount - contributionAmount, // Update remaining amount
                installments: 0,
            },
        };

        // Add the new member to the community
        this.members.push(newMember);
        await this.save();

        return { message: `Welcome to the community! Your position is ${newMember.position}.` };
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
        const currentCycle = this.cycles.find((c) => !c.isComplete);
        if (!currentCycle) throw new Error('No active cycle found.');

        const nextInLine = this.members.find((m) => m.position === currentCycle.midCycles.length + 1);
        if (!nextInLine) throw new Error('No eligible member for payout.');

        // Add new mid-cycle
        const newMidCycle = {
            cycleNumber: currentCycle.cycleNumber,
            nextInLine: { userId: nextInLine.userId },
            contributors: [],
            missedContributions: [],
        };
        this.midCycle.push(newMidCycle);

        // Sync changes to cycles
        await this.syncMidCyclesToCycles();
        return { message: 'Mid-cycle started successfully.' };
    } catch (err) {
        console.error('Error in startMidCycle:', err);
        throw err;
    }
};



CommunitySchema.methods.recordContribution = async function (contributorId, contributions) {
    try {
        const activeMidCycle = this.midCycle.find((c) => !c.isComplete);
        if (!activeMidCycle) throw new Error('No active mid-cycle found.');

        const contributor = activeMidCycle.contributors.find((c) => c.contributorId.equals(contributorId));
        if (!contributor) {
            activeMidCycle.contributors.push({ contributorId, contributions });
        } else {
            contributions.forEach((contribution) => {
                const existing = contributor.contributions.find((c) => c.recipientId.equals(contribution.recipientId));
                if (existing) {
                    existing.amount += contribution.amount;
                } else {
                    contributor.contributions.push(contribution);
                }
            });
        }

        // Sync changes to cycles
        await this.syncMidCyclesToCycles();
        return { message: 'Contributions recorded successfully.' };
    } catch (err) {
        console.error('Error recording contributions:', err);
        throw err;
    }
};



CommunitySchema.methods.validateContributions = async function () {
    const currentMidCycle = this.midCycle.find(c => !c.isComplete);
    if (!currentMidCycle) throw new Error('No active mid-cycle found.');

    const nextInLine = currentMidCycle.nextInLine.userId;

    for (const contributor of currentMidCycle.contributors) {
        for (const contribution of contributor.contributions) {
            if (contribution.recipientId.equals(nextInLine) && contribution.amount < this.settings.minContribution) {
                throw new Error(`Contributor ${contributor.contributorId} has not paid the required amount.`);
            }
        }
    }

    return { message: 'All contributions validated successfully.' };
};

// Distribute payouts to the next in line
CommunitySchema.methods.distributePayouts = async function () {
    try {
        const currentMidCycle = this.midCycle.find((cycle) => !cycle.isComplete);
        if (!currentMidCycle) throw new Error('No active mid-cycle found for payout distribution.');

        const nextInLine = this.members.find((m) => m.userId.equals(currentMidCycle.nextInLine.userId));
        if (!nextInLine) throw new Error('No eligible member for payout.');

        const totalContributions = currentMidCycle.contributors.reduce((sum, contributor) => {
            return sum + contributor.contributions.reduce((subSum, c) => subSum + c.amount, 0);
        }, 0);

        const backupDeduction = (totalContributions * this.settings.backupFundPercentage) / 100;
        const payoutAmount = totalContributions - backupDeduction;

        this.backupFund += backupDeduction;

        const wallet = await mongoose.model('Wallet').findOne({ userId: nextInLine.userId });
        if (!wallet) throw new Error('User wallet not found.');

        wallet.availableBalance += payoutAmount;
        await wallet.save();

        currentMidCycle.isComplete = true;
        currentMidCycle.payoutAmount = payoutAmount;

        await this.syncMidCyclesToCycles(); // Sync changes after updates

        return { message: `Payout of €${payoutAmount.toFixed(2)} distributed to ${nextInLine.userId}.` };
    } catch (err) {
        console.error('Error distributing payouts:', err);
        throw err;
    }
};


// Handle new members joining mid-cycle
CommunitySchema.methods.addNewMemberMidCycle = async function (userId) {
    try {
        const activeCycle = this.cycles.find(c => !c.isComplete);
        if (!activeCycle) throw new Error('No active cycle found.');

        const missedCycles = activeCycle.midCycles.length;
        const missedAmount = missedCycles * this.settings.minContribution;

        const newMember = {
            userId,
            position: this.members.length + 1,
            status: 'active',
            penalty: 0,
            missedContributions: [],
            paymentPlan: {
                type: 'Full',
                remainingAmount: missedAmount,
                installments: 0,
            },
        };

        this.members.push(newMember);
        await this.save();
    } catch (err) {
        console.error('Error adding new member mid-cycle:', err);
        throw err;
    }
};

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
            if (!nextEligible) throw new Error('No eligible member found for payout.');

            midCycle.missedContributions.push(defaulter.userId); // Add to missed contributions
            midCycle.nextInLine.userId = nextEligible.userId; // Update next in line

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


module.exports = mongoose.model('Community', CommunitySchema);

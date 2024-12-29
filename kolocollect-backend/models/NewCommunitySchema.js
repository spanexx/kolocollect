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
        isReady: { type: Boolean, default: false }, // New field to track contribution status
        payoutAmount: { type: Number }, // Expected payout amount
        payoutDate: { type: Date }, // Date and time of the payout
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


// Join Community
CommunitySchema.methods.joinCommunity = async function (userId, name, email) {
    try {
        // Check if the user is already a member
        const isAlreadyMember = this.members.some((member) => member.userId.equals(userId));
        if (isAlreadyMember) {
            throw new Error('User is already a member of this community.');
        }

        // Determine user status: Check for active mid-cycle in cycle 1
        const activeMidCycle = this.midCycle.find((mc) => !mc.isComplete && mc.cycleNumber === 1);
        const status = activeMidCycle ? 'waiting' : 'active';

        // Add user to the members array
        this.members.push({
            userId,
            name,
            email,
            position: null, // Position is assigned later
            status,
            penalty: 0,
            missedContributions: [],
            paymentPlan: {
                type: 'Full',
                remainingAmount: 0,
                installments: 0,
            },
        });

        // Save the updated community
        await this.save();

        // Update the user's profile to include the community
        const User = mongoose.model('User'); // Load the User model
        const user = await User.findById(userId);
        if (user) {
            const message = activeMidCycle
                ? `You have joined the community "${this.name}". You will participate in the next cycle.`
                : `You have successfully joined the community "${this.name}".`;

            // Add notification and community to user's profile
            await user.addNotification('info', message, this._id);
            user.communities.push(this._id);
            await user.save();
        }

        // Return success message
        return { message: `User successfully joined the community "${this.name}".`, userStatus: status };
    } catch (error) {
        console.error('Error in joinCommunity:', error);
        throw error;
    }
};

// Start First Cycle
CommunitySchema.methods.startFirstCycle = async function () {
    try {
        // Ensure there are no cycles and the minimum required members are present
        if (this.cycles.length > 0 || this.members.filter((m) => m.status === 'active').length < this.firstCycleMin) {
            throw new Error('First cycle cannot start due to existing cycles or insufficient members.');
        }

        // Assign positions to members
        const adminMember = this.members.find((member) => member.userId.equals(this.admin));
        if (!adminMember) {
            throw new Error('Admin must be a member before starting the first cycle.');
        }
        adminMember.position = 1; // Assign position 1 to the admin

        const nonAdminMembers = this.members.filter((member) => !member.userId.equals(this.admin));
        const assignedPositions = [1]; // Position 1 is already assigned to the admin

        nonAdminMembers.forEach((member) => {
            let randomPosition;
            do {
                randomPosition = Math.floor(Math.random() * this.firstCycleMin) + 1;
            } while (assignedPositions.includes(randomPosition));
            member.position = randomPosition;
            assignedPositions.push(randomPosition);
        });

        // Initialize the first cycle
        const firstCycle = {
            cycleNumber: 1,
            midCycles: [],
            isComplete: false,
            startDate: new Date(),
        };

        this.cycles.push(firstCycle);

        // Save the community state
        await this.save();

        // Automatically start the first mid-cycle
        const midCycleResult = await this.startMidCycle();
        return {
            message: `First cycle and its mid-cycle have started successfully.`,
            midCycleResult,
        };
    } catch (err) {
        console.error('Error starting first cycle:', err);
        throw err;
    }
};

// Start Mid Cycle
CommunitySchema.methods.startMidCycle = async function () {
    try {
        // Find the active cycle
        const activeCycle = this.cycles.find((c) => !c.isComplete);
        if (!activeCycle) {
            throw new Error('No active cycle found.');
        }

        // Determine the next eligible member for payout
        const nextPosition = activeCycle.midCycles.length + 1;
        const nextInLine = this.members.find((m) => m.position === nextPosition && m.status === 'active');
        if (!nextInLine) {
            throw new Error('No eligible member found for payout.');
        }

        // Create a new mid-cycle
        const newMidCycle = {
            cycleNumber: activeCycle.cycleNumber,
            nextInLine: { userId: nextInLine.userId },
            contributors: [],
            missedContributions: [],
            isComplete: false,
            isReady: false,
            payoutAmount: 0,
        };

        // Add the mid-cycle to the community
        this.midCycle.push(newMidCycle);
        this.cycle.midCycle.push(newMidCycle._id)

        // Sync mid-cycle to the current cycle
        if (!activeCycle.midCycles) {
            activeCycle.midCycles = [];
        }
        activeCycle.midCycles.push(newMidCycle._id);

        // Save the updated community
        await this.save();

        return { message: 'Mid-cycle started successfully.', midCycle: newMidCycle };
    } catch (err) {
        console.error('Error starting mid-cycle:', err);
        throw err;
    }
};

// Record Transactions
CommunitySchema.methods.recordContribution = async function (contributorId, contributions) {
    try {
        // Find the active mid-cycle
        const activeMidCycle = this.midCycle.find((mc) => !mc.isComplete);
        if (!activeMidCycle) {
            throw new Error('No active mid-cycle found.');
        }

        // Validate contributor membership and status
        const member = this.members.find((m) => m.userId.equals(contributorId));
        if (!member) {
            throw new Error('Contributor is not a member of this community.');
        }
        if (member.status !== 'active') {
            throw new Error('Only active members can contribute.');
        }

        // Validate contributions
        contributions.forEach((contribution) => {
            if (!contribution.recipientId) {
                throw new Error('Recipient ID is required for each contribution.');
            }
            if (contribution.amount <= 0) {
                throw new Error('Contribution amount must be greater than zero.');
            }
            if (contribution.amount < this.settings.minContribution) {
                throw new Error(
                    `Contribution amount must be at least €${this.settings.minContribution.toFixed(2)}.`
                );
            }
        });

        // Locate or initialize the contributor in the active mid-cycle
        let contributor = activeMidCycle.contributors.find((c) => c.contributorId.equals(contributorId));
        if (!contributor) {
            contributor = { contributorId, contributions: [] };
            activeMidCycle.contributors.push(contributor);
        }

        // Add contributions to the contributor's record
        contributions.forEach((contribution) => {
            contributor.contributions.push({
                recipientId: contribution.recipientId,
                amount: contribution.amount,
            });
        });

        console.log('Updated Contributor Record:', contributor);

        // Mark the member's contribution status as paid
        member.contributionPaid = true;

        // Save changes
        this.markModified('midCycle');
        this.markModified('members');
        await this.save();

        return {
            message: 'Contribution recorded successfully.',
        };
    } catch (err) {
        console.error('Error recording contributions:', err);
        throw err;
    }
};

CommunitySchema.methods.record = async function (contribution) {
    try {
        const { contributorId, recipientId, amount } = contribution;

        // Validate inputs
        if (!contributorId || !recipientId) {
            throw new Error('Contributor ID and Recipient ID are required.');
        }
        if (!amount || amount <= 0) {
            throw new Error('Contribution amount must be greater than zero.');
        }

        // Find the active mid-cycle
        const activeMidCycle = this.midCycle.find((mc) => !mc.isComplete);
        if (!activeMidCycle) {
            throw new Error('No active mid-cycle found.');
        }

        // Ensure contributors array exists
        if (!activeMidCycle.contributors) {
            activeMidCycle.contributors = [];
        }

        // Locate or initialize the contributor in the active mid-cycle
        let contributor = activeMidCycle.contributors.find((c) => c.contributorId?.equals(contributorId));
        if (!contributor) {
            contributor = { contributorId, contributions: [contribution] };
            activeMidCycle.contributors.push(contributor);
        }


        // Add the contribution to the contributor's record
        contributor.contributions.push({ recipientId, amount });

        // Update total contribution and backup fund
        this.totalContribution += amount;
        this.backupFund = (this.settings.backupFundPercentage / 100) * this.totalContribution;

        // Update payout amount for the active mid-cycle
        activeMidCycle.payoutAmount = this.totalContribution - this.backupFund;
        this.payoutDetails.payoutAmount = this.totalContribution - this.backupFund;;

        console.log('Updated Total Contribution:', this.totalContribution);
        console.log('Updated Backup Fund:', this.backupFund);
        console.log('Updated Mid-Cycle Payout Amount:', activeMidCycle.payoutAmount);

        // Save the updated schema
        this.markModified('midCycle');
        await this.save();

        return {
            message: 'Contribution recorded successfully.',
            totalContribution: this.totalContribution,
            backupFund: this.backupFund,
        };
    } catch (err) {
        console.error('Error recording contribution:', err);
        throw err;
    }
};


// Validate Contributions
CommunitySchema.methods.validateContributions = async function () {
    try {
        // Find the active mid-cycle
        const activeMidCycle = this.midCycle.find((mc) => !mc.isComplete);
        if (!activeMidCycle) {
            throw new Error('No active mid-cycle found.');
        }

        // Get all contributions from active mid-cycle
        const totalContributions = this.totalContribution

        // Calculate backup fund deduction
        const backupDeduction = this.backupFund

        // Update payout amount
        activeMidCycle.payoutAmount = totalContributions-backupDeduction

        // Mark mid-cycle as ready if all contributions are validated
        activeMidCycle.isReady = true;

        console.log('Updated Mid-Cycle Payout Amount:', activeMidCycle.payoutAmount);

        await this.save();
        return { message: 'All contributions validated successfully.' };
    } catch (err) {
        console.error('Error validating contributions:', err);
        throw err;
    }
};


// Distribute Payout
// CommunitySchema.methods.distributePayouts = async function () {
//     try {
//         // Find the active mid-cycle
//         const activeMidCycle = this.midCycle.find((mc) => mc.isReady && !mc.isComplete);
//         if (!activeMidCycle) {
//             throw new Error('No mid-cycle ready for payout distribution.');
//         }

//         // Retrieve the next recipient
//         const nextRecipientId = activeMidCycle.nextInLine.userId;
//         const recipient = this.members.find((m) => m.userId.equals(nextRecipientId));
//         if (!recipient || recipient.status !== 'active') {
//             throw new Error('Next-in-line recipient is not eligible for payout.');
//         }

//         // Calculate the payout amount
//         const payoutAmount = activeMidCycle.payoutAmount || 0;
//         if (payoutAmount <= 0) {
//             throw new Error('Invalid payout amount.');
//         }

//         // Transfer funds to the recipient's wallet
//         const Wallet = mongoose.model('Wallet');
//         const recipientWallet = await Wallet.findOne({ userId: nextRecipientId });
//         if (!recipientWallet) {
//             throw new Error('Recipient wallet not found.');
//         }
//         recipientWallet.availableBalance += payoutAmount;
//         await recipientWallet.save();

//         // Mark the mid-cycle as complete
//         activeMidCycle.isComplete = true;

//         // Add the recipient to the paidMembers array in the active cycle
//         const activeCycle = this.cycles.find((c) => !c.isComplete);
//         if (activeCycle && !activeCycle.paidMembers.includes(nextRecipientId)) {
//             activeCycle.paidMembers.push(nextRecipientId);
//         }

//         // Check if all active members have been paid
//         const activeMembers = this.members.filter((m) => m.status === 'active').map((m) => m.userId.toString());
//         const paidMembers = activeCycle.paidMembers.map((id) => id.toString());
//         const allPaid = activeMembers.every((id) => paidMembers.includes(id));

//         // Finalize the cycle if all members are paid
//         if (allPaid) {
//             activeCycle.isComplete = true;
//             activeCycle.endDate = new Date();
//         } else {
//             // Start the next mid-cycle if cycle is not complete
//             await this.startMidCycle();
//         }

//         // Save the community updates
//         await this.save();

//         return { message: `Payout of €${payoutAmount.toFixed(2)} distributed to ${recipient.name}.` };
//     } catch (err) {
//         console.error('Error distributing payouts:', err);
//         throw err;
//     }
// };
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
        recipientWallet.availableBalance += payoutAmount;
        await recipientWallet.save();

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
        } else {
            // Start the next mid-cycle if cycle is not complete
            await this.startMidCycle();
        }

        // Save changes
        await this.save();

        return { message: `Payout of €${payoutAmount} distributed to ${recipient.name}.` };
    } catch (err) {
        console.error('Error distributing payouts:', err);
        throw err;
    }
};

// Finalize Cycle
CommunitySchema.methods.finalizeCycle = async function () {
    try {
        // Find the active cycle
        const activeCycle = this.cycles.find((cycle) => !cycle.isComplete);
        if (!activeCycle) {
            throw new Error('No active cycle to finalize.');
        }

        // Ensure all mid-cycles in the active cycle are complete
        const allMidCyclesComplete = this.midCycle.every(
            (mc) => mc.cycleNumber === activeCycle.cycleNumber && mc.isComplete
        );
        if (!allMidCyclesComplete) {
            throw new Error('Not all mid-cycles in the current cycle are complete.');
        }

        // Mark the cycle as complete
        activeCycle.isComplete = true;
        activeCycle.endDate = new Date();

        // Save the community state
        await this.save();

         // Prepare for the next cycle
         const preparationResult = await this.prepareForNextCycle();

         return {
            message: `Cycle ${activeCycle.cycleNumber} finalized successfully. ${preparationResult.message}`,
            completedCycle: activeCycle,
        };
    } catch (err) {
        console.error('Error finalizing cycle:', err);
        throw err;
    }
};


CommunitySchema.methods.prepareForNextCycle = async function () {
    try {
        // Ensure the current cycle is finalized
        const lastCycle = this.cycles.find((cycle) => cycle.isComplete);
        if (!lastCycle) {
            throw new Error('No finalized cycle found to prepare for the next.');
        }

        // Reset member statuses and contributions for the new cycle
        this.members.forEach((member) => {
            member.contributionPaid = false;
            member.missedContributions = [];
            member.status = 'active'; // Reset all members to active
        });

        // Handle positioning based on community settings
        if (this.positioningMode === 'Random') {
            const positions = Array.from({ length: this.members.length }, (_, i) => i + 1);
            for (const member of this.members) {
                const randomIndex = Math.floor(Math.random() * positions.length);
                member.position = positions.splice(randomIndex, 1)[0];
            }
        } else if (this.positioningMode === 'Fixed') {
            // Retain positions as is
        }

        // Create the next cycle
        const nextCycleNumber = this.cycles.length + 1;
        const nextCycle = {
            cycleNumber: nextCycleNumber,
            midCycles: [],
            isComplete: false,
            startDate: new Date(),
        };
        this.cycles.push(nextCycle);

        // Save the updated community state
        await this.save();

        return {
            message: `Cycle ${nextCycleNumber} is ready to start.`,
            nextCycle,
        };
    } catch (err) {
        console.error('Error preparing for the next cycle:', err);
        throw err;
    }
};

CommunitySchema.methods.updateContributionStats = async function (contributions) {
    try {
        // Find the active mid-cycle
        const activeMidCycle = this.midCycle.find((mc) => !mc.isComplete);
        if (!activeMidCycle) throw new Error('No active mid-cycle found.');

        // Add contributions to the active mid-cycle
        contributions.forEach(({ contributorId, recipientId, amount }) => {
            let contributor = activeMidCycle.contributors.find((c) => c.contributorId?.equals(contributorId));
            if (!contributor) {
                contributor = { contributorId, contributions: [] };
                activeMidCycle.contributors.push(contributor);
            }
            contributor.contributions.push({ recipientId, amount });
        });

        // Calculate total contributions
        const totalContributions = activeMidCycle.contributors.reduce((sum, contributor) => {
            return (
                sum +
                contributor.contributions.reduce((subSum, contribution) => subSum + contribution.amount, 0)
            );
        }, 0);

        // Update total contributions and backup fund
        this.totalContribution = totalContributions;
        this.backupFund = (this.settings.backupFundPercentage / 100) * totalContributions;

        // Calculate payout amount
        activeMidCycle.payoutAmount = totalContributions - this.backupFund;

        // Mark the mid-cycle as ready if all active members have contributed
        const eligibleMembers = this.members.filter((m) => m.status === 'active');
        const allContributed = eligibleMembers.every((member) =>
            activeMidCycle.contributors.some(
                (contributor) =>
                    contributor.contributorId && contributor.contributorId.equals(member.userId)
            )
        );
        activeMidCycle.isReady = allContributed;

        console.log('Community stats updated successfully:', {
            totalContribution: this.totalContribution,
            backupFund: this.backupFund,
            payoutAmount: activeMidCycle.payoutAmount,
            isMidCycleReady: activeMidCycle.isReady,
        });

        // Save changes
        this.markModified('midCycle');
        this.markModified('members');
        await this.save();

        return {
            totalContribution: this.totalContribution,
            backupFund: this.backupFund,
            payoutAmount: activeMidCycle.payoutAmount,
            isMidCycleReady: activeMidCycle.isReady,
        };
    } catch (err) {
        console.error('Error updating contribution stats:', err);
        throw err;
    }
};

module.exports = mongoose.model('Community', CommunitySchema);

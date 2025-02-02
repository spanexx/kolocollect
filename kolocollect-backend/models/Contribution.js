const mongoose = require('mongoose');

const ContributionSchema = new mongoose.Schema({
  communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  cycleNumber: { type: Number, required: true },
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

// Static/Helper methods
ContributionSchema.statics.getUserContributions = async function (userId, communityId, cycleNumber) {
  return this.find({ userId, communityId, cycleNumber });
};

ContributionSchema.statics.getCycleTotal = async function (communityId, cycleNumber) {
  const result = await this.aggregate([
    { $match: { communityId: mongoose.Types.ObjectId(communityId), cycleNumber } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return result[0]?.total || 0;
};

ContributionSchema.statics.getMissedContributions = async function (userId, communityId) {
  return this.find({ userId, communityId, status: 'missed' });
};

// Method to create a normal contribution
ContributionSchema.statics.createContribution = async function (userId, communityId, amount, midCycleId) {
  try {
    // Validate community
    const community = await mongoose.model('Community').findById(communityId);
    if (!community) throw new Error('Community not found.');

    // Validate mid-cycle
    const activeMidCycle = community.midCycle.find(
      (mc) => mc._id.toString() === midCycleId.toString() && !mc.isComplete
    );
    if (!activeMidCycle) throw new Error('MidCycle not found or already complete.');

    // Validate minimum contribution amount
    if (amount < community.settings.minContribution) {
      throw new Error(`Contribution amount must be at least €${community.settings.minContribution.toFixed(2)}.`);
    }

    // Validate wallet balance
    const wallet = await mongoose.model('Wallet').findOne({ userId });
    if (!wallet || wallet.availableBalance < amount) {
      throw new Error('Insufficient wallet balance.');
    }

     // Deduct the contribution amount from wallet
     await wallet.addTransaction(
      amount,
      'contribution',
      `Contribution to community ${community.name}`,
      null,
      communityId
    );

    await wallet.save();

    // Create and save the contribution
    const newContribution = new this({
      userId,
      communityId,
      amount,
      midCycleId,
      cycleNumber: activeMidCycle.cycleNumber,
      status: 'completed',
    });

    const savedContribution = await newContribution.save();

    // Record the contribution in the community
    const recordResult = await community.record({
      contributorId: userId,
      recipientId: midCycleId,
      amount,
      contributionId: savedContribution._id, // Pass the saved contribution ID
    });

    console.log('Contribution successfully recorded:', recordResult.message);
    return savedContribution;
  } catch (error) {
    console.error('Error in createContribution method:', error);
    throw error;
  }
};

// Method to create a contribution with installments
ContributionSchema.statics.createContributionWithInstallment = async function (userId, communityId, amount, midCycleId) {
  const maxRetries = 5;
  let retries = 0;

  // Helper function to identify retry-safe errors
  const isRetryableError = (error) => {
    return error.errorLabels?.includes('TransientTransactionError') ||
           error.codeName === 'WriteConflict' ||
           [
             'MongoNetworkError',
             'MongoTimeoutError',
             'MongoExpiredSessionError'
           ].includes(error.name);
  };

  while (retries < maxRetries) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      // Check for existing contribution first
      const existingContribution = await this.findOne({
        userId,
        communityId,
        midCycleId,
        status: 'completed'
      }).session(session);

      if (existingContribution) {
        await session.abortTransaction();
        return existingContribution;
      }

      // Get fresh community instance
      const community = await mongoose.model('Community')
        .findById(communityId)
        .session(session)
        .select('+midCycle +members');


      // Validate mid-cycle
      const activeMidCycle = community.midCycle.find(
          (mc) => mc._id.toString() === midCycleId.toString() && !mc.isComplete
      );
      if (!activeMidCycle) throw new Error('MidCycle not found or already complete.');

      // Update the contributionPaid for the user in the community
      const member = community.members.find((m) => m.userId.toString() === userId.toString());
      if (!member) {
          throw new Error('Member not found in the community.');
      }

      // Check the remaining amount using the remainder method
      const { remainingAmount } = community.remainder(userId);
      if (amount < remainingAmount) {
        throw new Error(
            `Contribution amount is less than the remaining amount. ${message}, Amount Must be €${community.settings.minContribution + remainingAmount}.`
        );
    }

      // Calculate the contribution amount
      let contributionAmount = amount - remainingAmount;



      // Call the payNextInLine method to get the amount to deduct
      const payNextInLineResult = await community.payNextInLine(userId, midCycleId, contributionAmount);
      if (payNextInLineResult.amountToDeduct < 0) {
        throw new Error('Invalid deduction amount from payNextInLine.');
    }
    
      console.log(payNextInLineResult.message);

      // Add the amount to deduct to the contribution amount
      contributionAmount += payNextInLineResult.amountToDeduct;

      
      // Validate minimum contribution amount
      if (contributionAmount < community.settings.minContribution) {
        throw new Error(`Contribution amount must be at least €${community.settings.minContribution.toFixed(2)}.`);
    }

      // Validate wallet balance
      const wallet = await mongoose.model('Wallet')
      .findOne({ userId })
      .session(session);
  
      if (!wallet) throw new Error('Wallet not found');
      if (wallet.availableBalance < (contributionAmount + remainingAmount)) {
          throw new Error('Insufficient balance for full payment');
      }



      // Deduct the remaining amount from wallet
      if (remainingAmount > 0) {
          await wallet.addTransaction(
              remainingAmount,
              'contribution',
              `Contribution to community ${community.name}, back payment`,
              null,
              communityId
          );
      }

      // Deduct the contribution amount from wallet
      await wallet.addTransaction(
        contributionAmount,
        'contribution',
        `Contribution to community ${community.name}`,
        null,
        communityId
    );


      // Create and save the contribution
      const newContribution = new this({
          userId,
          communityId,
          amount: contributionAmount,
          midCycleId,
          cycleNumber: activeMidCycle.cycleNumber,
          status: 'completed',
      });

      const savedContribution = await newContribution.save();

      // Record the contribution in the community
       await community.record({
          contributorId: userId,
          recipientId: midCycleId,
          amount: contributionAmount,
          contributionId: savedContribution._id,
      });

      // Update the member's payment plan
      if (member) {
          let remainingAmountToPay = remainingAmount;
          let contributionAmountToUpdate = amount;

          while (remainingAmountToPay > 0 && contributionAmountToUpdate > 0) {
              const amountToDeduct = Math.min(remainingAmountToPay, contributionAmountToUpdate);
              member.paymentPlan.remainingAmount = Math.max(0, member.paymentPlan.remainingAmount - amountToDeduct);
              member.paymentPlan.paidContribution += amount - remainingAmount;
              member.paymentPlan.previousContribution += remainingAmount;
              member.paymentPlan.installments += 1;

              remainingAmountToPay -= amountToDeduct;
              contributionAmountToUpdate -= amountToDeduct;
          }

          if (member.paymentPlan.previousContribution === member.paymentPlan.totalPreviousContribution) {
              await community.markMidCycleCompleteForJoiner(userId);
          }

          // Save the updated member object
          community.markModified('members');
        }

      // Save the updated community

      await community.save({ session });
      await session.commitTransaction();

      success = true; // Mark the operation as successful
      return savedContribution;
  } catch (error) {
    await session.abortTransaction();
    if (isRetryableError(error) && retries < maxRetries) {
      retries++;
      console.log(`Retrying (${retries}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 100 * retries));
      continue;
    }
      console.error('Error in createContributionWithInstallment method:', error);
      throw error;
  }finally {
    session.endSession();
}}
};

// ContributionSchema.statics.createContributionWithInstallment = async function (userId, communityId, amount, midCycleId) {
//   const maxRetries = 5;
//   let retries = 0;

//   // Helper function to identify retry-safe errors
//   const isRetryableError = (error) => {
//     return [
//       'MongoNetworkError',
//       'MongoTimeoutError',
//       'MongoExpiredSessionError'
//     ].includes(error.name);
//   };

//   while (retries < maxRetries) {
//     const session = await mongoose.startSession();
//     try {
//       session.startTransaction();

//       // Check for existing contribution first
//       const existingContribution = await this.findOne({
//         userId,
//         communityId,
//         midCycleId,
//         status: 'completed'
//       }).session(session);

//       if (existingContribution) {
//         await session.abortTransaction();
//         return existingContribution;
//       }

//       // Get fresh community instance
//       const community = await mongoose.model('Community')
//         .findById(communityId)
//         .session(session)
//         .select('+midCycle +members');

//       // Validate mid-cycle
//       const activeMidCycle = community.midCycle.find(
//         (mc) => mc._id.toString() === midCycleId.toString() && !mc.isComplete
//       );
//       if (!activeMidCycle) throw new Error('MidCycle not found or already complete.');

//       // Check remaining amount
//       const { remainingAmount } = community.remainder(userId);
//       if (amount < remainingAmount) {
//         throw new Error(`Amount must be at least €${remainingAmount.toFixed(2)}`);
//       }

//       // Wallet validation
//       const wallet = await mongoose.model('Wallet').findOne({ userId }).session(session);
//       if (!wallet || wallet.availableBalance < amount) {
//         throw new Error('Insufficient wallet balance');
//       }

//       // Deduct from wallet
//       await wallet.addTransaction(
//         amount,
//         'contribution',
//         `Contribution to ${community.name}`,
//         null,
//         communityId
//       );

//       // Create contribution record
//       const newContribution = new this({
//         userId,
//         communityId,
//         amount,
//         midCycleId,
//         cycleNumber: activeMidCycle.cycleNumber,
//         status: 'completed',
//       });

//       const savedContribution = await newContribution.save({ session });

//       // Update community record
//       await community.record({
//         contributorId: userId,
//         recipientId: midCycleId,
//         amount,
//         contributionId: savedContribution._id,
//       });

//       // Update member payment plan
//       const member = community.members.find(m => m.userId.equals(userId));
//       if (member) {
//         member.paymentPlan.remainingAmount = Math.max(0, member.paymentPlan.remainingAmount - amount);
//         member.paymentPlan.installments += 1;
//         community.markModified('members');
//       }

//       await community.save({ session });
//       await session.commitTransaction();
//       return savedContribution;

//     } catch (error) {
//       await session.abortTransaction();
      
//       if (isRetryableError(error) && retries < maxRetries) {
//         retries++;
//         console.log(`Retrying (${retries}/${maxRetries})`);
//         await new Promise(resolve => setTimeout(resolve, 100 * retries));
//         continue;
//       }
//       throw error;
//     } finally {
//       session.endSession();
//     }
//   }
//   throw new Error('Max retries reached');
// };
module.exports = mongoose.model('Contribution', ContributionSchema);

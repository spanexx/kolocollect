const { calculateTotalOwed, processBackPayment, recordContribution } = require('../utils/contributionUtils');
const Contribution = require('../models/Contribution');
const Community = require('../models/Community');
const User = require('../models/User');
const Wallet = require('../models/Wallet');

const createErrorResponse = (res, status, message) => res.status(status).json({ error: { message } });

// Get all contributions
exports.getContributions = async (req, res) => {
  try {
    const contributions = await Contribution.find();
    res.status(200).json(contributions);
  } catch (err) {
    console.error('Error fetching contributions:', err);
    createErrorResponse(res, 500, 'Server error while fetching contributions.');
  }
};

// Get a single contribution by ID
exports.getContributionById = async (req, res) => {
  try {
    const contribution = await Contribution.findById(req.params.id);
    if (!contribution) {
      return createErrorResponse(res, 404, 'Contribution not found.');
    }
    res.status(200).json(contribution);
  } catch (err) {
    console.error('Error fetching contribution by ID:', err);
    createErrorResponse(res, 500, 'Server error while fetching contribution.');
  }
};

// Create a new contribution
exports.createContribution = async (req, res) => {
  console.log('Incoming Contribution Data:', req.body);

  try {
    const { userId, communityId, amount, contributionDate, cycleNumber, midCycleId } = req.body;

    // Validate required fields
    if (!userId || !communityId || !amount || cycleNumber === undefined || !midCycleId) {
      console.error('Missing required fields:', req.body);
      return createErrorResponse(res, 400, 'Missing required fields.');
    }

    // Find the wallet and validate balance
    const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.availableBalance < amount) {
      console.error('Insufficient wallet balance for user:', userId);
      return createErrorResponse(res, 400, 'Insufficient wallet balance.');
    }

    console.log('Wallet Balance Before Deduction:', wallet.availableBalance);

    // Deduct amount from wallet balance
    wallet.availableBalance -= amount;
    await wallet.save();
    console.log('Wallet Balance After Deduction:', wallet.availableBalance);

    // Find the community and validate its existence
    const community = await Community.findById(communityId);
    if (!community) {
      console.error('Community not found:', communityId);
      return createErrorResponse(res, 404, 'Community not found.');
    }

    console.log('Community Found:', community.name);

    // Validate cycle number and mid-cycle ID within the community
    const validCycle = community.cycles.find((cycle) => cycle.cycleNumber === cycleNumber);
    if (!validCycle) {
      console.error('Invalid cycle number:', cycleNumber);
      return createErrorResponse(res, 400, 'Invalid cycle number.');
    }

    const validMidCycle = community.midCycle.find((mc) => mc._id.toString() === midCycleId);
    if (!validMidCycle) {
      console.error('Invalid mid-cycle ID:', midCycleId);
      return createErrorResponse(res, 400, 'Invalid mid-cycle ID.');
    }

    // Validate user membership in the community
    const member = community.members.find((m) => m.userId.toString() === userId);
    if (!member) {
      console.error('User is not a member of the community:', userId);
      return createErrorResponse(res, 404, 'Member not found in the community.');
    }
    if (member.status === 'waiting') {
      console.error('Member is in "waiting" status and cannot contribute:', userId);
      return createErrorResponse(res, 403, 'Members with status "waiting" cannot contribute.');
    }

    // Calculate penalty if applicable
    let penalty = 0;
    if (member.missedContributions.length > 0) {
      penalty = member.missedContributions.length * community.settings.penalty;
      console.log(`Penalty calculated for user ${userId}: €${penalty}`);
    }

    // Create and save the contribution
    const newContribution = new Contribution({
      userId,
      communityId,
      amount,
      contributionDate,
      cycleNumber,
      midCycleId,
      status: 'completed',
    });
    await newContribution.save();
    console.log('Contribution saved:', newContribution);

    // Update user contributions
    const user = await User.findById(userId);
    if (!user) {
      console.error('User not found:', userId);
      return createErrorResponse(res, 404, 'User not found.');
    }

    const userContribution = user.contributions.find(
      (contribution) => contribution.communityId.toString() === communityId
    );

    if (userContribution) {
      userContribution.totalContributed += amount;
      userContribution.positionInCycle = member.position;
      userContribution.penalty = member.penalty;
    } else {
      user.contributions.push({
        communityId,
        midCycleId,
        totalContributed: amount,
        positionInCycle: member.position,
        penalty: member.penalty,
      });
    }

    await user.save();
    console.log('User contributions updated:', userId);

    // Record contribution in the community
    const recordResult = await community.recordContribution(userId, [{ recipientId: midCycleId, amount }]);
    console.log('Contribution recorded in community:', recordResult.message);

    // Update mid-cycle status
    const isMidCycleReady = await community.updateMidCycleStatus();
    console.log('Mid-cycle status updated. Is ready:', isMidCycleReady);

    // Send success response
    res.status(201).json({
      message: 'Contribution created successfully.',
      contribution: newContribution,
      isMidCycleReady,
    });
  } catch (err) {
    console.error('Error creating contribution:', err);
    createErrorResponse(res, 500, 'Server error while creating contribution.');
  }
};

// Update a contribution
exports.updateContribution = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount: newAmount } = req.body;

    const contribution = await Contribution.findById(id);
    if (!contribution) {
      return createErrorResponse(res, 404, 'Contribution not found.');
    }

    const oldAmount = contribution.amount;

    if (newAmount !== oldAmount) {
      const wallet = await Wallet.findOne({ userId: contribution.userId });
      if (!wallet) {
        return createErrorResponse(res, 404, 'Wallet not found.');
      }

      wallet.availableBalance += oldAmount;
      wallet.availableBalance -= newAmount;
      await wallet.save();
    }

    contribution.amount = newAmount;
    await contribution.save();

    res.status(200).json({ message: 'Contribution updated successfully.', contribution });
  } catch (err) {
    console.error('Error updating contribution:', err);
    createErrorResponse(res, 500, 'Server error while updating contribution.');
  }
};

// Delete a contribution
exports.deleteContribution = async (req, res) => {
  try {
    const { id } = req.params;

    const contribution = await Contribution.findByIdAndDelete(id);
    if (!contribution) {
      return createErrorResponse(res, 404, 'Contribution not found.');
    }

    const wallet = await Wallet.findOne({ userId: contribution.userId });
    if (wallet) {
      wallet.availableBalance += contribution.amount;
      await wallet.save();
    }

    res.status(200).json({ message: 'Contribution deleted successfully.' });
  } catch (err) {
    console.error('Error deleting contribution:', err);
    createErrorResponse(res, 500, 'Server error while deleting contribution.');
  }
};

// Get contributions by community
exports.getContributionsByCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const contributions = await Contribution.find({ communityId });

    if (!contributions.length) {
      return createErrorResponse(res, 404, 'No contributions found for this community.');
    }

    res.status(200).json(contributions);
  } catch (err) {
    console.error('Error fetching community contributions:', err);
    createErrorResponse(res, 500, 'Server error while fetching community contributions.');
  }
};

// Get contributions by user
exports.getContributionsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const contributions = await Contribution.find({ userId });

    if (!contributions.length) {
      return createErrorResponse(res, 404, 'No contributions found for this user.');
    }

    res.status(200).json(contributions);
  } catch (err) {
    console.error('Error fetching user contributions:', err);
    createErrorResponse(res, 500, 'Server error while fetching user contributions.');
  }
};

const { calculateTotalOwed, processBackPayment, recordContribution } = require('../utils/contributionUtils');
const Contribution = require('../models/Contribution');
const Community = require('../models/Community');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const mongoose = require('mongoose');


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
    const { userId, communityId, amount, midCycleId } = req.body;

    // Validate required fields
    if (!userId || !communityId || !amount || !midCycleId) {
      console.error('Missing required fields:', req.body);
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    // Convert userId to ObjectId if it's a string
    const userIdObject = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    // Find the community and validate its existence
    const community = await Community.findById(communityId);
    if (!community) {
      console.error('Community not found:', communityId);
      return res.status(404).json({ message: 'Community not found.' });
    }

    console.log('Community Found:', community.name);

    // Validate the mid-cycle
    const activeMidCycle = community.midCycle.find(
      (mc) => mc._id.toString() === midCycleId.toString() && !mc.isComplete
    );

    if (!activeMidCycle) {
      console.error(`MidCycle not found or already complete: ${midCycleId}`);
      return res.status(404).json({ message: 'MidCycle not found in community.' });
    }

    // Ensure contribution amount is at least the minimum contribution
    if (amount < community.settings.minContribution) {
      console.error(
        `Contribution amount is less than the minimum required: ${amount} < ${community.settings.minContribution}`
      );
      return res.status(400).json({
        message: `Contribution amount must be at least €${community.settings.minContribution.toFixed(2)}.`,
      });
    }

    // Find the wallet and validate balance
    const wallet = await Wallet.findOne({ userId: userIdObject });
    if (!wallet || wallet.availableBalance < amount) {
      console.error('Insufficient wallet balance for user:', userIdObject);
      return res.status(400).json({ message: 'Insufficient wallet balance.' });
    }

    console.log('Wallet Balance Before Deduction:', wallet.availableBalance);

    // Deduct amount from wallet balance
    wallet.availableBalance -= amount;
    await wallet.save();
    console.log('Wallet Balance After Deduction:', wallet.availableBalance);

    // Validate user membership in the community
    const member = community.members.find((m) => m.userId.equals(userIdObject));
    if (!member) {
      console.error(`User is not a member of the community: ${userIdObject}`);
      return res.status(404).json({ message: 'Member not found in the community.' });
    }
    if (member.status === 'waiting') {
      console.error('Member is in "waiting" status and cannot contribute:', userIdObject);
      return res.status(403).json({ message: 'Members with status "waiting" cannot contribute.' });
    }

    // Record the contribution using Community's record method
    const recordResult = await community.record({
      contributorId: userIdObject,
      recipientId: communityId,
      amount,
    });
    console.log('Contribution recorded in community:', recordResult.message);

    // Create and save the contribution
    const newContribution = new Contribution({
      userId: userIdObject,
      communityId,
      amount,
      contributionDate: new Date(),
      cycleNumber: recordResult.cycleNumber || 1,
      midCycleId: activeMidCycle._id, // Use the validated mid-cycle ID
      status: 'completed',
    });
    // await newContribution.save();
    console.log('Contribution saved:', newContribution);

    // Send success response
    res.status(201).json({
      message: 'Contribution created successfully and recorded in community.',
      contribution: newContribution,
    });
  } catch (err) {
    console.error('Error creating contribution:', err);
    res.status(500).json({ message: 'Server error while creating contribution.' });
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

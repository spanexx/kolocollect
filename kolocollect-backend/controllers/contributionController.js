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
  try {
    const { userId, communityId, amount, contributionDate, cycleNumber, midCycleId } = req.body;

    if (!userId || !communityId || !amount || cycleNumber === undefined || !midCycleId) {
      return createErrorResponse(res, 400, 'Missing required fields.');
    }

    const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.availableBalance < amount) {
      return createErrorResponse(res, 400, 'Insufficient wallet balance.');
    }

    wallet.availableBalance -= amount;
    await wallet.save();

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

    // Use utility function to record contribution
    await recordContribution(communityId, userId, [{ recipientId: midCycleId, amount }]);

    res.status(201).json({ message: 'Contribution created successfully.', contribution: newContribution });
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

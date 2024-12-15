// controllers/contributionController.js

const Contribution = require('../models/Contribution');
const Community = require('../models/Community');
const User = require('../models/User');
const Wallet = require('../models/Wallet');

// Get all contributions
exports.getContributions = async (req, res) => {
  try {
    const contributions = await Contribution.find();
    res.status(200).json(contributions);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get a single contribution by ID
exports.getContributionById = async (req, res) => {
  try {
    const contribution = await Contribution.findById(req.params.id);
    if (!contribution) {
      return res.status(404).json({ message: 'Contribution not found' });
    }
    res.status(200).json(contribution);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Create a new contribution
exports.createContribution = async (req, res) => {
  try {
    const { userId, communityId, amount, contributionDate, cycleId, midCycleId } = req.body;

    if (!userId || !communityId || !amount || !cycleId || !midCycleId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate community existence
    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: 'Community not found' });

    // Validate user wallet balance
    const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.availableBalance < amount) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }

    // Deduct amount from wallet
    wallet.availableBalance -= amount;
    await wallet.save();

    // Create contribution
    const newContribution = new Contribution({
      userId,
      communityId,
      amount,
      contributionDate,
      cycleId,
      midCycleId,
      status: 'Completed',
    });
    await newContribution.save();

    // Update community and user contributions
    await newContribution.linkToUserAndCommunity();

    res.status(201).json({ message: 'Contribution created successfully', contribution: newContribution });
  } catch (err) {
    console.error('Error creating contribution:', err);
    res.status(500).json({ message: 'Error creating contribution', error: err.message });
  }
};

// Update a contribution
exports.updateContribution = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount: newAmount } = req.body;

    const contribution = await Contribution.findById(id);
    if (!contribution) {
      return res.status(404).json({ message: 'Contribution not found' });
    }

    const oldAmount = contribution.amount;

    // Update wallet balance if amount changes
    if (newAmount !== oldAmount) {
      const wallet = await Wallet.findOne({ userId: contribution.userId });
      if (!wallet) {
        return res.status(404).json({ message: 'Wallet not found' });
      }

      wallet.availableBalance += oldAmount; // Revert old amount
      wallet.availableBalance -= newAmount; // Deduct new amount
      await wallet.save();
    }

    // Update contribution details
    contribution.amount = newAmount;
    await contribution.save();

    // Update user and community
    await contribution.linkToUserAndCommunity();

    res.status(200).json({ message: 'Contribution updated successfully', contribution });
  } catch (err) {
    console.error('Error updating contribution:', err);
    res.status(500).json({ message: 'Error updating contribution', error: err.message });
  }
};

// Delete a contribution
exports.deleteContribution = async (req, res) => {
  try {
    const { id } = req.params;

    const contribution = await Contribution.findByIdAndDelete(id);
    if (!contribution) {
      return res.status(404).json({ message: 'Contribution not found' });
    }

    // Revert wallet balance
    const wallet = await Wallet.findOne({ userId: contribution.userId });
    if (wallet) {
      wallet.availableBalance += contribution.amount;
      await wallet.save();
    }

    res.status(200).json({ message: 'Contribution deleted successfully' });
  } catch (err) {
    console.error('Error deleting contribution:', err);
    res.status(500).json({ message: 'Error deleting contribution', error: err.message });
  }
};

// Get contributions by community
exports.getContributionsByCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const contributions = await Contribution.find({ communityId });

    if (!contributions.length) {
      return res.status(404).json({ message: 'No contributions found for this community' });
    }

    res.status(200).json(contributions);
  } catch (err) {
    console.error('Error fetching community contributions:', err);
    res.status(500).json({ message: 'Error fetching contributions', error: err.message });
  }
};

// Get contributions by user
exports.getContributionsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const contributions = await Contribution.find({ userId });

    if (!contributions.length) {
      return res.status(404).json({ message: 'No contributions found for this user' });
    }

    res.status(200).json(contributions);
  } catch (err) {
    console.error('Error fetching user contributions:', err);
    res.status(500).json({ message: 'Error fetching contributions', error: err.message });
  }
};

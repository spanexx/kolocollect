//controllers/contributionController.js

const Contribution = require('../models/Contribution');
const Community = require('../models/Community');
const { updateCommunity } = require('./communityController');
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
    const { userId, communityId, amount, contributionDate } = req.body;

    // Check for missing required fields
    if (!userId || !communityId || !amount || !contributionDate) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if the community exists
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }

    // Get the user's wallet to check balance
    const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.availableBalance < amount) {
      return res.status(400).json({ message: 'Insufficient funds in wallet' });
    }

    // Deduct the contribution amount from the user's wallet
    wallet.availableBalance -= amount;
    await wallet.addTransaction(amount, 'contribution', `Contribution to community ${community.name}`);

    // Create the contribution document
    const newContribution = new Contribution({
      userId,
      communityId,
      amount,
      contributionDate,
      status: 'Completed',
    });
    await newContribution.save();

    // Update the community's total contributions
    community.totalContributions = (community.totalContributions || 0) + amount;
    community.contributionList = [
      ...(community.contributionList || []),
      {
        userId,
        amount,
        contributionDate,
      },
    ];
    await community.save();

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
    const { amount: newAmount, userId, communityId } = req.body;

    const updatedContribution = await Contribution.findById(id);
    if (!updatedContribution) {
      return res.status(404).json({ message: 'Contribution not found' });
    }

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(400).json({ message: 'Wallet not found for user' });
    }

    // Adjust wallet if the amount changes
    const oldAmount = updatedContribution.amount;
    if (newAmount !== oldAmount) {
      // Update wallet by deducting oldAmount and adding newAmount
      wallet.availableBalance += oldAmount; // Reverse old contribution
      await wallet.addTransaction(oldAmount, 'contribution', `Reversed contribution update (Contribution ID: ${id})`);
      
      wallet.availableBalance -= newAmount; // Deduct new contribution
      await wallet.addTransaction(newAmount, 'contribution', `Updated contribution (Contribution ID: ${id})`);
    }

    // Update the contribution amount
    updatedContribution.amount = newAmount;
    await updatedContribution.save();

    // Adjust community total contributions
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }

    community.totalContributions -= oldAmount; // Remove old amount
    community.totalContributions += newAmount; // Add new amount

    // Update contribution list (optional, if needed)
    const contributionIndex = community.contributionList.findIndex(
      (contrib) => contrib.userId.toString() === userId.toString()
    );
    if (contributionIndex !== -1) {
      community.contributionList[contributionIndex].amount = newAmount;
    }

    await community.save();

    res.status(200).json(updatedContribution);
  } catch (err) {
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

    // Revert the wallet balance
    const wallet = await Wallet.findOne({ userId: contribution.userId });
    if (wallet) {
      wallet.availableBalance += contribution.amount;
      wallet.totalBalance += contribution.amount;
      wallet.transactions.push({
        amount: contribution.amount,
        type: 'withdrawal',
        description: `Reversed contribution (Contribution ID: ${id})`,
      });
      await wallet.save();
    }

    // Adjust community's total contributions
    const community = await Community.findById(contribution.communityId);
    if (community) {
      community.totalContributions -= contribution.amount;
      // Optionally, remove the contribution from the community's list
      community.contributionList = community.contributionList.filter(
        (contrib) => contrib.userId.toString() !== contribution.userId.toString()
      );
      await community.save();
    }

    res.status(200).json({ message: 'Contribution deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting contribution', error: err.message });
  }
};


// Get all contributions by community
exports.getContributionsByCommunity = async (req, res) => {
  try {
    const contributions = await Contribution.find({ communityId: req.params.communityId });
    if (!contributions.length) {
      return res.status(404).json({ message: 'No contributions found for this community' });
    }
    res.status(200).json(contributions);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching contributions', error: err.message });
  }
};

// Get all contributions by user
exports.getContributionsByUser = async (req, res) => {
  try {
    const contributions = await Contribution.find({ userId: req.params.userId });
    if (!contributions.length) {
      return res.status(404).json({ message: 'No contributions found for this user' });
    }
    res.status(200).json(contributions);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching contributions', error: err.message });
  }
};

const Contribution = require('../models/Contribution');
const Community = require('../models/Community');

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
  const { userId, communityId, amount, status, date, paymentMethod } = req.body;

  // Validation: Ensure required fields are present
  if (!userId || !communityId || !amount || !date || !paymentMethod) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Optional: Check for duplicate contributions
    const existingContribution = await Contribution.findOne({ userId, communityId, date });
    if (existingContribution) {
      return res.status(400).json({ message: 'Contribution already exists for this date' });
    }

    // Create new contribution
    const newContribution = new Contribution({
      userId,
      communityId,
      amount,
      status: status || 'pending', // Default status
      date,
      paymentMethod,
    });

    await newContribution.save();

    // Update the corresponding community
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }

    // Calculate 10% for backup fund and 90% for community available balance
    const backupAmount = amount * 0.1;
    const availableAmount = amount * 0.9;

    community.contributions += amount; // Increment total contributions
    community.backupFund += backupAmount; // Add 10% to the backup fund
    community.availableBalance += availableAmount; // Add 90% to available balance

    // Update the member's contributionsPaid
    const member = community.membersList.find((m) => m.userId.equals(userId));
    if (member) {
      member.contributionsPaid += amount; // Update the member's contributionsPaid
    } else {
      return res.status(404).json({ message: 'User not found in community members list' });
    }

    await community.save();

    res.status(201).json({
      message: 'Contribution created successfully and community updated',
      contribution: newContribution,
      updatedCommunity: community,
    });
  } catch (err) {
    console.error('Error saving contribution:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Update a contribution
exports.updateContribution = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedContribution = await Contribution.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedContribution) {
      return res.status(404).json({ message: 'Contribution not found' });
    }
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

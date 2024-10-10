const Contribution = require('../models/Contribution');

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
  const { userId, communityId, amount, date } = req.body;
  if (!userId || !communityId || !amount || !date) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const newContribution = new Contribution({
      userId,
      communityId,
      amount,
      date
    });

    await newContribution.save();
    res.status(201).json(newContribution);
  } catch (err) {
    res.status(500).json({ message: 'Error creating contribution', error: err.message });
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

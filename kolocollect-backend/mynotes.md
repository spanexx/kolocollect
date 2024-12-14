



//controllers/contributionController.js

const Contribution = require('../models/Contribution');
const Community = require('../models/Community');
const { updateCommunity } = require('./communityController');


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
    const { userId, communityId, amount, contributionDate, paymentMethod } = req.body;

    if (!userId || !communityId || !amount || !paymentMethod) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const community = await Community.findById(communityId);

    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }

    // Create the contribution
    const newContribution = new Contribution({
      userId,
      communityId,
      amount,
      contributionDate,
      paymentMethod,
      status: 'Completed',
    });
    await newContribution.save();

    // Update the community
    community.totalContributions = (community.totalContributions || 0) + amount;
    community.contributionList = [
      ...(community.contributionList || []),
      {
        userId,
        amount,
        contributionDate,
        paymentMethod,
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

const express = require('express');
const router = express.Router();
const communityController = require('../controllers/communityController');


// Routes for communities

// Get all communities
router.get('/', communityController.getCommunities);

// Get a single community by ID
router.get('/:id', communityController.getCommunityById);

// Join a community
router.post('/:communityId/join', communityController.joinCommunity);

// Create a new community
router.post('/create', communityController.createCommunity);

// Update a community (ensure valid ID and necessary fields in body)
router.put('/update/:id', communityController.updateCommunity);

// Delete a community
router.delete('/delete/:id', communityController.deleteCommunity);

module.exports = router;

const express = require('express');
const router = express.Router();
const contributionController = require('../controllers/contributionController');
const Contribution = require('../models/Contribution');


// Contribution Routes
router.post('/', async (req, res) => {
    console.log('Received payload:', req.body); // Add this to log the raw body
    try {
      const contribution = new Contribution(req.body);
      await contribution.save();
      res.status(201).json(contribution);
    } catch (error) {
      console.error('Error saving contribution:', error); // Log detailed error
      res.status(400).json({ error: error.message });
    }
  });
  router.get('/community/:communityId', contributionController.getContributionsByCommunity); // Get all contributions for a specific community
router.get('/user/:userId', contributionController.getContributionsByUser); // Get all contributions by a specific user

module.exports = router;


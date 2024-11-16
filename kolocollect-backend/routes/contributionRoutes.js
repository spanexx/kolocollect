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

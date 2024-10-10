const express = require('express');
const router = express.Router();
const contributionController = require('../controllers/contributionController');

// Contribution Routes
router.post('/', contributionController.createContribution); // Create new contribution
router.get('/community/:communityId', contributionController.getContributionsByCommunity); // Get all contributions for a specific community
router.get('/user/:userId', contributionController.getContributionsByUser); // Get all contributions by a specific user

module.exports = router;

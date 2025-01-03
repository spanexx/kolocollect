const express = require('express');
const router = express.Router();
const contributionController = require('../controllers/contributionController');

// Contribution Routes

// Get all contributions
router.get('/', contributionController.getContributions);

// Get a single contribution by ID
router.get('/:id', contributionController.getContributionById);

// Create a new contribution
router.post('/create', contributionController.createContribution);

// Update a contribution
router.put('/:id', contributionController.updateContribution);

// Delete a contribution
router.delete('/:id', contributionController.deleteContribution);

// Get all contributions for a specific community
router.get('/community/:communityId', contributionController.getContributionsByCommunity);

// Get all contributions by a specific user
router.get('/user/:userId', contributionController.getContributionsByUser);

// Get all contributions in mid-cycles for a community
// router.get('/community/:communityId/midcycles', contributionController.getMidCycleContributions);

// Fetch all contributions for a specific mid-cycle
// router.get('/midcycle/:midCycleId', contributionController.getContributionsByMidCycle);


module.exports = router;

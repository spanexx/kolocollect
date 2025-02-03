const express = require('express');
const { getCommunityById } = require('../controllers/communityController');
const router = express.Router();
const communityController = require('../controllers/communityController');
const User = require('../models/User')

// Route to search communities
router.get('/search', communityController.searchCommunity);

// Route to filter communities
router.post('/filter', communityController.filterCommunity);

//get community by Id
router.get('/:id', getCommunityById)

// Route to create a new community
router.post('/create', communityController.createCommunity);

// Route to join a community
router.post('/join/:communityId', communityController.joinCommunity);

// Route to update community settings
router.put('/update/:communityId', communityController.updateSettings);

// Route to delete a community
router.delete('/delete/:communityId', communityController.deleteCommunity);

// Route to distribute payouts
router.post('/payouts/distribute/:communityId', communityController.distributePayouts);

// Route to reactivate a member
router.post('/member/reactivate/:communityId/:userId', communityController.reactivateMember);

// Route to apply resolved votes
router.post('/votes/apply/:communityId', communityController.applyResolvedVotes);

//Fetch All Contributions in Mid-Cycles
router.get('/:communityId/midcycle-contributions', communityController.getMidCycleContributions);

router.get('/payout/:communityId', communityController.getPayoutInfo);

// Route to pay penalty and missed contributions
router.post('/:communityId/members/:userId/payPenaltyAndMissedContribution', communityController.payPenaltyAndMissedContribution);

// Route to skip contribution and mark mid-cycle as ready
router.post('/:communityId/midCycles/:midCycleId/skipContributionAndMarkReady', communityController.skipContributionAndMarkReady);

module.exports = router;

const express = require('express');
const router = express.Router();
const communityController = require('../controllers/communityController');

// Route to create a new community
router.post('/create', communityController.createCommunity);

// Route to join a community
router.post('/join/:communityId', communityController.joinCommunity);

// Route to start a new mid-cycle
router.post('/midcycle/start/:communityId', communityController.startMidCycle);

// Route to finalize a mid-cycle
router.post('/midcycle/finalize/:communityId', communityController.finalizeMidCycle);

// Route to finalize a complete cycle
router.post('/cycle/finalize/:communityId', communityController.finalizeCycle);

// Route to update community settings
router.put('/update/:communityId', communityController.updateSettings);

// Route to delete a community
router.delete('/delete/:communityId', communityController.deleteCommunity);

// Route to distribute payouts
router.post('/payouts/distribute/:communityId', communityController.distributePayouts);

// Route to record contributions
router.post('/contribution/record', communityController.recordContribution);

// Route to skip payouts for defaulters
router.post('/payouts/skip/:communityId/:midCycleId', communityController.skipPayoutForDefaulters);

// Route to reactivate a member
router.post('/member/reactivate/:communityId/:userId', communityController.reactivateMember);

// Route to calculate total owed
router.get('/calculate/owed/:communityId/:userId', communityController.calculateTotalOwed);

// Route to process back payments
router.post('/payment/back/:communityId/:userId', communityController.processBackPayment);

// Route to apply resolved votes
router.post('/votes/apply/:communityId', communityController.applyResolvedVotes);

module.exports = router;

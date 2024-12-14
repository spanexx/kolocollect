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
router.post('/cycle/finalize/:communityId', communityController.finalizeCompleteCycle);

// Route to update community settings
router.put('/update/:communityId', communityController.updateCommunity);

// Route to handle community votes
router.post('/vote/:communityId', communityController.communityVote);

// Route to delete a community
router.delete('/delete/:communityId', communityController.deleteCommunity);

module.exports = router;

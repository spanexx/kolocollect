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
router.post('/', communityController.createCommunity);

// Update a community (ensure valid ID and necessary fields in body)
router.put('/update/:id', communityController.updateCommunity);

// Delete a community
router.delete('/delete/:id', communityController.deleteCommunity);

module.exports = router;

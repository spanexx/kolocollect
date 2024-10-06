 
const express = require('express');
const router = express.Router();
const communityController = require('../controllers/communityController');

// Get all communities
router.get('/', communityController.getCommunities);

// Get community by ID
router.get('/:id', communityController.getCommunityById);

// Create a new community
router.post('/', communityController.createCommunity);

module.exports = router;

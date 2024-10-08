const express = require('express');
const router = express.Router();
const communityController = require('../controllers/communityController');

// Routes for communities
router.get('/', communityController.getCommunities);
router.get('/:id', communityController.getCommunityById);
router.post('/', communityController.createCommunity);
router.put('/:id', communityController.updateCommunity);
router.delete('/:id', communityController.deleteCommunity);



module.exports = router;

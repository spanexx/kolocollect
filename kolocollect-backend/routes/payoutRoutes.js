const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payoutController');

// Payout Routes
router.post('/', payoutController.createPayout); // Create a new payout
router.get('/community/:communityId', payoutController.getPayoutsByCommunity); // Get all payouts for a specific community
router.get('/user/:userId', payoutController.getPayoutsByUser); // Get all payouts by a specific user
router.get('/:id', payoutController.getPayoutById); // Get a single payout by ID
router.put('/:id', payoutController.updatePayout); // Update a payout by ID
router.delete('/:id', payoutController.deletePayout); // Delete a payout by ID

module.exports = router;

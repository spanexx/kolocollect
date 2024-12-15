const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const walletController = require('../controllers/walletController');

// User routes
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.post('/wallet-update', walletController.updateWalletBalance); // Updated to use wallet controller
router.get('/profile/:id', userController.getUserProfile);
router.put('/profile/:id', userController.updateUserProfile);

// User community management
router.post('/:userId/community', userController.addCommunityToUser);
router.delete('/:userId/community/:communityId', userController.removeCommunityFromUser);

// Wallet operations
router.get('/:userId/wallet', walletController.getWalletByUserId);

// Communities for a user
router.get('/:userId/communities', userController.getUserCommunities);

// Apply penalty to a user
router.post('/:userId/penalty', userController.applyPenaltyToUser);

// Notifications management
router.put('/:userId/notifications/read', userController.markAllNotificationsAsRead);

// Log user activity
router.post('/:userId/activity', userController.logUserActivity);

// Delete user route
router.delete('/:userId', userController.deleteUser);

module.exports = router;

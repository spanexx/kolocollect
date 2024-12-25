const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const walletController = require('../controllers/walletController');

// User Management
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.get('/profile/:id', userController.getUserProfile);
router.put('/profile/:id', userController.updateUserProfile);
router.delete('/:userId', userController.deleteUser);

// Community Management
router.post('/:userId/community', userController.addCommunityToUser);
router.get('/:userId/communities', userController.getUserCommunity);
router.delete('/:userId/community/:communityId', userController.removeCommunityFromUser);

// Notifications
router.put('/:userId/notifications/read', userController.markAllNotificationsAsRead);
router.get('/:userId/notifications', userController.getUserNotifications); // New Route

// Contributions
router.post('/contributions/update', userController.updateUserContributions);
router.get('/:userId/contributions', userController.getContributionsByUser); // New Route

// Payouts and Next In Line
router.get('/user/payouts/:userId', userController.getUserPayouts);
router.get('/user/nextinline/:userId', userController.checkNextInLineStatus);

// Penalties
router.post('/:userId/penalty', userController.applyPenaltyToUser);

// Wallet Management
router.get('/:userId/wallet', walletController.getWalletBalance); // New Route

// User Activity
router.post('/:userId/activity', userController.logUserActivity);

module.exports = router;

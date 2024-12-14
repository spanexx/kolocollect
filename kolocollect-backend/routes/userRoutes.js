const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const walletController = require('../controllers/walletController');

// User routes
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.post('/wallet-update', userController.updateWalletBalance);
router.get('/profile/:id', userController.getUserProfile);
router.put('/profile/:id', userController.updateUserProfile);

// Get wallet by user ID
router.get('/:userId/wallet', walletController.getWalletByUserId);

// Get communities for a user
router.get('/:userId/communities', userController.getUserCommunities);

// Apply penalty to a user
router.post('/:userId/penalty', userController.applyPenaltyToUser);

// Mark notifications as read
router.put('/:userId/notifications/read', userController.markNotificationsAsRead);

// Log user activity
router.post('/:userId/activity', userController.logUserActivity);

module.exports = router;

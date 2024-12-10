//walletRoute.js
const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const stripeWebhook = require('../middlewares/webhookMiddleware');

// Wallet routes
router.get('/:userId/full', walletController.getWallet);
router.get('/:userId/balance', walletController.getWalletBalance);
router.post('/:userId/add', walletController.addFunds);
router.post('/:userId/withdraw', walletController.withdrawFunds);
router.post('/:userId/transfer', walletController.transferFunds);
router.get('/:userId/transactions', walletController.getTransactionHistory);
router.post('/:userId/fix', walletController.fixFunds);
router.get('/:userId/fixedFunds', walletController.getFixedFunds);
router.post('/webhook', stripeWebhook);

module.exports = router;

// walletRoutes.js
const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');

// Get the user's entire wallet (balance and transaction history)

router.get('/:userId/full', walletController.getWallet);

// Get wallet balance
router.get('/:userId', walletController.getWalletBalance);

// Add funds to wallet
router.post('/:userId/add', walletController.addFunds);

// Withdraw funds from wallet
router.post('/:userId/withdraw', walletController.withdrawFunds);

//Get the transaction history of the user's wallet.

router.get('/:userId/transactions', walletController.getTransactionHistory);

// Route to fix funds
router.post('/:userId/fix', walletController.fixFunds); 

// Get fixed funds for a user
router.get('/:userId/fixedFunds', walletController.getFixedFunds);


// Route to transfer funds
router.post('/:userId/transfer', walletController.transferFunds); 

module.exports = router;

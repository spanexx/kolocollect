const express = require('express');
const { createPaymentIntent } = require('../controllers/stripeController');
const router = express.Router();

// Route to create a PaymentIntent
router.post('/payment-intent', createPaymentIntent);

module.exports = router;

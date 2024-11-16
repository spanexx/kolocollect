const mongoose = require('mongoose');


const contributionSchema = new mongoose.Schema({
  communityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  contributionDate: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed'],
    default: 'Pending',
  },
  paymentMethod: { 
    type: String, 
    required: false },

  transactionId: {
    type: String,  // Unique identifier for the transaction
    required: false,
  }
});



const Contribution = mongoose.model('Contribution', contributionSchema);

module.exports = Contribution;

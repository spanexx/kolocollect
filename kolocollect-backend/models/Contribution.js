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
    type: Date,
    default: Date.now,
  },
});

const Contribution = mongoose.model('Contribution', contributionSchema);

module.exports = Contribution;

// models/Contribution.js

const mongoose = require('mongoose');

const contributionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  communityId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Community' },
  amount: { type: Number, required: true },
  contributionDate: { type: String, required: true }, // Ensure this matches
  status: { type: String, default: 'Pending' },
});

module.exports = mongoose.model('Contribution', contributionSchema);

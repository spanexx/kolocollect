

const mongoose = require('mongoose');


const communitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  contributions: { type: Number, default: 0 }, // Total contributions including backup fund
  availableBalance: { type: Number, default: 0 }, // 90% of contributions
  nextPayout: { type: Date },
  members: { type: Number, default: 0 },
  maxMembers: { type: Number, required: true },
  contributionFrequency: { type: String, enum: ['weekly', 'bi-weekly', 'monthly'], required: true },
  cycleLockEnabled: { type: Boolean, default: false },
  backupFund: { type: Number, default: 0 },
  isPrivate: { type: Boolean, default: false },
  contributionLimit: { type: Number, default: 1000 },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  membersList: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String, required: true },
      email: { type: String, required: true },
      contributionsPaid: { type: Number, default: 0 },
    },
  ],
});

const Community = mongoose.model('Community', communitySchema);
module.exports = Community;

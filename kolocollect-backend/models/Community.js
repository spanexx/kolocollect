const mongoose = require('mongoose');

const communitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  contributions: { type: Number, default: 0 },
  nextPayout: { type: Date },
  members: { type: Number, default: 0 },
  maxMembers: { type: Number, required: true },  // Maximum members in the community
  contributionFrequency: { 
    type: String, 
    enum: ['weekly', 'bi-weekly', 'monthly'], 
    required: true 
  },
  cycleLockEnabled: { type: Boolean, default: false }, // Flag for cycle lock feature
  backupFund: { type: Number, default: 0 },  // Amount accumulated in the backup fund
  membersList: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String, required: true },
      email: { type: String, required: true },
      contributionsPaid: { type: Number, default: 0 },  // Contributions paid so far by the member
    },
  ],
});

const Community = mongoose.model('Community', communitySchema);
module.exports = Community;

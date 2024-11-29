const mongoose = require('mongoose');

const communitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    contributions: { type: Number, default: 0 },
    availableBalance: { type: Number, default: 0 },
    nextPayout: {
      type: Date,
      default: function () {
        const now = new Date();
        switch (this.contributionFrequency) {
          case 'weekly': return new Date(now.setDate(now.getDate() + 7));
          case 'bi-weekly': return new Date(now.setDate(now.getDate() + 14));
          case 'monthly': return new Date(now.setMonth(now.getMonth() + 1));
          default: return null;
        }
      },
    },
    members: { type: Number, default: 0 },
    maxMembers: { type: Number, required: true },
    contributionFrequency: {
      type: String,
      enum: ['weekly', 'bi-weekly', 'monthly'],
      required: true,
    },
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
        contributionsPaid: {
          total: { type: Number, default: 0 },
          records: [
            {
              amount: { type: Number },
              date: { type: Date, default: Date.now },
            },
          ],
        },
      },
    ],
    contributionsList: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        amount: { type: Number, required: true },
        paymentMethod: { type: String },
        contributionDate: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const Community = mongoose.model('Community', communitySchema);
module.exports = Community;

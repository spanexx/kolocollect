const mongoose = require('mongoose');

const communitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  contributions: { type: Number, default: 0 },
  nextPayout: { type: Date },
  members: { type: Number, default: 0 },
  // Store an array of user objects
  membersList: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    email: { type: String, required: true }
  }]
});

const Community = mongoose.model('Community', communitySchema);
module.exports = Community;

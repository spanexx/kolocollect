const mongoose = require('mongoose');

const CommunitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  members: { type: Number, default: 0 }, // This should default or auto-update
  contributions: { type: Number, default: 0 }, 
  nextPayout: { type: Date },
  membersList: [{ name: String }],
});

module.exports = mongoose.model('Community', CommunitySchema);

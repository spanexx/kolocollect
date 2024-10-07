const Community = require('../models/Community');

// Get all communities
exports.getCommunities = async (req, res) => {
  try {
    const communities = await Community.find();
    res.json(communities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get a single community by ID
exports.getCommunityById = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) return res.status(404).json({ message: "Community not found" });
    res.json(community);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



// Create a new community
exports.createCommunity = async (req, res) => {
  try {
    const { name, description, membersList, contributions, nextPayout } = req.body;
    
// Create a new community with the provided data and calculate members count
    const newCommunity = new Community({
      name,
      description,
      membersList,
      contributions,
      nextPayout,
      members: membersList.length // Automatically set the number of members based on the membersList length
    });
    
    // Save the new community to the database
    await newCommunity.save();

    res.status(201).json(newCommunity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

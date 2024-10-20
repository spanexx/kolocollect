const Community = require('../models/Community');
const User = require('../models/User');


// Get all communities
exports.getCommunities = async (req, res) => {
  try {
    const communities = await Community.find();
    res.json(communities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Join a community
exports.joinCommunity = async (req, res) => {
  try {
    const { communityId, userId } = req.body;

    // Validate that the user exists
    const user = await User.findById(userId).exec();
    console.log("User found:", user);

    if (!user) {
      console.log("User not found with ID:", userId);  // Debugging line
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Validate that the community exists
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    } 

    // Check if user is already a member of the community
    const isAlreadyMember = community.membersList.some(member => member.userId.equals(user._id));
    if (isAlreadyMember) {
      return res.status(400).json({ message: 'User is already a member of the community' });
    }

    // Add user to the community members list
    community.membersList.push({
      userId: user._id,
      name: user.name,
      email: user.email
    });
        community.members += 1;  // Increment the member count

    await community.save();
    res.status(200).json({ message: 'Successfully joined the community', community });
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
    const newCommunity = new Community({
      name,
      description,
      membersList,
      contributions,
      nextPayout,
      members: membersList.length
    });

    await newCommunity.save();
    res.status(201).json(newCommunity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update a community
exports.updateCommunity = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedCommunity = await Community.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedCommunity) return res.status(404).json({ message: "Community not found" });
    res.json(updatedCommunity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete a community
exports.deleteCommunity = async (req, res) => {
  try {
    const { id } = req.params;
    const community = await Community.findByIdAndDelete(id);
    if (!community) return res.status(404).json({ message: "Community not found" });
    res.json({ message: "Community deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

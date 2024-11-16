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
    const { communityId } = req.params;
    const { userId } = req.body;

    console.log("Join request received:", { userId, communityId });

    if (!communityId || !userId) {
      return res.status(400).json({ message: 'Missing required communityId or userId' });
    }

    const community = await Community.findById(communityId);
    const user = await User.findById(userId);

    if (!community) return res.status(404).json({ message: 'Community not found' });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Skip cycle lock check here for joining
    if (community.members >= community.maxMembers) {
      return res.status(400).json({ message: 'Community has reached its maximum number of members' });
    }

    const isAlreadyMember = community.membersList.some(member => member.userId.equals(user._id));
    if (isAlreadyMember) {
      return res.status(400).json({ message: 'User is already a member of the community' });
    }

    community.membersList.push({ userId: user._id, name: user.name, email: user.email });
    community.members += 1;
    if (!user.communities.includes(communityId)) {
      user.communities.push(communityId);
    }
    await community.save();
    await user.save();

    res.status(200).json({ message: 'Successfully joined the community', community });
  } catch (err) {
    console.error('Error in joinCommunity:', err);
    res.status(500).json({ error: 'An error occurred while processing your request' });
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
    const {
      name,
      description,
      maxMembers,
      contributionFrequency,
      cycleLockEnabled,
      backupFund,
      nextPayout,
      isPrivate = false,
      contributionLimit = 1000,
      userId,       // Include userId, name, and email in request body
      userName,
      userEmail,
    } = req.body;

    if (!name || !maxMembers || !contributionFrequency || !nextPayout || !userId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const newCommunity = new Community({
      name,
      description,
      maxMembers,
      contributionFrequency,
      cycleLockEnabled: cycleLockEnabled || false,
      backupFund: backupFund || 0,
      nextPayout,
      isPrivate,
      contributionLimit,
      adminId: userId, // Assign userId as adminId
      membersList: [{
        userId,
        name: userName,
        email: userEmail,
      }],
      members: 1, // Initial members count includes the admin
    });

    await newCommunity.save();

    const user = await User.findById(userId);
    if (user) {
      user.communities.push(newCommunity._id);
      await user.save();
    }

    res.status(201).json(newCommunity);
  } catch (err) {
    console.error('Error in createCommunity:', err);
    res.status(500).json({ error: err.message });
  }
};

// Update a community
exports.updateCommunity = async (req, res) => {
  try {
    const { id } = req.params;
    const { maxMembers, contributionFrequency, cycleLockEnabled, backupFund } = req.body;

    // Validate if required fields are provided
    if (maxMembers || contributionFrequency || cycleLockEnabled || backupFund) {
      const updatedCommunity = await Community.findByIdAndUpdate(id, req.body, { new: true });
      if (!updatedCommunity) return res.status(404).json({ message: "Community not found" });
      res.json(updatedCommunity);
    } else {
      return res.status(400).json({ message: 'No valid fields provided to update' });
    }
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

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
    const { communityId } = req.params; // Get communityId from params
    const { userId } = req.body; // Get userId from the request body

    // Log the incoming data for debugging purposes
    console.log("Join request received:", { userId, communityId });

    // Ensure all necessary data is provided
    if (!communityId || !userId) {
      console.log("Missing communityId or userId");
      return res.status(400).json({ message: 'Missing required communityId or userId' });
    }

    // Check if the community and user exist in the database
    const community = await Community.findById(communityId);
    const user = await User.findById(userId);

    // Log the results of these database queries
    console.log("Community found:", community ? true : false);
    console.log("User found:", user ? true : false);

    if (!community) return res.status(404).json({ message: 'Community not found' });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Additional checks: cycle lock, max members, etc.
    if (community.cycleLockEnabled) {
      console.log("Cycle lock is enabled for community", communityId);
      return res.status(400).json({ message: 'Cycle lock is enabled, cannot join community at this time' });
    }

    // Check if the community has reached its maximum members
    if (community.members >= community.maxMembers) {
      console.log("Community has reached its max members");
      return res.status(400).json({ message: 'Community has reached its maximum number of members' });
    }

    // Check if the user is already a member of the community
    const isAlreadyMember = community.membersList.some(member => member.userId.equals(user._id));
    if (isAlreadyMember) {
      console.log("User is already a member of the community");
      return res.status(400).json({ message: 'User is already a member of the community' });
    }

    // Add user to community membersList and update member count
    community.membersList.push({ userId: user._id, name: user.name, email: user.email });
    community.members += 1;

    // Add the community to the user's list of communities
    if (!user.communities.includes(communityId)) {
      user.communities.push(communityId);
    }

    // Save both user and community after updates
    await community.save();
    await user.save();

    // Log successful join action
    console.log("User successfully joined community", communityId);

    // Send success response
    res.status(200).json({ message: 'Successfully joined the community', community });
  } catch (err) {
    // Log the error for debugging purposes
    console.error("Error in joinCommunity:", err);

    // Send error response
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
    const { name, description, maxMembers, contributionFrequency, cycleLockEnabled, backupFund, nextPayout, membersList = [], contributions = 0 } = req.body;

    // Validate required fields
    if (!name || !maxMembers || !contributionFrequency) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Ensure membersList includes email for each member
    membersList.forEach(member => {
      if (!member.email) {
        return res.status(400).json({ message: 'Each member must have an email' });
      }
    });

    const newCommunity = new Community({
      name,
      description,
      maxMembers,
      contributionFrequency,
      cycleLockEnabled: cycleLockEnabled || false,
      backupFund: backupFund || 0,
      nextPayout,
      membersList,
      contributions,
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

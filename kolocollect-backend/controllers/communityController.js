const Community = require('../models/Community');
const User = require('../models/User');
const Wallet = require('../models/Wallet');

// Create a new community
exports.createCommunity = async (req, res) => {
  try {
    const { name, description, maxMembers, contributionFrequency, backupFundPercentage, adminId, settings } = req.body;

    if (!name || !maxMembers || !contributionFrequency || !adminId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const newCommunity = new Community({
      name,
      description,
      admin: adminId,
      settings: {
        contributionFrequency,
        maxMembers,
        backupFundPercentage,
        ...settings,
      },
      members: [
        {
          userId: adminId,
          position: 1,
          status: 'active',
          penalty: 0,
        },
      ],
    });

    // Ensure firstCycleMin is synced during creation
    await newCommunity.syncFirstCycleMin(newCommunity.settings.firstCycleMin || 5);

    await newCommunity.save();

    // Link community to the admin's user profile
    const adminUser = await User.findById(adminId);
    if (adminUser) {
      adminUser.communities.push(newCommunity._id);
      await adminUser.save();
    }

    res.status(201).json({ message: 'Community created successfully', community: newCommunity });
  } catch (err) {
    console.error('Error creating community:', err);
    res.status(500).json({ message: 'Error creating community', error: err.message });
  }
};


// Join a community
exports.joinCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { userId, contributionAmount } = req.body;

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: 'Community not found' });

    if (community.members.length >= community.settings.maxMembers) {
      return res.status(400).json({ message: 'Community is full' });
    }

    const isAlreadyMember = community.members.some((member) => member.userId.equals(userId));
    if (isAlreadyMember) {
      return res.status(400).json({ message: 'User is already a member of the community' });
    }

    // Add the user as a member (position remains null if first cycle hasn't started)
    if (community.cycles.length === 0) {
      // If no cycle exists, add member and start the first cycle if ready
      community.members.push({ userId, position: null, status: 'active', penalty: 0 });
      await community.save();

      await community.startFirstCycle();
    } else {
      // If cycles exist, treat it as mid-cycle addition
      await community.addNewMemberMidCycle(userId, contributionAmount);
    }

    const user = await User.findById(userId);
    if (user && !user.communities.includes(communityId)) {
      user.communities.push(communityId);
      await user.save();
    }

    res.status(200).json({ message: 'Successfully joined the community', community });
  } catch (err) {
    console.error('Error joining community:', err);
    res.status(500).json({ message: 'Error joining community', error: err.message });
  }
};

// Start a new mid-cycle
exports.startMidCycle = async (req, res) => {
  try {
    const { communityId } = req.params;

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: 'Community not found' });

    // Use the schema's method to handle mid-cycle creation
    await community.startMidCycle();

    res.status(200).json({ message: 'Mid-cycle started successfully' });
  } catch (err) {
    console.error('Error starting mid-cycle:', err);
    res.status(500).json({ message: 'Error starting mid-cycle', error: err.message });
  }
};

//distribute payouts
exports.distributePayouts = async (req, res) => {
  try {
    const { communityId } = req.params;

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: 'Community not found' });

    // Use the schema's method for payout distribution
    const result = await community.distributePayouts();

    res.status(200).json(result);
  } catch (err) {
    console.error('Error distributing payouts:', err);
    res.status(500).json({ message: 'Error distributing payouts', error: err.message });
  }
};

// Finalize a complete cycle
exports.finalizeCycle = async (req, res) => {
  try {
    const { communityId } = req.params;

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: 'Community not found' });

    const currentCycle = community.cycles.find((cycle) => !cycle.isComplete);
    if (!currentCycle) return res.status(400).json({ message: 'No active cycle to finalize.' });

    // Ensure all mid-cycles in the current cycle are complete
    const allMidCyclesComplete = community.midCycle.every(
      (midCycle) => midCycle.cycleNumber === currentCycle.cycleNumber && midCycle.isComplete
    );

    if (!allMidCyclesComplete) {
      return res.status(400).json({ message: 'Some mid-cycles are incomplete.' });
    }

    currentCycle.isComplete = true;
    currentCycle.endDate = new Date();

    await community.save();

    res.status(200).json({ message: 'Cycle finalized successfully', community });
  } catch (err) {
    console.error('Error finalizing cycle:', err);
    res.status(500).json({ message: 'Error finalizing cycle', error: err.message });
  }
};



exports.recordContribution = async (req, res) => {
  try {
    const { communityId, userId, contributions } = req.body;

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: 'Community not found' });

    const result = await community.recordContribution(userId, contributions);

    res.status(200).json(result);
  } catch (err) {
    console.error('Error recording contributions:', err);
    res.status(500).json({ message: 'Error recording contributions', error: err.message });
  }
};


exports.skipPayoutForDefaulters = async (req, res) => {
  try {
    const { communityId, midCycleId } = req.params;

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: 'Community not found' });

    const result = await community.skipPayoutForDefaulters(midCycleId);

    res.status(200).json(result);
  } catch (err) {
    console.error('Error skipping payout for defaulters:', err);
    res.status(500).json({ message: 'Error skipping payout for defaulters', error: err.message });
  }
};


exports.reactivateMember = async (req, res) => {
  try {
    const { communityId, userId } = req.params;
    const { contributionAmount } = req.body;

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: 'Community not found' });

    const result = await community.reactivateMember(userId, contributionAmount);

    res.status(200).json(result);
  } catch (err) {
    console.error('Error reactivating member:', err);
    res.status(500).json({ message: 'Error reactivating member', error: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { settings } = req.body;

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: 'Community not found' });

    if (settings.firstCycleMin) {
      await community.syncFirstCycleMin(settings.firstCycleMin);
    }

    Object.assign(community.settings, settings);

    await community.save();

    res.status(200).json({ message: 'Settings updated successfully', community });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ message: 'Error updating settings', error: err.message });
  }
};


exports.calculateTotalOwed = async (req, res) => {
  try {
    const { communityId, userId } = req.params;

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: 'Community not found' });

    const totalOwed = community.calculateTotalOwed(userId);

    res.status(200).json({ totalOwed });
  } catch (err) {
    console.error('Error calculating total owed:', err);
    res.status(500).json({ message: 'Error calculating total owed', error: err.message });
  }
};


exports.processBackPayment = async (req, res) => {
  try {
    const { communityId, userId } = req.params;
    const { paymentAmount } = req.body;

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: 'Community not found' });

    await community.processBackPayment(userId, paymentAmount);

    res.status(200).json({ message: 'Back payment processed successfully.' });
  } catch (err) {
    console.error('Error processing back payment:', err);
    res.status(500).json({ message: 'Error processing back payment', error: err.message });
  }
};


exports.applyResolvedVotes = async (req, res) => {
  try {
    const { communityId } = req.params;

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: 'Community not found' });

    await community.applyResolvedVotes();

    res.status(200).json({ message: 'Resolved votes applied successfully.' });
  } catch (err) {
    console.error('Error applying resolved votes:', err);
    res.status(500).json({ message: 'Error applying resolved votes', error: err.message });
  }
};


exports.deleteCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;

    // Find the community by ID
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }

    // Check if the requestor is the admin of the community
    const { userId } = req.body; // Assuming userId is sent in the request body
    if (!community.admin.equals(userId)) {
      return res.status(403).json({ message: 'You are not authorized to delete this community.' });
    }

    // Remove the community reference from all member profiles
    for (const member of community.members) {
      const user = await User.findById(member.userId);
      if (user) {
        user.communities = user.communities.filter((id) => !id.equals(communityId));
        await user.save();
      }
    }

    // Handle linked wallets (optional: freeze or notify users)
    // Example: Unlink wallets if needed, or handle funds before deletion
    for (const member of community.members) {
      const wallet = await Wallet.findOne({ userId: member.userId });
      if (wallet) {
        // Optionally perform wallet operations here
        console.log(`Wallet handled for user: ${member.userId}`);
      }
    }

    // Delete the community
    await Community.findByIdAndDelete(communityId);

    res.status(200).json({ message: 'Community deleted successfully.' });
  } catch (err) {
    console.error('Error deleting community:', err);
    res.status(500).json({ message: 'Error deleting community.', error: err.message });
  }
};
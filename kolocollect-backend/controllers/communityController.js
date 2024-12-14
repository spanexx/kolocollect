const Community = require('../models/Community');
const User = require('../models/User');
const Wallet = require('../models/Wallet');

// Create a new community
exports.createCommunity = async (req, res) => {
  try {
    const {
      name,
      description,
      maxMembers,
      contributionFrequency,
      backupFundPercentage,
      adminId,
      settings,
    } = req.body;

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
      members: [{
        userId: adminId,
        position: 1,
        status: 'active',
        penalty: 0,
      }],
    });

    await newCommunity.save();

    // Link community to admin user
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
    const { userId } = req.body;

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: 'Community not found' });

    if (community.members.length >= community.settings.maxMembers) {
      return res.status(400).json({ message: 'Community is full' });
    }

    const isAlreadyMember = community.members.some(member => member.userId.equals(userId));
    if (isAlreadyMember) {
      return res.status(400).json({ message: 'User is already a member of the community' });
    }

    community.members.push({ userId, status: 'active', penalty: 0 });

    const user = await User.findById(userId);
    if (user && !user.communities.includes(communityId)) {
      user.communities.push(communityId);
      await user.save();
    }

    await community.save();

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

    const currentCycle = community.cycles.find(c => !c.isComplete);
    if (!currentCycle) return res.status(400).json({ message: 'No active cycle available to start a mid-cycle.' });

    await community.startMidCycle();

    res.status(200).json({ message: 'Mid-cycle started successfully' });
  } catch (err) {
    console.error('Error starting mid-cycle:', err);
    res.status(500).json({ message: 'Error starting mid-cycle', error: err.message });
  }
};

// Finalize a mid-cycle
exports.finalizeMidCycle = async (req, res) => {
  try {
    const { communityId } = req.params;
    const community = await Community.findById(communityId).populate('midCycle');

    if (!community) return res.status(404).json({ message: 'Community not found' });

    const currentMidCycle = community.midCycle.find((m) => !m.isComplete);
    if (!currentMidCycle) return res.status(400).json({ message: 'No active mid-cycle found to finalize.' });

    // Example payout logic
    for (const contributor of currentMidCycle.contributors) {
      await User.updateUserContributions(contributor.contributorId, communityId, {
        amount: contributor.amount,
        cycleId: currentMidCycle.cycleNumber,
        midCycleId: currentMidCycle._id,
      });
    }

    if (currentMidCycle.missedContributions.length > 0) {
      for (const missedUserId of currentMidCycle.missedContributions) {
        await User.updateUserContributions(missedUserId, communityId, {
          missed: true,
          cycleId: currentMidCycle.cycleNumber,
          midCycleId: currentMidCycle._id,
        });
      }
    }

    currentMidCycle.isComplete = true;
    await community.save();

    res.status(200).json({ message: 'Mid-cycle finalized successfully' });
  } catch (err) {
    console.error('Error finalizing mid-cycle:', err);
    res.status(500).json({ message: 'Error finalizing mid-cycle', error: err.message });
  }
};

// Finalize a complete cycle
exports.finalizeCompleteCycle = async (req, res) => {
  try {
    const { communityId } = req.params;
    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: 'Community not found' });

    const currentCycle = community.cycles.find(c => !c.isComplete);
    if (!currentCycle) return res.status(400).json({ message: 'No active cycle found to finalize.' });

    await community.finalizeCompleteCycle();

    res.status(200).json({ message: 'Complete cycle finalized successfully' });
  } catch (err) {
    console.error('Error finalizing complete cycle:', err);
    res.status(500).json({ message: 'Error finalizing complete cycle', error: err.message });
  }
};

// Update community settings
exports.updateCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { adminId, settings } = req.body;

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: 'Community not found' });

    if (!community.admin.equals(adminId)) {
      return res.status(403).json({ message: 'Only the admin can update community settings' });
    }

    Object.assign(community.settings, settings);
    await community.save();

    res.status(200).json({ message: 'Community settings updated successfully', community });
  } catch (err) {
    console.error('Error updating community:', err);
    res.status(500).json({ message: 'Error updating community', error: err.message });
  }
};

// Handle community votes
exports.communityVote = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { userId, topic, choice } = req.body;

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: 'Community not found' });

    if (community.members.length % 2 === 0) {
      return res.status(400).json({ message: 'Voting can only occur when the number of members is odd.' });
    }

    const existingVote = community.votes.find(v => v.topic === topic && !v.resolved);
    if (!existingVote) {
      community.votes.push({ topic, options: [choice], votes: [{ userId, choice }] });
    } else {
      const userVote = existingVote.votes.find(v => v.userId.equals(userId));
      if (userVote) {
        userVote.choice = choice;
      } else {
        existingVote.votes.push({ userId, choice });
      }

      const voteCounts = existingVote.votes.reduce((counts, v) => {
        counts[v.choice] = (counts[v.choice] || 0) + 1;
        return counts;
      }, {});

      const totalVotes = existingVote.votes.length;
      const adminExtraVote = community.admin.equals(userId) ? 1 : 0;

      Object.keys(voteCounts).forEach(option => {
        voteCounts[option] += adminExtraVote;
      });

      const maxVotes = Math.max(...Object.values(voteCounts));
      const winningChoices = Object.keys(voteCounts).filter(option => voteCounts[option] === maxVotes);

      if (winningChoices.length === 1) {
        existingVote.resolved = true;
        existingVote.resolution = winningChoices[0];

        if (topic === 'positioningMode') {
          community.positioningMode = winningChoices[0];
        } else if (topic === 'lockPayout') {
          community.cycleLockEnabled = winningChoices[0] === 'Locked';
        }
      }
    }

    await community.save();
    res.status(200).json({ message: 'Vote processed successfully', community });
  } catch (err) {
    console.error('Error handling vote:', err);
    res.status(500).json({ message: 'Error handling vote', error: err.message });
  }
};

// Delete a community
exports.deleteCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { adminId } = req.body;

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: 'Community not found' });

    if (!community.admin.equals(adminId)) {
      return res.status(403).json({ message: 'Only the admin can delete this community' });
    }

    const membersToUpdate = community.members.map(member => member.userId);
    await User.updateMany(
      { _id: { $in: membersToUpdate } },
      { $pull: { communities: communityId } }
    );

    await community.remove();

    res.status(200).json({ message: 'Community deleted successfully' });
  } catch (err) {
    console.error('Error deleting community:', err);
    res.status(500).json({ message: 'Error deleting community', error: err.message });
  }
};

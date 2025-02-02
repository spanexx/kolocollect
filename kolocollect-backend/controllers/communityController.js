const { calculateTotalOwed, processBackPayment } = require('../utils/contributionUtils');
const Community = require('../models/Community');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const createErrorResponse = (res, status, message) => res.status(status).json({ error: { message } });
const mongoose = require('mongoose');

// Function to check if a string is a valid ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const retryOperation = async (fn, maxRetries = 3) => {
  let attempts = 0;
  const retry = async () => {
      try {
          return await fn();
      } catch (err) {
          if (err.name === 'VersionError' && attempts < maxRetries) {
              attempts++;
              console.log(`Retry #${attempts} for version conflict`);
              await new Promise(resolve => setTimeout(resolve, 100 * attempts));
              return retry();
          }
          throw err;
      }
  };
  return retry();
};


// Get all communities
exports.getAllCommunities = async (req, res) => {
  try {
    // Fetch all communities from the database
    const communities = await Community.find();

    // Check if communities exist
    if (!communities || communities.length === 0) {
      return res.status(404).json([]);
    }

    // Respond with the list of communities directly (as an array)
    res.status(200).json(communities);
  } catch (err) {
    console.error('Error fetching communities:', err);
    
    res.status(500).json({ message: 'Error fetching communities.', error: err.message });
  }
};




// Create a new community
exports.createCommunity = async (req, res) => {
  try {
    const { name, description, maxMembers, contributionFrequency, backupFundPercentage, adminId, settings } = req.body;

    if (!name || !maxMembers || !contributionFrequency || !adminId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Fetch admin user details
    const adminUser = await User.findById(adminId);
    if (!adminUser) {
      return res.status(404).json({ message: 'Admin user not found' });
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
          name: adminUser.name, // Use admin's name
          email: adminUser.email, // Use admin's email
          position: 1,
          status: 'active',
          penalty: 0,
        },
      ],
    });

    await newCommunity.syncFirstCycleMin(newCommunity.settings.firstCycleMin || 5);
    await newCommunity.updatePayoutInfo()
    await newCommunity.save();

    // Update admin's user details
    if (adminUser.role !== 'admin') {
      adminUser.role = 'admin'; // Update role to admin
    }
    adminUser.communities.push(newCommunity._id); // Add the community ID to the user's communities array
    await adminUser.addNotification(
      'info',
      `Community "${name}" created successfully.`,
      newCommunity._id
    );
    await adminUser.save();

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
      const { userId, name, email, contributionAmount } = req.body;

      if (!userId || !name || !email) {
          return res.status(400).json({ message: 'Missing required fields: userId, name, or email.' });
      }

      const community = await Community.findById(communityId);
      if (!community) return res.status(404).json({ message: 'Community not found.' });

      const isAlreadyMember = community.members.some((member) => 
          member.userId.toString() === userId || member.email === email
      );
      if (isAlreadyMember) {
          return res.status(400).json({ message: 'User is already a member of the community.' });
      }

      const isFull = community.members.length >= community.settings.maxMembers;
      if (isFull) {
          return res.status(400).json({ message: 'Community is full.' });
      }

      const currentCycleNumber = community.cycles.length ? community.cycles[community.cycles.length - 1].cycleNumber : 0;

      if (currentCycleNumber <= 1 ) {
          const activeMidCycle = community.midCycle.find((mc) => !mc.isComplete);
          const status = activeMidCycle ? 'waiting' : 'active';

          community.members.push({
              userId,
              name,
              email,
              position: null,
              status,
              penalty: 0,
          });
      } else {

          await community.addNewMemberMidCycle(userId, name, email, contributionAmount);
      }

      await community.save();

      const user = await User.findById(userId);
      if (user) {
          const message =
              currentCycleNumber === 1
                  ? `You have joined the community "${community.name}".`
                  : `You have joined the community "${community.name}" during a mid-cycle.`;

          await user.addNotification('info', message, communityId);
          user.communities.push(communityId);
          await user.save();
      }

      res.status(200).json({ message: 'Successfully joined the community.', community });
  } catch (err) {
      console.error('Error in joinCommunity:', err);
      res.status(500).json({ message: 'Error joining community.', error: err.message });
  }
};



exports.getCommunityById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid community ID' });
    }
    const community = await Community.findById(id);
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }
    res.json(community);
  } catch (error) {
    console.error('Error fetching community:', error);
    res.status(500).json({ message: 'Server error' });
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

        const result = await community.distributePayouts();
        res.status(200).json(result);
    } catch (err) {
        console.error('Error distributing payouts:', err);
        res.status(500).json({ message: 'Error distributing payouts.', error: err.message });
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

      await community.recordContribution(userId, contributions);
      await community.updatePayoutInfo();
      res.status(200).json({ message: 'Contribution recorded and payout updated.' });
  } catch (err) {
      console.error('Error recording contributions:', err);
      res.status(500).json({ message: 'Error recording contributions.' });
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


// Reactivate a member
exports.reactivateMember = async (req, res) => {
  try {
    const { communityId, userId } = req.params;
    const { contributionAmount } = req.body;

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: 'Community not found' });

    const result = await community.reactivateMember(userId, contributionAmount);

    // Notify the reactivated member
    const user = await User.findById(userId);
    if (user) {
      await user.addNotification('info', `Your membership has been reactivated in the community "${community.name}".`);
    }

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
    const totalOwed = await calculateTotalOwed(communityId, userId);

    res.status(200).json({ totalOwed });
  } catch (err) {
    console.error('Error calculating total owed:', err);
    createErrorResponse(res, 500, 'Failed to calculate total owed.');
  }
};


exports.processBackPayment = async (req, res) => {
  try {
    const { communityId, userId } = req.params;
    const { paymentAmount } = req.body;

    await processBackPayment(communityId, userId, paymentAmount);

    res.status(200).json({ message: 'Back payment processed successfully.' });
  } catch (err) {
    console.error('Error processing back payment:', err);
    createErrorResponse(res, 500, 'Failed to process back payment.');
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

exports.getMidCycleContributions = async (req, res) => {
  try {
    const { communityId } = req.params;

    // Validate that the community exists
    const community = await Community.findById(communityId);
    if (!community) return createErrorResponse(res, 404, 'Community not found.');

    // Extract contributions from all mid-cycles
    const midCycleContributions = community.midCycle.map(midCycle => ({
      cycleNumber: midCycle.cycleNumber,
      isComplete: midCycle.isComplete,
      nextInLine: midCycle.nextInLine,
      contributions: midCycle.contributors.map(contributor => ({
        contributorId: contributor.contributorId,
        contributions: contributor.contributions,
      })),
    }));

    // Check if there are any mid-cycle contributions
    if (!midCycleContributions.length) {
      return createErrorResponse(res, 404, 'No mid-cycle contributions found for this community.');
    }

    res.status(200).json({ midCycleContributions });
  } catch (err) {
    console.error('Error fetching mid-cycle contributions:', err);
    createErrorResponse(res, 500, 'Server error while fetching mid-cycle contributions.');
  }
};


// Get contributions by mid-cycle
exports.getContributionsByMidCycle = async (req, res) => {
  try {
    const { midCycleId } = req.params;

    if (!midCycleId) {
      return createErrorResponse(res, 400, 'Mid-cycle ID is required.');
    }

    // Fetch contributions associated with the midCycleId
    const contributions = await Contribution.find({ midCycleId });

    if (!contributions || contributions.length === 0) {
      return createErrorResponse(res, 404, 'No contributions found for this mid-cycle.');
    }

    res.status(200).json({ message: 'Contributions fetched successfully.', contributions });
  } catch (err) {
    console.error('Error fetching contributions by mid-cycle:', err);
    createErrorResponse(res, 500, 'Failed to fetch contributions. Please try again.');
  }
};


exports.getPayoutInfo = async (req, res) => {
  try {
    const { communityId } = req.params;
    const community = await Community.findById(communityId);

    if (!community) return res.status(404).json({ message: 'Community not found.' });

    res.status(200).json({
      nextPayout: community.nextPayout,
      payoutDetails: community.payoutDetails,
    });
  } catch (err) {
    console.error('Error fetching payout info:', err);
    res.status(500).json({ message: 'Error fetching payout info.' });
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

exports.searchCommunity = async (req, res) => {
  try {
    const keyword = req.query.keyword;
    const communities = await Community.searchCommunity(keyword);
    res.status(200).json(communities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.filterCommunity = async (req, res) => {
    try {
        const criteria = req.body;
        const query = {};

        if (criteria.backupFund) {
            query.backupFund = { $gte: criteria.backupFund };
        }

        if (criteria.numberOfMembers) {
            query['members.length'] = { $gte: criteria.numberOfMembers };
        }

        if (criteria.nextPayout) {
            query.nextPayout = { $lte: new Date(criteria.nextPayout) };
        }

        if (criteria.contributionFrequency) {
            query['settings.contributionFrequency'] = criteria.contributionFrequency;
        }

        const communities = await Community.find(query);
        res.status(200).json(communities);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
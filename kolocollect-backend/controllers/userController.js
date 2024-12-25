// controller/UserController.js
const { calculateTotalOwed } = require('../utils/contributionUtils');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Community = require('../models/Community');

const createErrorResponse = (res, status, message) => res.status(status).json({ error: { message } });

// Register User
exports.registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return createErrorResponse(res, 400, 'Email is already in use.');

    const newUser = new User({ name, email, password });
    const savedUser = await newUser.save();

    const wallet = new Wallet({
      userId: savedUser._id,
      availableBalance: 0,
      fixedBalance: 0,
      totalBalance: 0,
      transactions: [],
    });
    await wallet.save();

    res.status(201).json({
      message: 'User registered successfully.',
      user: { id: savedUser._id, name: savedUser.name, email: savedUser.email },
      wallet: { id: wallet._id, availableBalance: wallet.availableBalance, totalBalance: wallet.totalBalance },
    });
  } catch (err) {
    console.error('Error during registration:', err);
    createErrorResponse(res, 500, 'Failed to register user. Please try again later.');
  }
};

// Login User
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return createErrorResponse(res, 400, 'Invalid email or password.');

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return createErrorResponse(res, 400, 'Invalid email or password.');

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const wallet = await Wallet.findOne({ userId: user._id });

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
      wallet: { id: wallet._id, availableBalance: wallet.availableBalance, totalBalance: wallet.totalBalance },
    });
  } catch (err) {
    console.error('Error during login:', err);
    createErrorResponse(res, 500, 'Failed to login. Please try again later.');
  }
};

// Fetch User Profile
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate({
        path: 'communities',
        select: 'name description',
      })
      .populate({
        path: 'contributions.communityId',
        select: 'name',
      });

    if (!user) return createErrorResponse(res, 404, 'User not found.');

    const wallet = await Wallet.findOne({ userId: user._id });

    const nextInLineDetails = await user.nextInLineDetails;


    res.json({
      user, 
      wallet: {
        availableBalance: wallet.availableBalance,
        totalBalance: wallet.totalBalance,
      },
    });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    createErrorResponse(res, 500, 'Failed to fetch user profile. Please try again later.');
  }
};

// Update User Contributions
exports.updateUserContributions = async (req, res) => {
  try {
    const { userId, communityId, amount, cycleId, midCycleId, penalty, missed } = req.body;

    const user = await User.findById(userId);
    if (!user) return createErrorResponse(res, 404, 'User not found.');

    await user.addContribution(communityId, amount, cycleId, midCycleId);
    if (missed || penalty) {
      await user.applyPenalty(communityId, penalty || 0, cycleId, midCycleId);
    }

    res.json({ message: 'Contributions updated successfully.', user });
  } catch (err) {
    console.error('Error updating contributions:', err);
    createErrorResponse(res, 500, 'Failed to update contributions. Please try again later.');
  }
};


// Handle Notifications
exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user) return createErrorResponse(res, 404, 'User not found.');

    user.notifications.forEach((notification) => (notification.read = true));
    await user.save();

    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('Error marking notifications as read:', err);
    createErrorResponse(res, 500, 'Failed to mark notifications as read.');
  }
};

// Log User Activity
exports.logUserActivity = async (req, res) => {
  const { action, details } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) return createErrorResponse(res, 404, 'User not found.');

    user.activityLog.push({ action, details });
    await user.save();

    res.json({ message: 'Activity logged successfully.' });
  } catch (err) {
    console.error('Error logging activity:', err);
    createErrorResponse(res, 500, 'Failed to log activity.');
  }
};



exports.getUserCommunity = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find the user and populate their communities
    const user = await User.findById(userId).populate({
      path: 'communities',
      select: 'name description members settings',
    });

    if (!user) {
      return createErrorResponse(res, 404, 'User not found.');
    }

    // Prepare community data
    const communities = user.communities.map((community) => ({
      id: community._id,
      name: community.name,
      description: community.description,
      memberCount: community.members.length,
      settings: community.settings,
    }));

    res.status(200).json(
      communities
    );
  } catch (err) {
    console.error('Error fetching user communities:', err);
    createErrorResponse(res, 500, 'Failed to fetch user communities.');
  }
};


// Update User Profile
exports.updateUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const updatedUser = await User.findByIdAndUpdate(id, updates, { new: true });
    if (!updatedUser) return createErrorResponse(res, 404, 'User not found.');

    res.json(updatedUser);
  } catch (err) {
    console.error('Error updating profile:', err);
    createErrorResponse(res, 500, 'Failed to update user profile.');
  }
};

// Apply Penalty to User
exports.applyPenaltyToUser = async (req, res) => {
  try {
    const { userId, communityId, penaltyAmount, missedCycleId, missedMidCycleId } = req.body;

    if (!userId || !communityId || !penaltyAmount || !missedCycleId || !missedMidCycleId) {
      return createErrorResponse(res, 400, 'All fields are required: userId, communityId, penaltyAmount, missedCycleId, missedMidCycleId.');
    }

    const user = await User.findById(userId);
    if (!user) return createErrorResponse(res, 404, 'User not found.');

    await user.applyPenalty(communityId, penaltyAmount, missedCycleId, missedMidCycleId);

    const updatedContribution = user.contributions.find(
      (c) => c.communityId.toString() === communityId.toString()
    );

    res.json({
      message: `Penalty of ${penaltyAmount} applied to user ${userId}.`,
      updatedContribution,
    });
  } catch (err) {
    console.error('Error applying penalty:', err);
    createErrorResponse(res, 500, 'Failed to apply penalty.');
  }
};


exports.addCommunityToUser = async (req, res) => {
  try {
    const { userId, communityId } = req.body;

    const user = await User.findById(userId);
    if (!user) return createErrorResponse(res, 404, 'User not found.');

    await user.addCommunity(communityId);

    res.json({ message: 'Community added to user successfully.', user });
  } catch (err) {
    console.error('Error adding community to user:', err);
    createErrorResponse(res, 500, 'Failed to add community to user. Please try again later.');
  }
};

exports.removeCommunityFromUser = async (req, res) => {
  try {
    const { userId, communityId } = req.body;

    const user = await User.findById(userId);
    if (!user) return createErrorResponse(res, 404, 'User not found.');

    await user.removeCommunity(communityId);

    res.json({ message: 'Community removed from user successfully.', user });
  } catch (err) {
    console.error('Error removing community from user:', err);
    createErrorResponse(res, 500, 'Failed to remove community from user. Please try again later.');
  }
};
// Add Notification to User
exports.addNotificationToUser = async (req, res) => {
  try {
    const { userId, type, message, communityId } = req.body;

    const user = await User.findById(userId);
    if (!user) return createErrorResponse(res, 404, 'User not found.');

    const notificationResult = await user.addNotification(type, message, communityId);

    res.json(notificationResult);
  } catch (err) {
    console.error('Error adding notification:', err);
    createErrorResponse(res, 500, 'Failed to add notification.');
  }
};

exports.getUserTotalOwed = async (req, res) => {
  try {
    const { communityId, userId } = req.params;
    const totalOwed = await calculateTotalOwed(communityId, userId);

    res.status(200).json({ totalOwed });
  } catch (err) {
    console.error('Error fetching total owed for user:', err);
    createErrorResponse(res, 500, 'Failed to fetch total owed for user.');
  }
};

exports.getUserPayouts = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate('contributions.communityId', 'name');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.status(200).json({
      upcomingPayouts: user.upcomingPayouts,
    });
  } catch (err) {
    console.error('Error fetching user payouts:', err);
    res.status(500).json({ message: 'Error fetching user payouts.' });
  }
};

exports.checkNextInLineStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const nextInLineDetails = await user.nextInLineDetails;

    if (nextInLineDetails) {
      res.status(200).json({
        message: 'User is next in line for a payout.',
        nextInLineDetails,
      });
    } else {
      res.status(200).json({
        message: 'User is not next in line for any payouts.',
      });
    }
  } catch (err) {
    console.error('Error checking next in line status:', err);
    createErrorResponse(res, 500, 'Failed to check next in line status.');
  }
};


// Get Notifications by User
exports.getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find user by ID and fetch notifications
    const user = await User.findById(userId).select('notifications');

    if (!user) {
      return createErrorResponse(res, 404, 'User not found.');
    }

    // Return notifications
    res.status(200).json({
      message: 'User notifications retrieved successfully.',
      notifications: user.notifications,
    });
  } catch (err) {
    console.error('Error fetching notifications for user:', err);
    createErrorResponse(res, 500, 'Failed to fetch notifications for user.');
  }
};



// Get Contributions by User
exports.getContributionsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find user by ID and populate contributions
    const user = await User.findById(userId).populate({
      path: 'contributions.communityId',
      select: 'name description',
    });

    if (!user) {
      return createErrorResponse(res, 404, 'User not found.');
    }

    // Return contributions
    res.status(200).json({
      message: 'User contributions retrieved successfully.',
      contributions: user.contributions,
    });
  } catch (err) {
    console.error('Error fetching contributions by user:', err);
    createErrorResponse(res, 500, 'Failed to fetch contributions for user.');
  }
};




//Reusable Helper for Fetching User with Wallet
const getUserWithWallet = async (userId) => {
  const user = await User.findById(userId).select('-password');
  const wallet = await Wallet.findOne({ userId });

  if (!user || !wallet) {
    throw new Error('User or wallet not found.');
  }

  return { user, wallet };
};



// Delete User
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) return createErrorResponse(res, 404, 'User not found.');

    await Promise.all(
      user.communities.map(async (communityId) => {
        const community = await Community.findById(communityId);
        if (community) {
          community.members = community.members.filter((member) => !member.userId.equals(userId));
          await community.save();
        }
      })
    );

    const wallet = await Wallet.findOneAndDelete({ userId });
    if (wallet && wallet.transactions.length > 0) {
      console.log(`Archived transactions for user ${userId}.`);
    }

    await User.findByIdAndDelete(userId);
    res.status(200).json({ message: 'User and associated data deleted successfully.' });
  } catch (err) {
    console.error('Error deleting user:', err);
    createErrorResponse(res, 500, 'Failed to delete user. Please try again later.');
  }
};

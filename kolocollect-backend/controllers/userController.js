// controller/UserController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');

// Register User
exports.registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already in use' });

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
      message: 'User registered successfully',
      user: { id: savedUser._id, name: savedUser.name, email: savedUser.email },
      wallet: { id: wallet._id, availableBalance: wallet.availableBalance, totalBalance: wallet.totalBalance },
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Login User
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const wallet = await Wallet.findOne({ userId: user._id });

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
      wallet: { id: wallet._id, availableBalance: wallet.availableBalance, totalBalance: wallet.totalBalance },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
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

    if (!user) return res.status(404).json({ message: 'User not found' });

    const wallet = await Wallet.findOne({ userId: user._id });

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        totalCommunities: user.totalCommunities,
        totalPenalties: user.totalPenalties,
        contributions: user.contributions,
        votes: user.votes,
        notifications: user.notifications,
      },
      wallet: {
        availableBalance: wallet.availableBalance,
        totalBalance: wallet.totalBalance,
      },
    });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: err.message });
  }
};

// Update User Contributions
exports.updateUserContributions = async (req, res) => {
  try {
    const { userId, communityId, updateData } = req.body;

    const user = await User.updateUserContributions(userId, communityId, updateData);

    res.json({ message: 'User contributions updated successfully', user });
  } catch (err) {
    console.error('Error updating contributions:', err);
    res.status(500).json({ error: err.message });
  }
};

// Handle Notifications
exports.markNotificationsAsRead = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.notifications.forEach(notification => {
      notification.read = true;
    });

    await user.save();

    res.json({ message: 'Notifications marked as read' });
  } catch (err) {
    console.error('Error marking notifications as read:', err);
    res.status(500).json({ error: err.message });
  }
};

// Log User Activity
exports.logUserActivity = async (req, res) => {
  const { action, details } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.activityLog.push({ action, details });
    await user.save();

    res.json({ message: 'Activity logged successfully' });
  } catch (err) {
    console.error('Error logging activity:', err);
    res.status(500).json({ error: err.message });
  }
};

// Update User Profile
exports.updateUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const updatedUser = await User.findByIdAndUpdate(id, updates, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Apply Penalty to User
exports.applyPenaltyToUser = async (req, res) => {
  try {
    const { userId, communityId, penaltyAmount, missedCycleId, missedMidCycleId } = req.body;

    // Validate inputs
    if (!userId || !communityId || !penaltyAmount || !missedCycleId || !missedMidCycleId) {
      return res.status(400).json({ message: 'All fields are required: userId, communityId, penaltyAmount, missedCycleId, missedMidCycleId' });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Apply penalty using the method in the schema
    await user.applyPenalty(communityId, penaltyAmount, missedCycleId, missedMidCycleId);

    // Fetch updated contributions for the response
    const updatedContribution = user.contributions.find(
      (c) => c.communityId.toString() === communityId.toString()
    );

    res.json({
      message: `Penalty of ${penaltyAmount} applied to user ${userId}`,
      updatedContribution,
    });
  } catch (err) {
    console.error('Error applying penalty:', err);

    if (err.message === 'Contribution data not found for this community') {
      return res.status(404).json({ message: err.message });
    }

    res.status(500).json({ error: err.message });
  }
};


const User = require('../models/User');
const Community = require('../models/Community'); // Make sure to import Community model if needed
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Register a new user
exports.registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Log the plain password
    console.log('Plain password during registration:', password);

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });

    await newUser.save();
    console.log('User saved successfully');

    // Generate JWT token
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({
      token,
      user: { id: newUser._id, name: newUser.name, email: newUser.email },
    });
  } catch (err) {
    console.log('Error during registration:', err);
    res.status(500).json({ error: err.message });
  }
};

// Login User
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  console.log("Login attempt:", email, password); // Log received data

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found"); // Log if user is not found
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Password mismatch"); // Log if password is incorrect
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.log('Error during login:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get User Profile
exports.getUserProfile = async (req, res) => {
  const userId = req.params.id;
  console.log("UserID: ", userId);


  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const user = await User.findById(userId).select('-password').populate('communities');
    console.log("User: ", user);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.log('Error fetching user profile:', err);
    res.status(500).json({ error: err.message });
  }
};

// Update User Profile
exports.updateUserProfile = async (req, res) => {
  const { name, email, password } = req.body;
  const userId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.name = name || user.name;
    user.email = email || user.email;

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.log('Error updating profile:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get Communities Associated with the User
exports.getUserCommunities = async (req, res) => {
  const userId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const user = await User.findById(userId).populate('communities');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user.communities);
  } catch (error) {
    console.error('Error fetching user communities:', error);
    res.status(500).json({ error: 'An error occurred while retrieving communities' });
  }
};

// Join Community
exports.joinCommunity = async (req, res) => {
  const userId = req.params.id;
  const { communityId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(communityId)) {
    return res.status(400).json({ error: 'Invalid user or community ID' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.communities.includes(communityId)) {
      user.communities.push(communityId);
      await user.save();

      const community = await Community.findById(communityId);
      if (!community) {
        return res.status(404).json({ message: 'Community not found' });
      }

      community.members.push(user._id);
      await community.save();

      res.status(200).json({ message: 'Joined community successfully', user, community });
    } else {
      res.status(400).json({ message: 'User is already part of this community' });
    }
  } catch (err) {
    console.error('Error joining community:', err);
    res.status(500).json({ error: err.message });
  }
};

// Leave Community
exports.leaveCommunity = async (req, res) => {
  const userId = req.params.id;
  const { communityId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(communityId)) {
    return res.status(400).json({ error: 'Invalid user or community ID' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.communities = user.communities.filter(id => id.toString() !== communityId);
    await user.save();

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }

    community.members = community.members.filter(member => member.toString() !== user._id.toString());
    await community.save();

    res.status(200).json({ message: 'Left community successfully', user, community });
  } catch (err) {
    console.error('Error leaving community:', err);
    res.status(500).json({ error: err.message });
  }
};

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');

// Register User
exports.registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already in use' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
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

    const isMatch = await bcrypt.compare(password, user.password);
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
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const wallet = await Wallet.findOne({ userId: user._id });

    res.json({
      user: { id: user._id, name: user.name, email: user.email },
      wallet: { id: wallet._id, availableBalance: wallet.availableBalance, totalBalance: wallet.totalBalance },
    });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: err.message });
  }
};

// Update Wallet Balance (Example Function)
exports.updateWalletBalance = async (req, res) => {
  const { amount } = req.body;

  try {
    const wallet = await Wallet.findOne({ userId: req.user.id });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    wallet.balance += amount;
    await wallet.save();

    res.json({
      message: 'Wallet balance updated',
      wallet: {
        id: wallet._id,
        balance: wallet.balance,
      },
    });
  } catch (err) {
    console.error("Error updating wallet balance:", err);
    res.status(500).json({ error: err.message });
  }
};

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


// Get User Communities
exports.getUserCommunities = async (req, res) => {
  const { userId } = req.params;

  try {
    // Find the user by ID and populate the communities
    const user = await User.findById(userId).populate('communities');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User communities fetched successfully',
      communities: user.communities,
    });
  } catch (err) {
    console.error('Error fetching user communities:', err);
    res.status(500).json({ error: 'Server error while fetching user communities' });
  }
};


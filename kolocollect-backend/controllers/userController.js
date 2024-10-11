
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register a new user
exports.registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    // Log the plain password
    console.log('Plain password during registration:', password);

    const newUser = new User({ name, email, password });

    // Check the user object right before saving
    console.log('New user object right before save:', newUser);

    await newUser.save();
    console.log('User saved successfully');

    // Generate JWT token
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({ token, user: { id: newUser._id, name: newUser.name, email: newUser.email } });
  } catch (err) {
    console.log('Error during registration:', err);
    res.status(500).json({ error: err.message });
  }
};

// login User
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log('Login attempt failed: email not found');
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Log the hashed password stored in DB
    console.log('Stored hashed password during login:', user.password);

    // Compare the provided password with the stored hashed password using async/await
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      console.log('Login attempt failed: password mismatch');
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Log success message if password matches
    console.log('Login successful for user:', email);

    // If password matches, proceed to generate JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.log('Error during login:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (err) {
    console.log('Error fetching user profile:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateUserProfile = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.name = name || user.name;
    user.email = email || user.email;

    if (password) {
      console.log('Updating password for user:', email);
      user.password = await bcrypt.hash(password, 10);
      console.log('New hashed password:', user.password);
    }

    await user.save();

    res.json({ message: 'Profile updated successfully', user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.log('Error updating profile:', err);
    res.status(500).json({ error: err.message });
  }
};

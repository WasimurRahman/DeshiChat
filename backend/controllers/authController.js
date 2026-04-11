const User = require('../models/User');
const jwt = require('jsonwebtoken');
const validator = require('validator');

// Generate JWT Token
const generateToken = (userId, rememberMe = false) => {
  const expiresIn = rememberMe ? '24h' : '7d';
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
};

// Check Username Availability
exports.checkEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) return res.json({ available: false, message: 'Email is already taken' });

    res.json({ available: true, message: 'Email is available' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during email check' });
  }
};

// Check Username Availability
exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ message: 'Username is required' });
    const normalizedUsername = username.trim();
    const existingUser = await User.findOne({ username: normalizedUsername });

    if (existingUser) return res.json({ available: false, message: 'Username is already taken' });

    res.json({ available: true, message: 'Username is available' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during username check' });
  }
};

// Sign Up
exports.signup = async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;
    if (!username || !email || !password || !confirmPassword) return res.status(400).json({ message: 'All fields are required' });
    if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match' });
    if (!validator.isEmail(email)) return res.status(400).json({ message: 'Invalid email address' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.trim();

    const [emailUser, usernameUser] = await Promise.all([
      User.findOne({ email: normalizedEmail }),
      User.findOne({ username: normalizedUsername })
    ]);

    if (emailUser && emailUser.isVerified) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    if (usernameUser && usernameUser.isVerified) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    if (emailUser && usernameUser && !emailUser._id.equals(usernameUser._id)) {
      return res.status(409).json({
        message: 'This email/username combination conflicts with existing accounts. Please use different credentials.'
      });
    }

    let user = emailUser || usernameUser || null;

    if (user) {
      user.username = normalizedUsername;
      user.email = normalizedEmail;
      user.password = password;
      user.isVerified = true;
      user.status = 'online';
      await user.save();
    } else {
      user = new User({ username: normalizedUsername, email: normalizedEmail, password, isVerified: true, status: 'online' });
      await user.save();
    }

    const token = generateToken(user._id);
    res.status(201).json({ message: 'Registration successful', token, user: user.toJSON() });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error during signup' });
  }
};

// Sign In
exports.signin = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id, rememberMe || false);
    user.status = 'online';
    await user.save();

    res.json({ message: 'User logged in successfully', token, user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ message: 'Server error during signin' });
  }
};


// Logout
exports.logout = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user) {
      user.status = 'offline';
      await user.save();
    }
    res.json({ message: 'User logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during logout' });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.toJSON());
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};


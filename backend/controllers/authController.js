const User = require('../models/User');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const sendEmail = require('../utils/email');

// Generate JWT Token
const generateToken = (userId, rememberMe = false) => {
  const expiresIn = rememberMe ? '24h' : '7d';
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn });
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Check Username Availability
exports.checkEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser && existingUser.isVerified) {
      return res.json({ available: false, message: 'Email is already taken' });
    }

    // Unverified users can resume signup with the same email.
    if (existingUser && !existingUser.isVerified) {
      return res.json({ available: true, message: 'Email has a pending signup. Continue to receive a new OTP.' });
    }

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

    if (existingUser && existingUser.isVerified) {
      return res.json({ available: false, message: 'Username is already taken' });
    }

    // Unverified users can resume signup with the same username.
    if (existingUser && !existingUser.isVerified) {
      return res.json({ available: true, message: 'Username has a pending signup. Continue to receive a new OTP.' });
    }

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
        message: 'This email/username combination conflicts with pending accounts. Try different credentials or use signin/resend OTP.'
      });
    }

    const existingUnverifiedUser = emailUser || usernameUser || null;
    const isExistingUnverified = !!existingUnverifiedUser;

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    let user = existingUnverifiedUser;

    if (user) {
      user.username = normalizedUsername;
      user.email = normalizedEmail;
      user.password = password;
      user.isVerified = false;
      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();
    } else {
      user = new User({ username: normalizedUsername, email: normalizedEmail, password, isVerified: false, otp, otpExpires });
      await user.save();
    }

    try {
      await sendEmail({
        to: normalizedEmail,
        subject: 'Verify your DeshiChat Account',
        text: `Welcome to DeshiChat! Your verification code is: ${otp}. It expires in 10 minutes.`
      });
    } catch (mailError) {
      // Roll back only newly created users to avoid dead one-off accounts.
      if (!isExistingUnverified) {
        await User.findByIdAndDelete(user._id);
      }
      console.error('Signup email error:', mailError);
      return res.status(503).json({ message: 'Unable to send OTP email right now. Please try again shortly.' });
    }

    res.status(201).json({ message: 'Registration successful. Please verify your email.', requiresVerification: true, email: normalizedEmail });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error during signup' });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.isVerified) return res.status(400).json({ message: 'User is already verified' });
    if (user.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
    if (user.otpExpires < new Date()) return res.status(400).json({ message: 'OTP has expired' });

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    user.status = 'online';
    await user.save();

    const token = generateToken(user._id);
    res.json({ message: 'Email verified successfully', token, user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ message: 'Server error during verification' });
  }
};

// Resend OTP
exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.isVerified) return res.status(400).json({ message: 'User is already verified' });

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendEmail({
      to: normalizedEmail,
      subject: 'Your new Verification Code',
      text: `Your new verification code is: ${otp}. It expires in 10 minutes.`
    });

    res.json({ message: 'OTP resent successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during OTP resend' });
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

    if (!user.isVerified) {
      const otp = generateOTP();
      user.otp = otp;
      user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();
      await sendEmail({
        to: normalizedEmail,
        subject: 'Verify your DeshiChat Account',
        text: `Your verification code is: ${otp}. It expires in 10 minutes.`
      });
      return res.status(403).json({ message: 'Email not verified. A new OTP has been sent.', requiresVerification: true, email: normalizedEmail });
    }

    const token = generateToken(user._id, rememberMe || false);
    user.status = 'online';
    await user.save();

    res.json({ message: 'User logged in successfully', token, user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ message: 'Server error during signin' });
  }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendEmail({
      to: normalizedEmail,
      subject: 'Password Reset Code',
      text: `Your password reset code is: ${otp}. It expires in 10 minutes.`
    });

    res.json({ message: 'Password reset OTP sent to email' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ message: 'Email, OTP, and new password are required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
    if (user.otpExpires < new Date()) return res.status(400).json({ message: 'OTP has expired' });

    user.password = newPassword;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
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

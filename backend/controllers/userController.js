const User = require('../models/User');

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const { search } = req.query;
    const currentUserId = req.userId;

    let query = { _id: { $ne: currentUserId } };

    if (search) {
      query = {
        ...query,
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const users = await User.find(query).select('-password').limit(50);

    res.json({
      data: users
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      data: user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const { avatar, fullName, bio } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (avatar !== undefined) {
      user.avatar = avatar;
    }
    if (fullName !== undefined) {
      user.fullName = fullName;
    }
    if (bio !== undefined) {
      user.bio = bio;
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      data: user.toJSON()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

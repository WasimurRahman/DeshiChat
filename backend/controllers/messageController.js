const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');

// Send a message
exports.sendMessage = async (req, res) => {
  try {
    const { recipientId, content } = req.body;
    const senderId = req.userId;

    if (!recipientId || !content) {
      return res.status(400).json({ message: 'Recipient and message content are required' });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    // Create message
    const message = new Message({
      sender: senderId,
      recipient: recipientId,
      content
    });

    await message.save();
    await message.populate('sender recipient', '-password');

    res.status(201).json({
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get conversation between two users
exports.getConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: userId },
        { sender: userId, recipient: currentUserId }
      ]
    })
      .populate('sender recipient', '-password')
      .populate('reactions.user', 'username avatar')
      .sort({ createdAt: 1 });

    res.json({
      data: messages
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all conversations (users the current user has messages with)
exports.getAllConversations = async (req, res) => {
  try {
    const currentUserId = req.userId;
    const currentObjectId = new mongoose.Types.ObjectId(currentUserId);

    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: currentObjectId },
            { recipient: currentObjectId }
          ]
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', currentObjectId] },
              '$recipient',
              '$sender'
            ]
          },
          lastMessage: { $first: '$content' },
          lastMessageTime: { $first: '$createdAt' }
        }
      },
      { $sort: { lastMessageTime: -1 } }
    ]);

    const unreadMessages = await Message.aggregate([
      {
        $match: {
          recipient: currentObjectId,
          isread: false
        }
      },
      {
        $group: {
          _id: '$sender',
          unreadCount: { $sum: 1 }
        }
      }
    ]);

    const unreadMap = new Map(
      unreadMessages.map((entry) => [String(entry._id), entry.unreadCount])
    );

    // Populate user details efficiently in one query
    const userIds = conversations.map(c => c._id);
    const users = await User.find({ _id: { $in: userIds } }).select('-password').lean();
    const userMap = new Map(users.map(u => [String(u._id), u]));

    const populatedConversations = conversations.map((conv) => ({
      user: userMap.get(String(conv._id)) || null,
      lastMessage: conv.lastMessage,
      lastMessageTime: conv.lastMessageTime,
      unreadCount: unreadMap.get(String(conv._id)) || 0
    })).filter(c => c.user !== null); // Filter out orphans

    res.json({
      data: populatedConversations
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Mark messages as read
exports.markAsRead = async (req, res) => {
  try {
    const { senderId } = req.body;
    const userId = req.userId;

    const result = await Message.updateMany(
      { sender: senderId, recipient: userId, isread: false },
      { isread: true }
    );

    if (result && result.modifiedCount > 0) {
      const io = req.app.get('io');
      if (io) {
        io.emit('messages:read', { senderId, readerId: userId });
      }
    }

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get unread message count
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.userId;

    const unreadCount = await Message.countDocuments({
      recipient: userId,
      isread: false
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Star a message
exports.starMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user already starred it
    if (message.starredBy.includes(userId)) {
      return res.status(400).json({ message: 'Message already starred' });
    }

    // Add user to starredBy array
    message.starredBy.push(userId);
    
    // If first star, update isStarred and starredAt
    if (message.starredBy.length === 1) {
      message.isStarred = true;
      message.starredAt = new Date();
    }

    await message.save();
    await message.populate('sender recipient', '-password');

    res.json({
      message: 'Message starred successfully',
      data: message
    });
  } catch (error) {
    console.error('Star message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Unstar a message
exports.unstarMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Remove user from starredBy array
    message.starredBy = message.starredBy.filter(
      (id) => id.toString() !== userId.toString()
    );

    // Always update isStarred based on current starredBy array
    message.isStarred = message.starredBy.length > 0;
    
    // Update starredAt only if there are no more stars
    if (!message.isStarred) {
      message.starredAt = null;
    }

    await message.save();
    await message.populate('sender recipient', '-password');

    res.json({
      message: 'Message unstarred successfully',
      data: message
    });
  } catch (error) {
    console.error('Unstar message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all starred messages for current user
exports.getStarredMessages = async (req, res) => {
  try {
    const userId = req.userId;

    const starredMessages = await Message.find({
      starredBy: userId
    })
      .populate('sender recipient', '-password')
      .sort({ starredAt: -1 });

    res.json({
      data: starredMessages
    });
  } catch (error) {
    console.error('Get starred messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Edit a message
exports.editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.userId;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message content cannot be empty' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is the sender
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'You can only edit your own messages' });
    }

    // Update message
    message.content = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();

    await message.save();
    await message.populate('sender recipient', '-password');

    res.json({
      message: 'Message edited successfully',
      data: message
    });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a message
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is the sender
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }

    // Delete the message
    await Message.findByIdAndDelete(messageId);

    res.json({
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


exports.reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const existingReactionIndex = message.reactions.findIndex(r => r.user.toString() === userId.toString());

    if (existingReactionIndex > -1) {
      if (message.reactions[existingReactionIndex].emoji === emoji) {
        // Toggle off
        message.reactions.splice(existingReactionIndex, 1);
      } else {
        // Change
        message.reactions[existingReactionIndex].emoji = emoji;
      }
    } else {
      // Add
      message.reactions.push({ user: userId, emoji });
    }

    await message.save();

    // Populate reactions user info for response if needed
    // Usually no need to populate user in reaction array except ID, but maybe username and avatar
    const populatedMessage = await Message.findById(messageId).populate('reactions.user', 'username avatar');

    // Emit via socket
    const io = req.app.get('io');
      const userSockets = req.app.get('userSockets') || new Map();
      
      if (io) {
        const recipientSockets = userSockets.get(message.recipient.toString());
        const senderSockets = userSockets.get(message.sender.toString());

        if (recipientSockets && recipientSockets.size > 0) {
          for (const sId of recipientSockets) {
            io.to(sId).emit('message_reaction', { messageId, reactions: populatedMessage.reactions, message });
          }
        }
        if (senderSockets && senderSockets.size > 0) {
          for (const sId of senderSockets) {
            io.to(sId).emit('message_reaction', { messageId, reactions: populatedMessage.reactions, message });
          }
        }
      }

    res.json(populatedMessage.reactions);
  } catch (error) {
    console.error('React to message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

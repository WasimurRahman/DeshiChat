const mongoose = require('mongoose');

const groupMessageSchema = new mongoose.Schema({
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  isSystemMessage: {
    type: Boolean,
    default: false
  },
  readBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ],
  isStarred: {
    type: Boolean,
    default: false
  },
  starredBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ],
  starredAt: {
    type: Date,
    default: null
  },

  reactions: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      emoji: {
        type: String,
        enum: ['👍', '👎', '❤️', '😂', '😢', '😮', '😡'],
        required: true
      }
    }
  ],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
groupMessageSchema.index({ group: 1, createdAt: -1 });
groupMessageSchema.index({ 'starredBy': 1, starredAt: 1 });

// TTL Indexes for automatic deletion
// Delete unstarred messages after 3 days
groupMessageSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 259200, // 3 days in seconds
    partialFilterExpression: { isStarred: false }
  }
);

// Delete starred messages after 30 days
groupMessageSchema.index(
  { starredAt: 1 },
  {
    expireAfterSeconds: 2592000, // 30 days in seconds
    partialFilterExpression: { isStarred: true }
  }
);

module.exports = mongoose.model('GroupMessage', groupMessageSchema);

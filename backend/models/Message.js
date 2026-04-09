const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  isread: {
    type: Boolean,
    default: false
  },
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

// Index for faster queries and avoiding collection scans on $or aggregation
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, createdAt: -1 });
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, isread: 1 });
messageSchema.index({ 'starredBy': 1, starredAt: 1 });

// TTL Indexes for automatic deletion
// Delete unstarred messages after 3 days
messageSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 259200, // 3 days in seconds
    partialFilterExpression: { isStarred: false }
  }
);

// Delete starred messages after 30 days
messageSchema.index(
  { starredAt: 1 },
  {
    expireAfterSeconds: 2592000, // 30 days in seconds
    partialFilterExpression: { isStarred: true }
  }
);

module.exports = mongoose.model('Message', messageSchema);

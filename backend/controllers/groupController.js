const Group = require('../models/Group');
const GroupMessage = require('../models/GroupMessage');
const User = require('../models/User');
const mongoose = require('mongoose');

// Create a group
exports.createGroup = async (req, res) => {
  try {
    const { name, description, memberIds } = req.body;
    const adminId = req.userId;

    if (!name) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    // Add admin to members if not already included
    const allMembers = [adminId, ...memberIds].filter(
      (id, index, array) => array.indexOf(id) === index
    );

    // Validate all members exist
    const members = await User.find({ _id: { $in: allMembers } });
    if (members.length !== allMembers.length) {
      return res.status(400).json({ message: 'Some members not found' });
    }

    const memberJoinDates = {};
    const now = new Date();
    allMembers.forEach(id => {
      memberJoinDates[id.toString()] = now;
    });

    // Create group
    const group = new Group({
      name,
      description,
      admin: adminId,
      admins: [adminId],
      members: allMembers,
      memberJoinDates
    });

    await group.save();
    await group.populate('admin admins members', '-password');

    res.status(201).json({
      message: 'Group created successfully',
      data: group
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all groups for current user
exports.getUserGroups = async (req, res) => {
  try {
    const userId = req.userId;
    const currentObjectId = new mongoose.Types.ObjectId(userId);

    const groups = await Group.find({
      members: userId
    })
      .populate('admin admins members', '-password')
      .sort({ updatedAt: -1 });

    const groupsWithActivity = await Promise.all(
      groups.map(async (group) => {
        let memberJoinDate = group.memberJoinDates ? group.memberJoinDates.get(userId.toString()) : null;

        const query = { group: group._id };
        if (memberJoinDate) {
          query.createdAt = { $gte: memberJoinDate };
        }

        const lastGroupMessage = await GroupMessage.findOne(query)
          .populate('sender', '-password')
          .sort({ createdAt: -1 });

        const unreadCount = await GroupMessage.countDocuments({
          ...query,
          readBy: { $ne: currentObjectId }
        });

        const groupObject = group.toObject();
        return {
          ...groupObject,
          lastMessage: lastGroupMessage ? lastGroupMessage.content : '',
          lastMessageTime: lastGroupMessage
            ? lastGroupMessage.createdAt
            : groupObject.updatedAt || groupObject.createdAt,
          unreadCount: unreadCount
        };
      })
    );

    groupsWithActivity.sort(
      (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
    );

    res.json({
      data: groupsWithActivity
    });
  } catch (error) {
    console.error('Get user groups error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get group details
exports.getGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.userId;

    const group = await Group.findById(groupId).populate('admin admins members', '-password');

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is member
    if (!group.members.some(member => member._id.equals(userId))) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    res.json({
      data: group
    });
  } catch (error) {
    console.error('Get group details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add member to group
exports.addMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId: newMemberId } = req.body;
    const adminId = req.userId;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is admin
    const isUserAdmin = group.admins && group.admins.some(admin => admin.equals(adminId)) || group.admin.equals(adminId);
    if (!isUserAdmin) {
      return res.status(403).json({ message: 'Only admins can add members' });
    }

    // Check if user already exists in group
    if (group.members.some(member => member.equals(newMemberId))) {
      return res.status(400).json({ message: 'User already in group' });
    }

    // Check if user exists
    const user = await User.findById(newMemberId);
    const adminUser = await User.findById(adminId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const joinTime = new Date();
    group.members.push(newMemberId);
    group.memberJoinDates.set(newMemberId.toString(), joinTime);
    await group.save();
    
    // Create system message
    const systemMessage = new GroupMessage({
      group: groupId,
      sender: adminId, // System messages can be tied to the admin who invited them
      content: `${adminUser.username} added ${user.username} to the group.`,
      isSystemMessage: true,
      createdAt: joinTime,
      readBy: [adminId] // Admin already read it implicitly
    });
    await systemMessage.save();
    
    await group.populate('admin admins members', '-password');

    res.json({
      message: 'Member added successfully',
      data: group,
      systemMessage: systemMessage
    });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Remove member from group
exports.removeMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId: memberToRemove } = req.body;
    const adminId = req.userId;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is admin
    const isUserAdmin = group.admins && group.admins.some(admin => admin.equals(adminId)) || group.admin.equals(adminId);
    if (!isUserAdmin) {
      return res.status(403).json({ message: 'Only admins can remove members' });
    }

    if (group.admin.equals(memberToRemove)) {
      return res.status(400).json({ message: 'Group creator cannot be removed from the group' });
    }

    const removedUser = await User.findById(memberToRemove);
    const actionAdmin = await User.findById(adminId);

    // Remove member and clean up references
    group.members = group.members.filter(member => !member.equals(memberToRemove));
    if (group.admins) {
      group.admins = group.admins.filter(a => !a.equals(memberToRemove));
    }
    if (group.memberJoinDates && group.memberJoinDates.has(memberToRemove.toString())) {
      group.memberJoinDates.delete(memberToRemove.toString());
    }
    await group.save();

    // Remove starred messages for this user in this group
    await GroupMessage.updateMany(
      { group: groupId, starredBy: memberToRemove },
      { $pull: { starredBy: memberToRemove } }
    );
    
    // Fix any messages that are now empty of stars
    await GroupMessage.updateMany(
      { group: groupId, isStarred: true, starredBy: { $size: 0 } },
      { $set: { isStarred: false, starredAt: null } }
    );
    
    let systemMessage = null;
    if (removedUser && actionAdmin) {
      systemMessage = new GroupMessage({
        group: groupId,
        sender: adminId,
        content: `${actionAdmin.username} removed ${removedUser.username} from the group.`,
        isSystemMessage: true,
        createdAt: new Date(),
        readBy: [adminId]
      });
      await systemMessage.save();
    }

    await group.populate('admin admins members', '-password');

    res.json({
      message: 'Member removed successfully',
      data: group,
      systemMessage: systemMessage
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Send group message
exports.sendGroupMessage = async (req, res) => {
  try {
    const groupId = req.params.groupId || req.body.groupId;
    const { content } = req.body;
    const senderId = req.userId;

    if (!content) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is member
    if (!group.members.some(member => member.equals(senderId))) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    const message = new GroupMessage({
      group: groupId,
      sender: senderId,
      content,
      readBy: [senderId] // Sender automatically reads their own message
    });

    await message.save();
    await message.populate('sender', '-password');

    group.updatedAt = new Date();
    await group.save();

    res.status(201).json({
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Send group message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get group messages
exports.getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.userId;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is member
    if (!group.members.some(member => member.equals(userId))) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    const memberJoinDate = group.memberJoinDates ? group.memberJoinDates.get(userId.toString()) : null;

    const query = { group: groupId };
    if (memberJoinDate) {
      query.createdAt = { $gte: memberJoinDate };
    }

    const messages = await GroupMessage.find(query)
      .populate('sender', '-password')
      .populate('reactions.user', 'username avatar')
      .sort({ createdAt: 1 });

    // Mark all messages as read by this user
    await GroupMessage.updateMany(
      { group: groupId, sender: { $ne: userId }, readBy: { $ne: userId } },
      { $push: { readBy: userId } }
    );

    res.json({
      data: messages
    });
  } catch (error) {
    console.error('Get group messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Mark all group messages as read for current user
exports.markGroupAsRead = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.userId;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is member
    if (!group.members.some(member => member.equals(userId))) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    // Mark all messages as read by this user
    const result = await GroupMessage.updateMany(
      { group: groupId, sender: { $ne: userId }, readBy: { $ne: userId } },
      { $push: { readBy: userId } }
    );

    if (result && result.modifiedCount > 0) {
      const io = req.app.get('io');
      if (io) {
        io.emit('group:messages:read', { groupId, readerId: userId });
      }
    }

    res.json({
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Mark group as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update group
exports.updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description } = req.body;
    const userId = req.userId;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is admin
    if (!group.admin.equals(userId)) {
      return res.status(403).json({ message: 'Only admin can update group' });
    }

    if (name) group.name = name;
    if (description) group.description = description;
    group.updatedAt = Date.now();

    await group.save();
    await group.populate('admin admins members', '-password');

    res.json({
      message: 'Group updated successfully',
      data: group
    });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete group
exports.deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.userId;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is admin
    if (!group.admin.equals(userId)) {
      return res.status(403).json({ message: 'Only admin can delete group' });
    }

    // Delete all messages in group
    await GroupMessage.deleteMany({ group: groupId });

    // Delete group
    await Group.findByIdAndDelete(groupId);

    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Star a group message
exports.starGroupMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    const message = await GroupMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is member of the group
    const group = await Group.findById(message.group);
    if (!group.members.some(member => member.equals(userId))) {
      return res.status(403).json({ message: 'Not a member of this group' });
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
    await message.populate('sender', '-password');

    res.json({
      message: 'Message starred successfully',
      data: message
    });
  } catch (error) {
    console.error('Star group message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Unstar a group message
exports.unstarGroupMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    const message = await GroupMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is member of the group
    const group = await Group.findById(message.group);
    if (!group.members.some(member => member.equals(userId))) {
      return res.status(403).json({ message: 'Not a member of this group' });
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
    await message.populate('sender', '-password');

    res.json({
      message: 'Message unstarred successfully',
      data: message
    });
  } catch (error) {
    console.error('Unstar group message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get starred group messages for current user
exports.getStarredGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.userId;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is member
    if (!group.members.some(member => member.equals(userId))) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    const starredMessages = await GroupMessage.find({
      group: groupId,
      starredBy: userId
    })
      .populate('sender', '-password')
      .populate('group', 'name')
      .sort({ starredAt: -1 });

    res.json({
      data: starredMessages
    });
  } catch (error) {
    console.error('Get starred group messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Edit a group message
exports.editGroupMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.userId;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message content cannot be empty' });
    }

    const message = await GroupMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const group = await Group.findById(message.group);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.some(member => member.equals(userId))) {
      return res.status(403).json({ message: 'Not a member of this group' });
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
    await message.populate('sender', '-password');

    res.json({
      message: 'Message edited successfully',
      data: message
    });
  } catch (error) {
    console.error('Edit group message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a group message
exports.deleteGroupMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    const message = await GroupMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const group = await Group.findById(message.group);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.some(member => member.equals(userId))) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    // Check if user is the sender
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }

    // Delete the message
    await GroupMessage.findByIdAndDelete(messageId);

    res.json({
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete group message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add admin role
exports.addAdmin = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId: adminToAdd } = req.body;
    const currentAdminId = req.userId;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isCurrentAdmin = group.admins && group.admins.some(admin => admin.equals(currentAdminId)) || group.admin.equals(currentAdminId);
    if (!isCurrentAdmin) {
      return res.status(403).json({ message: 'Only admins can add other admins' });
    }

    if (!group.members.some(m => m.equals(adminToAdd))) {
      return res.status(400).json({ message: 'User must be a member first' });
    }

    if (!group.admins.some(admin => admin.equals(adminToAdd))) {
      group.admins.push(adminToAdd);
      await group.save();
    }
    
    const targetUser = await User.findById(adminToAdd);
    const actionAdmin = await User.findById(currentAdminId);

    let systemMessage = null;
    if (targetUser && actionAdmin) {
      systemMessage = new GroupMessage({
        group: groupId,
        sender: currentAdminId,
        content: `${actionAdmin.username} made ${targetUser.username} an admin.`,
        isSystemMessage: true,
        createdAt: new Date(),
        readBy: [currentAdminId]
      });
      await systemMessage.save();
    }
    
    await group.populate('admin admins members', '-password');

    res.json({ message: 'Admin added successfully', data: group, systemMessage: systemMessage });
  } catch (error) {
    console.error('Add admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Remove admin role
exports.removeAdmin = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId: adminToRemove } = req.body;
    const currentAdminId = req.userId;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isCurrentAdmin = group.admins && group.admins.some(admin => admin.equals(currentAdminId)) || group.admin.equals(currentAdminId);
    if (!isCurrentAdmin) {
      return res.status(403).json({ message: 'Only admins can remove other admins' });
    }

    if (group.admin.equals(adminToRemove)) {
      return res.status(400).json({ message: 'Group creator cannot be removed from admin role' });
    }

    group.admins = group.admins.filter(a => !a.equals(adminToRemove));
    await group.save();
    
    const targetUser = await User.findById(adminToRemove);
    const actionAdmin = await User.findById(currentAdminId);

    let systemMessage = null;
    if (targetUser && actionAdmin) {
      systemMessage = new GroupMessage({
        group: groupId,
        sender: currentAdminId,
        content: `${actionAdmin.username} removed ${targetUser.username} as an admin.`,
        isSystemMessage: true,
        createdAt: new Date(),
        readBy: [currentAdminId]
      });
      await systemMessage.save();
    }
    
    await group.populate('admin admins members', '-password');

    res.json({ message: 'Admin removed successfully', data: group, systemMessage: systemMessage });
  } catch (error) {
    console.error('Remove admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


exports.reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.userId;

    const message = await GroupMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const existingReactionIndex = message.reactions.findIndex(r => r.user.toString() === userId.toString());

    if (existingReactionIndex > -1) {
      if (message.reactions[existingReactionIndex].emoji === emoji) {
        message.reactions.splice(existingReactionIndex, 1);
      } else {
        message.reactions[existingReactionIndex].emoji = emoji;
      }
    } else {
      message.reactions.push({ user: userId, emoji });
    }

    await message.save();

    const populatedMessage = await GroupMessage.findById(messageId).populate('reactions.user', 'username avatar');

    const io = req.app.get('io');
    if (io) io.emit('group_message_reaction', {
      messageId,
      groupId: message.group,
      reactions: populatedMessage.reactions,
      message: populatedMessage
    });

    res.json(populatedMessage.reactions);
  } catch (error) {
    console.error('Group react to message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

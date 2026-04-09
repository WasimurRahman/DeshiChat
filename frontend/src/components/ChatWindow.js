import React, { useState, useEffect, useRef } from 'react';
import { messageAPI, groupAPI, userAPI, reactToMessage, reactToGroupMessage } from '../api/api';
import { getSocket } from '../services/socket';
import { sanitizeMessage, validateMessage, unescapeMessage } from '../utils/sanitizer';
import './ChatWindow.css';
import ProfileModal from './ProfileModal';


const MessageInputForm = ({ onSendMessage, onTyping }) => {
  const [messageInput, setMessageInput] = React.useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    onSendMessage(messageInput);
    setMessageInput('');
  };

  return (
    <form onSubmit={handleSubmit} className="message-input-form">
      <input
        type="text"
        value={messageInput}
        onChange={(e) => {
          setMessageInput(e.target.value);
          onTyping();
        }}
        placeholder="Type a message..."
        className="message-input"
      />
      <button type="submit" className="send-btn">Send</button>
    </form>
  );
};

const ChatWindow = ({ selectedChat, chatType, user, onlineUsers, onConversationChanged, onChatUpdated, focusMessageId, onFocusHandled, onProfileUpdate, onSelectChat }) => {
  const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [viewProfileId, setViewProfileId] = useState(null);
    const [activeReactMessageId, setActiveReactMessageId] = useState(null);
    const [showReactionUsersMessage, setShowReactionUsersMessage] = useState(null);
    const REACTION_EMOJIS = ['👍', '👎', '❤️', '😂', '😢', '😮', '😡'];

    const handleReactionClick = async (messageId, emoji) => {
      try {
        let newReactions = [];
        if (chatType === 'direct') {
          newReactions = await reactToMessage(messageId, emoji);
        } else {
          newReactions = await reactToGroupMessage(messageId, emoji);
        }
        setMessages(prev => prev.map(msg => msg._id === messageId ? { ...msg, reactions: newReactions } : msg));
        setActiveReactMessageId(null);
      } catch(e) {
        console.error('Failed to react', e);
      }
    };

  
  // Add Member states
  const [showAddMember, setShowAddMember] = useState(false);
  const [showManageMembers, setShowManageMembers] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupCurrentPage, setGroupCurrentPage] = useState(1);
  const [groupPageInput, setGroupPageInput] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);

  const messagesEndRef = useRef(null);
  const prevMessageCountRef = useRef(0);
  const messageRefs = useRef({});
  const socket = getSocket();
  const typingTimeoutRef = useRef(null);

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setLoading(true);
        setMessages([]);
        setIsTyping(false);

        if (chatType === 'direct') {
          const response = await messageAPI.getConversation(selectedChat._id);
          setMessages(response.data.data);
          messageAPI.markAsRead(selectedChat._id).catch((error) => {
            console.error('Failed to mark messages as read:', error);
          });
          onConversationChanged?.();
        } else if (chatType === 'group') {
          const response = await groupAPI.getGroupMessages(selectedChat._id);
          setMessages(response.data.data);
          onConversationChanged?.();
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat, chatType]);

  // Auto-scroll to bottom only if a new message was added, not on reactions or edits
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && !focusMessageId) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, focusMessageId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      setActiveReactMessageId(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!focusMessageId || messages.length === 0) return;

    const targetElement = messageRefs.current[focusMessageId];
    if (!targetElement) return;

    // Apply highlight state immediately for instant feedback
    setHighlightedMessageId(focusMessageId);
    
    // Microtask delay for the scroll to ensure browser layouts are completely up to date
    setTimeout(() => {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    
    // Let the CSS animation finish before un-highlighting
    setTimeout(() => {
      setHighlightedMessageId((current) => current === focusMessageId ? null : current);
    }, 2000);
    
    // Notify parent immediately
    onFocusHandled?.();

  }, [focusMessageId, messages, onFocusHandled]); // No cleanup return to prevent parent state clear from aborting the timeouts

  // Socket listeners for messages
  useEffect(() => {
    if (!socket) return;
    
    // Explicit Handlers to prevent removing sidebar events
    const handleMessageReceive = (data) => {
      if (data.senderId === selectedChat._id) {
        setMessages(prev => [...prev, {
          sender: { _id: data.senderId },
          content: data.content,
          createdAt: data.timestamp,
          _id: data._id
        }]);
        
        // Mark messages as read immediately and refresh sidebar
        messageAPI.markAsRead(selectedChat._id).catch((error) => {
          console.error('Failed to mark direct messages as read:', error);
        });
        onConversationChanged?.();
      }
    };
    const handleMessageEdited = (data) => {
      if (data.senderId === selectedChat._id) {
        setMessages(prev => prev.map(msg =>
          msg._id === data.messageId
            ? { 
                ...msg, 
                content: data.content, 
                isEdited: true, 
                editedAt: data.editedAt,
                // Preserve starred data
                starredBy: msg.starredBy || [],
                isStarred: msg.isStarred || false,
                starredAt: msg.starredAt || null
              }
            : msg
        ));
      }
    };
    
const handleReactionEvent = (data) => {
  if ((chatType === 'direct' && data.message) || (chatType === 'group' && data.groupId === selectedChat._id)) {
    setMessages(prev => prev.map(msg => msg._id === data.messageId ? { ...msg, reactions: data.reactions } : msg));
  }
};

const handleMessageDeleted = (data) => {
      if (data.senderId === selectedChat._id) {
        setMessages(prev => prev.filter(msg => msg._id !== data.messageId));
      }
    };
    const handleTyping = (data) => {
      if (data.senderId === selectedChat._id) {
        setIsTyping(true);
      }
    };
    const handleStopTyping = (data) => {
      if (data.senderId === selectedChat._id) {
        setIsTyping(false);
      }
    };

    const handleGroupReceive = (data) => {
      if (data.groupId === selectedChat._id) {
        setMessages(prev => [...prev, {
          _id: data._id,
          sender: { _id: data.senderId, username: data.senderUsername },
          content: data.content,
          isSystemMessage: data.isSystemMessage,
          createdAt: data.timestamp,
          readBy: []
        }]);

        if (data.isSystemMessage && typeof onChatUpdated === 'function') {
          groupAPI.getGroupDetails(selectedChat._id)
            .then(res => {
              onChatUpdated({ ...selectedChat, ...res.data.data });
            })
            .catch(console.error);
        }

        // Mark messages as read immediately and refresh sidebar
        groupAPI.markAsRead(selectedChat._id).catch((error) => {
          console.error('Failed to mark group messages as read:', error);
        });
        onConversationChanged?.();
      }
    };
    const handleGroupEdited = (data) => {
      if (data.groupId === selectedChat._id) {
        setMessages(prev => prev.map(msg =>
          msg._id === data.messageId
            ? { 
                ...msg, 
                content: data.content, 
                isEdited: true, 
                editedAt: data.editedAt,
                // Preserve starred data
                starredBy: msg.starredBy || [],
                isStarred: msg.isStarred || false,
                starredAt: msg.starredAt || null
              }
            : msg
        ));
      }
    };
    const handleGroupDeleted = (data) => {
      if (data.groupId === selectedChat._id) {
        setMessages(prev => prev.filter(msg => msg._id !== data.messageId));
      }
    };

    const handleProfileUpdate = (updatedUser) => {
      setMessages(prev => prev.map(msg => {
        const senderId = msg?.sender?._id || msg?.sender;
        if (senderId && String(senderId) === String(updatedUser._id)) {
          return {
            ...msg,
            sender: {
              ...(typeof msg.sender === 'object' ? msg.sender : {}),
              ...updatedUser
            }
          };
        }
        return msg;
      }));

      if (chatType === 'direct' && String(selectedChat._id) === String(updatedUser._id)) {
        if (onChatUpdated) {
          onChatUpdated({ ...selectedChat, ...updatedUser });
        }
      }
    };

    const handleMessagesRead = (data) => {
      const { readerId } = data;
      if (chatType === 'direct' && String(selectedChat._id) === String(readerId)) {
        setMessages(prev => prev.map(m => (!m.isread ? { ...m, isread: true } : m)));
      }
    };

    const handleGroupMessagesRead = (data) => {
      const { groupId, readerId } = data;
      if (chatType === 'group' && String(selectedChat._id) === String(groupId)) {
        setMessages(prev => prev.map(m => {
          if (!m.readBy?.includes(readerId)) {
            return { ...m, readBy: [...(m.readBy || []), readerId] };
          }
          return m;
        }));
      }
    };

    if (chatType === 'direct') {
      socket.on('message:receive', handleMessageReceive);
      socket.on('message:edited', handleMessageEdited);
      socket.on('message:deleted', handleMessageDeleted);
      socket.on('user:typing:indicator', handleTyping);
      socket.on('user:stop-typing:indicator', handleStopTyping);
socket.on('message_reaction', handleReactionEvent);
      socket.on('messages:read', handleMessagesRead);
    } else if (chatType === 'group') {
      socket.on('group:message:receive', handleGroupReceive);
      socket.on('group:message:edited', handleGroupEdited);
      socket.on('group:message:deleted', handleGroupDeleted);
socket.on('group_message_reaction', handleReactionEvent);
      socket.on('group:messages:read', handleGroupMessagesRead);
    }
    socket.on('user:profile:updated', handleProfileUpdate);

    return () => {
      if (chatType === 'direct') {
        socket.off('message:receive', handleMessageReceive);
        socket.off('message:edited', handleMessageEdited);
        socket.off('message:deleted', handleMessageDeleted);
        socket.off('user:typing:indicator', handleTyping);
        socket.off('user:stop-typing:indicator', handleStopTyping);
socket.off('message_reaction', handleReactionEvent);
        socket.off('messages:read', handleMessagesRead);
      } else if (chatType === 'group') {
        socket.off('group:message:receive', handleGroupReceive);
        socket.off('group:message:edited', handleGroupEdited);
        socket.off('group:message:deleted', handleGroupDeleted);
socket.off('group_message_reaction', handleReactionEvent);
        socket.off('group:messages:read', handleGroupMessagesRead);
      }
      socket.off('user:profile:updated', handleProfileUpdate);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, selectedChat, chatType]);

  useEffect(() => {
    const isUserAdmin = selectedChat?.admins?.some(admin => typeof admin === 'object' ? admin._id === user?._id : admin === user?._id) || user?._id === selectedChat?.admin?._id;
    if (chatType === 'group' && isUserAdmin) {
      const fetchUsers = async () => {
        try {
          const res = await userAPI.getAllUsers();
          setAllUsers(res.data.data.filter(u => 
            u._id !== user._id && 
            !selectedChat.members.some(member => member._id === u._id) // Filter existing members
          ));
        } catch (error) {
          console.error('Error fetching users:', error);
        }
      };
      fetchUsers();
    }
  }, [chatType, user, selectedChat, showAddMember]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (selectedMembers.length === 0) return;

    try {
      let finalGroup = null;
      for (const memberId of selectedMembers) {
        const response = await groupAPI.addMember(selectedChat._id, memberId);
        finalGroup = response.data.data;
        
        // Broadcast the system message so everyone else sees the update
        if (response.data.systemMessage && socket) {
          socket.emit('group:message:send', {
            groupId: selectedChat._id,
            content: response.data.systemMessage.content,
            senderId: user._id,
            senderUsername: user.username,
            isSystemMessage: true,
            timestamp: response.data.systemMessage.createdAt,
            _id: response.data.systemMessage._id
          });
        }
      }
      setSelectedMembers([]);
      setShowAddMember(false);
      onConversationChanged?.(); // Refresh sidebar/groups
      
      // Update selected chat
      if (onChatUpdated && finalGroup) {
        onChatUpdated({ ...selectedChat, ...finalGroup });
      }
    } catch (error) {
      console.error('Error adding members:', error);
      alert(error.response?.data?.message || 'Error adding members');
    }
  };

  const handleDemoteAdmin = async (userId) => {
    if (!window.confirm('Do you want to revoke admin privileges for this user?')) return;
    try {
      const resp = await groupAPI.removeAdmin(selectedChat._id, userId);
      onConversationChanged?.();
      
      if (resp.data.systemMessage && socket) {
        socket.emit('group:message:send', {
          groupId: selectedChat._id,
          content: resp.data.systemMessage.content,
          senderId: user._id,
          senderUsername: user.username,
          isSystemMessage: true,
          timestamp: resp.data.systemMessage.createdAt,
          _id: resp.data.systemMessage._id
        });
      }

      if (onChatUpdated) {
        onChatUpdated({ ...selectedChat, ...resp.data.data });
      }
    } catch (error) {
      console.error('Error demoting admin:', error);
      alert(error.response?.data?.message || 'Error demoting admin');
    }
  };

  const handlePromoteAdmin = async (userId) => {
    if (!window.confirm('Do you want to grant admin privileges to this user?')) return;
    try {
      const resp = await groupAPI.addAdmin(selectedChat._id, userId);
      onConversationChanged?.();
      
      if (resp.data.systemMessage && socket) {
        socket.emit('group:message:send', {
          groupId: selectedChat._id,
          content: resp.data.systemMessage.content,
          senderId: user._id,
          senderUsername: user.username,
          isSystemMessage: true,
          timestamp: resp.data.systemMessage.createdAt,
          _id: resp.data.systemMessage._id
        });
      }

      if (onChatUpdated) {
        onChatUpdated({ ...selectedChat, ...resp.data.data });
      }
    } catch (error) {
      console.error('Error promoting admin:', error);
      alert(error.response?.data?.message || 'Error promoting admin');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this user from the group?')) return;
    try {
      const resp = await groupAPI.removeMember(selectedChat._id, userId);
      onConversationChanged?.();
      
      if (resp.data.systemMessage && socket) {
        socket.emit('group:message:send', {
          groupId: selectedChat._id,
          content: resp.data.systemMessage.content,
          senderId: user._id,
          senderUsername: user.username,
          isSystemMessage: true,
          timestamp: resp.data.systemMessage.createdAt,
          _id: resp.data.systemMessage._id
        });
      }

      if (onChatUpdated) {
        onChatUpdated({ ...selectedChat, ...resp.data.data });
      }
    } catch (error) {
      console.error('Error removing member:', error);
      alert(error.response?.data?.message || 'Error removing member');
    }
  };

  const handleSendMessage = async (rawInput) => {
      // Validate message
      const validation = validateMessage(rawInput);
      if (!validation.isValid) {
        alert(validation.error);
        return;
      }

      // Sanitize content for storage
      const content = sanitizeMessage(rawInput.trim());

    try {
      if (chatType === 'direct') {
        const res = await messageAPI.sendMessage(selectedChat._id, content);
        const newMsg = res.data.data;
        onConversationChanged?.();
        socket?.emit('message:send', {
          senderId: user._id,
          recipientId: selectedChat._id,
          content,
          _id: newMsg._id,
          timestamp: newMsg.createdAt
        });
        setMessages(prev => [...prev, {
          sender: { _id: user._id },
          content,
          createdAt: newMsg.createdAt,
          isread: newMsg.isread,
          _id: newMsg._id
        }]);
      } else if (chatType === 'group') {
        const res = await groupAPI.sendGroupMessage(selectedChat._id, content);
        const newMsg = res.data.data;
        onConversationChanged?.();
        socket?.emit('group:message:send', {
          groupId: selectedChat._id,
          senderId: user._id,
          senderUsername: user.username,
          content,
          timestamp: newMsg.createdAt,
          _id: newMsg._id
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    }

    if (chatType === 'direct') {
      socket?.emit('user:stop-typing', {
        senderId: user._id,
        recipientId: selectedChat._id
      });
    }
  };

  const handleTyping = () => {
    if (chatType === 'direct') {
      socket?.emit('user:typing', {
        senderId: user._id,
        recipientId: selectedChat._id
      });

      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket?.emit('user:stop-typing', {
          senderId: user._id,
          recipientId: selectedChat._id
        });
      }, 3000);
    }
  };

  const getActionErrorMessage = (error, actionLabel) => {
    const status = error?.response?.status;
    const apiMessage = error?.response?.data?.message;

    if (apiMessage) {
      return apiMessage;
    }

    if (status === 401) return 'Your session has expired. Please login again.';
    if (status === 403) return 'You can only edit or delete your own messages.';
    if (status === 404) return 'This message no longer exists.';

    return `Failed to ${actionLabel} message`;
  };

  const handleStarMessage = async (messageId, messageData) => {
    try {
      // Check if current user has starred this message
      const userHasStarred = messageData.starredBy?.includes(user._id) || false;
      
      if (chatType === 'direct') {
        try {
          if (userHasStarred) {
            await messageAPI.unstarMessage(messageId);
          } else {
            await messageAPI.starMessage(messageId);
          }
        } catch (error) {
          console.error('Star API error:', error);
          alert(getActionErrorMessage(error, 'update star status for'));
          throw error;
        }
        
        // Update local message state: preserve starred data
        setMessages(prev => prev.map(msg => 
          msg._id === messageId 
            ? { 
                ...msg, 
                starredBy: userHasStarred 
                  ? msg.starredBy.filter(id => id !== user._id)
                  : [...(msg.starredBy || []), user._id],
                isStarred: userHasStarred ? false : true
              }
            : msg
        ));
      } else if (chatType === 'group') {
        try {
          if (userHasStarred) {
            await groupAPI.unstarGroupMessage(messageId);
          } else {
            await groupAPI.starGroupMessage(messageId);
          }
        } catch (error) {
          console.error('Star API error:', error);
          alert(getActionErrorMessage(error, 'update star status for'));
          throw error;
        }
        
        // Update local message state: preserve starred data
        setMessages(prev => prev.map(msg => 
          msg._id === messageId 
            ? { 
                ...msg, 
                starredBy: userHasStarred 
                  ? msg.starredBy.filter(id => id !== user._id)
                  : [...(msg.starredBy || []), user._id],
                isStarred: userHasStarred ? false : true
              }
            : msg
        ));
      }
    } catch (error) {
      console.error('Failed to star/unstar message:', error);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      if (chatType === 'direct') {
        try {
          await messageAPI.deleteMessage(messageId);
        } catch (error) {
          console.error('Delete API error:', error);
          alert(getActionErrorMessage(error, 'delete'));
          throw error;
        }
        
        // Only emit socket if API succeeded
        socket?.emit('message:delete', {
          senderId: user._id,
          recipientId: selectedChat._id,
          messageId
        });
      } else if (chatType === 'group') {
        try {
          await groupAPI.deleteGroupMessage(selectedChat._id, messageId);
        } catch (error) {
          console.error('Delete API error:', error);
          alert(getActionErrorMessage(error, 'delete'));
          throw error;
        }
        
        // Only emit socket if API succeeded
        socket?.emit('group:message:delete', {
          groupId: selectedChat._id,
          senderId: user._id,
          messageId
        });
      }

      // Remove message from local state
      setMessages(prev => prev.filter(msg => msg._id !== messageId));
      
      // Call onConversationChanged
      try {
        onConversationChanged?.();
      } catch (e) {
        console.warn('Warning: onConversationChanged failed', e);
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const handleEditMessage = (messageId, content) => {
    setEditingId(messageId);
    setEditingContent(content);
  };

  const handleSendEdit = async (messageId) => {
    const validation = validateMessage(editingContent);
    if (!validation.isValid) {
      alert(validation.error);
      return;
    }

    try {
      const content = sanitizeMessage(editingContent.trim());
      
      if (chatType === 'direct') {
        try {
          await messageAPI.editMessage(messageId, content);
        } catch (error) {
          console.error('Edit API error:', error);
          alert(getActionErrorMessage(error, 'edit'));
          throw error;
        }
        
        // Only emit socket if API succeeded
        socket?.emit('message:edit', {
          senderId: user._id,
          recipientId: selectedChat._id,
          messageId,
          content
        });
      } else if (chatType === 'group') {
        try {
          await groupAPI.editGroupMessage(selectedChat._id, messageId, content);
        } catch (error) {
          console.error('Edit API error:', error);
          alert(getActionErrorMessage(error, 'edit'));
          throw error;
        }
        
        // Only emit socket if API succeeded
        socket?.emit('group:message:edit', {
          groupId: selectedChat._id,
          senderId: user._id,
          messageId,
          content
        });
      }

      // Update local message state - preserve starred data
      setMessages(prev => prev.map(msg =>
        msg._id === messageId
          ? { 
              ...msg, 
              content, 
              isEdited: true, 
              editedAt: new Date(),
              // Preserve starred data
              starredBy: msg.starredBy || [],
              isStarred: msg.isStarred || false,
              starredAt: msg.starredAt || null
            }
          : msg
      ));

      setEditingId(null);
      setEditingContent('');
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingContent('');
  };

    const renderMessageContent = (content) => {
    if (!content) return null;
    const text = unescapeMessage(content);
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="message-link"
          >
            {part}
          </a>
        );
      }
      return <span key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{part}</span>;
    });
  };

  const chatTitle = chatType === 'direct' 
    ? selectedChat.username 
    : selectedChat.name;

  const chatAvatar = chatType === 'direct'
    ? selectedChat.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat.username || 'User')}&background=random`
    : selectedChat.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat.name || 'G')}&background=random`;

  const isOnline = chatType === 'direct' && onlineUsers.has(selectedChat._id);

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-header-title">
          {chatType === 'direct' && (
            <img 
              src={chatAvatar} 
              alt={chatTitle} 
              className="chat-header-avatar" 
            />
          )}
          <div className="chat-header-info">
            <h2 
              onClick={() => chatType === 'direct' && setViewProfileId(selectedChat._id)} 
              style={{ cursor: chatType === 'direct' ? 'pointer' : 'default', textDecoration: chatType === 'direct' ? 'underline' : 'none' }}
            >
              {chatTitle}
            </h2>
            {chatType === 'direct' && (
              <span className={`status ${isOnline ? 'online' : 'offline'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            )}
            {chatType === 'group' && (
              <span 
                className="members-count" 
                onClick={() => setShowManageMembers(true)}
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
              >
                {selectedChat.members.length} members
              </span>
            )}
          </div>
        </div>
        
        {chatType === 'group' && (
          selectedChat.admins?.some(admin => typeof admin === 'object' ? admin._id === user?._id : admin === user?._id) || 
          user?._id === selectedChat?.admin?._id
        ) && (
          <button className="add-member-btn" onClick={() => setShowAddMember(true)}>
            Add Member
          </button>
        )}
      </div>

      {showAddMember && (
        <div className="create-group-modal" onClick={() => setShowAddMember(false)}>
          <div className="create-group-content" onClick={e => e.stopPropagation()}>
            <h3>Add Member to {chatTitle}</h3>
            
            <form onSubmit={handleAddMember} className="create-group-form">
              <div className="members-selector">
                <label>Select members:</label>
                
                <input
                  type="text"
                  className="group-search-input"
                  placeholder="Search users..."
                  value={groupSearchQuery}
                  onChange={(e) => {
                    setGroupSearchQuery(e.target.value);
                    setGroupCurrentPage(1);
                  }}
                />
                
                {(() => {
                  const normalizedQuery = groupSearchQuery.trim().toLowerCase();
                const groupFiltered = allUsers
                  .filter(u => (u.username || '').toLowerCase().includes(normalizedQuery))
                  .sort((a, b) => (a.username || '').localeCompare(b.username || ''));
                  
                const itemsPerPage = 10;
                const totalPages = Math.ceil(groupFiltered.length / itemsPerPage) || 1;
                const validPage = Math.min(Math.max(1, groupCurrentPage), totalPages);
                const startIndex = (validPage - 1) * itemsPerPage;
                const pageItems = groupFiltered.slice(startIndex, startIndex + itemsPerPage);

                const getPageNumbers = () => {
                  const pages = [];
                  if (totalPages <= 5) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    if (validPage <= 3) {
                      pages.push(1, 2, 3, 4, '...', totalPages);
                    } else if (validPage >= totalPages - 2) {
                      pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                    } else {
                      pages.push(1, '...', validPage - 1, validPage, validPage + 1, '...', totalPages);
                    }
                  }
                  return pages;
                };

                return (
                  <>
                    <div className="members-list-window">
                      {pageItems.length === 0 ? (
                        <p className="empty-message">No matching users</p>
                      ) : (
                        pageItems.map(u => (
                          <label key={u._id} className="member-checkbox">
                            <input
                              type="checkbox"
                              checked={selectedMembers.includes(u._id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMembers([...selectedMembers, u._id]);
                                } else {
                                  setSelectedMembers(selectedMembers.filter(id => id !== u._id));
                                }
                              }}
                            />
                            <span className="member-name">{u.username}</span>
                          </label>
                        ))
                      )}
                    </div>

                    {totalPages > 1 && (
                      <>
                        <div className="pagination-controls">
                          <button
                            type="button"
                            disabled={validPage === 1}
                            onClick={() => setGroupCurrentPage(validPage - 1)}
                            className="page-btn nav-arrow"
                          >
                            &larr;
                          </button>
                          
                          <div className="page-numbers">
                            {getPageNumbers().map((p, idx) => (
                              <span
                                key={idx}
                                className={`page-number ${p === validPage ? 'active' : ''} ${p === '...' ? 'dots' : 'clickable'}`}
                                onClick={() => p !== '...' && setGroupCurrentPage(p)}
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                          
                          <button
                            type="button"
                            disabled={validPage === totalPages}
                            onClick={() => setGroupCurrentPage(validPage + 1)}
                            className="page-btn nav-arrow"
                          >
                            &rarr;
                          </button>
                        </div>
                        
                        <div className="jump-to-page">
                          <input
                            type="number"
                            min="1"
                            max={totalPages}
                            value={groupPageInput}
                            onChange={(e) => setGroupPageInput(e.target.value)}
                            placeholder="Page Number"
                            onKeyDown={(e) => {
                              if(e.key === 'Enter') {
                                const p = parseInt(groupPageInput, 10);
                                if (p >= 1 && p <= totalPages) {
                                  setGroupCurrentPage(p);
                                  setGroupPageInput('');
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="jump-btn"
                            onClick={() => {
                              const p = parseInt(groupPageInput, 10);
                              if (p >= 1 && p <= totalPages) {
                                setGroupCurrentPage(p);
                                setGroupPageInput('');
                              }
                            }}
                          >
                            Jump
                          </button>
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
            
            <div className="create-group-actions">
              <button 
                type="submit"
                disabled={selectedMembers.length === 0}
                className="create-btn"
              >
                Add Users
              </button>
              <button 
                type="button"
                onClick={() => {
                  setShowAddMember(false);
                  setSelectedMembers([]);
                }} 
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
            </form>
          </div>
        </div>
      )}

      {showManageMembers && chatType === 'group' && (
        <div className="create-group-modal" onClick={() => setShowManageMembers(false)}>
          <div className="create-group-content" onClick={e => e.stopPropagation()}>
            <h3>Group Members</h3>
            <div className="members-list-window" style={{ maxHeight: '350px' }}>
              {selectedChat.members.map((member) => {
                const isAdmin = selectedChat.admins?.some(a => 
                  typeof a === 'object' ? a._id === member._id : a === member._id
                ) || selectedChat.admin?._id === member._id;

                const isCurrentUserAdmin = selectedChat.admins?.some(a => 
                  typeof a === 'object' ? a._id === user._id : a === user._id
                ) || selectedChat.admin?._id === user._id;

                const isCreator = selectedChat.admin?._id === member._id;

                return (
                  <div key={member._id} className="member-checkbox" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="member-name">{member.username}</span>
                      <span style={{ fontSize: '11px', color: '#888' }}>
                        {isAdmin ? 'Admin' : 'Member'}
                        {isCreator && ' (Creator)'}
                      </span>
                    </div>

                    {isCurrentUserAdmin && user._id !== member._id && !isCreator && (
                      <div className="member-actions" style={{ display: 'flex', gap: '5px' }}>
                        {!isAdmin && (
                          <button 
                            className="action-btn" 
                            style={{ fontSize: '11px', padding: '2px 5px', cursor: 'pointer' }}
                            onClick={() => handlePromoteAdmin(member._id)}
                          >
                            Make Admin
                          </button>
                        )}
                        {isAdmin && (
                          <button 
                            className="action-btn" 
                            style={{ fontSize: '11px', padding: '2px 5px', cursor: 'pointer', color: 'red' }}
                            onClick={() => handleDemoteAdmin(member._id)}
                          >
                            Remove Admin
                          </button>
                        )}
                        <button 
                          className="action-btn" 
                          style={{ fontSize: '11px', padding: '2px 5px', cursor: 'pointer', color: 'red' }}
                          onClick={() => handleRemoveMember(member._id)}
                        >
                          Kick
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="modal-actions" style={{ marginTop: '10px' }}>
              <button 
                onClick={() => setShowManageMembers(false)} 
                className="cancel-btn"
                style={{ width: '100%' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="messages-container">
        {loading ? (
          <div className="loading">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="no-messages">No messages yet. Start conversation!</div>
        ) : (
          messages.map((msg, index) => {
            const userHasStarred = msg.starredBy?.includes(user._id) || false;
            const isOwnMessage = String(msg?.sender?._id || '') === String(user?._id || '');
            const isEditing = editingId === msg._id;

            if (isEditing) {
              return (
                <div 
                  key={index} 
                  className={`message ${isOwnMessage ? 'sent' : 'received'}`}
                  title={`${new Date(msg.createdAt).toLocaleDateString()} at ${new Date(msg.createdAt).toLocaleTimeString()}`}
                >
                  <div className="edit-message-form">
                    <input
                      type="text"
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="edit-input"
                      autoFocus
                    />
                    <div className="edit-buttons">
                      <button
                        onClick={() => handleSendEdit(msg._id)}
                        className="edit-save-btn"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="edit-cancel-btn"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            if (msg.isSystemMessage) {
              return (
                <div
                  key={msg._id || index}
                  ref={(el) => {
                    if (msg._id && el) {
                      messageRefs.current[msg._id] = el;
                    }
                  }}
                  className={`message system-message ${highlightedMessageId === msg._id ? 'highlighted' : ''}`}
                  title={`${new Date(msg.createdAt).toLocaleDateString()} at ${new Date(msg.createdAt).toLocaleTimeString()}`}
                >
                  <div className="message-content">
                    {renderMessageContent(msg.content)}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg._id || index}
                ref={(el) => {
                  if (msg._id && el) {
                    messageRefs.current[msg._id] = el;
                  }
                }}
                className={`message-wrapper ${isOwnMessage ? 'sent-wrapper' : 'received-wrapper'}`}
              >
                {chatType === 'group' && (
                  <img
                    src={(isOwnMessage ? user?.avatar : msg.sender?.avatar) || `https://ui-avatars.com/api/?name=${encodeURIComponent((isOwnMessage ? user?.username : msg.sender?.username) || 'User')}&background=random`}
                    alt="avatar"
                    className="message-avatar"
                    onClick={() => {
                      const profileId = isOwnMessage ? user?._id : msg.sender?._id;
                      if (profileId) setViewProfileId(profileId);
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                )}
                {!msg.isSystemMessage && isOwnMessage && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', margin: '0 4px', paddingBottom: '8px', color: '#8696a0', fontSize: '13px' }}>
                    {(chatType === 'group' ? msg.readBy?.filter(id => String(id) !== String(user._id)).length > 0 : msg.isread) ? '✓✓' : '✓'}
                  </div>
                )}
                <div
                  className={`message ${isOwnMessage ? 'sent' : 'received'} ${highlightedMessageId === msg._id ? 'highlighted' : ''} ${(msg.reactions && msg.reactions.length > 0) ? 'has-reactions' : ''}`}
                  title={`${new Date(msg.createdAt).toLocaleDateString()} at ${new Date(msg.createdAt).toLocaleTimeString()}`}
                >
                  {!isOwnMessage && chatType === 'group' && msg.sender?.username && (
                    <div className="message-sender-name">{msg.sender.username}</div>
                  )}
                  <div className="message-content">
                    {renderMessageContent(msg.content)}
                    {msg.isEdited && (
                      <span className="edited-badge" title={`Edited at ${new Date(msg.editedAt).toLocaleString()}`}>
                        (edited)
                      </span>
                    )}
                      {userHasStarred && (
                        <span className="static-star" title="Starred message" style={{ color: '#ffc700', marginLeft: '6px', fontSize: '13px' }}>
                          ★
                        </span>
                      )}

                  </div>
                  <div className="message-meta">
                    <span 
                      className="message-time" 
                      title={new Date(msg.createdAt).toLocaleString()}
                    >
                      {new Date(msg.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <div className="message-actions-group" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isOwnMessage && (
                      <div className="message-actions">
                      <button
                        className="action-btn edit-btn"
                        onClick={() => handleEditMessage(msg._id, unescapeMessage(msg.content))}
                        title="Edit message"
                      >
                        ✏️
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDeleteMessage(msg._id)}
                        title="Delete message"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                  <button
                    className={`star-btn ${userHasStarred ? 'starred' : ''}`}
                    onClick={() => handleStarMessage(msg._id, msg)}
                    title={userHasStarred ? 'Unstar message' : 'Star message'}
                  >
                    ★
                  </button>
                  </div>
                </div>
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div 
                      className="reaction-display" 
                      onClick={() => setShowReactionUsersMessage(msg)}
                      style={{ cursor: 'pointer' }}
                    >
                      {(() => {
                        const reactionMap = {};
                        msg.reactions.forEach(r => {
                          reactionMap[r.emoji] = (reactionMap[r.emoji] || 0) + 1;
                        });
                        
                        const top3Emojis = Object.entries(reactionMap)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 3)
                          .map(entry => entry[0]);

                        return (
                          <>
                            {top3Emojis.map((emoji, idx) => (
                              <span key={idx} className="reaction-display-icon" style={{ fontSize: '14px', marginRight: '2px' }}>{emoji}</span>
                            ))}
                            {msg.reactions.length > 1 && <span className="reaction-display-count">{msg.reactions.length}</span>}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
                {/* Reaction Button Outside of Message to Prevent Jumping */}
                <div className="reaction-action-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center', zIndex: 5, padding: '0 5px' }}>
                  <button className="react-plus-btn" onClick={(e) => { e.stopPropagation(); setActiveReactMessageId(activeReactMessageId === msg._id ? null : msg._id); }}>
                    🙂+
                  </button>
                  {activeReactMessageId === msg._id && (
                    <div className="reaction-menu" onClick={(e) => e.stopPropagation()}>
                      {REACTION_EMOJIS.map(emoji => {
                        const hasReacted = msg.reactions?.some(r => (typeof r.user === 'object' ? r.user._id : r.user) === user?._id && r.emoji === emoji);
                        return (
                        <span key={emoji} className={`reaction-emoji ${hasReacted ? 'reacted' : ''}`} onClick={(e) => { e.stopPropagation(); handleReactionClick(msg._id, emoji); }}>
                          {emoji}
                        </span>
                        )})}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        {isTyping && (
          <div className="message received typing-indicator">
            <div className="dot"></div>
            <div className="dot"></div>
            <div className="dot"></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <MessageInputForm onSendMessage={handleSendMessage} onTyping={handleTyping} />

      {viewProfileId && (
        <ProfileModal
          userId={viewProfileId}
          currentUserId={user?._id}
          onClose={() => setViewProfileId(null)}
          onProfileUpdate={onProfileUpdate}
          onlineUsers={onlineUsers}
          onSendMessage={(targetUser) => {
            if (typeof onSelectChat === 'function') {
              onSelectChat(targetUser, 'direct');
            }
          }}
        />
      )}
      {showReactionUsersMessage && (
        <div className="create-group-modal" style={{ zIndex: 2000 }} onClick={() => setShowReactionUsersMessage(null)}>
          <div className="create-group-content reaction-list-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>Reactions</h3>
              <button 
                className="action-btn" 
                style={{ fontSize: '18px', cursor: 'pointer', border: 'none', background: 'none' }} 
                onClick={() => setShowReactionUsersMessage(null)}
              >
                &times;
              </button>
            </div>
            <div className="members-list-window" style={{ maxHeight: '330px', overflowY: 'auto' }}>
              {showReactionUsersMessage.reactions.map((r, i) => (
                <div key={i} className="reaction-user-row member-checkbox" style={{ display: 'flex', alignItems: 'center', padding: '10px' }}>
                  <img
                    src={(typeof r.user === 'object' && r.user?.avatar) ? r.user.avatar : `https://ui-avatars.com/api/?name=${encodeURIComponent((typeof r.user === 'object' ? r.user.username : 'User'))}&background=random`}
                    alt="avatar"
                    style={{ width: '35px', height: '35px', borderRadius: '50%', marginRight: '15px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <span className="member-name" style={{ fontWeight: '500' }}>{(typeof r.user === 'object' ? r.user.username : 'Unknown User')}</span>
                  </div>
                  <span style={{ fontSize: '20px' }}>{r.emoji}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;

import React, { useState, useEffect } from 'react';
import { userAPI, messageAPI, groupAPI } from '../api/api';
import { sanitizeGroupName } from '../utils/sanitizer';
import './Sidebar.css';

import ProfileModal from './ProfileModal';

const Sidebar = ({ user, selectedChat, onSelectChat, onlineUsers, onLogout, refreshKey, onProfileUpdate }) => {
  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [starredMessages, setStarredMessages] = useState([]);
  const [starredGroupMessages, setStarredGroupMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('chats'); // 'chats', 'groups', 'users', 'starred'
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupCurrentPage, setGroupCurrentPage] = useState(1);
  const [groupPageInput, setGroupPageInput] = useState('');
  const [usersCurrentPage, setUsersCurrentPage] = useState(1);
  const [usersPageInput, setUsersPageInput] = useState('');

  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await messageAPI.getAllConversations();
        setConversations(response.data.data);
      } catch (error) {
        console.error('Failed to fetch conversations:', error);
      }
    };

    fetchConversations();
  }, [refreshKey]);

  // Fetch groups
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await groupAPI.getUserGroups();
        setGroups(response.data.data);
      } catch (error) {
        console.error('Failed to fetch groups:', error);
      }
    };

    fetchGroups();
  }, [refreshKey]);

  // Fetch all users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await userAPI.getAllUsers(searchQuery);
        setAllUsers(response.data.data);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };

    const timer = setTimeout(fetchUsers, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch starred messages
  useEffect(() => {
    if (activeTab === 'starred') {
      const fetchStarred = async () => {
        try {
          const [directResponse, groupResponses] = await Promise.all([
            messageAPI.getStarredMessages().catch(() => ({ data: { data: [] } })),
            (async () => {
              try {
                const groupsData = await groupAPI.getUserGroups().catch(() => ({ data: { data: [] } }));
                if (groupsData?.data?.data?.length > 0) {
                  const promises = groupsData.data.data.map(group =>
                    groupAPI.getStarredGroupMessages(group._id).catch(() => ({ data: { data: [] } }))
                  );
                  const results = await Promise.all(promises);
                  return results.flatMap(r => r?.data?.data || []);
                }
                return [];
              } catch (error) {
                console.error('Failed to fetch group starred messages:', error);
                return [];
              }
            })()
          ]);
          setStarredMessages(directResponse?.data?.data || []);
          setStarredGroupMessages(groupResponses);
        } catch (error) {
          console.error('Failed to fetch starred messages:', error);
        }
      };
      fetchStarred();
    }
  }, [activeTab, refreshKey]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedMembers.length === 0) {
      alert('Please enter group name and select members');
      return;
    }

    try {
      // Sanitize group name before sending
      const sanitizedGroupName = sanitizeGroupName(groupName);
      if (!sanitizedGroupName) {
        alert('Invalid group name');
        return;
      }

      await groupAPI.createGroup(sanitizedGroupName, '', selectedMembers);
      setGroupName('');
      setSelectedMembers([]);
      setShowCreateGroup(false);
      // Refresh groups
      const response = await groupAPI.getUserGroups();
      setGroups(response.data.data);
    } catch (error) {
      alert('Failed to create group');
    }
  };

  const toggleMember = (memberId) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleOpenStarredGroupMessage = (message) => {
    const existingGroup = groups.find((group) => group._id === message?.group?._id);

    if (existingGroup) {
      onSelectChat(existingGroup, 'group', message._id);
      return;
    }

    // Fallback object to avoid breaking chat header if groups list has not refreshed yet
    if (message?.group?._id) {
      onSelectChat(
        {
          _id: message.group._id,
          name: message.group.name || 'Group',
          members: []
        },
        'group',
        message._id
      );
    }
  };

  const handleOpenStarredDirectMessage = async (message) => {
    const senderId = String(message?.sender?._id || '');
    const recipientId = String(message?.recipient?._id || '');
    const currentUserId = String(user?._id || '');

    const counterpartId = senderId === currentUserId ? recipientId : senderId;
    if (!counterpartId) {
      alert('Could not open this inbox message context.');
      return;
    }

    const existingConversation = conversations.find(
      (conv) => String(conv?.user?._id || '') === counterpartId
    );

    const targetChat =
      existingConversation?.user ||
      (senderId === currentUserId ? message?.recipient : message?.sender);

    if (targetChat?._id) {
      onSelectChat(targetChat, 'direct', message._id);
      return;
    }

    // Fallback: fetch full user record in case starred payload is incomplete
    try {
      const userResponse = await userAPI.getUserById(counterpartId);
      const resolvedUser = userResponse?.data?.data;
      if (!resolvedUser?._id) {
        alert('Could not resolve chat target for this message.');
        return;
      }
      onSelectChat(resolvedUser, 'direct', message._id);
    } catch (error) {
      console.error('Failed to resolve starred direct chat target:', error);
      alert('Failed to open inbox chat for this message.');
    }
  };

  const combinedChats = [
    ...conversations
      .filter((conv) => conv?.user?._id)
      .map((conv) => ({
        id: conv.user._id,
        type: 'direct',
        chat: conv.user,
        name: conv.user.username,
        lastMessage: conv.lastMessage || 'No messages yet',
        lastMessageTime: conv.lastMessageTime,
        unreadCount: conv.unreadCount || 0,
        isOnline: onlineUsers.has(conv.user._id)
      })),
    ...groups.map((group) => ({
      id: group._id,
      type: 'group',
      chat: group,
      name: group.name,
      lastMessage: group.lastMessage || 'No messages yet',
      lastMessageTime: group.lastMessageTime || group.updatedAt || group.createdAt,
      unreadCount: group.unreadCount || 0,
      isOnline: false
    }))
  ].sort((a, b) => {
    const aTime = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
    const bTime = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
    return bTime - aTime;
  });

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredChats = normalizedQuery
    ? combinedChats.filter((chatItem) => {
        const name = chatItem.name?.toLowerCase() || '';
        const lastMessage = chatItem.lastMessage?.toLowerCase() || '';
        return name.includes(normalizedQuery) || lastMessage.includes(normalizedQuery);
      })
    : combinedChats;

  const filteredGroups = normalizedQuery
    ? groups.filter((group) => (group.name || '').toLowerCase().includes(normalizedQuery))
    : groups;

  const filteredUsers = normalizedQuery
    ? allUsers.filter((u) => {
        const username = (u.username || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        return username.includes(normalizedQuery) || email.includes(normalizedQuery);
      })
    : allUsers;

  const filteredStarredMessages = normalizedQuery
    ? starredMessages.filter((msg) => {
        const content = (msg.content || '').toLowerCase();
        const senderName = (msg.sender?.username || '').toLowerCase();
        return content.includes(normalizedQuery) || senderName.includes(normalizedQuery);
      })
    : starredMessages;

  const filteredStarredGroupMessages = normalizedQuery
    ? starredGroupMessages.filter((msg) => {
        const content = (msg.content || '').toLowerCase();
        const senderName = (msg.sender?.username || '').toLowerCase();
        const groupName = (msg.group?.name || '').toLowerCase();
        return content.includes(normalizedQuery) || senderName.includes(normalizedQuery) || groupName.includes(normalizedQuery);
      })
    : starredGroupMessages;

  const unseenChatsCount = combinedChats.filter(chat => chat.unreadCount > 0).length;

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', gap: '8px', width: '100%' }}>
          <img src="/logo.png" alt="DeshiChat Logo" style={{ height: 'auto', width: 'auto', maxHeight: '42px', maxWidth: '25%', objectFit: 'contain' }} />
          <img src="/site_name.jpg" alt="DeshiChat Name" style={{ height: 'auto', width: 'auto', maxHeight: '42px', maxWidth: '70%', objectFit: 'contain' }} />
        </div>
        <div className="user-info">
          <div 
            onClick={() => setShowProfile(true)} 
            className="profile-btn"
          >
            <img 
              src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.username || 'User')}&background=random`} 
              alt="avatar" 
              className="sidebar-avatar" 
            />
            <span className="sidebar-username">{user?.username}</span>
          </div>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </div>

      {showProfile && (
        <ProfileModal 
          userId={user._id} 
          currentUserId={user._id} 
          onClose={() => setShowProfile(false)} 
          onProfileUpdate={onProfileUpdate}
          onlineUsers={onlineUsers}
        />
      )}

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'chats' ? 'active' : ''}`}
          onClick={() => { setActiveTab('chats'); setSearchQuery(''); }}
        >
          Chats {unseenChatsCount > 0 && <span className="unseen-badge">{unseenChatsCount}</span>}
        </button>
        <button
          className={`tab ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => { setActiveTab('groups'); setSearchQuery(''); }}
        >
          Groups
        </button>
        <button
          className={`tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => { setActiveTab('users'); setSearchQuery(''); }}
        >
          Users
        </button>
        <button
          className={`tab ${activeTab === 'starred' ? 'active' : ''}`}
          onClick={() => { setActiveTab('starred'); setSearchQuery(''); }}
        >
          ★ Starred
        </button>
      </div>

      <div className="search-box">
        <input
          type="text"
          placeholder={
            activeTab === 'chats' ? 'Search chats or messages...' :
            activeTab === 'groups' ? 'Search groups...' :
            activeTab === 'users' ? 'Search users...' :
            'Search starred messages or sender...'
          }
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (activeTab === 'users') setUsersCurrentPage(1);
          }}
        />
      </div>

      <div className="sidebar-content">
        {activeTab === 'chats' && (
          <div className="conversations-list">
            {filteredChats.length === 0 ? (
              <p className="empty-message">No conversations yet</p>
            ) : (
              filteredChats.map((chatItem) => (
                <div
                  key={`${chatItem.type}-${chatItem.id}`}
                  className={`conversation-item ${
                    selectedChat?._id === chatItem.id ? 'active' : ''
                  } ${chatItem.unreadCount > 0 ? 'unseen-chat' : ''}`}
                  onClick={() => onSelectChat(chatItem.chat, chatItem.type)}
                >
                  <div className="conversation-content">
                    <div className="chat-row-top">
                      <span className={`chat-type-icon ${chatItem.type}`}>
                        {chatItem.type === 'direct' ? '👤' : '👥'}
                      </span>
                      <span className={`user-name ${chatItem.unreadCount > 0 ? 'unseen-text' : ''}`}>
                        {chatItem.name}
                      </span>
                    </div>
                    <div className={`last-message ${chatItem.unreadCount > 0 ? 'unseen-text' : ''}`}>
                      {chatItem.lastMessage}
                    </div>
                  </div>
                  <div className="conversation-meta">
                    {chatItem.unreadCount > 0 && (
                      <span className="unread-badge">{chatItem.unreadCount}</span>
                    )}
                    {chatItem.type === 'direct' && (
                      <div className={`online-status ${chatItem.isOnline ? 'online' : 'offline'}`}></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'groups' && (
          <div className="groups-list">
            <button
              className="create-group-btn"
              onClick={() => setShowCreateGroup(!showCreateGroup)}
            >
              + Create Group
            </button>

            {showCreateGroup && (
              <form onSubmit={handleCreateGroup} className="create-group-form">
                <input
                  type="text"
                  placeholder="Group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  required
                />
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
                          {pageItems.map(u => (
                            <label key={u._id} className="member-checkbox">
                              <input
                                type="checkbox"
                                checked={selectedMembers.includes(u._id)}
                                onChange={() => toggleMember(u._id)}
                              />
                              <span className="member-name">{u.username}</span>
                            </label>
                          ))}
                        </div>
                        
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
                    );
                  })()}
                </div>
                <div className="create-group-actions">
                  <button type="submit" className="create-btn">Create</button>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => {
                      setShowCreateGroup(false);
                      setGroupName('');
                      setSelectedMembers([]);
                      setGroupSearchQuery('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {filteredGroups.length === 0 ? (
              <p className="empty-message">No groups yet</p>
            ) : (
              filteredGroups.map(group => (
                <div
                  key={group._id}
                  className={`group-item ${selectedChat?._id === group._id ? 'active' : ''}`}
                  onClick={() => onSelectChat(group, 'group')}
                >
                  <div className="group-name">{group.name}</div>
                  <div className="group-members">{group.members.length} members</div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="users-list">
            {(() => {
              const itemsPerPage = 10;
              const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
              const validPage = Math.min(Math.max(1, usersCurrentPage), totalPages);
              const startIndex = (validPage - 1) * itemsPerPage;
              const pageItems = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

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

              if (filteredUsers.length === 0) {
                return <p className="empty-message">No users found</p>;
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {pageItems.map(u => (
                      <div
                        key={u._id}
                        className={`user-item ${selectedChat?._id === u._id ? 'active' : ''}`}
                        onClick={() => onSelectChat(u, 'direct')}
                      >
                        <div className="user-name">{u.username}</div>
                        <div className={`online-status ${onlineUsers.has(u._id) ? 'online' : 'offline'}`}></div>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '10px 0', borderTop: '1px solid #eee' }}>
                    <div className="pagination-controls" style={{ marginBottom: '10px', justifyContent: 'center' }}>
                      <button
                        type="button"
                        disabled={validPage === 1}
                          onClick={() => setUsersCurrentPage(validPage - 1)}
                          className="page-btn nav-arrow"
                        >
                          &larr;
                        </button>
                        
                        <div className="page-numbers">
                          {getPageNumbers().map((p, idx) => (
                            <span
                              key={idx}
                              className={`page-number ${p === validPage ? 'active' : ''} ${p === '...' ? 'dots' : 'clickable'}`}
                              onClick={() => p !== '...' && setUsersCurrentPage(p)}
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                        
                        <button
                          type="button"
                          disabled={validPage === totalPages}
                          onClick={() => setUsersCurrentPage(validPage + 1)}
                          className="page-btn nav-arrow"
                        >
                          &rarr;
                        </button>
                      </div>
                      
                      <div className="jump-to-page" style={{ justifyContent: 'center' }}>
                        <input
                          type="number"
                          min="1"
                          max={totalPages}
                          value={usersPageInput}
                          onChange={(e) => setUsersPageInput(e.target.value)}
                          placeholder="Page"
                          onKeyDown={(e) => {
                            if(e.key === 'Enter') {
                              e.preventDefault();
                              const p = parseInt(usersPageInput, 10);
                              if (p >= 1 && p <= totalPages) {
                                setUsersCurrentPage(p);
                                setUsersPageInput('');
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="jump-btn"
                          onClick={() => {
                            const p = parseInt(usersPageInput, 10);
                            if (p >= 1 && p <= totalPages) {
                              setUsersCurrentPage(p);
                              setUsersPageInput('');
                            }
                          }}
                        >
                          Jump
                        </button>
                      </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'starred' && (
          <div className="starred-messages-list">
            {filteredStarredMessages.length === 0 && filteredStarredGroupMessages.length === 0 ? (
              <p className="empty-message">No starred messages yet</p>
            ) : (
              <>
                {filteredStarredMessages.length > 0 && (
                  <div className="starred-section">
                    <h3>Direct Messages</h3>
                    {filteredStarredMessages.map((msg) => {
                      const isOwnMessage = msg.sender._id === user._id;
                      const senderAvatar = isOwnMessage ? user?.avatar : msg.sender?.avatar;
                      const senderUsername = isOwnMessage ? user?.username : msg.sender?.username;
                      const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(senderUsername || 'User')}&background=random`;

                      return (
                        <div
                          key={msg._id}
                          className="starred-message-item"
                          onClick={() => handleOpenStarredDirectMessage(msg)}
                          title="Open chat and jump to message"
                        >
                          <img 
                            src={senderAvatar || fallbackAvatar} 
                            alt="avatar" 
                            className="starred-message-avatar"
                          />
                          <div className="starred-message-details">
                            <div className="starred-message-header">
                              <span className="starred-sender">
                                {isOwnMessage ? 'You' : msg.sender.username}
                              </span>
                              <span className="starred-message-time">
                                {new Date(msg.starredAt).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="starred-message-content">{msg.content}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {filteredStarredGroupMessages.length > 0 && (
                  <div className="starred-section">
                    <h3>Group Messages</h3>
                    {filteredStarredGroupMessages.map((msg) => {
                      const isOwnMessage = msg.sender._id === user._id;
                      const senderAvatar = isOwnMessage ? user?.avatar : msg.sender?.avatar;
                      const senderUsername = isOwnMessage ? user?.username : msg.sender?.username;
                      const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(senderUsername || 'User')}&background=random`;

                      return (
                        <div
                          key={msg._id}
                          className="starred-message-item"
                          onClick={() => handleOpenStarredGroupMessage(msg)}
                          title="Open group chat and jump to message"
                        >
                          <img 
                            src={senderAvatar || fallbackAvatar} 
                            alt="avatar" 
                            className="starred-message-avatar"
                          />
                          <div className="starred-message-details">
                            <div className="starred-message-header">
                              <span className="starred-sender">
                                {isOwnMessage ? 'You' : msg.sender.username}
                              </span>
                              <span className="starred-message-time">
                                {new Date(msg.starredAt).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="starred-group-name">
                              {msg.group?.name || 'Unknown Group'}
                            </div>
                            <div className="starred-message-content">{msg.content}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;

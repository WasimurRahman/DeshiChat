import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import { getSocket, getOnlineUsers } from '../services/socket';
import { playNotificationSound } from '../utils/sound';
import './Chat.css';

const Chat = () => {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatType, setChatType] = useState(null); // 'direct' or 'group'
  const [focusMessageId, setFocusMessageId] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const socket = getSocket();
  const hasStoredToken = Boolean(localStorage.getItem('token'));

  useEffect(() => {
    // Only redirect when there is definitely no authenticated session
    if (!user && !hasStoredToken) {
      navigate('/login');
    }
  }, [user, hasStoredToken, navigate]);

  useEffect(() => {
    if (socket) {
      const syncOnlineUsers = () => {
        getOnlineUsers(socket).then((users) => {
          if (users !== null) { // prevent overwriting with [] if timeout reached
            setOnlineUsers(new Set(users));
          }
        });
      };

      // Fetch initial list of online users and re-sync after reconnects
      syncOnlineUsers();
      socket.on('connect', syncOnlineUsers);

      socket.on('user:online', (data) => {
        if (data.onlineUsers) {
          setOnlineUsers(new Set(data.onlineUsers));
        } else {
          setOnlineUsers(prev => new Set([...prev, data.userId]));
        }
      });

      socket.on('user:offline', (data) => {
        if (data.onlineUsers) {
          setOnlineUsers(new Set(data.onlineUsers));
        } else {
          setOnlineUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(data.userId);
            return newSet;
          });
        }
      });

      const handleRefresh = () => {
        setSidebarRefreshKey(prev => prev + 1);
      };

      const handleMessageReceive = (data) => {
        // Play notification if the message is from someone else
        // (Assuming backend doesn't broadcast your own message back, but doing simple check otherwise)
        if (data && user && data.senderId && data.senderId !== user._id) {
          playNotificationSound();
        } else if (data && user && data.sender && data.sender !== user._id) {
          playNotificationSound();
        }
        handleRefresh();
      };

      const handleGroupMessageReceive = (data) => {
        if (data && user && data.senderId && data.senderId !== user._id) {
          playNotificationSound();
        } else if (data && user && data.sender && data.sender !== user._id) {
          playNotificationSound();
        }
        handleRefresh();
      };


      // Listen for message events across all chats to keep sidebar updated
      socket.on('message:receive', handleMessageReceive);
      socket.on('message:edited', handleRefresh);
      socket.on('message:deleted', handleRefresh);
      socket.on('group:message:receive', handleGroupMessageReceive);
      socket.on('group:message:edited', handleRefresh);
      socket.on('group:message:deleted', handleRefresh);
      
// Additional group notification listeners (Not natively emitted, handled by system messages instead)
        // Leaving comments in case they are added in future iterations.
      
      socket.on('user:profile:updated', (updatedUser) => {
        if (updatedUser._id !== user._id) {
          handleRefresh();
        }
      });

      return () => {
        socket.off('connect', syncOnlineUsers);
        socket.off('user:online');
        socket.off('user:offline');
        socket.off('message:receive', handleMessageReceive);
        socket.off('message:edited', handleRefresh);
        socket.off('message:deleted', handleRefresh);
        socket.off('group:message:receive', handleGroupMessageReceive);
        socket.off('group:message:edited', handleRefresh);
        socket.off('group:message:deleted', handleRefresh);

        socket.off('user:profile:updated');
      };
    }
  }, [socket, user]);

  const handleSelectChat = (chat, type, messageId = null) => {
    setSelectedChat(chat);
    setChatType(type);
    setFocusMessageId(messageId);
  };

  const handleSidebarRefresh = () => {
    setSidebarRefreshKey((value) => value + 1);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="chat-container">
      <Sidebar
        user={user}
        selectedChat={selectedChat}
        onSelectChat={handleSelectChat}
        onlineUsers={onlineUsers}
        onLogout={handleLogout}
        refreshKey={sidebarRefreshKey}
        onProfileUpdate={updateUser}
      />
      {selectedChat && (
        <ChatWindow
          selectedChat={selectedChat}
          chatType={chatType}
          user={user}
          onlineUsers={onlineUsers}
          onConversationChanged={handleSidebarRefresh}
          onChatUpdated={setSelectedChat}
          focusMessageId={focusMessageId}
          onFocusHandled={() => setFocusMessageId(null)}
          onProfileUpdate={updateUser}
          onSelectChat={handleSelectChat}
        />
      )}
      {!selectedChat && (
        <div className="no-chat-selected">
          <h2>Select a chat to start messaging</h2>
        </div>
      )}
    </div>
  );
};

export default Chat;

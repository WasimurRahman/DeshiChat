import React, { useState, useEffect } from 'react';
import { userAPI } from '../api/api';
import { getSocket } from '../services/socket';
import './ProfileModal.css';

const DEFAULT_AVATARS = [
  'https://ui-avatars.com/api/?name=User&background=random',
  'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Mittens',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=123',
  'https://api.dicebear.com/7.x/micah/svg?seed=Jasper',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Oliver',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Chloe',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Lily',
  'https://api.dicebear.com/7.x/big-ears-neutral/svg?seed=Bob',
  'https://api.dicebear.com/7.x/miniavs/svg?seed=Alice',
  'https://api.dicebear.com/7.x/identicon/svg?seed=Hash',
  'https://api.dicebear.com/7.x/thumbs/svg?seed=Up',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=Retro',
  'https://api.dicebear.com/7.x/rings/svg?seed=Halo',
  'https://api.dicebear.com/7.x/personas/svg?seed=Dave'
];

const ProfileModal = ({ userId, currentUserId, onClose, onProfileUpdate, onlineUsers = new Set(), onSendMessage }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showAvatarOptions, setShowAvatarOptions] = useState(false);

  const getDynamicAvatar = () => {
    if (!profile) return 'https://ui-avatars.com/api/?name=User&background=random';
    const nameStr = profile.username || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(nameStr)}&background=random`;
  };

  const activeAvatarsList = () => {
    return [getDynamicAvatar(), ...DEFAULT_AVATARS.slice(1)];
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await userAPI.getUserById(userId);
        setProfile(res.data.data);
        setEditForm({
          fullName: res.data.data.fullName || '',
          bio: res.data.data.bio || '',
          avatar: res.data.data.avatar || ''
        });
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    fetchProfile();
  }, [userId]);

  const handleSave = async () => {
    try {
      const res = await userAPI.updateProfile(editForm);
      setProfile(res.data.data);
      setIsEditing(false);
      if (onProfileUpdate) onProfileUpdate(res.data.data);
      
      const socket = getSocket();
      if (socket) {
        socket.emit('user:profile:update', res.data.data);
      }
    } catch (err) {
      alert('Failed to update profile');
    }
  };

  if (loading || !profile) return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal-content">Loading...</div>
    </div>
  );

  const isOwnProfile = currentUserId === userId;

  const getActiveStatus = () => {
    if (onlineUsers.has(userId)) return 'Active now';
    if (!profile.lastActive) return 'Offline';
    
    let diff = (Date.now() - new Date(profile.lastActive).getTime()) / 1000;
    
    // Handle negative diffs caused by slight clock drifts between client and server
    if (diff < 0) {
      if (Math.abs(diff) < 300) {
        diff = 1; // if it's within 5 minutes of drift, assume just now
      } else {
        diff = Math.abs(diff); // fallback for major clock discrepancies
      }
    }
    
    if (diff < 60) return `Active just now`;
    if (diff < 3600) return `Active ${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `Active ${Math.floor(diff / 3600)} hours ago`;
    return 'Active more than a day ago';
  };


  return (
    <div className="profile-modal-overlay" onClick={(e) => e.target.className === 'profile-modal-overlay' && onClose()}>
      <div className="profile-modal-content">
        <div className="profile-header">
          <h2>Profile</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        
        {isEditing ? (
          <div className="profile-edit-body">
            <div className="form-group avatar-edit-section">
              <div className="current-avatar-preview">
                <img 
                  src={editForm.avatar || getDynamicAvatar()} 
                  alt="current selected avatar" 
                  className="profile-avatar-large"
                />
                <button 
                  className="edit-avatar-btn" 
                  onClick={() => setShowAvatarOptions(!showAvatarOptions)}
                  type="button"
                >
                  ✎ Edit Avatar
                </button>
              </div>

              {showAvatarOptions && (
                <div className="avatar-selection-dropdown">
                  <label>Choose an Avatar:</label>
                  <div className="avatar-selection grid-5">
                    {activeAvatarsList().map((av, idx) => (
                      <img 
                        key={idx} 
                        src={av} 
                        alt="avatar option" 
                        className={`avatar-option ${editForm.avatar === av ? 'selected' : ''}`}
                        onClick={() => {
                          setEditForm({...editForm, avatar: av});
                          setShowAvatarOptions(false);
                        }} 
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Full Name</label>
              <input 
                type="text" 
                value={editForm.fullName} 
                onChange={(e) => setEditForm({...editForm, fullName: e.target.value})} 
                placeholder="Full Name"
              />
            </div>
            <div className="form-group">
              <label>Bio</label>
              <textarea 
                value={editForm.bio} 
                onChange={(e) => setEditForm({...editForm, bio: e.target.value})} 
                placeholder="Bio"
              />
            </div>
            <div className="profile-actions">
              <button onClick={() => setIsEditing(false)} className="cancel-btn">Cancel</button>
              <button onClick={handleSave} className="save-btn">Save</button>
            </div>
          </div>
        ) : (
          <div className="profile-view-body">
            <img src={profile.avatar || getDynamicAvatar()} alt="avatar" className="profile-avatar-large" />
            <h3 className="profile-username">@{profile.username}</h3>
            <p className="profile-fullname">{profile.fullName || 'No name set'}</p>
            <div className="profile-status-badge">{getActiveStatus()}</div>
            <p className="profile-bio">{profile.bio || 'Available'}</p>
            <p className="profile-date">Joined: {new Date(profile.createdAt).toLocaleDateString()}</p>
            
            {isOwnProfile && (
              <button className="edit-profile-btn" onClick={() => setIsEditing(true)}>Edit Profile</button>
            )}
              {!isOwnProfile && typeof onSendMessage === 'function' && (
                <button
                  className="send-message-btn"
                  onClick={() => {
                    onSendMessage({
                      _id: profile._id,
                      username: profile.username,
                      fullName: profile.fullName,
                      avatar: profile.avatar,
                    });
                    onClose();
                  }}
                >
                  Send Message
                </button>
              )}
          </div>
        )}
      </div>
    </div>
  );
};
export default ProfileModal;

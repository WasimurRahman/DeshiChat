import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace("localhost", window.location.hostname) : `http://${window.location.hostname}:5001/api`;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle responses and errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't automatically logout on 401 - let components handle auth errors gracefully
    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  signup: (username, email, password, confirmPassword) =>
    api.post('/auth/signup', { username, email, password, confirmPassword }),
  verifyOTP: (email, otp) =>
    api.post('/auth/verify-otp', { email, otp }),
  resendOTP: (email) =>
    api.post('/auth/resend-otp', { email }),
  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (email, otp, newPassword) =>
    api.post('/auth/reset-password', { email, otp, newPassword }),
  checkUsername: (username) =>
    api.post('/auth/check-username', { username }),
  checkEmail: (email) =>
    api.post('/auth/check-email', { email }),
  signin: (email, password, rememberMe = false) =>
    api.post('/auth/signin', { email, password, rememberMe }),
  logout: () =>
    api.post('/auth/logout'),
  getCurrentUser: () =>
    api.get('/auth/me')
};

// Message API calls
export const messageAPI = {
  sendMessage: (recipientId, content) =>
    api.post('/messages/send', { recipientId, content }),
  getConversation: (userId) =>
    api.get(`/messages/conversation/${userId}`),
  getAllConversations: () =>
    api.get('/messages/conversations'),
  markAsRead: (senderId) =>
    api.post('/messages/mark-read', { senderId }),
  getUnreadCount: () =>
    api.get('/messages/unread-count'),
  starMessage: (messageId) =>
    api.post(`/messages/${messageId}/star`),
  unstarMessage: (messageId) =>
    api.post(`/messages/${messageId}/unstar`),
  getStarredMessages: () =>
    api.get('/messages/starred'),
  editMessage: (messageId, content) =>
    api.put(`/messages/${messageId}/edit`, { content }),
  deleteMessage: (messageId) =>
    api.delete(`/messages/${messageId}`)
};

// Group API calls
export const groupAPI = {
  createGroup: (name, description, memberIds) =>
    api.post('/groups/create', { name, description, memberIds }),
  getUserGroups: () =>
    api.get('/groups/my-groups'),
  getGroupDetails: (groupId) =>
    api.get(`/groups/${groupId}`),
  addMember: (groupId, userId) =>
    api.post(`/groups/${groupId}/add-member`, { userId }),
  removeMember: (groupId, userId) =>
    api.post(`/groups/${groupId}/remove-member`, { userId }),
  addAdmin: (groupId, userId) =>
    api.post(`/groups/${groupId}/add-admin`, { userId }),
  removeAdmin: (groupId, userId) =>
    api.post(`/groups/${groupId}/remove-admin`, { userId }),
  sendGroupMessage: (groupId, content) =>
    api.post(`/groups/${groupId}/send-message`, { groupId, content }),
  getGroupMessages: (groupId) =>
    api.get(`/groups/${groupId}/messages`),
  markAsRead: (groupId) =>
    api.post(`/groups/${groupId}/mark-read`),
  updateGroup: (groupId, name, description) =>
    api.put(`/groups/${groupId}/update`, { name, description }),
  deleteGroup: (groupId) =>
    api.delete(`/groups/${groupId}/delete`),
  starGroupMessage: (messageId) =>
    api.post(`/groups/${messageId}/star`),
  unstarGroupMessage: (messageId) =>
    api.post(`/groups/${messageId}/unstar`),
  getStarredGroupMessages: (groupId) =>
    api.get(`/groups/${groupId}/starred`),
  editGroupMessage: (groupId, messageId, content) =>
    api.put(`/groups/message/${messageId}/edit`, { content }),
  deleteGroupMessage: (groupId, messageId) =>
    api.delete(`/groups/message/${messageId}`)
};

// User API calls
export const userAPI = {
  getAllUsers: (search) =>
    api.get('/users/all-users', { params: { search } }),
  getUserById: (userId) =>
    api.get(`/users/${userId}`),
  updateProfile: (profileData) =>
    api.put('/users/update-profile', profileData)
};

export default api;


export const reactToMessage = async (messageId, emoji) => {
  const response = await api.post(`/messages/${messageId}/react`, { emoji });
  return response.data;
};

export const reactToGroupMessage = async (messageId, emoji) => {
  const response = await api.post(`/groups/message/${messageId}/react`, { emoji });
  return response.data;
};

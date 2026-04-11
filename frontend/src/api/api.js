import axios from 'axios';

const resolveApiBaseUrl = () => {
  const envUrl = process.env.REACT_APP_API_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim();
  }

  const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (isLocalHost) {
    return 'http://localhost:5001/api';
  }

  return 'https://deshichat-backend.onrender.com/api';
};

const API_BASE_URL = resolveApiBaseUrl();
const DEFAULT_REQUEST_TIMEOUT_MS = 12000;
const AUTH_REQUEST_TIMEOUT_MS = 45000;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json'
  }
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const pingBackend = async ({ retries = 2, delayMs = 2000 } = {}) => {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await api.get('/health', {
        timeout: 10000,
        // Health checks do not need auth headers.
        headers: { Authorization: undefined }
      });
      return true;
    } catch (error) {
      if (attempt === retries) return false;
      await wait(delayMs);
    }
  }
  return false;
};

const isTransientError = (error) => {
  const status = error?.response?.status;
  return (
    error?.code === 'ECONNABORTED' ||
    !error?.response ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
};

const performAuthRequest = async (requestFn, { retries = 1, wakeRetries = 2 } = {}) => {
  await pingBackend({ retries: wakeRetries, delayMs: 2500 });

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await requestFn();
    } catch (error) {
      if (!isTransientError(error) || attempt === retries) {
        throw error;
      }
      await wait(2000);
      await pingBackend({ retries: 1, delayMs: 1500 });
    }
  }

  throw new Error('Request failed');
};

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
    performAuthRequest(() => api.post(
      '/auth/signup',
      { username, email, password, confirmPassword },
      { timeout: AUTH_REQUEST_TIMEOUT_MS }
    )),
  verifyOTP: (email, otp) =>
    performAuthRequest(() => api.post(
      '/auth/verify-otp',
      { email, otp },
      { timeout: AUTH_REQUEST_TIMEOUT_MS }
    )),
  resendOTP: (email) =>
    performAuthRequest(() => api.post(
      '/auth/resend-otp',
      { email },
      { timeout: AUTH_REQUEST_TIMEOUT_MS }
    )),
  forgotPassword: (email) =>
    performAuthRequest(() => api.post(
      '/auth/forgot-password',
      { email },
      { timeout: AUTH_REQUEST_TIMEOUT_MS }
    )),
  resetPassword: (email, otp, newPassword) =>
    performAuthRequest(() => api.post(
      '/auth/reset-password',
      { email, otp, newPassword },
      { timeout: AUTH_REQUEST_TIMEOUT_MS }
    )),
  checkUsername: (username) =>
    performAuthRequest(() => api.post(
      '/auth/check-username',
      { username },
      { timeout: 20000 }
    )),
  checkEmail: (email) =>
    performAuthRequest(() => api.post(
      '/auth/check-email',
      { email },
      { timeout: 20000 }
    )),
  signin: (email, password, rememberMe = false) =>
    performAuthRequest(() => api.post(
      '/auth/signin',
      { email, password, rememberMe },
      { timeout: AUTH_REQUEST_TIMEOUT_MS }
    )),
  logout: () =>
    api.post('/auth/logout'),
  getCurrentUser: () =>
    performAuthRequest(() => api.get('/auth/me', { timeout: 25000 }), { retries: 0, wakeRetries: 1 })
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

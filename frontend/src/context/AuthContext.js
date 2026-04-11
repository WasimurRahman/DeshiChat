import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../api/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Check if token is expired
const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    // Decode JWT and check expiration
    const payloadBase64 = token.split('.')[1];
    const decoded = JSON.parse(atob(payloadBase64));
    return decoded.exp * 1000 < Date.now(); // Convert to milliseconds
  } catch (error) {
    return true;
  }
};

const mapAuthError = (error) => {
  if (!error?.response) {
    return {
      message: 'Network error. Please check your internet and try again.'
    };
  }

  if (typeof error.response?.data === 'string') {
    return { message: error.response.data };
  }

  return error?.response?.data || error;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Check if user is logged in
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('token');
      
      // Check if token exists and is not expired
      if (storedToken && !isTokenExpired(storedToken)) {
        try {
          setToken(storedToken);

          const response = await authAPI.getCurrentUser();
          setUser(response.data);
          connectSocket(response.data._id);
        } catch (error) {
          console.error('Auth check failed:', error);
          const status = error?.response?.status;

          // Only clear auth on unauthorized responses.
          // Keep the current token for transient network/server errors.
          if (status === 401 || status === 403) {
            localStorage.removeItem('token');
            setToken(null);
            setUser(null);
            disconnectSocket();
          } else {
            // For transient startup/network failures, show app instead of infinite loader.
            setUser(null);
          }
        }
      } else if (storedToken && isTokenExpired(storedToken)) {
        // Token is expired, clear it
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        disconnectSocket();
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const signup = async (username, email, password, confirmPassword) => {
    try {
      const response = await authAPI.signup(username, email, password, confirmPassword);
      const { token: newToken, user: newUser } = response.data;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(newUser);
      connectSocket(newUser._id);
      return newUser;
    } catch (error) {
      throw mapAuthError(error);
    }
  };

  const signin = async (email, password, rememberMe = false) => {
    try {
      const response = await authAPI.signin(email, password, rememberMe);
      const { token: newToken, user: newUser } = response.data;
      localStorage.setItem('token', newToken);
      // Store the rememberMe flag for reference
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('rememberMe');
      }
      setToken(newToken);
      setUser(newUser);
      connectSocket(newUser._id);
      return newUser;
    } catch (error) {
      throw mapAuthError(error);
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('rememberMe');
      setToken(null);
      setUser(null);
      disconnectSocket();
    }
  };

  const updateUser = (newUserData) => setUser({ ...user, ...newUserData });

  return (
    <AuthContext.Provider value={{ user, token, loading, signup, signin, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

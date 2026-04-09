import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL ? process.env.REACT_APP_SOCKET_URL.replace("localhost", window.location.hostname) : `http://${window.location.hostname}:5001`;

let socket = null;

export const connectSocket = (userId) => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      socket.emit('user:join', userId);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }
  return socket;
};

export const getOnlineUsers = (socket) => {
  return new Promise((resolve) => {
    if (!socket) {
      resolve([]);
      return;
    }

    let settled = false;
    socket.once('users:online:list', (onlineUsers) => {
      if (settled) return;
      settled = true;
      console.log('Received online users:', onlineUsers);
      resolve(onlineUsers);
    });

    socket.emit('get:online:users');

    // Timeout after 5 seconds if no response
    setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn('Timeout waiting for users:online:list');
      resolve(null); // Return null to indicate timeout instead of empty array
    }, 5000);
  });
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

export default socket;

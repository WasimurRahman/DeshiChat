require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const connectDB = require('./config/db');
const User = require('./models/User');

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  'http://localhost:3000',
  'https://deshichat.vercel.app'
];

const isAllowedOrigin = (origin = '') => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  // Allow Vercel preview URLs for this project.
  return /https:\/\/deshichat-.*\.vercel\.app$/.test(origin);
};

const io = socketIO(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(mongoSanitize());

// Rate limiting middleware
const { apiLimiter, authLimiter, messageLimiter, searchLimiter } = require('./middleware/rateLimiter');
app.use('/api/', apiLimiter); // Apply general limit to all /api routes

// Routes with specific limiters
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/messages', messageLimiter, require('./routes/messageRoutes'));
app.use('/api/groups', messageLimiter, require('./routes/groupRoutes'));
app.use('/api/users', searchLimiter, require('./routes/userRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).send('OK');
});

// Socket.io for real-time messaging
const userSockets = new Map(); // userId -> Set(socketId)
const socketToUser = new Map(); // socketId -> userId

app.set('io', io);
app.set('userSockets', userSockets);

const getOnlineUsers = () => Array.from(userSockets.keys());

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // User joins
  socket.on('user:join', (userId) => {
    if (!userId) return;

    const existingSockets = userSockets.get(userId) || new Set();
    const wasOffline = existingSockets.size === 0;

    existingSockets.add(socket.id);
    userSockets.set(userId, existingSockets);
    socketToUser.set(socket.id, userId);

    if (wasOffline) {
      io.emit('user:online', { userId, status: 'online', onlineUsers: getOnlineUsers() });
    }

    console.log('User joined:', userId, 'Total online:', getOnlineUsers());
  });

  // Profile update
  socket.on('user:profile:update', (updatedUser) => {
    io.emit('user:profile:updated', updatedUser);
  });

  // One-to-one message
  socket.on('message:send', (data) => {
    const { senderId, recipientId, content, _id, timestamp } = data;
    const recipientSockets = userSockets.get(recipientId);

    if (recipientSockets && recipientSockets.size > 0) {
      recipientSockets.forEach((recipientSocketId) => {
        io.to(recipientSocketId).emit('message:receive', {
          senderId,
          content,
          timestamp: timestamp || new Date(),
          _id
        });
      });
    }
  });

  // Group message
  socket.on('group:message:send', (data) => {
    const { groupId, senderId, content, senderUsername, _id, timestamp, isSystemMessage } = data;
    io.emit('group:message:receive', {
      groupId,
      senderId,
      senderUsername,
      content,
      _id,
      isSystemMessage,
      timestamp: timestamp || new Date()
    });
  });

  // Message edit (one-to-one)
  socket.on('message:edit', (data) => {
    const { senderId, recipientId, messageId, content } = data;
    
    // Emit to recipient
    const recipientSockets = userSockets.get(recipientId);
    if (recipientSockets && recipientSockets.size > 0) {
      recipientSockets.forEach((recipientSocketId) => {
        io.to(recipientSocketId).emit('message:edited', {
          senderId,
          messageId,
          content,
          isEdited: true,
          editedAt: new Date()
        });
      });
    }
    
    // Broadcast to all users for starred message updates
    io.emit('message:edited', {
      senderId,
      messageId,
      content,
      isEdited: true,
      editedAt: new Date()
    });
  });

  // Message delete (one-to-one)
  socket.on('message:delete', (data) => {
    const { senderId, recipientId, messageId } = data;
    
    // Emit to recipient
    const recipientSockets = userSockets.get(recipientId);
    if (recipientSockets && recipientSockets.size > 0) {
      recipientSockets.forEach((recipientSocketId) => {
        io.to(recipientSocketId).emit('message:deleted', {
          senderId,
          messageId
        });
      });
    }
    
    // Broadcast to all users for starred message updates
    io.emit('message:deleted', {
      senderId,
      messageId
    });
  });

  // Group message edit
  socket.on('group:message:edit', (data) => {
    const { groupId, senderId, messageId, content } = data;
    io.emit('group:message:edited', {
      groupId,
      senderId,
      messageId,
      content,
      isEdited: true,
      editedAt: new Date()
    });
  });

  // Group message delete
  socket.on('group:message:delete', (data) => {
    const { groupId, senderId, messageId } = data;
    io.emit('group:message:deleted', {
      groupId,
      senderId,
      messageId
    });
  });

  // Typing indicator
  socket.on('user:typing', (data) => {
    const { recipientId, senderId } = data;
    const recipientSockets = userSockets.get(recipientId);

    if (recipientSockets && recipientSockets.size > 0) {
      recipientSockets.forEach((recipientSocketId) => {
        io.to(recipientSocketId).emit('user:typing:indicator', { senderId });
      });
    }
  });

  // Stop typing
  socket.on('user:stop-typing', (data) => {
    const { recipientId, senderId } = data;
    const recipientSockets = userSockets.get(recipientId);

    if (recipientSockets && recipientSockets.size > 0) {
      recipientSockets.forEach((recipientSocketId) => {
        io.to(recipientSocketId).emit('user:stop-typing:indicator', { senderId });
      });
    }
  });

  // Get current online users list
  socket.on('get:online:users', () => {
    socket.emit('users:online:list', getOnlineUsers());
  });

  // User disconnect
  socket.on('disconnect', () => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;

    const sockets = userSockets.get(userId);
    if (!sockets) return;

    sockets.delete(socket.id);
    socketToUser.delete(socket.id);

    if (sockets.size === 0) {
      userSockets.delete(userId);
      User.findByIdAndUpdate(userId, { lastActive: new Date() }).catch(console.error);
      io.emit('user:offline', { userId, status: 'offline', onlineUsers: getOnlineUsers(), lastActive: new Date() });
      console.log('User disconnected:', userId, 'Total online:', getOnlineUsers());
    } else {
      userSockets.set(userId, sockets);
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

/*
// CORS configuration to allow requests from any origin
const cors = require("cors");
app.use(cors({
  origin: "*"
}));
*/
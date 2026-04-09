# WhatsApp Clone (DeshiChat) - Full Project Documentation

This document is a beginner-friendly, instructor-ready explanation of the full project. It covers features, how they work, the technology stack, and exactly where to edit code to add, change, or remove functionality.

## 1. What This Project Is
DeshiChat is a full-stack, real-time chat application inspired by WhatsApp. It supports:
- Account creation and login with email verification
- One-to-one messaging
- Group chats with admin controls
- Message reactions, edits, deletes, and starring
- Read receipts and typing indicators
- User search and profile updates

The frontend is built in React, the backend is built with Node.js and Express, and MongoDB is used for storage. Socket.IO provides real-time events.

## 2. Technology Stack
- Backend: Node.js, Express, MongoDB, Mongoose, JWT, Socket.IO
- Frontend: React, React Router, Axios, Socket.IO client
- Security: Helmet, express-mongo-sanitize, rate limiting

## 3. High-Level Architecture
The app is split into two main folders:
- Backend API and real-time server in [backend](backend)
- Frontend React app in [frontend](frontend)

The frontend talks to the backend using REST APIs in [frontend/src/api/api.js](frontend/src/api/api.js). Real-time behavior is handled with Socket.IO through [backend/server.js](backend/server.js) and [frontend/src/services/socket.js](frontend/src/services/socket.js).

## 4. Feature Breakdown and How Each Works

### 4.1 Authentication and Account Verification
Key files:
- Controllers: [backend/controllers/authController.js](backend/controllers/authController.js)
- Routes: [backend/routes/authRoutes.js](backend/routes/authRoutes.js)
- Model: [backend/models/User.js](backend/models/User.js)
- Frontend pages: [frontend/src/pages/Login.js](frontend/src/pages/Login.js), [frontend/src/pages/Signup.js](frontend/src/pages/Signup.js)

How it works:
- Users sign up with email and password.
- An OTP (one-time code) is generated and sent via email.
- Users verify the OTP to activate the account.
- After verification, a JWT token is returned and stored in localStorage.
- The token is added to every API request by Axios in [frontend/src/api/api.js](frontend/src/api/api.js).

### 4.2 One-to-One Messaging
Key files:
- Controller: [backend/controllers/messageController.js](backend/controllers/messageController.js)
- Routes: [backend/routes/messageRoutes.js](backend/routes/messageRoutes.js)
- Model: [backend/models/Message.js](backend/models/Message.js)
- UI: [frontend/src/components/ChatWindow.js](frontend/src/components/ChatWindow.js)

How it works:
1. The sender posts a message to the API (`/api/messages/send`).
2. The server saves the message in MongoDB.
3. A Socket.IO event is emitted so the recipient receives it instantly.
4. The UI renders the new message without a page refresh.

### 4.3 Group Chats and Admin Controls
Key files:
- Controller: [backend/controllers/groupController.js](backend/controllers/groupController.js)
- Routes: [backend/routes/groupRoutes.js](backend/routes/groupRoutes.js)
- Models: [backend/models/Group.js](backend/models/Group.js), [backend/models/GroupMessage.js](backend/models/GroupMessage.js)

How it works:
- Group creators become admins.
- Admins can add or remove members, and promote other admins.
- Group messages are stored in a dedicated collection.
- When someone joins or leaves, a system message is created.

### 4.4 Read Receipts
Key files:
- Controller logic: [backend/controllers/messageController.js](backend/controllers/messageController.js)
- Controller logic: [backend/controllers/groupController.js](backend/controllers/groupController.js)
- UI: [frontend/src/components/ChatWindow.js](frontend/src/components/ChatWindow.js)

How it works:
- Direct messages use `isread` (boolean).
- Group messages use `readBy` (array of user IDs).
- The UI shows delivered or seen depending on whether the recipient has read the message.

### 4.5 Reactions, Stars, Edits, Deletes
Key files:
- Controller: [backend/controllers/messageController.js](backend/controllers/messageController.js)
- Controller: [backend/controllers/groupController.js](backend/controllers/groupController.js)
- UI: [frontend/src/components/ChatWindow.js](frontend/src/components/ChatWindow.js)

How it works:
- Reactions are stored on each message with `{ user, emoji }` objects.
- Starred messages are tracked by `starredBy` and `starredAt`.
- Edits and deletes are tracked with `isEdited` and `editedAt`.

### 4.6 Online Status and Typing Indicators
Key files:
- Socket server: [backend/server.js](backend/server.js)
- Client socket: [frontend/src/services/socket.js](frontend/src/services/socket.js)

How it works:
- The server tracks connected sockets per user.
- Typing indicators and online status are broadcast through Socket.IO events.

## 5. Data Model Overview
These models define how data is stored in MongoDB:

### User
Defined in [backend/models/User.js](backend/models/User.js). Stores account details, verification status, and profile fields.

### Message
Defined in [backend/models/Message.js](backend/models/Message.js). Stores direct messages, stars, reactions, and read status.

### Group
Defined in [backend/models/Group.js](backend/models/Group.js). Stores group metadata, admins, members, and join dates.

### GroupMessage
Defined in [backend/models/GroupMessage.js](backend/models/GroupMessage.js). Stores group messages, reads, and reactions.

## 6. Configuration and Environment Variables
The backend reads environment variables from `backend/.env`:
- `MONGO_URI`: MongoDB connection string
- `PORT`: backend port (the frontend uses 5001 by default)
- `JWT_SECRET`: secret for JWT signing

The frontend can optionally use `frontend/.env`:
- `REACT_APP_API_URL`: override base API URL

The Axios base URL logic is in [frontend/src/api/api.js](frontend/src/api/api.js).

## 7. How to Run Locally
1. Backend:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
2. Frontend:
   ```bash
   cd frontend
   npm install
   npm start
   ```

## 8. How to Modify Features (Step-by-Step)

### Add a new user field
1. Add the field in [backend/models/User.js](backend/models/User.js).
2. Accept and save it in [backend/controllers/userController.js](backend/controllers/userController.js).
3. Add UI form fields in [frontend/src/components/ProfileModal.js](frontend/src/components/ProfileModal.js).

### Add a new API endpoint
1. Add a route in [backend/routes/messageRoutes.js](backend/routes/messageRoutes.js) or [backend/routes/groupRoutes.js](backend/routes/groupRoutes.js).
2. Implement logic in the matching controller.
3. Add a frontend call in [frontend/src/api/api.js](frontend/src/api/api.js).
4. Call it from the UI (for example, [frontend/src/components/ChatWindow.js](frontend/src/components/ChatWindow.js)).

### Add a new real-time socket event
1. Emit from the client in [frontend/src/services/socket.js](frontend/src/services/socket.js).
2. Handle it in [backend/server.js](backend/server.js).
3. Update UI behavior in [frontend/src/components/ChatWindow.js](frontend/src/components/ChatWindow.js) or [frontend/src/pages/Chat.js](frontend/src/pages/Chat.js).

### Remove a feature (example: star messages)
1. Remove UI buttons in [frontend/src/components/ChatWindow.js](frontend/src/components/ChatWindow.js).
2. Remove API calls in [frontend/src/api/api.js](frontend/src/api/api.js).
3. Remove endpoints in [backend/routes/messageRoutes.js](backend/routes/messageRoutes.js) and [backend/controllers/messageController.js](backend/controllers/messageController.js).
4. Remove data fields in [backend/models/Message.js](backend/models/Message.js) if no longer needed.

## 9. Security and Production Notes
- Security middleware is configured in [backend/server.js](backend/server.js).
- Rate limiting is implemented in [backend/middleware/rateLimiter.js](backend/middleware/rateLimiter.js).
- Database indexes are defined in [backend/models/Message.js](backend/models/Message.js) and [backend/models/GroupMessage.js](backend/models/GroupMessage.js).

## 10. API Reference
See the full endpoint list in [API_DOCUMENTATION.md](API_DOCUMENTATION.md).

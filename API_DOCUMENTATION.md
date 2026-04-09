# API Documentation & Examples

## 📡 Complete API Reference and Examples

### Base URL
```
http://localhost:5001/api
```

### Authentication Header
For protected endpoints, include:
```
Authorization: Bearer <your_jwt_token>
```

Token is obtained from signin/signup response and stored in localStorage on frontend.

---

## 🔐 Authentication Endpoints

### 1. Sign Up (Create Account)
```
POST /api/auth/signup
Content-Type: application/json
```

**Request:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123",
  "confirmPassword": "password123"
}
```

**Success Response (201):**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "john_doe",
    "email": "john@example.com",
    "status": "offline",
    "createdAt": "2024-03-05T10:30:00Z"
  }
}
```

**Error Response (400):**
```json
{
  "message": "User already exists"
}
```

---

### 2. Sign In (Login)
```
POST /api/auth/signin
Content-Type: application/json
```

**Request:**
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "message": "User logged in successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "john_doe",
    "email": "john@example.com",
    "status": "online",
    "createdAt": "2024-03-05T10:30:00Z"
  }
}
```

**Error Response (401):**
```json
{
  "message": "Invalid credentials"
}
```

---

### 3. Logout
```
POST /api/auth/logout
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "message": "User logged out successfully"
}
```

---

### 4. Get Current User
```
GET /api/auth/me
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "username": "john_doe",
  "email": "john@example.com",
  "status": "online",
  "createdAt": "2024-03-05T10:30:00Z"
}
```

---

## 💬 Message Endpoints (One-to-One)

### 1. Send Message
```
POST /api/messages/send
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "recipientId": "507f1f77bcf86cd799439012",
  "content": "Hey! How are you doing?"
}
```

**Response (201):**
```json
{
  "message": "Message sent successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "sender": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "john_doe"
    },
    "recipient": {
      "_id": "507f1f77bcf86cd799439012",
      "username": "jane_doe"
    },
    "content": "Hey! How are you doing?",
    "isread": false,
    "createdAt": "2024-03-05T10:35:00Z"
  }
}
```

---

### 2. Get Conversation with User
```
GET /api/messages/conversation/:userId
Authorization: Bearer <token>
```

Example: `GET /api/messages/conversation/507f1f77bcf86cd799439012`

**Response (200):**
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "sender": {
        "_id": "507f1f77bcf86cd799439011",
        "username": "john_doe"
      },
      "recipient": {
        "_id": "507f1f77bcf86cd799439012",
        "username": "jane_doe"
      },
      "content": "Hey! How are you doing?",
      "isread": true,
      "createdAt": "2024-03-05T10:35:00Z"
    },
    {
      "_id": "507f1f77bcf86cd799439014",
      "sender": {
        "_id": "507f1f77bcf86cd799439012",
        "username": "jane_doe"
      },
      "recipient": {
        "_id": "507f1f77bcf86cd799439011",
        "username": "john_doe"
      },
      "content": "I'm doing great! What about you?",
      "isread": true,
      "createdAt": "2024-03-05T10:36:00Z"
    }
  ]
}
```

---

### 3. Get All Conversations
```
GET /api/messages/conversations
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "data": [
    {
      "user": {
        "_id": "507f1f77bcf86cd799439012",
        "username": "jane_doe",
        "email": "jane@example.com"
      },
      "lastMessage": "I'm doing great!",
      "lastMessageTime": "2024-03-05T10:36:00Z"
    }
  ]
}
```

---

### 4. Mark Messages as Read
```
POST /api/messages/mark-read
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "senderId": "507f1f77bcf86cd799439012"
}
```

**Response (200):**
```json
{
  "message": "Messages marked as read"
}
```

---

### 5. Get Unread Count
```
GET /api/messages/unread-count
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "unreadCount": 5
}
```

---

## 👥 Group Endpoints

### 1. Create Group
```
POST /api/groups/create
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Project Team",
  "description": "Team for project X",
  "memberIds": [
    "507f1f77bcf86cd799439012",
    "507f1f77bcf86cd799439013",
    "507f1f77bcf86cd799439014"
  ]
}
```

**Response (201):**
```json
{
  "message": "Group created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439015",
    "name": "Project Team",
    "description": "Team for project X",
    "admin": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "john_doe"
    },
    "members": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "username": "john_doe"
      },
      {
        "_id": "507f1f77bcf86cd799439012",
        "username": "jane_doe"
      }
    ],
    "createdAt": "2024-03-05T10:40:00Z",
    "updatedAt": "2024-03-05T10:40:00Z"
  }
}
```

---

### 2. Get User's Groups
```
GET /api/groups/my-groups
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439015",
      "name": "Project Team",
      "description": "Team for project X",
      "admin": {
        "_id": "507f1f77bcf86cd799439011",
        "username": "john_doe"
      },
      "members": [
        {
          "_id": "507f1f77bcf86cd799439011",
          "username": "john_doe"
        },
        {
          "_id": "507f1f77bcf86cd799439012",
          "username": "jane_doe"
        }
      ],
      "createdAt": "2024-03-05T10:40:00Z"
    }
  ]
}
```

---

### 3. Get Group Details
```
GET /api/groups/:groupId
Authorization: Bearer <token>
```

Example: `GET /api/groups/507f1f77bcf86cd799439015`

**Response (200):**
Same as group object in previous responses

---

### 4. Send Group Message
```
POST /api/groups/:groupId/send-message
Authorization: Bearer <token>
Content-Type: application/json
```

Example: `POST /api/groups/507f1f77bcf86cd799439015/send-message`

**Request:**
```json
{
  "content": "Great work everyone!"
}
```

**Response (201):**
```json
{
  "message": "Message sent successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439016",
    "group": "507f1f77bcf86cd799439015",
    "sender": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "john_doe"
    },
    "content": "Great work everyone!",
    "createdAt": "2024-03-05T10:42:00Z"
  }
}
```

---

### 5. Get Group Messages
```
GET /api/groups/:groupId/messages
Authorization: Bearer <token>
```

Example: `GET /api/groups/507f1f77bcf86cd799439015/messages`

**Response (200):**
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439016",
      "group": "507f1f77bcf86cd799439015",
      "sender": {
        "_id": "507f1f77bcf86cd799439011",
        "username": "john_doe"
      },
      "content": "Great work everyone!",
      "createdAt": "2024-03-05T10:42:00Z"
    }
  ]
}
```

---

### 6. Add Member to Group
```
POST /api/groups/:groupId/add-member
Authorization: Bearer <token>
Content-Type: application/json
```

Example: `POST /api/groups/507f1f77bcf86cd799439015/add-member`

**Request:**
```json
{
  "userId": "507f1f77bcf86cd799439014"
}
```

**Response (200):**
Updated group object with new member added

---

### 7. Remove Member from Group
```
POST /api/groups/:groupId/remove-member
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "userId": "507f1f77bcf86cd799439014"
}
```

**Response (200):**
Updated group object with member removed

---

### 8. Update Group
```
PUT /api/groups/:groupId/update
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Updated Team Name",
  "description": "Updated description"
}
```

**Response (200):**
Updated group object

---

### 9. Delete Group
```
DELETE /api/groups/:groupId/delete
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "message": "Group deleted successfully"
}
```

---

## 👤 User Endpoints

### 1. Get All Users (with optional search)
```
GET /api/users/all-users?search=query
Authorization: Bearer <token>
```

Example: `GET /api/users/all-users?search=john`

**Response (200):**
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "username": "john_doe",
      "email": "john@example.com",
      "status": "online",
      "createdAt": "2024-03-05T10:30:00Z"
    }
  ]
}
```

---

### 2. Get User by ID
```
GET /api/users/:userId
Authorization: Bearer <token>
```

Example: `GET /api/users/507f1f77bcf86cd799439011`

**Response (200):**
User object (see above)

---

### 3. Update Profile
```
PUT /api/users/update-profile
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "username": "new_username",
  "avatar": "https://example.com/avatar.jpg"
}
```

**Response (200):**
```json
{
  "message": "Profile updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "new_username",
    "email": "john@example.com",
    "avatar": "https://example.com/avatar.jpg",
    "status": "online",
    "createdAt": "2024-03-05T10:30:00Z"
  }
}
```

---

## 🔌 Socket.IO Events

### Client Emits (Browser → Server)

**user:join**
```javascript
socket.emit('user:join', userId);
```

**message:send**
```javascript
socket.emit('message:send', {
  senderId: userId,
  recipientId: otherUserId,
  content: 'Hello!'
});
```

**group:message:send**
```javascript
socket.emit('group:message:send', {
  groupId: groupId,
  senderId: userId,
  content: 'Group message'
});
```

**user:typing**
```javascript
socket.emit('user:typing', {
  senderId: userId,
  recipientId: otherUserId
});
```

**user:stop-typing**
```javascript
socket.emit('user:stop-typing', {
  senderId: userId,
  recipientId: otherUserId
});
```

---

### Server Emits (Server → Client)

**message:receive**
```javascript
socket.on('message:receive', (data) => {
  // data: { senderId, content, timestamp }
});
```

**group:message:receive**
```javascript
socket.on('group:message:receive', (data) => {
  // data: { groupId, senderId, content, timestamp }
});
```

**user:online**
```javascript
socket.on('user:online', (data) => {
  // data: { userId, status: 'online' }
});
```

**user:offline**
```javascript
socket.on('user:offline', (data) => {
  // data: { userId, status: 'offline' }
});
```

**user:typing:indicator**
```javascript
socket.on('user:typing:indicator', (data) => {
  // data: { senderId }
});
```

**user:stop-typing:indicator**
```javascript
socket.on('user:stop-typing:indicator', (data) => {
  // data: { senderId }
});
```

---

## 🧪 Testing with cURL

### Sign Up
```bash
curl -X POST http://localhost:5001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "confirmPassword": "password123"
  }'
```

### Send Message
```bash
curl -X POST http://localhost:5001/api/messages/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": "RECIPIENT_ID",
    "content": "Hello!"
  }'
```

### Create Group
```bash
curl -X POST http://localhost:5001/api/groups/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Group",
    "description": "A test group",
    "memberIds": ["MEMBER_ID_1", "MEMBER_ID_2"]
  }'
```

---

## 📊 HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request succeeded |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - No token or invalid token |
| 403 | Forbidden - Authenticated but not allowed |
| 404 | Not Found - Resource doesn't exist |
| 500 | Server Error - Something went wrong |

---

## 🔒 Error Responses

All errors follow this format:
```json
{
  "message": "Error description"
}
```

Common errors:
```json
{
  "message": "No auth token, access denied"
}
```

```json
{
  "message": "Invalid credentials"
}
```

```json
{
  "message": "User not found"
}
```

---

## 📝 Notes

- All timestamps are in ISO 8601 format
- IDs are MongoDB ObjectIds (24-character hex strings)
- Passwords are never returned in responses
- Tokens expire after 30 days
- Socket connection automatically established on login

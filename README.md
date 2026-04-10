# DeshiChat

DeshiChat is a full-stack chat application with real-time messaging, direct and group conversations, user profiles, and email-based account verification. It uses a React frontend, a Node.js/Express backend, MongoDB for storage, and Socket.IO for live updates.

## Features

- Email signup with OTP verification and JWT authentication
- Login with optional 24-hour session persistence
- Forgot password and OTP-based password reset
- Direct (one-to-one) messaging with read receipts and unread counts
- Group chats with admin controls, membership management, and system messages
- Live online/offline presence, typing indicators, and real-time updates via Socket.IO
- Message editing and deletion (direct and group)
- Starred messages (direct and group) with quick access
- Emoji reactions on messages
- User search, profiles, and avatar selection
- Rate limiting, input sanitization, and basic security middleware
- Automatic cleanup of old messages using TTL indexes

## Tech Stack

- Frontend: React, Axios, Socket.IO client
- Backend: Node.js, Express, Socket.IO, JWT
- Database: MongoDB (local or Atlas)
- Email: Nodemailer (Gmail by default)

## Project Structure

- [backend](backend) - Express API, Socket.IO server, MongoDB models
- [frontend](frontend) - React app
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - Detailed API reference and examples

## Local Setup

### Prerequisites

- Node.js 18+ (or compatible LTS)
- MongoDB (local instance or Atlas URI)
- A Gmail account with an app password (for OTP emails)

### 1) Backend

1. Install dependencies:
   - `cd backend`
   - `npm install`
2. Create a backend environment file and set these variables:

```
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_gmail_address
EMAIL_PASS=your_gmail_app_password
PORT=5000
```

Notes:
- `PORT` is optional. If you set a different port, update the frontend API and socket URLs to match.
- Gmail requires an app password when 2FA is enabled.

3. Start the backend:
   - `npm run dev`

The API will run on `http://localhost:5000` by default.

### 2) Frontend

1. Install dependencies:
   - `cd frontend`
   - `npm install`
2. Configure the API and Socket base URLs for local development:

Option A (quick change): update the hardcoded URLs in these files:
- [frontend/src/api/api.js](frontend/src/api/api.js)
- [frontend/src/services/socket.js](frontend/src/services/socket.js)

Set them to your local backend, for example:

- API base URL: `http://localhost:5000/api`
- Socket URL: `http://localhost:5000`

Option B (env-based): switch those files to use environment variables and add a frontend environment file with:

```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

3. Start the frontend:
   - `npm start`

The app will run on `http://localhost:3000`.

## How to Use

1. Sign up with email and password.
2. Verify your email using the OTP sent to your inbox.
3. Start a direct chat from the Users tab or create a group in the Groups tab.
4. Send messages, add reactions, star favorites, or edit/delete your own messages.
5. Edit your profile and avatar from the profile modal.

## API Reference

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for full endpoint details and sample requests.

## Configuration Notes

- CORS allows `http://localhost:3000` and the production domain by default.
- Rate limiting is enabled for auth, messages, and user search.
- Message TTL rules automatically delete unstarred messages after 3 days and starred messages after 30 days.

## Troubleshooting

- If OTP emails do not arrive, verify Gmail app password settings and check spam.
- If the frontend cannot connect to the backend, make sure the API base URL and socket URL match the backend port.
- If you are running on port 5001 (as referenced in API docs), set `PORT=5001` on the backend and update frontend URLs.

## Scripts

Backend:
- `npm run dev` - Start backend with nodemon
- `npm start` - Start backend with node

Frontend:
- `npm start` - Start React dev server
- `npm run build` - Build for production
- `npm test` - Run tests

const express = require('express');
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(authMiddleware);

router.post('/send', messageController.sendMessage);
router.get('/conversation/:userId', messageController.getConversation);
router.get('/conversations', messageController.getAllConversations);
router.post('/mark-read', messageController.markAsRead);
router.get('/unread-count', messageController.getUnreadCount);

// Star/Unstar routes
router.post('/:messageId/star', messageController.starMessage);
router.post('/:messageId/unstar', messageController.unstarMessage);
router.get('/starred', messageController.getStarredMessages);

// Edit/Delete routes
router.put('/:messageId/edit', messageController.editMessage);
router.delete('/:messageId', messageController.deleteMessage);


// Reaction routes
router.post('/:messageId/react', messageController.reactToMessage);

module.exports = router;

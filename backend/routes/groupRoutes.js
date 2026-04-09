const express = require('express');
const groupController = require('../controllers/groupController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(authMiddleware);

router.post('/create', groupController.createGroup);
router.get('/my-groups', groupController.getUserGroups);
router.get('/:groupId', groupController.getGroupDetails);
router.post('/:groupId/add-member', groupController.addMember);
router.post('/:groupId/remove-member', groupController.removeMember);
router.post('/:groupId/add-admin', groupController.addAdmin);
router.post('/:groupId/remove-admin', groupController.removeAdmin);
router.post('/:groupId/send-message', groupController.sendGroupMessage);
router.get('/:groupId/messages', groupController.getGroupMessages);
router.post('/:groupId/mark-read', groupController.markGroupAsRead);
router.put('/:groupId/update', groupController.updateGroup);
router.delete('/:groupId/delete', groupController.deleteGroup);

// Star/Unstar routes
router.post('/:messageId/star', groupController.starGroupMessage);
router.post('/:messageId/unstar', groupController.unstarGroupMessage);
router.get('/:groupId/starred', groupController.getStarredGroupMessages);

// Edit/Delete routes for messages
router.put('/message/:messageId/edit', groupController.editGroupMessage);
router.delete('/message/:messageId', groupController.deleteGroupMessage);
router.put('/:groupId/message/:messageId/edit', groupController.editGroupMessage);
router.delete('/:groupId/message/:messageId', groupController.deleteGroupMessage);


// Reaction route
router.post('/message/:messageId/react', groupController.reactToMessage);

module.exports = router;
  

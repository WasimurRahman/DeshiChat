const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(authMiddleware);

router.get('/all-users', userController.getAllUsers);
router.get('/:userId', userController.getUserById);
router.put('/update-profile', userController.updateProfile);

module.exports = router;

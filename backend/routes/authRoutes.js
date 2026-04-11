const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { authLimiter, signupLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/signup', signupLimiter, authController.signup);
router.post('/verify-otp', signupLimiter, authController.verifyOTP);
router.post('/resend-otp', signupLimiter, authController.resendOTP);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.post('/check-username', authController.checkUsername);
router.post('/check-email', authController.checkEmail);
router.post('/signin', authLimiter, authController.signin);
router.post('/logout', authMiddleware, authController.logout);
router.get('/me', authMiddleware, authController.getCurrentUser);
router.post('/email-test', authLimiter, authController.testEmailDelivery);

module.exports = router;

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // States to manage OTP and details screen
  const [step, setStep] = useState('details'); // 'details' | 'otp' | 'forgot'
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const { signin, verifyOTP } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (step === 'details') {
        await signin(email, password, rememberMe);
        navigate('/');
      } else if (step === 'otp') {
        await verifyOTP(email, otp);
        navigate('/');
      } else if (step === 'forgot') {
        if (newPassword !== confirmNewPassword) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }
        const { authAPI } = require('../api/api');
        await authAPI.resetPassword(email, otp, newPassword);
        setError('Password reset successful. Please sign in.');
        setStep('details');
        setPassword('');
        setOtp('');
        setNewPassword('');
        setConfirmNewPassword('');
      }
    } catch (err) {
      if (err.requiresVerification && step === 'details') {
        setStep('otp');
        setError('Your email is not verified. A new OTP has been sent.');
      } else {
        setError(err.message || 'Action failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      setLoading(true);
      setError('');
      const { authAPI } = require('../api/api');
      await authAPI.resendOTP(email);
      setError('A new OTP has been sent successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordClick = () => {
    setError('');
    setStep('forgot-email');
  };

  const handleSendResetOTP = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      const { authAPI } = require('../api/api');
      await authAPI.forgotPassword(email);
      setStep('forgot'); // Move to OTP input screen
      setError('Password reset code sent to your email.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset code. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginBottom: '20px', width: '100%' }}>
          <img src="/logo.png" alt="DeshiChat Logo" style={{ height: 'auto', width: 'auto', maxHeight: '80px', maxWidth: '30%', objectFit: 'contain' }} />
          <img src="/site_name.jpg" alt="DeshiChat Name" style={{ height: 'auto', width: 'auto', maxHeight: '80px', maxWidth: '65%', objectFit: 'contain' }} />
        </div>
        {step === 'details' && <h2>Sign In</h2>}

        {error && <div className="error-message">{error}</div>}

        {step === 'otp' ? (
          <>
            <h2>Verify Email</h2>
            <p style={{ textAlign: 'center' }}>An OTP code has been sent to <strong>{email}</strong>. Please enter it below to verify your account.</p>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>OTP Code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter 6-digit OTP"
                  required
                  maxLength="6"
                  style={{ textAlign: 'center', letterSpacing: '2px', fontSize: '1.2rem' }}
                />
              </div>
              <button type="submit" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify OTP & Login'}
              </button>
              <button 
                type="button" 
                onClick={handleResendOTP} 
                disabled={loading} 
                className="resend-btn"
                style={{ marginTop: '10px', background: 'transparent', color: '#00a884', border: '1px solid #00a884' }}
              >
                Resend OTP
              </button>
              <p className="auth-link" style={{ textAlign: 'center', marginTop: '10px', cursor: 'pointer' }} onClick={() => setStep('details')}>Back to Sign In</p>
            </form>
          </>
        ) : step === 'forgot' ? (
          <>
            <h2>Reset Password</h2>
            <p style={{ textAlign: 'center' }}>A reset code has been sent to <strong>{email}</strong>.</p>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Reset Code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter 6-digit OTP"
                  required
                  maxLength="6"
                  style={{ textAlign: 'center', letterSpacing: '2px', fontSize: '1.2rem' }}
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                />
              </div>
              <button type="submit" disabled={loading}>
                {loading ? 'Reseting...' : 'Reset Password & Login'}
              </button>
              <p className="auth-link" style={{ textAlign: 'center', marginTop: '10px', cursor: 'pointer' }} onClick={() => setStep('details')}>Back to Sign In</p>
            </form>
          </>
        ) : step === 'forgot-email' ? (
          <>
            <h2>Forgot Password</h2>
            <p style={{ textAlign: 'center' }}>Enter your email to receive an OTP.</p>
            <form onSubmit={handleSendResetOTP}>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>
              <button type="submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
              <p className="auth-link" style={{ textAlign: 'center', marginTop: '10px', cursor: 'pointer' }} onClick={() => setStep('details')}>Back to Sign In</p>
            </form>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <div className="form-group checkbox-group">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="rememberMe" className="checkbox-label">
                Keep me logged in for 24 hours
              </label>
            </div>

            <button type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {step === 'details' && (
          <>
            <p className="auth-link">
              <span style={{ cursor: 'pointer', color: '#007BFF' }} onClick={handleForgotPasswordClick}>Forgot Password?</span>
            </p>
            <p className="auth-link">
              Don't have an account? <Link to="/signup">Sign Up</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../api/api';
import './Auth.css';

const Signup = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(null); // 'checking', 'available', 'taken', null
  const [usernameMessage, setUsernameMessage] = useState('');
  const [emailStatus, setEmailStatus] = useState(null); // 'checking', 'available', 'taken', null
  const [emailMessage, setEmailMessage] = useState('');
  const emailDebounceRef = useRef(null);
  const [step, setStep] = useState('details'); // 'details' or 'otp'
  const [otp, setOtp] = useState('');
  const debounceRef = useRef(null);

  const { signup, verifyOTP } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const trimmedUsername = username.trim();
    if (trimmedUsername.length === 0) {
      setUsernameStatus(null);
      setUsernameMessage('');
      return;
    }

    if (trimmedUsername.length < 3) {
      setUsernameStatus('taken');
      setUsernameMessage('Username must be at least 3 characters');
      return;
    }

    setUsernameStatus('checking');
    setUsernameMessage('Checking availability...');

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const response = await authAPI.checkUsername(trimmedUsername);
        const { available, message } = response.data;
        setUsernameStatus(available ? 'available' : 'taken');
        setUsernameMessage(message);
      } catch (err) {
        setUsernameStatus('taken');
        setUsernameMessage('Error checking username');
      }
    }, 500);

    return () => clearTimeout(debounceRef.current);
  }, [username]);

  useEffect(() => {
    const trimmedEmail = email.trim();
    if (trimmedEmail.length === 0) {
      setEmailStatus(null);
      setEmailMessage('');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setEmailStatus('taken');
      setEmailMessage('Invalid email format');
      return;
    }

    setEmailStatus('checking');
    setEmailMessage('Checking availability...');

    if (emailDebounceRef.current) {
      clearTimeout(emailDebounceRef.current);
    }

    emailDebounceRef.current = setTimeout(async () => {
      try {
        const response = await authAPI.checkEmail(trimmedEmail);
        const { available, message } = response.data;
        setEmailStatus(available ? 'available' : 'taken');
        setEmailMessage(message);
      } catch (err) {
        setEmailStatus('taken');
        setEmailMessage('Error checking email');
      }
    }, 500);

    return () => clearTimeout(emailDebounceRef.current);
  }, [email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (usernameStatus === 'taken') {
      setError('Please choose an available username');
      return;
    }
    if (emailStatus === 'taken') {
      setError('Please choose an available email address');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (step === 'details') {
        const response = await signup(username, email, password, confirmPassword);
        if (response?.requiresVerification) {
          setStep('otp');
          setError(''); // clear previous errors
        } else {
          navigate('/'); // Fallback if no verification is somehow returned
        }
      } else if (step === 'otp') {
        await verifyOTP(email, otp);
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      setLoading(true);
      setError('');
      await authAPI.resendOTP(email);
      setError('A new OTP has been sent successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
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
        {step === 'details' && <h2>Sign Up</h2>}
        {step === 'otp' && <h2>Verify Email</h2>}

        {error && <div className="error-message">{error}</div>}

        {step === 'otp' ? (
          <>
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
            </form>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <div className="input-wrapper" style={{ position: 'relative' }}>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                required
                className={usernameStatus === 'taken' ? 'invalid' : usernameStatus === 'available' ? 'valid' : ''}
              />
              {usernameStatus === 'checking' && <span className="status-icon">🔄</span>}
              {usernameStatus === 'available' && <span className="status-icon" style={{ color: 'green' }}>✅</span>}
              {usernameStatus === 'taken' && <span className="status-icon" style={{ color: 'red' }}>❌</span>}
            </div>
            {usernameMessage && (
              <div className={`status-message ${usernameStatus}`}>
                {usernameMessage}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Email</label>
            <div className="input-wrapper" style={{ position: 'relative' }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className={emailStatus === 'taken' ? 'invalid' : emailStatus === 'available' ? 'valid' : ''}
              />
              {emailStatus === 'checking' && <span className="status-icon">🔄</span>}
              {emailStatus === 'available' && <span className="status-icon" style={{ color: 'green' }}>✅</span>}
              {emailStatus === 'taken' && <span className="status-icon" style={{ color: 'red' }}>❌</span>}
            </div>
            {emailMessage && (
              <div className={`status-message ${emailStatus}`}>
                {emailMessage}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a password"
              required
            />
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>
        )}

        <p className="auth-link">
          Already have an account? <Link to="/login">Sign In</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;

import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f0f2f5', color: '#111b21', textAlign: 'center', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '10px' }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'normal', marginBottom: '20px' }}>Page Not Found</h2>
      <p style={{ marginBottom: '30px', color: '#667781' }}>The page you are looking for does not exist.</p>
      <Link to="/" style={{ padding: '12px 24px', backgroundColor: '#00a884', color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: '500' }}>
        Return to Home
      </Link>
    </div>
  );
};

export default NotFound;

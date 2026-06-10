import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LogIn, User, Lock } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Convert username to internal email format for Supabase Auth
      const email = username.trim().toLowerCase() + '@tgh.nfe';
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Check if the user is a teacher
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (teacherData) {
        navigate('/teacher');
      } else {
        // Everyone else is an admin (managed via Supabase Auth dashboard)
        navigate('/admin');
      }

    } catch (err) {
      setError(err.message || 'Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container flex items-center justify-center" style={{ minHeight: '100vh' }}>
      <div className="glass-card" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="text-center" style={{ marginBottom: '24px' }}>
          <img src="/logo.png" alt="Triangle Generation Humanitaire" style={{ height: '110px', objectFit: 'contain', margin: '0 auto 24px', mixBlendMode: 'lighten' }} />
          <h1 className="text-2xl font-bold">Welcome Back</h1>
          <p className="text-secondary" style={{ marginTop: '8px' }}>Sign in to access your portal</p>
        </div>

        {error && (
          <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label className="input-label">Username</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                className="input-field"
                style={{ paddingLeft: '40px' }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Enter your username"
                autoComplete="username"
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
              <input
                type="password"
                className="input-field"
                style={{ paddingLeft: '40px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '16px' }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
          <p className="text-secondary" style={{ marginBottom: '16px', fontSize: '0.9rem' }}>New student looking to enroll?</p>
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="btn btn-secondary"
            style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 'bold' }}
          >
            Register a New Student
          </button>
        </div>
      </div>
    </div>
  );
}

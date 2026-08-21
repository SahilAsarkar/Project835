import React, { useState } from 'react';
import CenteredModal from './CenteredModal';

export default function CreateUserModal({ isOpen, onClose, onSave, clients, currentUser }) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('User');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const isSuperAdmin = currentUser?.role === 'Super Admin' || currentUser?.is_superuser;

  const handleCloseModal = () => {
    setErrorMsg('');
    setName('');
    setEmail('');
    setMobile('');
    setPassword('');
    setRole('User');
    setSelectedClientId('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim() || !email.trim() || !password) {
      setErrorMsg("Name, Email, and Password are required.");
      return;
    }

    if (role === 'User' && !selectedClientId) {
      setErrorMsg("Please select a client for this user.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await onSave({
        name: name.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        password,
        role,
        client_id: role === 'User' ? selectedClientId : null
      });
      handleCloseModal();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CenteredModal isOpen={isOpen} onClose={handleCloseModal}>
      <div className="modal-t">Create New Account</div>
      <p className="modal-b">Create a new Admin or User account.</p>
      
      {errorMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444',
          borderRadius: '6px',
          padding: '10px 14px',
          fontSize: '13px',
          marginBottom: '16px',
          fontWeight: 500
        }}>
          ⚠️ {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Name *</label>
          <input
            placeholder="e.g. John Doe"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrorMsg(''); }}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label>Email *</label>
          <input
            type="email"
            placeholder="e.g. john@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }}
            required
          />
        </div>
        <div className="field">
          <label>Mobile</label>
          <input
            placeholder="e.g. +1 555-0192"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Password *</label>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }}
            required
          />
        </div>
        
        {isSuperAdmin && (
          <div className="field">
            <label>Role</label>
            <select value={role} onChange={e => { setRole(e.target.value); setErrorMsg(''); }}>
              <option value="User">User (Standard Access)</option>
              <option value="Admin">Admin (Full Access)</option>
              <option value="Super Admin">Super Admin (System Owner)</option>
            </select>
          </div>
        )}
        
        {role === 'User' && (
          <div className="field">
            <label>Client *</label>
            <select
              value={selectedClientId}
              onChange={(e) => { setSelectedClientId(e.target.value); setErrorMsg(''); }}
              required
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid var(--line)',
                borderRadius: '4px',
                fontSize: '14px',
                background: 'var(--surface)',
                color: 'var(--ink)'
              }}
            >
              <option value="">-- Select Client --</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: '24px' }}>
          <button type="button" className="btn" onClick={handleCloseModal}>Cancel</button>
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </form>
    </CenteredModal>
  );
}

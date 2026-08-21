import React, { useState, useEffect } from 'react';
import CenteredModal from './CenteredModal';

export default function EditUserModal({ isOpen, onClose, onSave, onDelete, clients, user, currentUser }) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('User');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const isSuperAdmin = currentUser?.role === 'Super Admin' || currentUser?.is_superuser;

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setMobile(user.mobile && user.mobile !== '—' ? user.mobile : '');
      setRole(user.role || 'User');
      setSelectedClientId(user.client_id || '');
      setNewPassword('');
    }
  }, [user, isOpen]);

  const handleCloseModal = () => {
    setErrorMsg('');
    setNewPassword('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim() || !email.trim()) {
      setErrorMsg("Name and Email are required.");
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
      const payload = {
        name: name.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        role,
        is_staff: role === 'Admin',
        client_id: role === 'User' ? selectedClientId : null
      };
      if (newPassword) {
        payload.password = newPassword;
      }
      await onSave(user.id, payload);
      handleCloseModal();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CenteredModal isOpen={isOpen} onClose={handleCloseModal}>
      <div className="modal-t">Edit Account</div>
      <p className="modal-b">Update details for {user?.email}.</p>
      
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
        {isSuperAdmin ? (
          <div className="field">
            <label>Role</label>
            <select value={role} onChange={e => { setRole(e.target.value); setErrorMsg(''); }}>
              <option value="User">User (Standard Access)</option>
              <option value="Admin">Admin (Full Access)</option>
              <option value="Super Admin">Super Admin (System Owner)</option>
            </select>
          </div>
        ) : (
          <div className="field">
            <label>Role</label>
            <input value={role} readOnly style={{ background: 'var(--paper)', opacity: 0.8 }} />
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

        <div className="field" style={{ marginTop: '16px', borderTop: '1px solid var(--line-soft)', paddingTop: '16px' }}>
          <label>Reset Password (optional)</label>
          <input
            type="password"
            placeholder="Enter new password to reset"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        <div className="modal-actions" style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button 
            type="button" 
            className="btn danger" 
            onClick={() => {
              if (onDelete && user) {
                onDelete(user);
                handleCloseModal();
              }
            }}
            style={{ background: 'var(--brick)', color: '#fff', border: 'none' }}
          >
            Delete Account
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn" onClick={handleCloseModal}>Cancel</button>
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </CenteredModal>
  );
}

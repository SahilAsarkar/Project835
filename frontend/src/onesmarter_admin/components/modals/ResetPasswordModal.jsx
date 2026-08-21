import React, { useState } from 'react';
import CenteredModal from './CenteredModal';

export default function ResetPasswordModal({ isOpen, onClose, onSave, user }) {
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCloseModal = () => {
    setPassword('');
    setErrorMsg('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!password) {
      setErrorMsg("Password is required.");
      return;
    }

    setLoading(true);
    try {
      await onSave(user.id, { password });
      handleCloseModal();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CenteredModal isOpen={isOpen} onClose={handleCloseModal}>
      <div className="modal-t">Reset Password</div>
      <p className="modal-b">Set a new password for <b>{user?.name || user?.email}</b>.</p>

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
          <label>New Password *</label>
          <input
            type="password"
            placeholder="Enter new password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }}
            required
            autoFocus
          />
        </div>

        <div className="modal-actions" style={{ marginTop: '24px' }}>
          <button type="button" className="btn" onClick={handleCloseModal}>Cancel</button>
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </div>
      </form>
    </CenteredModal>
  );
}

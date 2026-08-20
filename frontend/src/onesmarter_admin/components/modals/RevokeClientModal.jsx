import React from 'react';
import CenteredModal from './CenteredModal';

export default function RevokeClientModal({ isOpen, onClose, client, onConfirm, loading }) {
  if (!client) return null;

  return (
    <CenteredModal isOpen={isOpen} onClose={onClose}>
      <div className="modal-t" style={{ color: 'var(--brick)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>⚠️</span> Revoke Client Access
      </div>
      <div className="modal-b" style={{ marginTop: '12px', fontSize: '13.5px', color: 'var(--ink)' }}>
        Are you sure you want to revoke <b>"{client.name}"</b>?
      </div>
      <p style={{ fontSize: '12px', color: 'var(--ink-2)', lineHeight: '1.5', margin: '8px 0 20px' }}>
        This action will permanently delete the tenant configuration, remove their sequential onboarding ladder, and erase evidence files from the database.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button type="button" className="btn" onClick={onClose} disabled={loading}>
          Cancel
        </button>
        <button
          type="button"
          className="btn danger"
          id="btn-confirm-revoke"
          onClick={onConfirm}
          disabled={loading}
          style={{ background: 'var(--brick-bg)', borderColor: 'var(--brick)', color: 'var(--brick)', fontWeight: '600' }}
        >
          {loading ? 'Revoking...' : 'Yes, Revoke'}
        </button>
      </div>
    </CenteredModal>
  );
}

import React from 'react';
import CenteredModal from './CenteredModal';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmation',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  kind = 'primary', // 'primary' | 'danger' | 'warning'
  loading = false
}) {
  return (
    <CenteredModal isOpen={isOpen} onClose={onClose}>
      <div 
        className="modal-t" 
        style={{ 
          color: kind === 'danger' ? 'var(--brick)' : (kind === 'warning' ? 'var(--ochre)' : 'var(--ink)'),
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <span>{kind === 'danger' || kind === 'warning' ? '⚠️' : 'ℹ️'}</span>
        {title}
      </div>
      <div className="modal-b" style={{ marginTop: '10px' }}>
        {typeof message === 'string' ? message : message}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
        <button type="button" className="btn" onClick={onClose} disabled={loading}>
          {cancelText}
        </button>
        <button 
          type="button" 
          className={`btn ${kind === 'danger' ? 'danger' : 'primary'}`} 
          onClick={onConfirm} 
          disabled={loading}
        >
          {loading ? 'Processing...' : confirmText}
        </button>
      </div>
    </CenteredModal>
  );
}

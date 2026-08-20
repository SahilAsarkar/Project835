import React from 'react';
import CenteredModal from './CenteredModal';

export default function RedoConfirmModal({ isOpen, onClose, stepNum, onConfirm, loading }) {
  return (
    <CenteredModal isOpen={isOpen} onClose={onClose}>
      <div className="modal-t" style={{ color: 'var(--brick)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>⚠️</span> Redo Onboarding Step
      </div>
      <div className="modal-b" id="redo-modal-desc">
        Redo <b>Step {stepNum}</b>?<br /><br />
        This will remove all uploaded files and data saved for Step {stepNum} from the database and reset any dependent onboarding progress.
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
        <button type="button" className="btn" onClick={onClose} disabled={loading}>Cancel</button>
        <button type="button" className="btn danger" id="btn-execute-redo" onClick={onConfirm} disabled={loading}>
          {loading ? 'Resetting...' : 'Redo Step'}
        </button>
      </div>
    </CenteredModal>
  );
}

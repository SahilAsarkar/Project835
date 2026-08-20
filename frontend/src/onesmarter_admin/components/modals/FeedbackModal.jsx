import React from 'react';
import CenteredModal from './CenteredModal';

export default function FeedbackModal({ isOpen, onClose, kind, title, content, checks }) {
  return (
    <CenteredModal isOpen={isOpen} onClose={onClose}>
      <div className={`modal-t ${kind === 'ok' ? 'ok' : 'bad'}`}>
        {title || 'Notice'}
      </div>
      <div className="modal-b">
        {content}
        {checks && checks.length > 0 && (
          <div className="vrep" style={{ marginTop: '12px' }}>
            {checks.map((c, idx) => (
              <div key={idx} className={`vrow ${c.ok ? 'vok' : 'vbad'}`}>
                <span className="vicon">{c.ok ? '✓' : '✕'}</span>
                <div>
                  <div className="vl">{c.label}</div>
                  <div className="vd" dangerouslySetInnerHTML={{ __html: c.detail }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
        <button type="button" className="btn primary" onClick={onClose}>
          OK
        </button>
      </div>
    </CenteredModal>
  );
}

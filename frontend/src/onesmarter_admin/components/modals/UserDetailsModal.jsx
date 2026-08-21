import React from 'react';
import CenteredModal from './CenteredModal';

export default function UserDetailsModal({ isOpen, onClose, user }) {
  if (!user) return null;

  function formatDate(isoStr) {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    } catch (e) {
      return isoStr;
    }
  }

  return (
    <CenteredModal isOpen={isOpen} onClose={onClose}>
      <div className="modal-t" style={{ fontSize: '20px', marginBottom: '8px' }}>User Account Profile</div>
      <p className="modal-b" style={{ marginBottom: '20px' }}>Full profile details for the selected user account.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '10px 0 20px' }}>
        <div style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Full Name</span>
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>{user.name || '—'}</span>
        </div>

        <div style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Email Address</span>
          <span style={{ fontSize: '14px', color: 'var(--ink)', fontFamily: 'monospace' }}>{user.email || '—'}</span>
        </div>

        <div style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Mobile Phone</span>
          <span style={{ fontSize: '14px', color: 'var(--ink)' }}>{user.mobile || '—'}</span>
        </div>

        <div style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>System Role</span>
          <span className={`tag ${user.role === 'Admin' ? 'ok' : 'idle'}`} style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '3px' }}>
            {user.role === 'Admin' ? 'Admin (Full Access)' : 'User (Standard Access)'}
          </span>
        </div>

        <div style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Associated Client</span>
          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)' }}>
            {user.role === 'Admin' ? 'OneSmarter' : (user.client_name || user.clients?.join(', ') || 'None')}
          </span>
        </div>

        <div style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>MFA Status</span>
          <span style={{ fontSize: '13px', color: 'var(--ink)' }}>{user.mfa || (user.totp_enabled ? '2FA Enabled' : 'Password Only')}</span>
        </div>

        <div style={{ borderBottom: '1px solid var(--line-soft)', paddingBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Last System Login</span>
          <span style={{ fontSize: '13px', color: 'var(--ink)' }}>{formatDate(user.last_login || user.created_at)}</span>
        </div>

        <div>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Account Status</span>
          <span className="tag ok" style={{ fontSize: '11px', fontWeight: 700 }}>Active</span>
        </div>
      </div>

      <div className="modal-actions" style={{ marginTop: '20px' }}>
        <button type="button" className="btn primary" onClick={onClose} style={{ width: '100%' }}>Close Profile</button>
      </div>
    </CenteredModal>
  );
}

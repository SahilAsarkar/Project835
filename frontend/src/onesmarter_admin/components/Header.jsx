import React from 'react';

export default function Header({ onSignOut, currentUser, onToggleSidebar }) {
  const adminName = currentUser?.name || 'Sahil Asarkar';
  const initials = adminName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AH';
  const role = currentUser?.role || 'CLIENT USER';

  return (
    <div className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          type="button"
          className="admin-hamburger-btn"
          onClick={onToggleSidebar}
          title="Toggle Navigation Menu"
          style={{
            background: 'none',
            border: 'none',
            color: '#B9C6D4',
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <div className="wordmark">ONESMARTER <span>/ MIR RELAY ADMIN</span></div>
      </div>
      <div className="spacer"></div>
      <div className="env env-ok" id="env">LIVE · DATABASE CONNECTED</div>
      <div className="me">
        <div className="av">{initials}</div>
        <div>
          <div>ABC Health Client</div>
          <div className="role">{role}</div>
        </div>
      </div>
      <button className="signout" id="signout" onClick={onSignOut}>Sign Out</button>
    </div>
  );
}

import React from 'react';

export default function Header({ onSignOut, currentUser, onToggleSidebar }) {
  const displayName = currentUser?.name || currentUser?.email || 'Sahil Asarkar';
  const initials = displayName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'SA';
  const role = currentUser?.role || 'CLIENT USER';
  const clientName = currentUser?.client || 'OneSmarter';
  
  // Show person's name for Admins, and client company name for standard Users
  const isSystemAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin' || currentUser?.is_staff || currentUser?.is_superuser;
  const displayTitle = isSystemAdmin ? displayName : clientName;

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
      <div className="me">
        <div className="av">{initials}</div>
        <div>
          <div>{displayTitle}</div>
          <div className="role">{role}</div>
        </div>
      </div>
      <button
        type="button"
        className="btn-topbar-logout"
        title="Sign Out"
        onClick={onSignOut}
      >
        <svg
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
          <line x1="12" y1="2" x2="12" y2="12"></line>
        </svg>
      </button>
    </div>
  );
}

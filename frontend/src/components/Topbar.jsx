import React from "react";

export default function Topbar({ user, onToggleDrawer, onLogout }) {
  return (
    <div className="topbar">
      <button
        type="button"
        className="btn-drawer-toggle"
        id="btnDrawerToggle"
        title="Toggle Navigation Menu"
        onClick={onToggleDrawer}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
      <div className="wordmark">
        MIR Relay <span>/ Project835</span>
      </div>
      <div className="spacer"></div>
      {user && user.name && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="tenant">
            <span className="dot"></span>
            <span>{user.name}</span>
          </div>
          <button
            type="button"
            className="btn-topbar-logout"
            title="Logout"
            onClick={onLogout}
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
      )}
    </div>
  );
}

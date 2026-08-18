import React from "react";

export default function Drawer({ isOpen, activeTab, onSelectTab, onClose }) {
  return (
    <>
      {/* Drawer Backdrop Overlay */}
      <div
        className={`drawer-backdrop ${isOpen ? "open" : ""}`}
        id="drawerBackdrop"
        onClick={onClose}
      ></div>

      {/* Left-to-Right Drawer Navigation Panel */}
      <nav className={`rail ${isOpen ? "open" : ""}`} id="navDrawer">
        <div className="drawer-header">
          <h3>NAVIGATION</h3>
          <button
            type="button"
            className="drawer-close-btn"
            id="drawerCloseBtn"
            title="Close Menu"
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        <div className="grp eyebrow">Operations</div>
        <button
          className={`navitem ${activeTab === "flow" ? "on" : ""}`}
          data-v="flow"
          onClick={() => onSelectTab("flow")}
        >
          Flow
        </button>
        <button
          className={`navitem ${activeTab === "batches" ? "on" : ""}`}
          data-v="batches"
          onClick={() => onSelectTab("batches")}
        >
          Conversions
        </button>
        <button
          className={`navitem ${activeTab === "notices" ? "on" : ""}`}
          data-v="notices"
          onClick={() => onSelectTab("notices")}
        >
          Notices from MPL <span className="count">3</span>
        </button>
        <div className="grp eyebrow" style={{ paddingTop: "18px" }}>
          Records
        </div>
        <button
          className={`navitem ${activeTab === "archive" ? "on" : ""}`}
          data-v="archive"
          onClick={() => onSelectTab("archive")}
        >
          Archive
        </button>
        <div className="grp eyebrow" style={{ paddingTop: "18px" }}>
          Setup
        </div>
        <button
          className={`navitem ${activeTab === "conn" ? "on" : ""}`}
          data-v="conn"
          onClick={() => onSelectTab("conn")}
        >
          Connections
        </button>
      </nav>
    </>
  );
}

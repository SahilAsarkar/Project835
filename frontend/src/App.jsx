import React, { useState, useEffect, useCallback } from "react";
import Topbar from "./components/Topbar";
import Drawer from "./components/Drawer";
import FileViewerModal from "./components/FileViewerModal";
import SftpBrowserModal from "./components/SftpBrowserModal";
import { safeFetchJson } from "./utils/api";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import TotpSetupPage from "./pages/TotpSetupPage";
import TotpVerifyPage from "./pages/TotpVerifyPage";
import FirstLoginPasswordPage from "./pages/FirstLoginPasswordPage";

import FlowView from "./pages/FlowView";
import ConversionsView from "./pages/ConversionsView";
import NoticesView from "./pages/NoticesView";
import ArchiveView from "./pages/ArchiveView";
import ConnectionsView from "./pages/ConnectionsView";
import ContactsView from "./pages/ContactsView";
import AdminView from "./pages/AdminView";

export default function App() {
  const [userState, setUserState] = useState(null); // { authenticated: bool, user: { name, email, totp_enabled, totp_verified } }
  const [loadingUser, setLoadingUser] = useState(true);
  const [isAdminRoute, setIsAdminRoute] = useState(() => {
    const path = window.location.pathname.toLowerCase();
    return path.includes("adminstrator") || path.includes("administrator") || path.startsWith("/mapping");
  });

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem("activeTab");
      // Also skip 'admin' which is a separate route
      const skipTabs = ["admin"];
      return saved && !skipTabs.includes(saved) ? saved : "flow";
    } catch (e) {
      return "flow";
    }
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      setIsAdminRoute(path.includes("adminstrator") || path.includes("administrator") || path.startsWith("/mapping"));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleTabChange = (tab) => {
    if (tab === "admin") return;
    setActiveTab(tab);
    try {
      // Don't persist 'conn' to localStorage so it doesn't become the default
      if (tab !== "conn") {
        localStorage.setItem("activeTab", tab);
      }
    } catch (e) {}
    setIsDrawerOpen(false);
  };

  // Modals state
  const [viewerFileId, setViewerFileId] = useState(null);
  const [sftpBrowserState, setSftpBrowserState] = useState(null);

  // Dashboard live data state
  const [metrics, setMetrics] = useState({});
  const [trackedFiles, setTrackedFiles] = useState([]);
  const [sftpConfigs, setSftpConfigs] = useState([]);
  const [activeSftpConfig, setActiveSftpConfig] = useState(null);

  // Fetch initial user status
  const checkUserStatus = useCallback(async () => {
    try {
      const { data } = await safeFetchJson("/accounts/api/user/");
      setUserState(data);
    } catch (e) {
      setUserState({ authenticated: false, user: null });
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    checkUserStatus();
  }, [checkUserStatus]);

  // Dashboard Data Refresh
  const refreshDashboardData = useCallback(async () => {
    try {
      const [mRes, tRes, sRes] = await Promise.all([
        safeFetchJson("/edi835/api/metrics/").catch(() => null),
        safeFetchJson("/edi835/api/tracked-files/").catch(() => null),
        safeFetchJson("/edi835/api/sftp/get/").catch(() => null),
      ]);

      if (mRes && mRes.res.ok) {
        setMetrics(mRes.data);
      }
      if (tRes && tRes.res.ok) {
        setTrackedFiles(tRes.data.files || []);
      }
      if (sRes && sRes.res.ok) {
        setSftpConfigs(sRes.data.configurations || []);
        setActiveSftpConfig(sRes.data.active_config || null);
      }
    } catch (e) {
      console.warn("Failed refreshing dashboard data:", e);
    }
  }, []);

  useEffect(() => {
    refreshDashboardData();
    const interval = setInterval(refreshDashboardData, 3000);
    return () => clearInterval(interval);
  }, [refreshDashboardData]);

  const handleLogout = async () => {
    try {
      await fetch("/accounts/api/logout/", { method: "POST" });
    } catch (e) {
      console.warn("Logout error:", e);
    }
    setUserState({ authenticated: false, user: null });
  };

  if (loadingUser) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--body)",
          color: "var(--ink-2)",
        }}
      >
        Loading MIR Relay...
      </div>
    );
  }

  if (!userState || !userState.authenticated) {
    // If on the client portal (not an admin route), redirect staff trying to use the client login
    // away — they must use /administrator. We can't know yet (not logged in), so just show login.
    return <LoginPage onLoginSuccess={checkUserStatus} isAdminRoute={isAdminRoute} />;
  }

  // ── Admin guard ──────────────────────────────────────────────────────────
  // Staff/admin users have no business on the client-side portal.
  // Redirect them to the admin portal immediately, regardless of which path
  // they landed on. They must always authenticate through /administrator.
  if (userState.authenticated && userState.user && userState.user.is_staff && !isAdminRoute) {
    window.location.replace("/administrator");
    return null; // nothing renders while redirect is in flight
  }
  // ─────────────────────────────────────────────────────────────────────────

  if (userState.authenticated) {
    if (!userState.user.totp_enabled) {
      return <TotpSetupPage onSetupSuccess={checkUserStatus} onGoDashboard={checkUserStatus} onLogout={handleLogout} />;
    }
    if (!userState.user.totp_verified) {
      return <TotpVerifyPage onVerifySuccess={checkUserStatus} onLogout={handleLogout} />;
    }
    if (userState.user.first_login) {
      return <FirstLoginPasswordPage onPasswordChangeSuccess={checkUserStatus} onLogout={handleLogout} />;
    }
  }

  const user = userState.user;

  // Standalone Admin Route View (/administrator or /adminstrator)
  if (isAdminRoute) {
    if (!user.is_staff) {
      return (
        <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "var(--body)", color: "var(--brick)", padding: "20px", textAlign: "center" }}>
          <div>
            <h2 style={{ marginBottom: "12px" }}>Access Denied</h2>
            <p style={{ color: "var(--ink-2)" }}>Standard users are not authorized to access administrative panels.</p>
            <button className="btn primary" onClick={() => { window.location.href = "/"; }} style={{ marginTop: "16px", padding: "8px 16px" }}>Go to Dashboard</button>
          </div>
        </div>
      );
    }
    return <AdminView user={user} onLogout={handleLogout} />;
  }

  // Main Application View
  return (
    <div>
      <Topbar
        user={user}
        onToggleDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
        onLogout={handleLogout}
      />

      <div className="shell">
        <Drawer
          isOpen={isDrawerOpen}
          activeTab={activeTab}
          onSelectTab={handleTabChange}
          onClose={() => setIsDrawerOpen(false)}
        />

        <main className="main">
          {activeTab === "flow" && (
            <FlowView
              metrics={metrics}
              recentFiles={trackedFiles}
              inboundConfig={activeSftpConfig}
              outboundConfig={activeSftpConfig}
              onNavigateTab={handleTabChange}
            />
          )}

          {activeTab === "batches" && (
            <ConversionsView
              trackedFiles={trackedFiles}
              onRefreshData={refreshDashboardData}
              onOpenFileModal={(id) => setViewerFileId(id)}
            />
          )}

          {activeTab === "notices" && <NoticesView />}

          {activeTab === "archive" && (
            <ArchiveView
              metrics={metrics}
              trackedFiles={trackedFiles}
              sftpConfig={activeSftpConfig}
              onRefreshData={refreshDashboardData}
              onOpenFileModal={(id) => setViewerFileId(id)}
            />
          )}

          {activeTab === "conn" && (
            <ConnectionsView
              sftpConfigs={sftpConfigs}
              activeConfig={activeSftpConfig}
              onRefreshSftp={refreshDashboardData}
              onOpenSftpBrowser={(params) => setSftpBrowserState(params)}
            />
          )}
          
          {activeTab === "contacts" && <ContactsView />}
        </main>
      </div>

      {/* Modals */}
      <FileViewerModal
        fileId={viewerFileId}
        onClose={() => setViewerFileId(null)}
      />

      {sftpBrowserState && (
        <SftpBrowserModal
          isOpen={!!sftpBrowserState}
          initialPath={sftpBrowserState.initialPath}
          configId={activeSftpConfig ? activeSftpConfig.id : null}
          sftpUniHost={sftpBrowserState.host}
          sftpUniPort={sftpBrowserState.port}
          sftpUniUser={sftpBrowserState.user}
          sftpUniPass={sftpBrowserState.pass}
          sftpUniSshKey={sftpBrowserState.sshKey}
          sftpUniAuth={sftpBrowserState.auth}
          onSelectFolder={sftpBrowserState.onSelectFolder}
          onClose={() => setSftpBrowserState(null)}
        />
      )}
    </div>
  );
}

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

import FlowView from "./pages/FlowView";
import ConversionsView from "./pages/ConversionsView";
import NoticesView from "./pages/NoticesView";
import ArchiveView from "./pages/ArchiveView";
import ConnectionsView from "./pages/ConnectionsView";
import AdminView from "./pages/AdminView";

export default function App() {
  const [userState, setUserState] = useState(null); // { authenticated: bool, user: { name, email, totp_enabled, totp_verified } }
  const [loadingUser, setLoadingUser] = useState(true);
  const [isAdminRoute, setIsAdminRoute] = useState(() => {
    const path = window.location.pathname.toLowerCase();
    return path.includes("adminstrator") || path.includes("administrator");
  });

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem("activeTab");
      return saved && saved !== "admin" ? saved : "flow";
    } catch (e) {
      return "flow";
    }
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      setIsAdminRoute(path.includes("adminstrator") || path.includes("administrator"));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleTabChange = (tab) => {
    if (tab === "admin") return;
    setActiveTab(tab);
    try {
      localStorage.setItem("activeTab", tab);
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

  const user = (userState && userState.user) || { name: "User", email: "user@example.com" };

  // Standalone Admin Route View (/administrator or /adminstrator)
  if (isAdminRoute) {
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

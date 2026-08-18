import React, { useState, useEffect, useCallback } from "react";
import Topbar from "./components/Topbar";
import Drawer from "./components/Drawer";
import FileViewerModal from "./components/FileViewerModal";
import SftpBrowserModal from "./components/SftpBrowserModal";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import TotpSetupPage from "./pages/TotpSetupPage";
import TotpVerifyPage from "./pages/TotpVerifyPage";

import FlowView from "./pages/FlowView";
import ConversionsView from "./pages/ConversionsView";
import NoticesView from "./pages/NoticesView";
import ArchiveView from "./pages/ArchiveView";
import ConnectionsView from "./pages/ConnectionsView";

export default function App() {
  const [userState, setUserState] = useState(null); // { authenticated: bool, user: { name, email, totp_enabled, totp_verified } }
  const [loadingUser, setLoadingUser] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem("activeTab") || "flow";
    } catch (e) {
      return "flow";
    }
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleTabChange = (tab) => {
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
      const res = await fetch("/accounts/api/user/");
      const data = await res.json();
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
    if (!userState || !userState.authenticated) return;
    try {
      const [mRes, tRes, sRes] = await Promise.all([
        fetch("/edi835/api/metrics/"),
        fetch("/edi835/api/tracked-files/"),
        fetch("/edi835/api/sftp/get/"),
      ]);

      if (mRes.ok) {
        const mData = await mRes.json();
        setMetrics(mData);
      }
      if (tRes.ok) {
        const tData = await tRes.json();
        setTrackedFiles(tData.files || []);
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        setSftpConfigs(sData.configurations || []);
        setActiveSftpConfig(sData.active_config || null);
      }
    } catch (e) {
      console.warn("Failed refreshing dashboard data:", e);
    }
  }, [userState]);

  useEffect(() => {
    if (userState && userState.authenticated && userState.user?.totp_verified) {
      refreshDashboardData();
      const interval = setInterval(refreshDashboardData, 3000);
      return () => clearInterval(interval);
    }
  }, [userState, refreshDashboardData]);

  const handleLogout = async () => {
    try {
      await fetch("/accounts/api/logout/", { method: "POST" });
    } catch (e) {
      console.warn("Logout error:", e);
    }
    setUserState({ authenticated: false, user: null });
  };

  const handleLoginSuccess = (data) => {
    checkUserStatus();
  };

  const handleSignupSuccess = (data) => {
    checkUserStatus();
  };

  const handleTotpVerified = () => {
    checkUserStatus();
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

  // Auth Routing Guard logic
  if (!userState || !userState.authenticated) {
    return (
      <div>
        <Topbar user={null} onToggleDrawer={() => {}} onLogout={() => {}} />
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onNavigate={(page) => {
            if (page === "signup") {
              setUserState({ authenticated: false, showSignup: true });
            }
          }}
        />
      </div>
    );
  }

  if (userState.showSignup) {
    return (
      <div>
        <Topbar user={null} onToggleDrawer={() => {}} onLogout={() => {}} />
        <SignupPage
          onSignupSuccess={handleSignupSuccess}
          onNavigate={(page) => {
            if (page === "login") {
              setUserState({ authenticated: false, showSignup: false });
            }
          }}
        />
      </div>
    );
  }

  const user = userState.user;
  if (!user.totp_enabled) {
    return (
      <div>
        <Topbar user={user} onToggleDrawer={() => {}} onLogout={handleLogout} />
        <TotpSetupPage
          onSetupSuccess={checkUserStatus}
          onGoDashboard={checkUserStatus}
        />
      </div>
    );
  }

  if (!user.totp_verified) {
    return (
      <div>
        <Topbar user={user} onToggleDrawer={() => {}} onLogout={handleLogout} />
        <TotpVerifyPage onVerifySuccess={handleTotpVerified} />
      </div>
    );
  }

  // Logged-in & 2FA Verified SPA View
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

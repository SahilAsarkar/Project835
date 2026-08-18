import React, { useState, useEffect, useRef } from "react";

export default function ConnectionsView({
  sftpConfigs,
  activeConfig,
  onRefreshSftp,
  onOpenSftpBrowser,
}) {
  const [sameServer, setSameServer] = useState(true);

  // Unified Mode State
  const [uniHost, setUniHost] = useState("sftp.example.com");
  const [uniPort, setUniPort] = useState("22");
  const [uniUser, setUniUser] = useState("");
  const [uniPass, setUniPass] = useState("");
  const [uniAuth, setUniAuth] = useState("Password");
  const [uniSshKey, setUniSshKey] = useState("");
  const [uniTrust, setUniTrust] = useState(true);
  const [uniDir837, setUniDir837] = useState("");
  const [uniDir835, setUniDir835] = useState("");
  const [uniDirMir, setUniDirMir] = useState("");
  const [showUniPass, setShowUniPass] = useState(false);

  // Credentials Memory Refs (persists even if input is emptied after test)
  const lastUniPassRef = useRef("");
  const lastUniSshKeyRef = useRef("");
  const lastInPassRef = useRef("");
  const lastOutPassRef = useRef("");

  // Dual Mode State - Inbound
  const [inHost, setInHost] = useState("inbound.sftp.example.com");
  const [inPort, setInPort] = useState("22");
  const [inUser, setInUser] = useState("");
  const [inPass, setInPass] = useState("");
  const [inAuth, setInAuth] = useState("Password");
  const [inDir837, setInDir837] = useState("");
  const [inDir835, setInDir835] = useState("");
  const [showInPass, setShowInPass] = useState(false);

  // Dual Mode State - Outbound
  const [outHost, setOutHost] = useState("outbound.sftp.example.com");
  const [outPort, setOutPort] = useState("22");
  const [outUser, setOutUser] = useState("");
  const [outPass, setOutPass] = useState("");
  const [outAuth, setOutAuth] = useState("Password");
  const [outDirMir, setOutDirMir] = useState("");
  const [showOutPass, setShowOutPass] = useState(false);

  // Batch Test State
  const [startingBatch, setStartingBatch] = useState(false);
  const [batchAlert, setBatchAlert] = useState(null);

  const handleStartBatchConversion = async () => {
    setStartingBatch(true);
    setBatchAlert(null);
    try {
      const res = await fetch("/api/start-batch-conversion/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        setBatchAlert({
          type: "success",
          message: data.message || `✓ Batch processing completed! Processed ${data.processed_count} files.`,
        });
        if (onRefreshSftp) onRefreshSftp();
      } else {
        setBatchAlert({
          type: "error",
          message: data.error || "Batch conversion failed.",
        });
      }
    } catch (err) {
      setBatchAlert({
        type: "error",
        message: err.message,
      });
    } finally {
      setStartingBatch(false);
    }
  };

  const [testingUni, setTestingUni] = useState(false);
  const [testingIn, setTestingIn] = useState(false);
  const [testingOut, setTestingOut] = useState(false);

  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (activeConfig) {
      setSameServer(activeConfig.use_same_server !== false);
      if (activeConfig.use_same_server !== false) {
        if (activeConfig.host) setUniHost(activeConfig.host);
        if (activeConfig.port) setUniPort(String(activeConfig.port));
        if (activeConfig.username) setUniUser(activeConfig.username);
        if (activeConfig.auth_method) setUniAuth(activeConfig.auth_method);
        if (activeConfig.inbound_837_folder) setUniDir837(activeConfig.inbound_837_folder);
        if (activeConfig.inbound_835_folder) setUniDir835(activeConfig.inbound_835_folder);
        if (activeConfig.outbound_mir_folder) setUniDirMir(activeConfig.outbound_mir_folder);
      } else {
        if (activeConfig.host) setInHost(activeConfig.host);
        if (activeConfig.port) setInPort(String(activeConfig.port));
        if (activeConfig.username) setInUser(activeConfig.username);
        if (activeConfig.inbound_837_folder) setInDir837(activeConfig.inbound_837_folder);
        if (activeConfig.inbound_835_folder) setInDir835(activeConfig.inbound_835_folder);

        if (activeConfig.outbound_host) setOutHost(activeConfig.outbound_host);
        if (activeConfig.outbound_port) setOutPort(String(activeConfig.outbound_port));
        if (activeConfig.outbound_username) setOutUser(activeConfig.outbound_username);
        if (activeConfig.outbound_mir_folder) setOutDirMir(activeConfig.outbound_mir_folder);
      }
    }
  }, [activeConfig]);

  const handleFileUpload = (e, setter, ref) => {
    if (!e.target.files || !e.target.files.length) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      setter(evt.target.result);
      if (ref) ref.current = evt.target.result;
    };
    reader.readAsText(file);
  };

  const handleTestSaveUnified = async () => {
    setTestingUni(true);
    setTestResult(null);

    const activePass = uniPass || lastUniPassRef.current;
    const activeKey = uniSshKey || lastUniSshKeyRef.current;

    const payload = {
      host: uniHost,
      port: parseInt(uniPort || "22", 10),
      username: uniUser,
      password: activePass,
      ssh_key: activeKey,
      auth_method: uniAuth,
      trust_unknown_key: uniTrust,
      inbound_837_folder: uniDir837,
      inbound_835_folder: uniDir835,
      outbound_mir_folder: uniDirMir,
    };

    // Keep activePass and activeKey in memory before clearing inputs
    if (uniPass) lastUniPassRef.current = uniPass;
    if (uniSshKey) lastUniSshKeyRef.current = uniSshKey;

    // Clear input fields for security
    setUniPass("");
    setUniSshKey("");

    try {
      const res = await fetch("/api/sftp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setTestResult(data);

      if (data.success) {
        alert("✓ SFTP connection successful");
        await fetch("/edi835/api/sftp/save/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            password: payload.password,
            ssh_key: payload.ssh_key,
            use_same_server: true,
            connection_type: "UNIFIED",
          }),
        });
        if (onRefreshSftp) onRefreshSftp();
      } else {
        alert("✕ " + (data.error || "SFTP connection failed"));
        await fetch("/edi835/api/sftp/save/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            password: payload.password,
            ssh_key: payload.ssh_key,
            use_same_server: true,
            connection_type: "UNIFIED",
          }),
        });
        if (onRefreshSftp) onRefreshSftp();
      }
    } catch (e) {
      alert("✕ Unable to connect to SFTP server");
    } finally {
      setTestingUni(false);
    }
  };


  const handleTestSaveDual = async (type) => {
    if (type === "inbound") setTestingIn(true);
    else setTestingOut(true);

    const payload = {
      use_same_server: false,
      connection_type: type === "inbound" ? "INBOUND" : "OUTBOUND",
      host: inHost,
      port: parseInt(inPort || "22", 10),
      username: inUser,
      password: inPass,
      auth_method: inAuth,
      inbound_837_folder: inDir837,
      inbound_835_folder: inDir835,

      outbound_host: outHost,
      outbound_port: parseInt(outPort || "22", 10),
      outbound_username: outUser,
      outbound_password: outPass,
      outbound_auth_method: outAuth,
      outbound_mir_folder: outDirMir,
    };

    setInPass("");
    setOutPass("");

    try {
      const res = await fetch("/edi835/api/sftp/save/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.connected) {
        alert("✓ " + data.message);
      } else {
        alert("❌ SFTP Connection Error:\n\n" + (data.error || "Connection failed."));
      }

      if (onRefreshSftp) onRefreshSftp();
    } catch (e) {
      alert("❌ Error performing SFTP connection test.");
    } finally {
      if (type === "inbound") setTestingIn(false);
      else setTestingOut(false);
    }
  };

  const handleDeleteConfig = async (id) => {
    if (!window.confirm("Delete this SFTP connection configuration from database?")) return;
    try {
      await fetch("/edi835/api/sftp/delete/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config_id: id }),
      });
      if (onRefreshSftp) onRefreshSftp();
    } catch (e) {
      console.warn("Failed to delete config:", e);
    }
  };

  const activeBadgeText = activeConfig ? activeConfig.status || "CONFIGURED" : "NOT CONFIGURED";
  const activeBadgeClass = activeConfig
    ? activeConfig.status === "CONNECTED"
      ? "ok"
      : activeConfig.status === "FAILED"
      ? "bad"
      : "work"
    : "";

  return (
    <section className="view on" id="v-conn">
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "4px" }}>
        <h1 style={{ margin: 0 }}>Connections</h1>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "var(--ink-3)",
            textTransform: "uppercase",
          }}
        >
          SFTP CONFIGURATION
        </span>
      </div>
      <p className="sub" style={{ marginTop: "4px", marginBottom: "20px" }}>
        Connect to the client SFTP, verify the remote folders, and reuse the saved paths on the Flow
        screen. Credentials are encrypted locally and are never returned to the browser.
      </p>

      {/* CHECKBOX CONTROL FOR SINGLE / SEPARATE SFTP SERVERS */}
      <div
        className="card"
        style={{
          padding: "14px 20px",
          marginBottom: "20px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontWeight: 600,
            fontSize: "13px",
            color: "var(--ink-1)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={sameServer}
            onChange={(e) => setSameServer(e.target.checked)}
            style={{ width: "16px", height: "16px", cursor: "pointer" }}
          />
          <span>Same SFTP server for Inbound and Outbound connections</span>
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "20px",
          marginBottom: "24px",
        }}
      >
        {/* LEFT COLUMN: SETUP BOX (UNIFIED OR DUAL) */}
        <div>
          {sameServer ? (
            /* UNIFIED SFTP SETUP BOX */
            <div className="card" style={{ padding: "24px", position: "relative" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                    SFTP connection
                  </h2>
                  <div className="eyebrow" style={{ marginTop: "2px" }}>
                    CLAIMS INPUT AND MPL OUTPUT
                  </div>
                </div>
                <span className={`tag ${activeBadgeClass}`} style={{ fontWeight: 700 }}>
                  {activeBadgeText}
                </span>
              </div>

              {/* Host Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "3fr 1fr 2fr 2fr",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--ink-2)",
                      marginBottom: "4px",
                    }}
                  >
                    Host
                  </label>
                  <input
                    type="text"
                    value={uniHost}
                    onChange={(e) => setUniHost(e.target.value)}
                    placeholder="sftp.example.com"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      fontSize: "12px",
                      border: "1px solid var(--line)",
                      borderRadius: "4px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--ink-2)",
                      marginBottom: "4px",
                    }}
                  >
                    Port
                  </label>
                  <input
                    type="text"
                    value={uniPort}
                    onChange={(e) => setUniPort(e.target.value)}
                    placeholder="22"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      fontSize: "12px",
                      border: "1px solid var(--line)",
                      borderRadius: "4px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--ink-2)",
                      marginBottom: "4px",
                    }}
                  >
                    Username
                  </label>
                  <input
                    type="text"
                    value={uniUser}
                    onChange={(e) => setUniUser(e.target.value)}
                    placeholder="username"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      fontSize: "12px",
                      border: "1px solid var(--line)",
                      borderRadius: "4px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--ink-2)",
                      marginBottom: "4px",
                    }}
                  >
                    Authentication
                  </label>
                  <select
                    value={uniAuth}
                    onChange={(e) => setUniAuth(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      fontSize: "12px",
                      border: "1px solid var(--line)",
                      borderRadius: "4px",
                    }}
                  >
                    <option value="Password">Password</option>
                    <option value="SSH Key">SSH Key</option>
                    <option value="SSH Key + Password">SSH Key + Password</option>
                  </select>
                </div>
              </div>

              {/* Password Container */}
              {(uniAuth === "Password" || uniAuth === "SSH Key + Password") && (
                <div style={{ marginBottom: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--ink-2)",
                      marginBottom: "4px",
                    }}
                  >
                    Password
                  </label>
                  <div className="pass-wrapper">
                    <input
                      type={showUniPass ? "text" : "password"}
                      value={uniPass}
                      onChange={(e) => setUniPass(e.target.value)}
                      placeholder="Password"
                      autoComplete="new-password"
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        fontSize: "12px",
                        border: "1px solid var(--line)",
                        borderRadius: "4px",
                      }}
                    />
                    <button
                      type="button"
                      className="pass-toggle-btn"
                      onMouseDown={() => setShowUniPass(true)}
                      onMouseUp={() => setShowUniPass(false)}
                      onMouseLeave={() => setShowUniPass(false)}
                      onTouchStart={() => setShowUniPass(true)}
                      onTouchEnd={() => setShowUniPass(false)}
                      title="Hold to see password"
                      style={{ color: showUniPass ? "var(--teal)" : "var(--ink-3)" }}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* SSH Key Container */}
              {(uniAuth === "SSH Key" || uniAuth === "SSH Key + Password") && (
                <div style={{ marginBottom: "16px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "4px",
                    }}
                  >
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink-2)" }}>
                      SSH Key
                    </label>
                    <label
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--teal)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        border: "1px solid var(--teal)",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        background: "var(--surface)",
                      }}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <span>Upload Key File</span>
                      <input
                        type="file"
                        accept=".pem,.key,id_rsa,id_ed25519,*/*"
                        style={{ display: "none" }}
                        onChange={(e) => handleFileUpload(e, setUniSshKey)}
                      />
                    </label>
                  </div>
                  <textarea
                    rows="3"
                    value={uniSshKey}
                    onChange={(e) => setUniSshKey(e.target.value)}
                    placeholder="e.g. -----BEGIN OPENSSH PRIVATE KEY----- or C:\path\to\id_ed25519"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      fontSize: "11px",
                      fontFamily: "var(--display)",
                      border: "1px solid var(--line)",
                      borderRadius: "4px",
                      resize: "vertical",
                      marginTop: 0,
                    }}
                  ></textarea>
                </div>
              )}

              {/* Trust Key */}
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "12px",
                    color: "var(--ink-2)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={uniTrust}
                    onChange={(e) => setUniTrust(e.target.checked)}
                  />
                  <span>Trust an unknown host key during this local POC</span>
                </label>
              </div>

              {/* Directories with Browse Buttons */}
              <div style={{ marginBottom: "14px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--ink-2)",
                    marginBottom: "4px",
                  }}
                >
                  837 reference inbound folder (.837 / .x12){" "}
                  <span style={{ color: "var(--ink-3)", fontWeight: "normal" }}>optional</span>
                </label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="text"
                    value={uniDir837}
                    onChange={(e) => setUniDir837(e.target.value)}
                    placeholder="e.g. /inbound/837/"
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      fontSize: "12px",
                      border: "1px solid var(--line)",
                      borderRadius: "4px",
                    }}
                  />
                  <button
                    type="button"
                    className="btn secondary"
                    style={{
                      padding: "7px 10px",
                      color: "var(--teal)",
                      borderColor: "var(--teal)",
                    }}
                    title="Browse Remote SFTP Folder"
                    onClick={() =>
                      onOpenSftpBrowser({
                        initialPath: uniDir837,
                        onSelectFolder: (p) => setUniDir837(p),
                        host: uniHost,
                        port: uniPort,
                        user: uniUser,
                        pass: uniPass || lastUniPassRef.current,
                        sshKey: uniSshKey || lastUniSshKeyRef.current,
                        auth: uniAuth,
                      })
                    }
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--ink-2)",
                    marginBottom: "4px",
                  }}
                >
                  835 inbound folder (.835 / .x12 source)
                </label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="text"
                    value={uniDir835}
                    onChange={(e) => setUniDir835(e.target.value)}
                    placeholder="e.g. /inbound/835/"
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      fontSize: "12px",
                      border: "1px solid var(--line)",
                      borderRadius: "4px",
                    }}
                  />
                  <button
                    type="button"
                    className="btn secondary"
                    style={{
                      padding: "7px 10px",
                      color: "var(--teal)",
                      borderColor: "var(--teal)",
                    }}
                    title="Browse Remote SFTP Folder"
                    onClick={() =>
                      onOpenSftpBrowser({
                        initialPath: uniDir835,
                        onSelectFolder: (p) => setUniDir835(p),
                        host: uniHost,
                        port: uniPort,
                        user: uniUser,
                        pass: uniPass || lastUniPassRef.current,
                        sshKey: uniSshKey || lastUniSshKeyRef.current,
                        auth: uniAuth,
                      })
                    }
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--ink-2)",
                    marginBottom: "4px",
                  }}
                >
                  MIR outbound folder (.mir output destination)
                </label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="text"
                    value={uniDirMir}
                    onChange={(e) => setUniDirMir(e.target.value)}
                    placeholder="e.g. /outbound/mir/"
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      fontSize: "12px",
                      border: "1px solid var(--line)",
                      borderRadius: "4px",
                    }}
                  />
                  <button
                    type="button"
                    className="btn secondary"
                    style={{
                      padding: "7px 10px",
                      color: "var(--teal)",
                      borderColor: "var(--teal)",
                    }}
                    title="Browse Remote SFTP Folder"
                    onClick={() =>
                      onOpenSftpBrowser({
                        initialPath: uniDirMir,
                        onSelectFolder: (p) => setUniDirMir(p),
                        host: uniHost,
                        port: uniPort,
                        user: uniUser,
                        pass: uniPass || lastUniPassRef.current,
                        sshKey: uniSshKey || lastUniSshKeyRef.current,
                        auth: uniAuth,
                      })
                    }
                  >

                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  type="button"
                  className="btn primary"
                  style={{ padding: "9px 18px", fontSize: "12.5px", fontWeight: 600 }}
                  onClick={handleTestSaveUnified}
                  disabled={testingUni}
                >
                  {testingUni ? "Connecting..." : "Test & save connection"}
                </button>
                <button
                  type="button"
                  className="btn-gray"
                  style={{ padding: "9px 18px", fontSize: "12.5px", fontWeight: 600 }}
                  onClick={handleStartBatchConversion}
                  disabled={startingBatch}
                  title="Test SFTP Inbound Batch: Reads files from inbound SFTP folder, validates, archives, converts to MIR, uploads to outbound SFTP, and deletes original file from inbound SFTP."
                >
                  {startingBatch ? "Testing..." : "Test"}
                </button>
              </div>

              {batchAlert && (
                <div
                  className={`status-banner ${batchAlert.type === "success" ? "valid" : "invalid"}`}
                  style={{ marginTop: "14px" }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "13px" }}>
                      {batchAlert.type === "success" ? "✓ SFTP Inbound Batch Pipeline Executed" : "✕ Batch Error"}
                    </div>
                    <div style={{ fontSize: "12px", marginTop: "2px" }}>
                      {batchAlert.message}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* DUAL SFTP SETUP BOXES */
            <div>
              {/* Inbound Box */}
              <div className="card" style={{ padding: "20px", marginBottom: "20px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "14px",
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>
                      Inbound SFTP connection
                    </h2>
                    <div className="eyebrow" style={{ marginTop: "2px" }}>
                      CLAIMS & 837 INBOUND SOURCE
                    </div>
                  </div>
                  <span className="tag ok">CONFIGURED</span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "3fr 1fr 2fr 2fr",
                    gap: "10px",
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--ink-2)",
                        marginBottom: "4px",
                      }}
                    >
                      Inbound Host
                    </label>
                    <input
                      type="text"
                      value={inHost}
                      onChange={(e) => setInHost(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 9px",
                        fontSize: "12px",
                        border: "1px solid var(--line)",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--ink-2)",
                        marginBottom: "4px",
                      }}
                    >
                      Port
                    </label>
                    <input
                      type="text"
                      value={inPort}
                      onChange={(e) => setInPort(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 9px",
                        fontSize: "12px",
                        border: "1px solid var(--line)",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--ink-2)",
                        marginBottom: "4px",
                      }}
                    >
                      Username
                    </label>
                    <input
                      type="text"
                      value={inUser}
                      onChange={(e) => setInUser(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 9px",
                        fontSize: "12px",
                        border: "1px solid var(--line)",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--ink-2)",
                        marginBottom: "4px",
                      }}
                    >
                      Authentication
                    </label>
                    <select
                      value={inAuth}
                      onChange={(e) => setInAuth(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 9px",
                        fontSize: "12px",
                        border: "1px solid var(--line)",
                        borderRadius: "4px",
                      }}
                    >
                      <option value="Password">Password</option>
                      <option value="SSH Key">SSH Key</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--ink-2)",
                      marginBottom: "4px",
                    }}
                  >
                    Password
                  </label>
                  <div className="pass-wrapper">
                    <input
                      type={showInPass ? "text" : "password"}
                      value={inPass}
                      onChange={(e) => setInPass(e.target.value)}
                      placeholder="Enter SFTP password"
                      style={{
                        width: "100%",
                        padding: "7px 9px",
                        fontSize: "12px",
                        border: "1px solid var(--line)",
                        borderRadius: "4px",
                      }}
                    />
                    <button
                      type="button"
                      className="pass-toggle-btn"
                      onMouseDown={() => setShowInPass(true)}
                      onMouseUp={() => setShowInPass(false)}
                      onMouseLeave={() => setShowInPass(false)}
                      onTouchStart={() => setShowInPass(true)}
                      onTouchEnd={() => setShowInPass(false)}
                      title="Hold to see password"
                      style={{ color: showInPass ? "var(--teal)" : "var(--ink-3)" }}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--ink-2)",
                      marginBottom: "4px",
                    }}
                  >
                    837 reference inbound folder optional
                  </label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="text"
                      value={inDir837}
                      onChange={(e) => setInDir837(e.target.value)}
                      placeholder="e.g. /inbound/837/"
                      style={{
                        flex: 1,
                        padding: "7px 9px",
                        fontSize: "12px",
                        border: "1px solid var(--line)",
                        borderRadius: "4px",
                      }}
                    />
                    <button
                      type="button"
                      className="btn secondary"
                      style={{
                        padding: "6px 10px",
                        color: "var(--teal)",
                        borderColor: "var(--teal)",
                      }}
                      title="Browse Remote SFTP Folder"
                      onClick={() =>
                        onOpenSftpBrowser({
                          initialPath: inDir837,
                          onSelectFolder: (p) => setInDir837(p),
                          host: inHost,
                          port: inPort,
                          user: inUser,
                          pass: inPass || lastInPassRef.current,
                          sshKey: inSshKey || lastInSshKeyRef.current,
                          auth: inAuth,
                        })
                      }
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--ink-2)",
                      marginBottom: "4px",
                    }}
                  >
                    835 inbound folder
                  </label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="text"
                      value={inDir835}
                      onChange={(e) => setInDir835(e.target.value)}
                      placeholder="e.g. /inbound/835/"
                      style={{
                        flex: 1,
                        padding: "7px 9px",
                        fontSize: "12px",
                        border: "1px solid var(--line)",
                        borderRadius: "4px",
                      }}
                    />
                    <button
                      type="button"
                      className="btn secondary"
                      style={{
                        padding: "6px 10px",
                        color: "var(--teal)",
                        borderColor: "var(--teal)",
                      }}
                      title="Browse Remote SFTP Folder"
                      onClick={() =>
                        onOpenSftpBrowser({
                          initialPath: inDir835,
                          onSelectFolder: (p) => setInDir835(p),
                          host: inHost,
                          port: inPort,
                          user: inUser,
                          pass: inPass || lastInPassRef.current,
                          sshKey: inSshKey || lastInSshKeyRef.current,
                          auth: inAuth,
                        })
                      }
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn primary"
                  style={{ padding: "8px 16px", fontSize: "12px" }}
                  onClick={() => handleTestSaveDual("inbound")}
                  disabled={testingIn}
                >
                  {testingIn ? "Testing live connection..." : "Test & save inbound connection"}
                </button>
              </div>

              {/* Outbound Box */}
              <div className="card" style={{ padding: "20px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "14px",
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>
                      Outbound SFTP connection
                    </h2>
                    <div className="eyebrow" style={{ marginTop: "2px" }}>
                      MIR OUTBOUND DESTINATION
                    </div>
                  </div>
                  <span className="tag ok">CONFIGURED</span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "3fr 1fr 2fr 2fr",
                    gap: "10px",
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--ink-2)",
                        marginBottom: "4px",
                      }}
                    >
                      Outbound Host
                    </label>
                    <input
                      type="text"
                      value={outHost}
                      onChange={(e) => setOutHost(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 9px",
                        fontSize: "12px",
                        border: "1px solid var(--line)",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--ink-2)",
                        marginBottom: "4px",
                      }}
                    >
                      Port
                    </label>
                    <input
                      type="text"
                      value={outPort}
                      onChange={(e) => setOutPort(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 9px",
                        fontSize: "12px",
                        border: "1px solid var(--line)",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--ink-2)",
                        marginBottom: "4px",
                      }}
                    >
                      Username
                    </label>
                    <input
                      type="text"
                      value={outUser}
                      onChange={(e) => setOutUser(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 9px",
                        fontSize: "12px",
                        border: "1px solid var(--line)",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--ink-2)",
                        marginBottom: "4px",
                      }}
                    >
                      Authentication
                    </label>
                    <select
                      value={outAuth}
                      onChange={(e) => setOutAuth(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 9px",
                        fontSize: "12px",
                        border: "1px solid var(--line)",
                        borderRadius: "4px",
                      }}
                    >
                      <option value="Password">Password</option>
                      <option value="SSH Key">SSH Key</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--ink-2)",
                      marginBottom: "4px",
                    }}
                  >
                    Password
                  </label>
                  <div className="pass-wrapper">
                    <input
                      type={showOutPass ? "text" : "password"}
                      value={outPass}
                      onChange={(e) => setOutPass(e.target.value)}
                      placeholder="Enter SFTP password"
                      style={{
                        width: "100%",
                        padding: "7px 9px",
                        fontSize: "12px",
                        border: "1px solid var(--line)",
                        borderRadius: "4px",
                      }}
                    />
                    <button
                      type="button"
                      className="pass-toggle-btn"
                      onMouseDown={() => setShowOutPass(true)}
                      onMouseUp={() => setShowOutPass(false)}
                      onMouseLeave={() => setShowOutPass(false)}
                      onTouchStart={() => setShowOutPass(true)}
                      onTouchEnd={() => setShowOutPass(false)}
                      title="Hold to see password"
                      style={{ color: showOutPass ? "var(--teal)" : "var(--ink-3)" }}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--ink-2)",
                      marginBottom: "4px",
                    }}
                  >
                    MIR outbound folder
                  </label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="text"
                      value={outDirMir}
                      onChange={(e) => setOutDirMir(e.target.value)}
                      placeholder="e.g. /outbound/mir/"
                      style={{
                        flex: 1,
                        padding: "7px 9px",
                        fontSize: "12px",
                        border: "1px solid var(--line)",
                        borderRadius: "4px",
                      }}
                    />
                    <button
                      type="button"
                      className="btn secondary"
                      style={{
                        padding: "6px 10px",
                        color: "var(--teal)",
                        borderColor: "var(--teal)",
                      }}
                      title="Browse Remote SFTP Folder"
                      onClick={() =>
                        onOpenSftpBrowser({
                          initialPath: outDirMir,
                          onSelectFolder: (p) => setOutDirMir(p),
                          host: outHost,
                          port: outPort,
                          user: outUser,
                          pass: outPass || lastOutPassRef.current,
                          sshKey: outSshKey || lastOutSshKeyRef.current,
                          auth: outAuth,
                        })
                      }
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn primary"
                  style={{ padding: "8px 16px", fontSize: "12px" }}
                  onClick={() => handleTestSaveDual("outbound")}
                  disabled={testingOut}
                >
                  {testingOut
                    ? "Testing live connection..."
                    : "Test & save outbound connection"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: AVAILABLE REMOTE FOLDERS */}
        <div>
          <div className="card" style={{ padding: "20px", height: "100%" }}>
            <h2 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>
              Available remote folders
            </h2>
            <div className="eyebrow" style={{ marginTop: "2px", marginBottom: "14px" }}>
              VISIBLE AFTER A SUCCESSFUL CONNECTION TEST
            </div>

            <div
              id="sftpDiscoveredFoldersBox"
              style={{
                background: "var(--surface)",
                border: "1px dashed var(--line)",
                borderRadius: "6px",
                padding: "20px 16px",
                fontSize: "12px",
                color: "var(--ink-3)",
                minHeight: "140px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              {testResult && testResult.success ? (
                <div style={{ textAlign: "left", width: "100%" }}>
                  <div
                    style={{ fontWeight: 600, color: "var(--teal)", marginBottom: "8px" }}
                  >
                    ✓ SFTP Connection Successful
                  </div>
                  <div
                    style={{
                      padding: "4px 0",
                      marginBottom: "6px",
                      borderBottom: "1px solid var(--line)",
                      color: "var(--ink-1)",
                    }}
                  >
                    📍 Remote Working Dir (pwd): <code>{testResult.pwd || "/"}</code>
                  </div>
                  <div
                    style={{
                      fontWeight: 600,
                      margin: "6px 0 4px 0",
                      fontSize: "11.5px",
                      color: "var(--ink-2)",
                    }}
                  >
                    Available Remote Folders on Server:
                  </div>
                  {testResult.remote_folders && testResult.remote_folders.length > 0 ? (
                    testResult.remote_folders.map((rf, i) => (
                      <div
                        key={i}
                        style={{ padding: "4px 0", borderBottom: "1px solid var(--line)" }}
                      >
                        📁 <b>Directory:</b> <code>/{rf}/</code>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: "4px 0", color: "var(--ink-3)" }}>
                      No subdirectories found in remote working directory.
                    </div>
                  )}
                  {testResult.remote_files && testResult.remote_files.length > 0 && (
                    <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--ink-2)" }}>
                      <b>Discovered Files:</b>{" "}
                      {testResult.remote_files
                        .map((rf) => `${rf.name} (${rf.size}B)`)
                        .join(", ")}
                    </div>
                  )}
                </div>
              ) : testResult && !testResult.success ? (
                <div style={{ textAlign: "left", width: "100%" }}>
                  <div
                    style={{ fontWeight: 700, color: "var(--brick)", marginBottom: "8px" }}
                  >
                    ✕ {testResult.error || "SFTP connection failed"}
                  </div>
                  {testResult.troubleshooting && (
                    <div
                      style={{
                        marginTop: "10px",
                        paddingTop: "8px",
                        borderTop: "1px dashed var(--line)",
                        fontSize: "11px",
                        color: "var(--ink-2)",
                      }}
                    >
                      <b>Verify that:</b>
                      <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                        {testResult.troubleshooting.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : activeConfig && activeConfig.host ? (
                <div style={{ textAlign: "left", width: "100%" }}>
                  <div
                    style={{ fontWeight: 600, color: "var(--teal)", marginBottom: "8px" }}
                  >
                    ✓ Verified Active Remote Folders:
                  </div>
                  {activeConfig.inbound_835_folder && (
                    <div
                      style={{ padding: "4px 0", borderBottom: "1px solid var(--line)" }}
                    >
                      📁 835 Inbound (.835 / .x12):{" "}
                      <code>{activeConfig.inbound_835_folder}</code>
                    </div>
                  )}
                  {activeConfig.inbound_837_folder && (
                    <div
                      style={{ padding: "4px 0", borderBottom: "1px solid var(--line)" }}
                    >
                      📁 837 Reference (.837 / .x12):{" "}
                      <code>{activeConfig.inbound_837_folder}</code>
                    </div>
                  )}
                  {activeConfig.outbound_mir_folder && (
                    <div style={{ padding: "4px 0" }}>
                      📁 MIR Outbound (.mir):{" "}
                      <code>{activeConfig.outbound_mir_folder}</code>
                    </div>
                  )}
                </div>
              ) : (
                "No successful SFTP test yet."
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SAVED SFTP CONNECTIONS DATA TABLE */}
      <div className="card" style={{ padding: "20px", marginBottom: "20px" }}>
        <div style={{ marginBottom: "14px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>
            Configured SFTP Connections Database
          </h2>
          <div className="eyebrow" style={{ marginTop: "2px" }}>
            SAVED CLIENT CONNECTION PATHS
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="datatable" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>TYPE</th>
                <th>HOST & PORT</th>
                <th>USERNAME</th>
                <th>835 INBOUND PATH</th>
                <th>MIR OUTBOUND PATH</th>
                <th>STATUS</th>
                <th>LAST TESTED</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {!sftpConfigs || sftpConfigs.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    style={{ padding: "20px", textAlign: "center", color: "var(--ink-3)" }}
                  >
                    No SFTP connections saved yet.
                  </td>
                </tr>
              ) : (
                sftpConfigs.map((c) => {
                  let typeStr = "UNIFIED";
                  if (c.connection_type === "INBOUND") typeStr = "INBOUND";
                  else if (c.connection_type === "OUTBOUND") typeStr = "OUTBOUND";
                  else if (c.use_same_server) typeStr = "UNIFIED";
                  else typeStr = "DUAL (IN/OUT)";

                  const hostPort = `${c.host}:${c.port}`;
                  const lastTested = c.last_tested_at || "—";
                  const status = c.status || "CONFIGURED";
                  const tagClass =
                    status === "FAILED"
                      ? "bad"
                      : status === "PENDING"
                      ? "work"
                      : "ok";

                  const inPath =
                    c.connection_type === "OUTBOUND" ? "—" : c.inbound_835_folder || "—";
                  const outPath =
                    c.connection_type === "INBOUND" ? "—" : c.outbound_mir_folder || "—";

                  let statusTitle = "";
                  if (status === "CONNECTED") {
                    statusTitle = "CONNECTED: Active SFTP connection verified. Authentication and remote folder access succeeded.";
                  } else if (status === "PENDING") {
                    statusTitle = c.last_error
                      ? `PENDING: ${c.last_error}`
                      : "PENDING: Connection saved, waiting for test verification or active connection check.";
                  } else if (status === "FAILED") {
                    statusTitle = c.last_error
                      ? `FAILED: ${c.last_error}`
                      : "FAILED: SFTP connection test failed. Check host, port, credentials, or remote folder permissions.";
                  } else {
                    statusTitle = `${status}: Saved SFTP connection configuration status.`;
                  }

                  return (
                    <tr key={c.id}>
                      <td className="num" style={{ fontWeight: 600, fontSize: "11.5px" }}>
                        {typeStr}
                      </td>
                      <td className="num" style={{ fontWeight: 600, color: "var(--ink-1)" }}>
                        {hostPort}
                      </td>
                      <td className="num">{c.username || "anonymous"}</td>
                      <td className="num" style={{ color: "var(--ink-2)", fontSize: "11px" }}>
                        {inPath}
                      </td>
                      <td className="num" style={{ color: "var(--ink-2)", fontSize: "11px" }}>
                        {outPath}
                      </td>
                      <td>
                        <span
                          className={`tag ${tagClass}`}
                          style={{ cursor: "pointer" }}
                          title={statusTitle}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="num">{lastTested}</td>
                      <td
                        className="num"
                        style={{
                          fontSize: "11px",
                          display: "flex",
                          gap: "6px",
                          alignItems: "center",
                        }}
                      >
                        <button
                          onClick={() => handleDeleteConfig(c.id)}
                          className="btn secondary"
                          style={{
                            padding: "3px 8px",
                            fontSize: "10.5px",
                            color: "var(--brick)",
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CURRENT SCOPE NOTICE BOX */}
      <div
        style={{
          border: "1.5px dashed var(--line)",
          borderRadius: "8px",
          padding: "16px 20px",
          fontSize: "12px",
          color: "var(--ink-2)",
          background: "var(--surface)",
          lineHeight: 1.5,
        }}
      >
        <strong>Current scope.</strong> Manual upload on Conversions remains the active ingestion
        workflow. This screen establishes and verifies the real SFTP connection/folder configuration
        so watched-folder pickup and automated outbound delivery can use the same settings when we
        wire those jobs.
      </div>
    </section>
  );
}

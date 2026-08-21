import React, { useState, useEffect } from 'react';
import { safeFetchJson } from '../../utils/api';
import SftpBrowserModal from '../../components/SftpBrowserModal';

export default function ClientSftpModal({ clientId, onClose, onConfigured }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [configId, setConfigId] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authMethod, setAuthMethod] = useState('Password');

  const [inbound835, setInbound835] = useState('');
  const [inbound837, setInbound837] = useState('');
  const [outboundMir, setOutboundMir] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [connected, setConnected] = useState(false);

  // Password visibility state (hold to reveal)
  const [showPass, setShowPass] = useState(false);

  // SFTP Browser state
  const [browserState, setBrowserState] = useState(null);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await safeFetchJson(`/edi835/api/sftp/get/?client_id=${clientId}`);
        if (res.data && res.data.configurations) {
          const config = res.data.configurations.find(c => c.connection_type === 'UNIFIED') || res.data.active_config;
        if (config) {
            setConfigId(config.id || '');
            setHost(config.host || '');
            setPort(config.port ? String(config.port) : '22');
            setUsername(config.username || '');
            setAuthMethod(config.auth_method || 'Password');
            setInbound835(config.inbound_835_folder || '');
            setInbound837(config.inbound_837_folder || '');
            setOutboundMir(config.outbound_mir_folder || '');
            // Never pre-populate password from server — mark as already configured
            if (config.host && config.username) setConnected(true);
          }
        }
      } catch (err) {
        console.error("Failed to fetch SFTP config", err);
      } finally {
        setLoading(false);
      }
    }
    if (clientId) fetchConfig();
    else setLoading(false);
  }, [clientId]);

  const openBrowser = (currentVal, setter) => {
    setBrowserState({
      initialPath: currentVal || '/',
      host, port, user: username, pass: password, sshKey: '', auth: authMethod,
      onSelectFolder: (p) => { setter(p); setBrowserState(null); },
    });
  };

  const handleSaveConnection = async () => {
    if (!host.trim() || !username.trim()) {
      setErrorMsg('Host and Username are required.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const payload = {
        id: configId,
        client_id: clientId,
        use_same_server: true,
        connection_type: "UNIFIED",
        host,
        port: parseInt(port || "22", 10),
        username,
        password,
        auth_method: authMethod,
        inbound_835_folder: inbound835,
        inbound_837_folder: inbound837,
        outbound_mir_folder: outboundMir,
      };
      const res = await fetch("/edi835/api/sftp/save/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success || data.connected) {
        if (data.config_id) setConfigId(data.config_id);
        setSuccessMsg('Connection verified and saved! You can now configure the folders.');
        setPassword('');   // Clear password from UI after successful connection
        setConnected(true);
      } else {
        setErrorMsg(data.error || 'Failed to connect to SFTP server.');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePaths = async () => {
    if (!host.trim() || !username.trim()) {
      setErrorMsg('Host and Username are required.');
      return;
    }
    if (!inbound835.trim() || !outboundMir.trim()) {
      setErrorMsg('835 Inbound Folder and MIR Outbound Folder are required. Please select folders before saving.');
      return;
    }
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const payload = {
        id: configId,
        client_id: clientId,
        use_same_server: true,
        connection_type: "UNIFIED",
        host,
        port: parseInt(port || "22", 10),
        username,
        password,
        auth_method: authMethod,
        inbound_835_folder: inbound835,
        inbound_837_folder: inbound837,
        outbound_mir_folder: outboundMir,
      };
      const res = await fetch("/edi835/api/sftp/save/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success || data.connected) {
        if (data.config_id) setConfigId(data.config_id);
        setSuccessMsg('Folders verified and configuration complete!');
        if (onConfigured) {
          onConfigured({
            config_id: data.config_id || configId,
            host,
            port: parseInt(port || '22', 10),
            username,
            auth_method: authMethod,
            inbound_835_folder: inbound835,
            inbound_837_folder: inbound837,
            outbound_mir_folder: outboundMir,
            status: 'CONNECTED',
          });
        }
      } else {
        setErrorMsg(data.error || 'Failed to verify folders — connection test failed.');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const FolderBrowse = ({ label, value, onChange, setter }) => (
    <div>
      <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '11px', color: 'var(--ink-2, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ flex: 1, padding: '7px 9px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
        />
        <button
          type="button"
          title="Browse Remote SFTP Folder"
          onClick={() => openBrowser(value, setter)}
          style={{ padding: '7px 10px', background: 'var(--surface, #f8fafc)', border: '1px solid var(--teal, #0d9488)', borderRadius: '4px', cursor: 'pointer', color: 'var(--teal, #0d9488)', display: 'flex', alignItems: 'center' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 9998,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{
          background: '#fff', borderRadius: '10px', padding: '24px',
          width: '520px', maxWidth: '92%', boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
          display: 'flex', flexDirection: 'column', gap: '16px', color: '#0f172a',
          maxHeight: '90vh', overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '16px' }}>SFTP Configuration</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Client-specific — linked to this client only</div>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '22px', cursor: 'pointer', color: '#64748b', lineHeight: 1 }}>×</button>
          </div>

          {loading ? (
            <div style={{ color: '#64748b', fontSize: '13px' }}>Loading...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              {/* Connection */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '11px', color: 'var(--ink-2, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Host</label>
                  <input type="text" style={{ width: '100%', padding: '7px 9px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }} value={host} onChange={e => setHost(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '11px', color: 'var(--ink-2, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Port</label>
                  <input type="text" style={{ width: '100%', padding: '7px 9px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }} value={port} onChange={e => setPort(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '11px', color: 'var(--ink-2, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username</label>
                  <input type="text" style={{ width: '100%', padding: '7px 9px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }} value={username} onChange={e => setUsername(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '11px', color: 'var(--ink-2, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                  <div style={{ display: 'flex', position: 'relative', alignItems: 'center' }}>
                    <input
                      type={showPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder={connected && !password ? '●●●●●●●● (saved — enter new to change)' : ''}
                      style={{ width: '100%', padding: '7px 34px 7px 9px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box', background: connected && !password ? '#f8fafc' : '#fff' }}
                      value={password}
                      onChange={e => { setPassword(e.target.value); if (connected && e.target.value) setConnected(false); }}
                    />
                    <button
                      type="button"
                      title="Hold to reveal password"
                      onMouseDown={() => setShowPass(true)}
                      onMouseUp={() => setShowPass(false)}
                      onMouseLeave={() => setShowPass(false)}
                      onTouchStart={() => setShowPass(true)}
                      onTouchEnd={() => setShowPass(false)}
                      style={{ position: 'absolute', right: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: showPass ? 'var(--teal, #0d9488)' : '#94a3b8', display: 'flex', alignItems: 'center' }}
                    >
                      {showPass ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Save & Test Connection button before path selection */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-4px' }}>
                <button
                  type="button"
                  onClick={handleSaveConnection}
                  disabled={saving}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--teal, #0d9488)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  {saving ? 'Saving & Testing...' : 'Save & Test Connection'}
                </button>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <FolderBrowse label="835 Inbound Folder" value={inbound835} onChange={setInbound835} setter={setInbound835} />
                <FolderBrowse label="837 Reference Folder" value={inbound837} onChange={setInbound837} setter={setInbound837} />
                <FolderBrowse label="MIR Outbound Folder" value={outboundMir} onChange={setOutboundMir} setter={setOutboundMir} />
              </div>

              {errorMsg && <div style={{ color: '#ef4444', fontSize: '12px', background: '#fef2f2', padding: '8px 10px', borderRadius: '4px' }}>{errorMsg}</div>}
              {successMsg && <div style={{ color: '#16a34a', fontSize: '12px', background: '#f0fdf4', padding: '8px 10px', borderRadius: '4px' }}>✓ {successMsg}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}>
                <button onClick={onClose} style={{ padding: '8px 18px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '5px', cursor: 'pointer', fontSize: '13px' }}>Close</button>
                <button onClick={handleSavePaths} disabled={saving} style={{ padding: '8px 18px', background: 'var(--teal, #0d9488)', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                  {saving ? 'Saving Paths...' : 'Save Paths'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {browserState && (
        <SftpBrowserModal
          isOpen={!!browserState}
          initialPath={browserState.initialPath}
          sftpUniHost={browserState.host}
          sftpUniPort={browserState.port}
          sftpUniUser={browserState.user}
          sftpUniPass={browserState.pass}
          sftpUniSshKey={browserState.sshKey}
          sftpUniAuth={browserState.auth}
          onSelectFolder={browserState.onSelectFolder}
          onClose={() => setBrowserState(null)}
        />
      )}
    </>
  );
}


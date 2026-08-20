import React, { useState, useEffect } from 'react';
import ClientSelectDropdown from './ClientSelectDropdown';
import { fetchClientTestEnvironment, updateClientTestEnvironment, runClientSandboxTest } from '../services/api';

export default function TestEnvironmentView({ clients = [], activeClientId, onSelectClient }) {
  const [selectedClientId, setSelectedClientId] = useState(activeClientId || (clients[0]?.id || ''));
  const [testEnv, setTestEnv] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Editable settings
  const [sftpHost, setSftpHost] = useState('');
  const [watchedFolder, setWatchedFolder] = useState('');
  const [notes, setNotes] = useState('');

  const currentClient = clients.find(c => c.id === selectedClientId) || clients[0];

  useEffect(() => {
    if (activeClientId && activeClientId !== selectedClientId) {
      setSelectedClientId(activeClientId);
    }
  }, [activeClientId]);

  useEffect(() => {
    if (selectedClientId) {
      loadTestEnvironment(selectedClientId);
    }
  }, [selectedClientId]);

  async function loadTestEnvironment(clientId) {
    if (!clientId) return;
    setLoading(true);
    setErrorMessage('');
    try {
      const data = await fetchClientTestEnvironment(clientId);
      setTestEnv(data);
      setSftpHost(data.sftp_host || '');
      setWatchedFolder(data.watched_folder || '');
      setNotes(data.notes || '');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load test environment');
      setTestEnv(null);
    } finally {
      setLoading(false);
    }
  }

  function handleClientChange(e) {
    const newId = e.target.value;
    setSelectedClientId(newId);
    if (onSelectClient) {
      onSelectClient(newId);
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    if (!selectedClientId) return;
    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const updated = await updateClientTestEnvironment(selectedClientId, {
        sftp_host: sftpHost,
        watched_folder: watchedFolder,
        notes: notes
      });
      setTestEnv(updated);
      setSuccessMessage('Test environment configuration updated successfully.');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save test environment');
    } finally {
      setSaving(false);
    }
  }

  async function handleRunTest() {
    if (!selectedClientId) return;
    setTesting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await runClientSandboxTest(selectedClientId);
      setTestEnv(res.test_environment);
      setSuccessMessage('Sandbox 835-to-MIR conversion test verified successfully.');
    } catch (err) {
      setErrorMessage(err.message || 'Test execution failed');
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="view on" id="v-sandbox">
      <div className="hdr-row">
        <div>
          <div className="eyebrow">Integration Sandbox</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '2px 0 4px' }}>
            <ClientSelectDropdown
              clients={clients}
              value={selectedClientId}
              onChange={(val) => {
                setSelectedClientId(val);
                if (onSelectClient) {
                  onSelectClient(val);
                }
              }}
            />
            <h1 style={{ margin: 0 }}>Test Environment</h1>
          </div>
          <p className="sub">Isolated test environment for running 835 to MIR conversion verification for <b>{currentClient?.name}</b>.</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn primary"
            disabled={testing || loading || !selectedClientId}
            onClick={handleRunTest}
          >
            {testing ? 'Testing...' : '⚡ Run Sandbox Test'}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="note" style={{ background: 'var(--brick-bg)', borderColor: 'var(--brick)', color: 'var(--brick)' }}>
          <b>Error:</b> {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="good">
          ✓ {successMessage}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-3)' }}>
          Loading test environment for {currentClient?.name}...
        </div>
      ) : (
        <div className="cols">
          <div className="card">
            <h2>Isolation Controls</h2>
            <div className="eyebrow">Safe Conversion Sandbox</div>
            <div className="kv" style={{ marginTop: '9px' }}>
              <span className="k">Test SFTP</span>
              <span className="v">{testEnv?.sftp_host || 'sftp-test.onesmarter.internal'}</span>
            </div>
            <div className="kv">
              <span className="k">Watched Folder</span>
              <span className="v">{testEnv?.watched_folder || `/inbound/${selectedClientId}_835`}</span>
            </div>
            <div className="kv">
              <span className="k">MPL Delivery</span>
              <span className="v" style={{ color: 'var(--brick)' }}>Blocked in Test</span>
            </div>
            <div className="kv">
              <span className="k">Archive Retention</span>
              <span className="v">{testEnv?.archive_retention_days || 90} Days</span>
            </div>
            <div className="kv">
              <span className="k">Keys</span>
              <span className="v">{testEnv?.keys_status || 'Separate from Production'}</span>
            </div>
            <div className="kv">
              <span className="k">Sandbox Status</span>
              <span className="v"><span className={`tag ${testEnv?.test_status === 'Verified' ? 'ok' : 'work'}`}>{testEnv?.test_status || 'In Progress'}</span></span>
            </div>
          </div>

          <div className="card">
            <h2>External Mapping &amp; SFTP Integration</h2>
            <p>Steps 8 and 9 connect directly to external specialized applications for <b>{currentClient?.name}</b>:</p>
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn tiny primary"
                onClick={() => window.open(`/mapping?client=${encodeURIComponent(selectedClientId)}`, '_blank')}
              >
                Open Mapping App ↗
              </button>
              <button
                type="button"
                className="btn tiny"
                onClick={() => window.open(`/sftp?client=${encodeURIComponent(selectedClientId)}`, '_blank')}
              >
                Open SFTP App ↗
              </button>
            </div>

            <hr style={{ margin: '16px 0', borderColor: 'var(--line-soft)', borderStyle: 'solid', borderWidth: '1px 0 0 0' }} />

            <form onSubmit={handleSaveSettings}>
              <div className="field">
                <label>SFTP Host:</label>
                <input
                  type="text"
                  value={sftpHost}
                  onChange={e => setSftpHost(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Watched Folder:</label>
                <input
                  type="text"
                  value={watchedFolder}
                  onChange={e => setWatchedFolder(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Notes / Isolation Details:</label>
                <textarea
                  rows="2"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
              <button type="submit" className="btn tiny primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

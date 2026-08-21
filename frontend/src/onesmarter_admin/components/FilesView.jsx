import React, { useState, useEffect } from 'react';
import ClientSelectDropdown from './ClientSelectDropdown';
import { fetchClientEdiFiles } from '../services/api';

export default function FilesView({ clients = [], activeClientId, onSelectClient }) {
  const [selectedClientId, setSelectedClientId] = useState(activeClientId || (clients[0]?.id || ''));
  const [ediFiles, setEdiFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const currentClient = clients.find(c => c.id === selectedClientId) || clients[0];

  useEffect(() => {
    if (activeClientId && activeClientId !== selectedClientId) {
      setSelectedClientId(activeClientId);
    }
  }, [activeClientId]);

  useEffect(() => {
    if (selectedClientId) {
      loadEdiFiles(selectedClientId);
    }
  }, [selectedClientId]);

  async function loadEdiFiles(clientId) {
    if (!clientId) return;
    setLoading(true);
    setErrorMessage('');
    try {
      const files = await fetchClientEdiFiles(clientId);
      setEdiFiles(files);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load files');
      setEdiFiles([]);
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

  function getStatusColor(status) {
    switch (status) {
      case 'COMPLETED': return 'var(--green)';
      case 'ARCHIVED': return 'var(--blue)';
      case 'PROCESSING': return 'var(--orange)';
      case 'ERROR': return 'var(--brick)';
      default: return 'var(--ink-2)';
    }
  }

  return (
    <section className="view on" id="v-files">
      <div className="hdr-row">
        <div>
          <div className="eyebrow">Client Files</div>
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
            <h1 style={{ margin: 0 }}>Files</h1>
          </div>
          <p className="sub">Archived EDI 835 payload files and data extracts for <b>{currentClient?.name}</b>.</p>
        </div>
      </div>

      {errorMessage && (
        <div className="note" style={{ background: 'var(--brick-bg)', borderColor: 'var(--brick)', color: 'var(--brick)' }}>
          <b>Error:</b> {errorMessage}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-3)' }}>
          Loading archive files for {currentClient?.name}...
        </div>
      ) : ediFiles.length === 0 ? (
        <div className="stub" style={{ textAlign: 'center', padding: '36px' }}>
          <b>No EDI 835 files found in the archive for this client.</b>
          <p style={{ margin: '6px 0 0', color: 'var(--ink-2)' }}>
            Files dropped via SFTP or processed manually will appear here.
          </p>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: '25%' }}>Original Filename</th>
              <th style={{ width: '15%' }}>Status</th>
              <th style={{ width: '12%' }}>Claims</th>
              <th style={{ width: '12%' }}>Services</th>
              <th style={{ width: '12%' }}>Source</th>
              <th style={{ width: '24%' }}>Received On</th>
            </tr>
          </thead>
          <tbody>
            {ediFiles.map((file) => {
              const dateStr = file.uploaded_at ? new Date(file.uploaded_at).toLocaleString() : 'N/A';
              return (
                <tr key={file.id}>
                  <td>
                    <code style={{ fontSize: '11.5px', wordBreak: 'break-all', display: 'inline-block' }}>
                      {file.original_filename}
                    </code>
                  </td>
                  <td>
                    <span style={{ 
                      fontSize: '11px', 
                      fontWeight: 600, 
                      padding: '2px 6px', 
                      borderRadius: '4px',
                      background: `${getStatusColor(file.status)}20`,
                      color: getStatusColor(file.status)
                    }}>
                      {file.status}
                    </span>
                  </td>
                  <td className="num">{file.claims_count}</td>
                  <td className="num">{file.services_count}</td>
                  <td>{file.ingestion_source}</td>
                  <td>{dateStr}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

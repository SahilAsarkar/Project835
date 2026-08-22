import React, { useState, useEffect, useRef } from 'react';
import ClientSelectDropdown from './ClientSelectDropdown';
import { fetchClientDocuments, uploadClientDocument, downloadDocumentFile, fetchDocumentFile } from '../services/api';
import FileViewerModal from './modals/FileViewerModal';

export default function DocumentsView({ clients = [], activeClientId, onSelectClient }) {
  const [selectedClientId, setSelectedClientId] = useState(activeClientId || (clients[0]?.id || ''));
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [viewerFile, setViewerFile] = useState(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerDocTitle, setViewerDocTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const fileInputRef = useRef(null);

  const currentClient = clients.find(c => c.id === selectedClientId) || clients[0];

  useEffect(() => {
    if (activeClientId && activeClientId !== selectedClientId) {
      setSelectedClientId(activeClientId);
    }
  }, [activeClientId]);

  useEffect(() => {
    if (selectedClientId) {
      loadDocuments(selectedClientId);
    }
  }, [selectedClientId]);

  async function loadDocuments(clientId) {
    if (!clientId) return;
    setLoading(true);
    setErrorMessage('');
    try {
      const docs = await fetchClientDocuments(clientId);
      setDocuments(docs);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load documents');
      setDocuments([]);
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

  async function handleDownload(doc) {
    setDownloadingId(doc.id);
    setErrorMessage('');
    try {
      await downloadDocumentFile(doc.id, doc.original_filename);
    } catch (err) {
      setErrorMessage(`Failed to download ${doc.document_name}: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleView(doc) {
    setViewingId(doc.id);
    setErrorMessage('');
    try {
      const data = await fetchDocumentFile(doc.id, doc.original_filename);
      setViewerFile(data);
      setViewerDocTitle(doc.document_name);
      setIsViewerOpen(true);
    } catch (err) {
      setErrorMessage(`Failed to preview ${doc.document_name}: ${err.message}`);
    } finally {
      setViewingId(null);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !selectedClientId) return;

    setUploading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await uploadClientDocument(selectedClientId, file, file.name.replace(/\.[^/.]+$/, ''), 'General Document');
      setSuccessMessage(`Document '${file.name}' uploaded and registered successfully.`);
      await loadDocuments(selectedClientId);
    } catch (err) {
      setErrorMessage(err.message || 'Document upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  return (
    <section className="view on" id="v-docs">
      <div className="hdr-row">
        <div>
          <div className="eyebrow">Client Documents</div>
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
            <h1 style={{ margin: 0 }}>Documents &amp; Agreements</h1>
          </div>
          <p className="sub">Executed legal agreements, compliance certificates, and evidence files associated with <b>{currentClient?.name}</b>.</p>
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
          Loading documents for {currentClient?.name}...
        </div>
      ) : documents.length === 0 ? (
        <div className="stub" style={{ textAlign: 'center', padding: '36px' }}>
          <b>No documents available for this client.</b>
          <p style={{ margin: '6px 0 0', color: 'var(--ink-2)' }}>
            Upload legal agreements, compliance forms, or test data for {currentClient?.name} using the onboarding workflow.
          </p>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: '25%' }}>Document</th>
              <th style={{ width: '30%' }}>Template / Filename</th>
              <th style={{ width: '15%' }}>Category</th>
              <th style={{ width: '6%' }}>Format</th>
              <th style={{ width: '7%' }}>Size</th>
              <th style={{ width: '9%' }}>Uploaded By</th>
              <th style={{ width: '8%', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const ext = (doc.original_filename?.split('.').pop() || 'PDF').toUpperCase();
              return (
                <tr key={doc.id}>
                  <td>
                    <b>{doc.document_name}</b>
                  </td>
                  <td>
                    <code style={{ fontSize: '11.5px', wordBreak: 'break-all', display: 'inline-block' }}>
                      {doc.original_filename}
                    </code>
                  </td>
                  <td>{doc.document_type || 'Legal / Confidentiality'}</td>
                  <td>
                    <span className="mono" style={{ fontSize: '11px' }}>{ext}</span>
                  </td>
                  <td className="num">{formatBytes(doc.file_size)}</td>
                  <td>{doc.uploaded_by || 'Admin User'}</td>
                  <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn icon-btn view-btn"
                        onClick={() => handleView(doc)}
                        title={`View ${doc.document_name}`}
                        aria-label={`View ${doc.document_name}`}
                        disabled={viewingId === doc.id}
                      >
                        {viewingId === doc.id ? (
                          '…'
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
                            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn icon-btn download-btn"
                        disabled={downloadingId === doc.id}
                        onClick={() => handleDownload(doc)}
                        title={`Download ${doc.document_name}`}
                        aria-label={`Download ${doc.document_name}`}
                      >
                        {downloadingId === doc.id ? (
                          '…'
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
                            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <FileViewerModal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        fileData={viewerFile}
        stepTitle={viewerDocTitle}
        stepNum=""
      />
    </section>
  );
}

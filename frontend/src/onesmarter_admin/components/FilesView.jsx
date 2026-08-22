import React, { useState, useEffect } from 'react';
import ClientSelectDropdown from './ClientSelectDropdown';
import { fetchClientEdiFiles } from '../services/api';

export default function FilesView({ clients = [], activeClientId, onSelectClient }) {
  const [selectedClientId, setSelectedClientId] = useState(activeClientId || (clients[0]?.id || ''));
  const [ediFiles, setEdiFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showZipMenu, setShowZipMenu] = useState(false);

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

  const handleSortHeader = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  let filtered = ediFiles.filter((item) => {
    if (searchText) {
      const query = searchText.toLowerCase();
      const fullStr = (
        (item.id || '') + ' ' +
        (item.original_filename || '') + ' ' +
        (item.output_path || '')
      ).toLowerCase();
      if (!fullStr.includes(query)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    const mult = sortOrder === 'asc' ? 1 : -1;
    let valA, valB;
    if (sortKey === 'date') {
      valA = new Date(a.uploaded_at || 0).getTime();
      valB = new Date(b.uploaded_at || 0).getTime();
    } else if (sortKey === 'id') {
      valA = (a.id || '').toLowerCase();
      valB = (b.id || '').toLowerCase();
    } else if (sortKey === 'filename') {
      valA = (a.original_filename || '').toLowerCase();
      valB = (b.original_filename || '').toLowerCase();
    } else if (sortKey === 'claims') {
      valA = a.claims_count || 0;
      valB = b.claims_count || 0;
    } else if (sortKey === 'status') {
      valA = (a.status || '').toLowerCase();
      valB = (b.status || '').toLowerCase();
    } else if (sortKey === 'sftp') {
      valA = a.present_in_sftp ? 1 : 0;
      valB = b.present_in_sftp ? 1 : 0;
    } else {
      valA = 0; valB = 0;
    }
    if (valA < valB) return -1 * mult;
    if (valA > valB) return 1 * mult;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageIndex = Math.min(currentPage, totalPages);
  const startIndex = (pageIndex - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  // Metrics derived from ediFiles
  const conversionSets = ediFiles.length;
  const archivedCount = ediFiles.filter(f => f.status === 'ARCHIVED').length;
  const files835 = ediFiles.length;
  const validatedSets = ediFiles.filter(f => f.status !== 'ERROR').length;
  const processedSets = ediFiles.filter(f => f.status === 'ARCHIVED').length;
  const waitingFailed = ediFiles.filter(f => f.status === 'PROCESSING').length;
  const valFailed = ediFiles.filter(f => f.status === 'ERROR').length;

  return (
    <section className="view on" id="v-files">
      {/* HEADER ROW */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <h1 style={{ margin: 0 }}>Archive</h1>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
                ALL CONVERSION-SET HISTORY
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>Client:</span>
              <ClientSelectDropdown
                clients={clients}
                value={selectedClientId}
                onChange={(val) => {
                  setSelectedClientId(val);
                  setCurrentPage(1);
                  if (onSelectClient) onSelectClient(val);
                }}
              />
            </div>
          </div>
        </div>

        {/* ZIP ARCHIVE DOWNLOAD BUTTON */}
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            type="button"
            className="btn-gray"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              cursor: 'pointer',
            }}
            onClick={() => setShowZipMenu(!showZipMenu)}
            title="Export Archive to ZIP"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 8v13H3V8" />
              <path d="M1 3h22v5H1z" />
              <path d="M10 12h4" />
            </svg>
            <span>ZIP Archive</span>
            <span style={{ fontSize: '10px', marginLeft: '2px' }}>▼</span>
          </button>

          {showZipMenu && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: '6px',
              background: '#ffffff', border: '1px solid var(--line, #e2e8f0)',
              borderRadius: '6px', boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
              zIndex: 200, minWidth: '210px', overflow: 'hidden',
            }}>
              <a
                href={`/api/download-zip/?type=mir&client=${selectedClientId}`}
                style={{ display: 'block', padding: '10px 14px', fontSize: '12px', color: '#1e293b', textDecoration: 'none', borderBottom: '1px solid #f1f5f9', fontWeight: 500 }}
                onClick={() => setShowZipMenu(false)}
              >
                Download all MIR (.mir)
              </a>
              <a
                href={`/api/download-zip/?type=835&client=${selectedClientId}`}
                style={{ display: 'block', padding: '10px 14px', fontSize: '12px', color: '#1e293b', textDecoration: 'none', borderBottom: '1px solid #f1f5f9', fontWeight: 500 }}
                onClick={() => setShowZipMenu(false)}
              >
                Download all 835 (.x12 / .835)
              </a>
              <a
                href={`/api/download-zip/?type=both&client=${selectedClientId}`}
                style={{ display: 'block', padding: '10px 14px', fontSize: '12px', color: 'var(--teal, #0d9488)', fontWeight: 700, textDecoration: 'none' }}
                onClick={() => setShowZipMenu(false)}
              >
                Download Both (MIR &amp; 835)
              </a>
            </div>
          )}
        </div>
      </div>

      <p className="sub" style={{ marginTop: '4px', marginBottom: '20px' }}>
        One row represents one 835 conversion set for <b>{currentClient?.name || 'selected client'}</b>. The 835 input(s), optional 837 reference, MIR output, validation result, and processing result stay together.
      </p>

      {errorMessage && (
        <div className="note" style={{ background: 'var(--brick-bg)', borderColor: 'var(--brick)', color: 'var(--brick)', marginBottom: '16px' }}>
          <b>Error:</b> {errorMessage}
        </div>
      )}

      {/* 5 METRIC CARDS */}
      <div className="metrics" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <div className="metric">
          <div className="v">{conversionSets}</div>
          <div className="l">Conversion sets</div>
          <div className="d"><span>{archivedCount}</span> physical file seals stored</div>
        </div>
        <div className="metric">
          <div className="v">{files835}</div>
          <div className="l">835 files received</div>
          <div className="d">Across all conversion sets</div>
        </div>
        <div className="metric">
          <div className="v">0</div>
          <div className="l">837 references</div>
          <div className="d">Optional - reference only</div>
        </div>
        <div className="metric">
          <div className="v">{validatedSets}</div>
          <div className="l">Validated sets</div>
          <div className="d">835 validation passed</div>
        </div>
        <div className="metric">
          <div className="v">{processedSets}</div>
          <div className="l">Processed sets</div>
          <div className="d"><span>{waitingFailed}</span> waiting/failed – <span>{valFailed}</span> validation failed</div>
        </div>
      </div>

      {/* SEARCH BAR ROW */}
      <div className="filters-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <input
          type="text"
          placeholder="Search run, 835, 837, or MIR..."
          value={searchText}
          onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
          style={{ padding: '7px 12px', fontSize: '12px', border: '1px solid var(--line)', borderRadius: '4px', width: '280px' }}
        />
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-3)' }}>
          {filtered.length} sets
        </span>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-3)' }}>
          Loading archive files for {currentClient?.name}...
        </div>
      ) : (
        <>
          {/* ARCHIVE DATA TABLE */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="datatable" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th
                      className={`sortable ${sortKey === 'date' ? sortOrder : ''}`}
                      onClick={() => handleSortHeader('date')}
                      style={{ fontSize: '11px', letterSpacing: '0.05em' }}
                    >
                      835 DATE <span className="sort-arrow">{sortKey === 'date' ? (sortOrder === 'asc' ? '↑' : '↓') : '⇅'}</span>
                    </th>
                    <th
                      className={`sortable ${sortKey === 'id' ? sortOrder : ''}`}
                      onClick={() => handleSortHeader('id')}
                      style={{ fontSize: '11px', letterSpacing: '0.05em' }}
                    >
                      RUN <span className="sort-arrow">{sortKey === 'id' ? (sortOrder === 'asc' ? '↑' : '↓') : '⇅'}</span>
                    </th>
                    <th
                      className={`sortable ${sortKey === 'filename' ? sortOrder : ''}`}
                      onClick={() => handleSortHeader('filename')}
                      style={{ fontSize: '11px', letterSpacing: '0.05em' }}
                    >
                      835 INPUT <span className="sort-arrow">{sortKey === 'filename' ? (sortOrder === 'asc' ? '↑' : '↓') : '⇅'}</span>
                    </th>
                    <th style={{ fontSize: '11px', letterSpacing: '0.05em' }}>837 REF</th>
                    <th style={{ fontSize: '11px', letterSpacing: '0.05em' }}>MIR OUTPUT</th>
                    <th
                      className={`sortable ${sortKey === 'claims' ? sortOrder : ''}`}
                      onClick={() => handleSortHeader('claims')}
                      style={{ fontSize: '11px', letterSpacing: '0.05em' }}
                    >
                      CLAIMS <span className="sort-arrow">{sortKey === 'claims' ? (sortOrder === 'asc' ? '↑' : '↓') : '⇅'}</span>
                    </th>
                    <th
                      className={`sortable ${sortKey === 'sftp' ? sortOrder : ''}`}
                      onClick={() => handleSortHeader('sftp')}
                      style={{ fontSize: '11px', letterSpacing: '0.05em' }}
                    >
                      IMPORT MODE <span className="sort-arrow">{sortKey === 'sftp' ? (sortOrder === 'asc' ? '↑' : '↓') : '⇅'}</span>
                    </th>
                    <th style={{ fontSize: '11px', letterSpacing: '0.05em' }}>SFTP PUSH</th>
                    <th
                      className={`sortable ${sortKey === 'status' ? sortOrder : ''}`}
                      onClick={() => handleSortHeader('status')}
                      style={{ fontSize: '11px', letterSpacing: '0.05em' }}
                    >
                      STATUS <span className="sort-arrow">{sortKey === 'status' ? (sortOrder === 'asc' ? '↑' : '↓') : '⇅'}</span>
                    </th>
                    <th style={{ fontSize: '11px', letterSpacing: '0.05em' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-3)' }}>
                        {ediFiles.length === 0
                          ? 'No EDI 835 files found in the archive for this client.'
                          : 'No conversion sets match these filters.'}
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((f) => {
                      const upDate = f.uploaded_at ? f.uploaded_at.substring(0, 10) : '—';
                      const shortId = 'R-' + (f.id || '').substring(0, 6).toUpperCase();
                      const baseName = (f.original_filename || '').replace(/\.[^/.]+$/, '');
                      const mirName = 'MIR_' + baseName + '.mir';
                      const isProcessed = f.status === 'ARCHIVED';
                      const isSftpSuccess = Boolean(f.present_in_sftp);
                      const sftpStatusText = isSftpSuccess ? 'Success' : f.status === 'ERROR' ? 'Failed' : 'Pending';
                      const sftpTagClass = isSftpSuccess ? 'ok' : f.status === 'ERROR' ? 'bad' : 'work';

                      let displayStatus = '';
                      if (f.status === 'ARCHIVED') {
                        displayStatus = isSftpSuccess ? 'Validated & SFTP Success' : 'Validated & SFTP Pending';
                      } else if (f.status === 'PROCESSING') {
                        displayStatus = 'Validated & SFTP Pending';
                      } else if (f.status === 'ERROR') {
                        displayStatus = 'Validation Failed';
                      } else {
                        displayStatus = f.status + ' & SFTP ' + sftpStatusText;
                      }

                      const statusTagClass = f.status === 'ARCHIVED' ? 'ok' : f.status === 'ERROR' ? 'bad' : 'work';

                      const isSftpSource =
                        f.ingestion_source === 'SFTP' ||
                        (f.original_filename && f.original_filename.includes(',')) ||
                        (f.input_path && f.input_path.toLowerCase().includes('sftp'));
                      const sourceLabel = isSftpSource ? 'SFTP' : 'MANUAL';
                      const sourceTagClass = isSftpSource ? 'ok' : 'work';
                      const sourceTitle = isSftpSource
                        ? 'Ingested automatically from SFTP inbound folder'
                        : 'Uploaded manually via conversion form';

                      return (
                        <tr key={f.id}>
                          <td className="num">{upDate}</td>
                          <td className="num" style={{ fontWeight: 600, fontSize: '11.5px' }}>{shortId}</td>
                          <td className="num" style={{ color: 'var(--ink-2)' }}>{f.original_filename}</td>
                          <td className="num" style={{ color: 'var(--ink-3)' }}>—</td>
                          <td className="num" style={{ color: 'var(--ink-2)' }}>{isProcessed ? mirName : '—'}</td>
                          <td className="num">{f.claims_count || 0}</td>
                          <td>
                            <span className={`tag ${sourceTagClass}`} style={{ fontSize: '10.5px' }} title={sourceTitle}>
                              {sourceLabel}
                            </span>
                          </td>
                          <td>
                            <span className={`tag ${sftpTagClass}`} style={{ fontSize: '10.5px' }}>
                              {sftpStatusText}
                            </span>
                          </td>
                          <td>
                            <span className={`tag ${statusTagClass}`} style={{ fontSize: '10.5px' }}>
                              {displayStatus}
                            </span>
                          </td>
                          <td className="num" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              className="btn-eye"
                              title="View File"
                            >
                              <svg viewBox="0 0 24 24">
                                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                              </svg>
                            </button>
                            {isProcessed ? (
                              <button
                                type="button"
                                className="btn-download"
                                title="Download .mir File"
                              >
                                <svg viewBox="0 0 24 24">
                                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                                </svg>
                              </button>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION CONTROL FOOTER */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 20px', borderTop: '1px solid var(--line)', background: 'var(--surface)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setCurrentPage(1); }}
                  style={{ padding: '4px 8px', fontSize: '11px', border: '1px solid var(--line)', borderRadius: '4px' }}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  className="btn secondary"
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                  disabled={pageIndex <= 1}
                  onClick={() => setCurrentPage(pageIndex - 1)}
                >
                  &ndash; Previous
                </button>
                <span style={{ fontSize: '11px', color: 'var(--ink-2)' }}>
                  Page {pageIndex} of {totalPages}
                </span>
                <button
                  className="btn secondary"
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                  disabled={pageIndex >= totalPages}
                  onClick={() => setCurrentPage(pageIndex + 1)}
                >
                  Next &rarr;
                </button>
              </div>
            </div>
          </div>

          {/* FOOTER LEGEND */}
          <div style={{ fontSize: '11.5px', color: 'var(--teal)', fontWeight: 500, display: 'flex', gap: '24px' }}>
            <span>&#9632; Archive table = one row per conversion set</span>
            <span>&#9632; Physical 835 / 837 / MIR file hashes remain stored individually</span>
          </div>
        </>
      )}
    </section>
  );
}

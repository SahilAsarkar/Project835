import React, { useState, useEffect } from 'react';

export default function FileViewerModal({ isOpen, onClose, fileData, stepTitle, stepNum }) {
  const [textContent, setTextContent] = useState('');
  const [loadingText, setLoadingText] = useState(false);

  const isPdf = fileData?.contentType?.includes('pdf') || fileData?.filename?.toLowerCase().endsWith('.pdf');
  const isImage = fileData?.contentType?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg|tiff|tif|ico|avif|heic)$/i.test(fileData?.filename || '');
  const isText = !isPdf && !isImage && fileData?.blob;

  useEffect(() => {
    if (isText && fileData?.blob) {
      setLoadingText(true);
      fileData.blob.text()
        .then((text) => setTextContent(text))
        .catch(() => setTextContent('(Unable to display text content)'))
        .finally(() => setLoadingText(false));
    } else {
      setTextContent('');
    }
  }, [fileData, isText]);

  if (!isOpen || !fileData) return null;

  const handleDownload = () => {
    if (!fileData.fileUrl) return;
    const a = document.createElement('a');
    a.href = fileData.fileUrl;
    a.download = fileData.filename || 'evidence_file';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 1000);
  };

  const handleOpenNewTab = () => {
    if (fileData.fileUrl) {
      window.open(fileData.fileUrl, '_blank');
    }
  };

  return (
    <div className="modal on" onClick={onClose}>
      <div 
        className="modal-card" 
        style={{ maxWidth: '850px', width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--line-soft)', paddingBottom: '12px', marginBottom: '14px' }}>
          <div>
            <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>👁</span> Uploaded Evidence Preview · Step {stepNum}
            </div>
            <div className="modal-t" style={{ fontSize: '15px', marginTop: '3px' }}>
              {fileData.filename}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--ink-3)' }}>{stepTitle}</div>
          </div>
          <button 
            type="button" 
            className="btn tiny" 
            onClick={onClose} 
            title="Close Preview"
            style={{ fontSize: '14px', padding: '3px 8px' }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, minHeight: '350px', maxHeight: '65vh', overflow: 'auto', background: '#F8FAFC', border: '1px solid var(--line-soft)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isPdf ? (
            <iframe
              src={fileData.fileUrl}
              title={fileData.filename}
              style={{ width: '100%', height: '62vh', border: 'none', background: '#fff' }}
            />
          ) : isImage ? (
            <div style={{ padding: '16px', textAlign: 'center' }}>
              <img
                src={fileData.fileUrl}
                alt={fileData.filename}
                style={{ maxWidth: '100%', maxHeight: '58vh', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
            </div>
          ) : isText ? (
            <div style={{ width: '100%', height: '100%', padding: '14px 16px', overflow: 'auto' }}>
              {loadingText ? (
                <div style={{ color: 'var(--ink-3)', fontSize: '12.5px' }}>Loading text contents...</div>
              ) : (
                <pre style={{ margin: 0, fontFamily: 'var(--display)', fontSize: '12px', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--ink)' }}>
                  {textContent || '(Empty file)'}
                </pre>
              )}
            </div>
          ) : (
            <div style={{ padding: '30px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>{fileData.filename}</div>
              <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: '4px' }}>Binary file preview is not available in-browser.</p>
              <button type="button" className="btn tiny primary" onClick={handleDownload} style={{ marginTop: '10px' }}>
                ⬇ Download to View
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '10px', borderTop: '1px solid var(--line-soft)' }}>
          <span className="mono" style={{ fontSize: '11px', color: 'var(--ink-3)' }}>
            {fileData.contentType || 'file'}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn tiny" onClick={handleOpenNewTab} title="Open file in new browser window">
              ↗ Open in New Tab
            </button>
            <button type="button" className="btn tiny" onClick={handleDownload} title="Download file">
              ⬇ Download
            </button>
            <button type="button" className="btn tiny primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

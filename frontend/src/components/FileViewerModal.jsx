import React, { useState, useEffect } from "react";

export default function FileViewerModal({ fileId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [filename, setFilename] = useState("Loading file...");
  const [ediText, setEdiText] = useState("");
  const [mirText, setMirText] = useState("");
  const [activeTab, setActiveTab] = useState("835"); // "835" or "MIR"
  const [copyStatus, setCopyStatus] = useState("Copy");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!fileId) return;
    setLoading(true);
    setError(null);
    setActiveTab("835");

    fetch(`/api/file-content/${fileId}/`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not retrieve file content");
        return res.json();
      })
      .then((data) => {
        setFilename(data.filename || "File View & Edit");
        setEdiText(data.edi_text || "(No 835 content recorded)");
        setMirText(data.mir_text || "(No MIR content generated yet)");
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setFilename("Error Loading File");
        setLoading(false);
      });
  }, [fileId]);

  if (!fileId) return null;

  const currentText = activeTab === "835" ? ediText : mirText;

  const handleTextChange = (e) => {
    const val = e.target.value;
    if (activeTab === "835") {
      setEdiText(val);
    } else {
      setMirText(val);
    }
  };

  const handleCopy = () => {
    if (!currentText) return;
    navigator.clipboard.writeText(currentText).then(() => {
      setCopyStatus("Copied!");
      setTimeout(() => setCopyStatus("Copy"), 2000);
    });
  };

  return (
    <div
      id="fileViewerModal"
      className="inline-viewer-modal"
      onClick={(e) => {
        if (e.target.id === "fileViewerModal") onClose();
      }}
    >
      <div className="inline-viewer-content">
        <div className="inline-viewer-header">
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <h3 id="modalFileTitle">{filename}</h3>
            <div className="inline-viewer-nav">
              <button
                type="button"
                className={`tab-btn ${activeTab === "835" ? "active" : ""}`}
                onClick={() => setActiveTab("835")}
              >
                835 Code
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === "MIR" ? "active" : ""}`}
                onClick={() => setActiveTab("MIR")}
              >
                MIR Code
              </button>
            </div>
          </div>
          <button
            type="button"
            className="modal-cross-btn"
            title="Close Popup"
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        <div className="inline-viewer-body">
          <textarea
            spellCheck="false"
            value={loading ? "Loading file content..." : error ? `Error: ${error}` : currentText}
            onChange={handleTextChange}
            style={{
              whiteSpace: activeTab === "835" ? "pre-wrap" : "pre",
              overflowX: activeTab === "835" ? "hidden" : "auto",
            }}
          ></textarea>
        </div>
        <div className="inline-viewer-footer">
          <button
            type="button"
            className="btn secondary"
            style={{ padding: "6px 12px", fontSize: "12px" }}
            onClick={handleCopy}
          >
            {copyStatus}
          </button>
          <button
            type="button"
            className="btn primary"
            style={{ padding: "6px 16px", fontSize: "12px" }}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from "react";

export default function ConversionsView({
  trackedFiles,
  onRefreshData,
  onOpenFileModal,
}) {
  // Conversion Form State
  const [ediText, setEdiText] = useState("");
  const [currentFileName, setCurrentFileName] = useState("uploaded_file.x12");
  const [file835Subtext, setFile835Subtext] = useState("No 835 files selected.");
  const [file837Subtext, setFile837Subtext] = useState("No 837 reference selected.");
  const [activeValidatedFileId, setActiveValidatedFileId] = useState(null);

  const [validating, setValidating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [convertingId, setConvertingId] = useState(null);
  const [startingBatch, setStartingBatch] = useState(false);
  const [batchAlert, setBatchAlert] = useState(null);

  const [validationReport, setValidationReport] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [isValidated, setIsValidated] = useState(false);

  const [mirOutputText, setMirOutputText] = useState("");
  const [copyStatus, setCopyStatus] = useState("Copy Text");

  // Step Pills State
  const [step1State, setStep1State] = useState("active");
  const [step2State, setStep2State] = useState("");
  const [step3State, setStep3State] = useState("");

  // Table Filters, Sort, Pagination
  const [searchText, setSearchText] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");

  // 835 File Input change
  const handle835FileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setCurrentFileName(file.name);
      setFile835Subtext("Selected: " + file.name);
      const reader = new FileReader();
      reader.onload = (evt) => {
        setEdiText(evt.target.result);
        resetConversionForm();
      };
      reader.readAsText(file);
    }
  };

  // 837 File Input change
  const handle837FileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile837Subtext(
        "Selected: " + e.target.files[0].name + " (optional reference)"
      );
    }
  };

  const resetConversionForm = () => {
    setValidationError(null);
    setValidationReport(null);
    setIsValidated(false);
    setMirOutputText("");
    setActiveValidatedFileId(null);
    setStep1State("active");
    setStep2State("");
    setStep3State("");
  };

  // Validate 835 Action
  const handleValidate = async () => {
    const text = ediText.trim();
    setValidationError(null);
    setValidationReport(null);
    setMirOutputText("");

    if (!text) {
      setValidationError("Please select an 835 file to validate.");
      return;
    }

    setValidating(true);
    try {
      const res = await fetch("/api/validate/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edi_text: text,
          original_filename: currentFileName,
        }),
      });

      const data = await res.json();
      if (data.file_id) setActiveValidatedFileId(data.file_id);

      if (!res.ok || data.error) {
        throw new Error(data.error || "Validation failed");
      }

      const report = data.report;
      const valid = report.valid !== undefined ? report.valid : report.is_valid;
      setValidationReport(report);

      if (valid) {
        setIsValidated(true);
        setStep1State("done");
        setStep2State("done");
        setStep3State("active");
      } else {
        setIsValidated(false);
        setStep1State("done");
        setStep2State("active");
        setStep3State("");
      }

      if (onRefreshData) onRefreshData();
    } catch (err) {
      setValidationError("Validation error: " + err.message);
      if (onRefreshData) onRefreshData();
    } finally {
      setValidating(false);
    }
  };

  // Process MIR Action
  const handleProcessMIR = async () => {
    const text = ediText.trim();
    if (!text) return;

    setProcessing(true);
    setValidationError(null);

    try {
      const res = await fetch("/api/convert/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edi_text: text,
          original_filename: currentFileName,
          file_id: activeValidatedFileId,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Conversion failed");
      }

      setMirOutputText(data.text);
      setStep1State("done");
      setStep2State("done");
      setStep3State("done");
      setActiveValidatedFileId(null);

      if (onRefreshData) onRefreshData();
    } catch (err) {
      setValidationError("Conversion error: " + err.message);
      if (onRefreshData) onRefreshData();
    } finally {
      setProcessing(false);
    }
  };

  // Convert file to MIR on clicking PROCESSING status in table
  const handleConvertStatusClick = async (fileId) => {
    if (!fileId || convertingId) return;
    setConvertingId(fileId);
    try {
      const res = await fetch("/api/convert/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: fileId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || "Failed to convert file to MIR");
      } else {
        if (data.text) setMirOutputText(data.text);
      }
    } catch (err) {
      alert("Error converting file: " + err.message);
    } finally {
      setConvertingId(null);
      if (onRefreshData) onRefreshData();
    }
  };

  // Copy MIR Text
  const handleCopyMir = () => {
    if (!mirOutputText) return;
    navigator.clipboard.writeText(mirOutputText).then(() => {
      setCopyStatus("Copied!");
      setTimeout(() => setCopyStatus("Copy Text"), 2000);
    });
  };

  // Download MIR File
  const handleDownloadMir = (fileName, content) => {
    const textToDownload = content || mirOutputText;
    if (!textToDownload) return;

    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/download/";

    const inputContent = document.createElement("input");
    inputContent.type = "hidden";
    inputContent.name = "mir_content";
    inputContent.value = textToDownload;
    form.appendChild(inputContent);

    const inputName = document.createElement("input");
    inputName.type = "hidden";
    inputName.name = "file_name";
    inputName.value = fileName || currentFileName.replace(/\.[^/.]+$/, "") + ".mir";
    form.appendChild(inputName);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  // Start Automated SFTP Inbound Batch Pipeline
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
        if (onRefreshData) onRefreshData();
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

  // Table Sorting & Filtering
  const handleSortHeader = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  let filtered = (trackedFiles || []).filter((item) => {
    if (searchText) {
      const query = searchText.toLowerCase();
      const fullStr = (
        item.id +
        " " +
        item.original_filename +
        " " +
        (item.output_path || "")
      ).toLowerCase();
      if (!fullStr.includes(query)) return false;
    }
    return true;
  });

  // Sort logic
  filtered.sort((a, b) => {
    const mult = sortOrder === "asc" ? 1 : -1;
    let valA, valB;
    if (sortKey === "date" || sortKey === "time") {
      valA = new Date(a.uploaded_at || 0).getTime();
      valB = new Date(b.uploaded_at || 0).getTime();
    } else if (sortKey === "id") {
      valA = (a.id || "").toLowerCase();
      valB = (b.id || "").toLowerCase();
    } else if (sortKey === "filename") {
      valA = (a.original_filename || "").toLowerCase();
      valB = (b.original_filename || "").toLowerCase();
    } else if (sortKey === "claims") {
      valA = a.claims_count || 0;
      valB = b.claims_count || 0;
    } else if (sortKey === "status") {
      valA = (a.status || "").toLowerCase();
      valB = (b.status || "").toLowerCase();
    } else {
      valA = 0;
      valB = 0;
    }

    if (valA < valB) return -1 * mult;
    if (valA > valB) return 1 * mult;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageIndex = Math.min(currentPage, totalPages);
  const startIndex = (pageIndex - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  return (
    <section className="view on" id="v-batches">
      <div className="eyebrow">Operations Studio</div>
      <h1>Conversions</h1>
      <p className="sub">
        Start a conversion run, validate EDI 835 files, and view 30-day conversion history.
      </p>

      {/* START A CONVERSION CARD */}
      <div className="start-conversion-card">
        <div className="start-conversion-header">
          <h2>Start a conversion</h2>
          <div className="step-pills">
            <span className={`step-pill ${step1State}`} id="pillStep1">
              1 &bull; UPLOAD 835
            </span>
            <span className="step-arrow">&rarr;</span>
            <span className={`step-pill ${step2State}`} id="pillStep2">
              2 &bull; VALIDATE
            </span>
            <span className="step-arrow">&rarr;</span>
            <span className={`step-pill ${step3State}`} id="pillStep3">
              3 &bull; PROCESS MIR
            </span>
          </div>
        </div>

        <div className="conversion-boxes">
          {/* REQUIRED 835 INPUT BOX */}
          <div className="c-box">
            <div className="c-box-label">REQUIRED &bull; 835 INPUT</div>
            <input
              type="file"
              accept=".835,.853,.x12,.txt,.edi,*/*"
              onChange={handle835FileChange}
            />
            <div className="subtext">{file835Subtext}</div>
          </div>

          {/* OPTIONAL 837 REFERENCE BOX */}
          <div className="c-box">
            <div className="c-box-label">OPTIONAL &bull; 837 REFERENCE ONLY</div>
            <input type="file" accept=".837,.x12,.txt,*/*" onChange={handle837FileChange} />
            <div className="subtext">{file837Subtext}</div>
          </div>

          {/* ACTION BUTTONS WITH ICONS */}
          <div className="c-actions">
            <button
              type="button"
              className="btn-gray"
              onClick={handleValidate}
              disabled={validating}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>{validating ? "Validating..." : "Validate 835"}</span>
            </button>

            <button
              type="button"
              className={isValidated && !processing ? "btn-gray" : "btn-disabled"}
              onClick={handleProcessMIR}
              disabled={!isValidated || processing}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span>{processing ? "Processing MIR..." : "Process MIR"}</span>
            </button>

            <button
              type="button"
              className="btn-gray"
              onClick={handleStartBatchConversion}
              disabled={startingBatch}
              title="Test SFTP Inbound Batch Conversion: Reads all files from inbound SFTP folder, validates, archives, converts to MIR, uploads to outbound SFTP, and deletes original file from inbound SFTP."
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span>{startingBatch ? "Testing..." : "Test"}</span>
            </button>
          </div>
        </div>

        {/* BATCH CONVERSION ALERT BANNER */}
        {batchAlert && (
          <div
            className={`status-banner ${batchAlert.type === "success" ? "valid" : "invalid"}`}
            style={{ marginTop: "14px" }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: "14px" }}>
                {batchAlert.type === "success" ? "✓ Automated Inbound Batch Pipeline Completed" : "✕ Batch Pipeline Error"}
              </div>
              <div style={{ fontSize: "12px", marginTop: "2px" }}>
                {batchAlert.message}
              </div>
            </div>
          </div>
        )}

        {/* ERROR ALERT BOX */}
        {validationError && (
          <div className="error-msg" style={{ marginTop: "14px" }}>
            {validationError}
          </div>
        )}

        {/* VALIDATION RESULT REPORT */}
        {validationReport && (
          <div style={{ marginTop: "14px" }}>
            <div
              className={`status-banner ${
                validationReport.valid !== false && validationReport.is_valid !== false
                  ? "valid"
                  : "invalid"
              }`}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px" }}>
                  {validationReport.valid !== false && validationReport.is_valid !== false
                    ? "✓ EDI File Validated Successfully"
                    : "✕ EDI Validation Failed"}
                </div>
                <div style={{ fontSize: "12px", marginTop: "2px" }}>
                  {validationReport.status_message ||
                    (validationReport.valid !== false && validationReport.is_valid !== false
                      ? "PyX12 Engine: All envelope headers and segment rules passed. Ready for Process MIR."
                      : "PyX12 Engine: Structural or syntax errors found.")}
                </div>
              </div>
            </div>

            <div className="metrics">
              <div className="metric">
                <div className="v">{validationReport.total_segments || 0}</div>
                <div className="l">Total Segments</div>
              </div>
              <div className="metric">
                <div className="v">
                  {validationReport.claims !== undefined
                    ? validationReport.claims
                    : validationReport.claims_found || 0}
                </div>
                <div className="l">Claims Identified</div>
              </div>
              <div className="metric">
                <div className="v" style={{ color: "var(--brick)" }}>
                  {(validationReport.errors || []).length}
                </div>
                <div className="l">Errors</div>
              </div>
              <div className="metric">
                <div className="v" style={{ color: "var(--ochre)" }}>
                  {(validationReport.warnings || []).length}
                </div>
                <div className="l">Warnings</div>
              </div>
            </div>

            {validationReport.errors && validationReport.errors.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <div className="eyebrow" style={{ color: "var(--brick)", marginBottom: "6px" }}>
                  Errors Found
                </div>
                {validationReport.errors.map((err, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "var(--brick-bg)",
                      borderLeft: "3px solid var(--brick)",
                      padding: "8px 12px",
                      marginBottom: "6px",
                      fontSize: "12px",
                    }}
                  >
                    <span>
                      Line {err.line || "N/A"}: {err.message || err}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FILTERS CONTROL BAR */}
      <div
        className="filters-bar"
        style={{
          display: "flex",
          alignItems: "center",
          justifySpaceBetween: "space-between",
          marginBottom: "12px",
        }}
      >
        <input
          type="text"
          placeholder="Search run, 835 file, or MIR file"
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            setCurrentPage(1);
          }}
          style={{
            padding: "7px 12px",
            fontSize: "12px",
            border: "1px solid var(--line)",
            borderRadius: "4px",
            width: "280px",
          }}
        />
        <span
          className="runs-counter"
          style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-3)" }}
        >
          {filtered.length} runs
        </span>
      </div>

      {/* CONVERSIONS TABLE */}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: "16px" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th
                  className={`sortable ${sortKey === "id" ? sortOrder : ""}`}
                  onClick={() => handleSortHeader("id")}
                >
                  RUN{" "}
                  <span className="sort-arrow">
                    {sortKey === "id" ? (sortOrder === "asc" ? "↑" : "↓") : "⇅"}
                  </span>
                </th>
                <th
                  className={`sortable ${sortKey === "date" ? sortOrder : ""}`}
                  onClick={() => handleSortHeader("date")}
                >
                  835 DATE{" "}
                  <span className="sort-arrow">
                    {sortKey === "date" ? (sortOrder === "asc" ? "↑" : "↓") : "⇅"}
                  </span>
                </th>
                <th
                  className={`sortable ${sortKey === "time" ? sortOrder : ""}`}
                  onClick={() => handleSortHeader("time")}
                >
                  TIMESTAMP{" "}
                  <span className="sort-arrow">
                    {sortKey === "time" ? (sortOrder === "asc" ? "↑" : "↓") : "⇅"}
                  </span>
                </th>
                <th
                  className={`sortable ${sortKey === "filename" ? sortOrder : ""}`}
                  onClick={() => handleSortHeader("filename")}
                >
                  835 IN{" "}
                  <span className="sort-arrow">
                    {sortKey === "filename" ? (sortOrder === "asc" ? "↑" : "↓") : "⇅"}
                  </span>
                </th>
                <th>837 REF</th>
                <th
                  className={`sortable ${sortKey === "claims" ? sortOrder : ""}`}
                  onClick={() => handleSortHeader("claims")}
                >
                  CLAIMS{" "}
                  <span className="sort-arrow">
                    {sortKey === "claims" ? (sortOrder === "asc" ? "↑" : "↓") : "⇅"}
                  </span>
                </th>
                <th>MIR OUT</th>
                <th
                  className={`sortable ${sortKey === "status" ? sortOrder : ""}`}
                  onClick={() => handleSortHeader("status")}
                >
                  STATUS{" "}
                  <span className="sort-arrow">
                    {sortKey === "status" ? (sortOrder === "asc" ? "↑" : "↓") : "⇅"}
                  </span>
                </th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    style={{ padding: "26px", textAlign: "center", color: "var(--ink-3)" }}
                  >
                    No conversion runs match search query.
                  </td>
                </tr>
              ) : (
                pageItems.map((f) => {
                  const upDate = f.uploaded_at ? f.uploaded_at.substring(0, 10) : "—";
                  const upTime = f.uploaded_at ? f.uploaded_at.substring(11, 19) : "—";
                  const shortId = "R-" + f.id.substring(0, 6).toUpperCase();
                  const baseName = (f.original_filename || "").replace(/\.[^/.]+$/, "");
                  const mirName = "MIR_" + baseName + ".mir";

                  let statusTitle = "";
                  if (f.status === "PROCESSING") {
                    statusTitle = "PROCESSING: 835 EDI file validated and stored in archive folder. Click to convert file into MIR.";
                  } else if (f.status === "ARCHIVED") {
                    statusTitle = "ARCHIVED: File successfully converted into MIR format and stored in output/archive folders.";
                  } else if (f.status === "ERROR") {
                    statusTitle = f.error_message
                      ? `ERROR: ${f.error_message}`
                      : "ERROR: Validation or processing failed during conversion.";
                  } else if (f.status === "UPLOADED") {
                    statusTitle = "UPLOADED: File received, pending validation and processing.";
                  } else {
                    statusTitle = `${f.status}: Current status of 835 file.`;
                  }

                  return (
                    <tr key={f.id}>
                      <td className="num" style={{ fontWeight: 600, fontSize: "11.5px" }}>
                        {shortId}
                      </td>
                      <td className="num">{upDate}</td>
                      <td className="num">{upTime}</td>
                      <td className="num" style={{ color: "var(--ink-2)" }}>
                        {f.original_filename}
                      </td>
                      <td className="num" style={{ color: "var(--ink-3)" }}>
                        —
                      </td>
                      <td className="num">{f.claims_count || 0}</td>
                      <td className="num" style={{ color: "var(--ink-2)" }}>
                        {f.status === "ARCHIVED" ? mirName : "—"}
                      </td>
                      <td>
                        <span
                          className={`tag ${
                            f.status === "ARCHIVED"
                              ? "ok"
                              : f.status === "ERROR"
                              ? "bad"
                              : "work"
                          }`}
                          style={{
                            cursor: f.status === "PROCESSING" ? "pointer" : "default",
                          }}
                          title={statusTitle}
                          onClick={() => {
                            if (f.status === "PROCESSING") {
                              handleConvertStatusClick(f.id);
                            }
                          }}
                        >
                          {convertingId === f.id ? "CONVERTING..." : f.status}
                        </span>
                      </td>
                      <td
                        className="num"
                        style={{
                          fontSize: "11px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <button
                          type="button"
                          className="btn-eye"
                          title="View / Edit Code"
                          onClick={() => onOpenFileModal(f.id)}
                        >
                          <svg viewBox="0 0 24 24">
                            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                          </svg>
                        </button>
                        {f.status === "ARCHIVED" ? (
                          <button
                            type="button"
                            className="btn-download"
                            title="Download .mir File"
                            onClick={() => handleDownloadMir(mirName, "")}
                          >
                            <svg viewBox="0 0 24 24">
                              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                            </svg>
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* CONVERSIONS PAGINATION CONTROL FOOTER */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            borderTop: "1px solid var(--line)",
            background: "var(--surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: "var(--ink-3)" }}>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setCurrentPage(1);
              }}
              style={{
                padding: "4px 8px",
                fontSize: "11px",
                border: "1px solid var(--line)",
                borderRadius: "4px",
              }}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              className="btn secondary"
              style={{ padding: "4px 10px", fontSize: "11px" }}
              disabled={pageIndex <= 1}
              onClick={() => setCurrentPage(pageIndex - 1)}
            >
              &ndash; Previous
            </button>
            <span style={{ fontSize: "11px", color: "var(--ink-2)" }}>
              Page {pageIndex} of {totalPages}
            </span>
            <button
              className="btn secondary"
              style={{ padding: "4px 10px", fontSize: "11px" }}
              disabled={pageIndex >= totalPages}
              onClick={() => setCurrentPage(pageIndex + 1)}
            >
              Next &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* OPERATIONAL VIEW BANNER */}
      <div className="stub">
        <b>30-day operational view.</b> This table is intentionally limited by the backend to the
        latest 30 days. Every uploaded 835 and every generated MIR is also written to the
        SQLite-backed Archive.
      </div>
    </section>
  );
}

import React from "react";

export default function FlowView({
  metrics,
  recentFiles,
  inboundConfig,
  outboundConfig,
  onNavigateTab,
}) {
  const todayDateStr = new Date().toISOString().substring(0, 10);
  const firstFile = recentFiles && recentFiles.length > 0 ? recentFiles[0] : null;

  return (
    <section className="view on" id="v-flow">
      <div className="flow-title-row">
        <div>
          <h1>Flow</h1>
          <p className="sub">
            <span className="eyebrow" style={{ marginRight: "8px" }}>
              TODAY &bull; {todayDateStr}
            </span>
            837 is optional reference only. MIR is built from validated 835 files using the active
            mapping, then the output is ready for the configured MPL delivery path.
          </p>
        </div>
        <button
          type="button"
          className="btn-sftp"
          onClick={() => onNavigateTab("conn")}
        >
          SFTP connection
        </button>
      </div>

      {/* DYNAMIC PIPELINE TRACK */}
      <div className="pipe">
        <div className="pipe-track">
          {/* STAGE 01 */}
          <div className="stage">
            <div className="n">01</div>
            <h3>837 reference</h3>
            <div className="who">Optional - reference only</div>
            <div className="chipstack">
              <div className="chip idle">
                <span>No 837 reference today</span>
                <span className="c">optional</span>
              </div>
            </div>
          </div>

          {/* STAGE 02 */}
          <div className="stage">
            <div className="n">02</div>
            <h3>835 received</h3>
            <div className="who">Source used to build MIR</div>
            <div className="chipstack" id="stage2Chips">
              {recentFiles && recentFiles.length > 0 ? (
                recentFiles.map((f, idx) => (
                  <div
                    key={idx}
                    className={`chip ${
                      f.status === "ARCHIVED"
                        ? "ok"
                        : f.status === "PROCESSING"
                        ? "work"
                        : "hold"
                    }`}
                  >
                    <span title={f.original_filename}>
                      {(f.original_filename || "").substring(0, 24)}
                    </span>
                    <span className="c">{f.claims_count || 0} clm</span>
                  </div>
                ))
              ) : (
                <div className="chip idle">
                  <span>No 835 received today</span>
                  <span className="c">&ndash;</span>
                </div>
              )}
            </div>
          </div>

          {/* STAGE 03 */}
          <div className="stage">
            <div className="n">03</div>
            <h3>MIR built</h3>
            <div className="who">Relay conversion</div>
            <div className="chipstack" id="stage3Chips">
              {recentFiles &&
              recentFiles.filter(
                (f) => f.status === "ARCHIVED" || f.status === "COMPLETED"
              ).length > 0 ? (
                recentFiles
                  .filter(
                    (f) => f.status === "ARCHIVED" || f.status === "COMPLETED"
                  )
                  .map((f, idx) => {
                    const base = (f.original_filename || "").replace(/\.[^/.]+$/, "");
                    const mirName = "MIR_" + base + ".mir";
                    return (
                      <div key={idx} className="chip ok">
                        <span title={mirName}>{mirName.substring(0, 24)}</span>
                        <span className="c">
                          {`${f.records_count || f.claims_count || 0} rec`}
                        </span>
                      </div>
                    );
                  })
              ) : (
                <div className="chip idle">
                  <span>No MIR built today</span>
                  <span className="c">&ndash;</span>
                </div>
              )}
            </div>
          </div>

          {/* STAGE 04 */}
          <div className="stage">
            <div className="n">04</div>
            <h3>MIR delivery path</h3>
            <div className="who">Configured outbound SFTP</div>
            <div className="chipstack" id="stage4Chips">
              {outboundConfig && outboundConfig.status === "CONNECTED" ? (
                <div className="chip ok">
                  <span>MIR folder configured</span>
                  <span className="c">SFTP ready</span>
                </div>
              ) : (
                <div className="chip idle">
                  <span>SFTP not connected</span>
                  <span className="c">setup</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* VAULT FOOTER BAR */}
        <div className="vault">
          <span className="lock">&squarf; 837 never feeds MIR generation</span>
          <span className="lock">&squarf; 835 validation happens on the backend</span>
          <span className="lock">&squarf; Plan and file metadata persist in SQLite</span>
        </div>
      </div>

      {/* METRICS GRID */}
      <div className="metrics">
        <div className="metric">
          <div className="v" id="metricClaimsConvertedCount">
            {metrics.total_claims_converted_today || 0}
          </div>
          <div className="l">Claims converted today</div>
          <div className="d">
            <span id="metricCompletedRunsCount">
              {metrics.converted_today_file_count || 0}
            </span>{" "}
            completed runs
          </div>
        </div>
        <div className="metric">
          <div className="v" id="metricValidatedWaitingCount">
            {metrics.validated_waiting_count || 0}
          </div>
          <div className="l">Validated, waiting</div>
          <div className="d">Ready for Process MIR</div>
        </div>
        <div className="metric">
          <div
            className="v"
            id="metricRunsAttentionCount"
            style={{
              color: metrics.runs_needing_attention_count > 0 ? "var(--brick)" : "inherit",
            }}
          >
            {metrics.runs_needing_attention_count || 0}
          </div>
          <div className="l">Runs needing attention</div>
          <div className="d">Validation or processing failed</div>
        </div>
        <div className="metric">
          <div className="v" id="metricMirOutputsCount">
            {metrics.mir_outputs_today_count || 0}
          </div>
          <div className="l">MIR outputs today</div>
          <div className="d">0 optional 837 references</div>
        </div>
      </div>

      {/* INBOUND & OUTBOUND SFTP CARDS */}
      <div className="cols" style={{ gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div className="card" style={{ padding: "20px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "4px" }}>
            Inbound SFTP
          </h2>
          <div className="eyebrow" style={{ marginBottom: "12px" }}>
            835 FROM CLAIMS SYSTEM &bull; 837 OPTIONAL REFERENCE
          </div>
          <div
            id="flowInboundBanner"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "4px",
              padding: "8px 12px",
              fontWeight: 600,
              fontSize: "13px",
              color:
                inboundConfig && inboundConfig.status === "CONNECTED"
                  ? "var(--teal)"
                  : "var(--ink-2)",
              marginBottom: "14px",
            }}
          >
            {inboundConfig && inboundConfig.host
              ? `${inboundConfig.status === "CONNECTED" ? "Connected" : "Configured"} (${inboundConfig.host})`
              : "Not configured"}
          </div>
          <div className="kv" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <span className="k">Host</span>
            <span className="v" id="flowInboundHost" style={{ color: "var(--ink-3)" }}>
              {inboundConfig ? `${inboundConfig.host}:${inboundConfig.port || 22}` : "–"}
            </span>
          </div>
          <div className="kv" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <span className="k">835 folder</span>
            <span className="v" id="flowInbound835Dir" style={{ color: "var(--ink-3)" }}>
              {inboundConfig ? inboundConfig.inbound_835_folder || "–" : "–"}
            </span>
          </div>
          <div className="kv" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <span className="k">837 reference folder</span>
            <span className="v" id="flowInbound837Dir" style={{ color: "var(--ink-3)" }}>
              {inboundConfig ? inboundConfig.inbound_837_folder || "–" : "–"}
            </span>
          </div>
          <div className="kv" style={{ padding: "8px 0" }}>
            <span className="k">Connection</span>
            <span
              className="v"
              id="flowInboundConnection"
              style={{
                color:
                  inboundConfig && inboundConfig.status === "CONNECTED"
                    ? "var(--teal)"
                    : inboundConfig && inboundConfig.status === "FAILED"
                    ? "var(--brick)"
                    : "var(--ink-3)",
                fontWeight: 500,
              }}
            >
              {inboundConfig ? inboundConfig.status || "CONFIGURED" : "Not configured"}
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: "20px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "4px" }}>
            Outbound SFTP
          </h2>
          <div className="eyebrow" style={{ marginBottom: "12px" }}>
            MIR DESTINATION FOR MPL
          </div>
          <div
            id="flowOutboundBanner"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "4px",
              padding: "8px 12px",
              fontWeight: 600,
              fontSize: "13px",
              color:
                outboundConfig && outboundConfig.status === "CONNECTED"
                  ? "var(--teal)"
                  : "var(--ink-2)",
              marginBottom: "14px",
            }}
          >
            {outboundConfig && outboundConfig.host
              ? `${outboundConfig.status === "CONNECTED" ? "Connected" : "Configured"} (${outboundConfig.host})`
              : "Not configured"}
          </div>
          <div className="kv" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <span className="k">MIR folder</span>
            <span className="v" id="flowOutboundMirDir" style={{ color: "var(--ink-3)" }}>
              {outboundConfig ? outboundConfig.outbound_mir_folder || "–" : "–"}
            </span>
          </div>
          <div className="kv" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <span className="k">MIR built today</span>
            <span className="v" id="flowMirBuiltCount" style={{ fontWeight: 600 }}>
              {metrics.mir_outputs_today_count || 0}
            </span>
          </div>
          <div className="kv" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <span className="k">Last connection test</span>
            <span className="v" id="flowOutboundLastTest" style={{ color: "var(--ink-3)" }}>
              {outboundConfig ? outboundConfig.last_tested_at || "–" : "–"}
            </span>
          </div>
          <div className="kv" style={{ padding: "8px 0" }}>
            <span className="k">Folders discovered</span>
            <span className="v" id="flowOutboundFoldersDiscovered" style={{ fontWeight: 600 }}>
              {outboundConfig
                ? (outboundConfig.inbound_835_folder ? 1 : 0) +
                  (outboundConfig.inbound_837_folder ? 1 : 0) +
                  (outboundConfig.outbound_mir_folder ? 1 : 0)
                : 0}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

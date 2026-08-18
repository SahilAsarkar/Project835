import React from "react";

export default function NoticesView() {
  return (
    <section className="view on" id="v-notices">
      <div className="eyebrow">Returned from MPL</div>
      <h1>Notices</h1>
      <p className="sub">
        MPL sends these back every few days rather than on a schedule. Relay keeps the original
        and reads it back in plain language.
      </p>

      <article className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
          <div>
            <div className="mono" style={{ fontSize: "13px", fontWeight: 600 }}>
              MPL-RTN-20250806-114
            </div>
            <div style={{ fontSize: "11px", color: "var(--ink-3)" }}>
              6 Aug &bull; covers 1–5 Aug
            </div>
          </div>
          <span className="tag bad">Needs an answer</span>
        </div>
        <pre>
          {`RTN 20250806 ABCHEALTH
BATCH 20250801-20250805 RECV 004 ACC 003 REJ 001
FILE MIR_ABC_20250804_03 ST=R CD=E220 SEG=CLM OCC=00007
CD=E220 TXT=PRV ID NOT ON FILE FOR SVC DT RANGE
ACTION=RESUBMIT AFTER CORRECTION WINDOW=15D`}
        </pre>
        <p style={{ marginTop: "10px", fontSize: "13px", color: "var(--ink-2)" }}>
          MPL took three of the four files sent last week and rejected one. The provider ID was
          not on file for the service date range.
        </p>
      </article>
    </section>
  );
}

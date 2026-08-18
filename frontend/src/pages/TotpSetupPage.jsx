import React, { useState, useEffect } from "react";

export default function TotpSetupPage({ onSetupSuccess, onGoDashboard }) {
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [verified, setVerified] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/accounts/api/totp/setup/")
      .then((res) => res.json())
      .then((data) => {
        if (data.qr_code) setQrCode(data.qr_code);
        if (data.secret) setSecret(data.secret);
        if (data.already_configured) setVerified(true);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load 2FA setup details.");
        setLoading(false);
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/accounts/api/totp/setup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Invalid authenticator code.");
      }

      setVerified(true);
      if (data.recovery_codes) setRecoveryCodes(data.recovery_codes);
      if (onSetupSuccess) onSetupSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <p style={{ textAlign: "center", color: "var(--ink-3)" }}>
            Loading 2FA setup...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Two-Factor Authentication</h1>
        <p className="sub">Configure Authenticator App</p>

        {verified ? (
          <>
            <div className="success-msg">
              <p>✅ Authenticator app configured successfully!</p>
            </div>

            {recoveryCodes && recoveryCodes.length > 0 && (
              <>
                <h3 style={{ fontSize: "14px", marginBottom: "6px" }}>Save Recovery Codes</h3>
                <p style={{ fontSize: "12px", color: "var(--ink-2)", marginBottom: "12px" }}>
                  Store these codes safely to recover access if you lose your device:
                </p>

                <div
                  style={{
                    background: "var(--paper)",
                    padding: "12px",
                    border: "1px solid var(--line)",
                    marginBottom: "16px",
                  }}
                >
                  {recoveryCodes.map((c, i) => (
                    <code
                      key={i}
                      style={{
                        fontFamily: "var(--display)",
                        fontSize: "12px",
                        margin: "2px 6px",
                        display: "inline-block",
                        color: "var(--ink)",
                      }}
                    >
                      {c}
                    </code>
                  ))}
                </div>
              </>
            )}

            <button type="button" className="btn-primary" onClick={onGoDashboard}>
              Go to Dashboard
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: "12.5px", color: "var(--ink-2)", marginBottom: "14px" }}>
              Scan the QR code below with Google Authenticator or Microsoft Authenticator:
            </p>

            <div style={{ textAlign: "center", margin: "16px 0" }}>
              {qrCode && (
                <img
                  src={`data:image/png;base64,${qrCode}`}
                  alt="2FA QR Code"
                  style={{
                    width: "200px",
                    height: "200px",
                    border: "1px solid var(--line)",
                    padding: "8px",
                    background: "#fff",
                  }}
                />
              )}
            </div>

            <p
              style={{
                fontSize: "11px",
                fontFamily: "var(--display)",
                textTransform: "uppercase",
                color: "var(--ink-3)",
                marginBottom: "4px",
              }}
            >
              Manual Key
            </p>
            <div
              style={{
                fontFamily: "var(--display)",
                fontSize: "12px",
                background: "var(--paper)",
                padding: "8px",
                textAlign: "center",
                border: "1px solid var(--line)",
                marginBottom: "16px",
                wordBreak: "break-all",
              }}
            >
              {secret}
            </div>

            {error && (
              <div className="error-msg">
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <label>Enter 6-Digit Authenticator Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                autoComplete="off"
                required
                maxLength={6}
                autoFocus
              />
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? "Verifying..." : "Verify & Enable 2FA"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

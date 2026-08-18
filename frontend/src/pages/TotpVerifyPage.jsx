import React, { useState } from "react";

export default function TotpVerifyPage({ onVerifySuccess }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/accounts/api/totp/verify/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Invalid authenticator code.");
      }

      onVerifySuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Two-Factor Verification</h1>
        <p className="sub">Enter the 6-digit code from your authenticator app.</p>

        {error && (
          <div className="error-msg">
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div>
            <label>Authenticator Code</label>
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
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Verifying..." : "Verify Authentication"}
          </button>
        </form>
      </div>
    </div>
  );
}

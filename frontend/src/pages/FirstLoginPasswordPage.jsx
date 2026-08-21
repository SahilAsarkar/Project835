import React, { useState } from "react";
import { safeFetchJson } from "../utils/api";

export default function FirstLoginPasswordPage({ onPasswordChangeSuccess, onLogout }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { res, data } = await safeFetchJson("/accounts/api/user/change-password/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Password change failed.");
      }

      onPasswordChangeSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-brand">
        ONESMARTER <span>/ PASSWORD</span>
      </div>
      <div className="auth-card">
        <h1>Reset Password</h1>
        <p className="sub">This is your first login. Please choose a new secure password.</p>

        {error && (
          <div className="error-msg" style={{ marginBottom: "20px" }}>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Updating..." : "Update Password & Proceed"}
          </button>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              style={{
                display: "block",
                width: "100%",
                textAlign: "center",
                marginTop: "16px",
                color: "var(--ink-2)",
                textDecoration: "underline",
                fontSize: "13px",
                border: "none",
                background: "none",
                cursor: "pointer"
              }}
            >
              Cancel & Log Out
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

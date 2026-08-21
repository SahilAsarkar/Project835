import React, { useState } from "react";
import { safeFetchJson } from "../utils/api";

export default function LoginPage({ onLoginSuccess, isAdminRoute }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { res, data } = await safeFetchJson("/accounts/api/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, isAdminRoute }),
      });

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Sign in failed.");
      }

      onLoginSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const brandLabel = isAdminRoute ? (
    <div className="auth-brand">
      ONESMARTER <span>/ ADMIN</span>
    </div>
  ) : (
    <div className="auth-brand">
      ONESMARTER <span>/ PORTAL</span>
    </div>
  );

  const title = isAdminRoute ? "Admin Sign In" : "Sign In";
  const subtitle = isAdminRoute
    ? "Administrator access to client onboarding, compliance evidence, and integrations."
    : "MIR Relay · EDI 835 Conversion Operations";

  const emailLabel = isAdminRoute ? "Work email" : "Email Address";
  const footerText = isAdminRoute
    ? "Access is restricted to authorized OneSmarter administrative staff."
    : "Access is restricted to authorized OneSmarter client users.";

  return (
    <div className="auth-wrapper">
      {brandLabel}
      <div className="auth-card">
        <h1>{title}</h1>
        <p className="sub">{subtitle}</p>

        {error && (
          <div className="error-msg" style={{ marginBottom: "20px" }}>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>{emailLabel}</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. admin"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Continuing..." : "Continue"}
          </button>
        </form>

        <div className="auth-footer">{footerText}</div>
      </div>
    </div>
  );
}

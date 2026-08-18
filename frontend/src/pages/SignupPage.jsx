import React, { useState } from "react";

export default function SignupPage({ onSignupSuccess, onNavigate }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setGeneralError(null);
    setLoading(true);

    try {
      const res = await fetch("/accounts/api/signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          mobile,
          password,
          confirm_password: confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.errors) {
          setErrors(data.errors);
        }
        throw new Error(data.error || "Registration failed.");
      }

      onSignupSuccess(data);
    } catch (err) {
      setGeneralError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Create Account</h1>
        <p className="sub">Register for MIR Relay Operations</p>

        {generalError && (
          <div className="error-msg">
            <p>{generalError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div>
            <label>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
            />
            {errors.name && <div className="error-msg">{errors.name}</div>}
          </div>
          <div>
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
            />
            {errors.email && <div className="error-msg">{errors.email}</div>}
          </div>
          <div>
            <label>Mobile Number</label>
            <input
              type="text"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="1234567890"
            />
            {errors.mobile && <div className="error-msg">{errors.mobile}</div>}
          </div>
          <div>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            {errors.password && <div className="error-msg">{errors.password}</div>}
          </div>
          <div>
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            {errors.confirm_password && (
              <div className="error-msg">{errors.confirm_password}</div>
            )}
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p
          className="center"
          style={{ marginTop: "20px", fontSize: "13px", color: "var(--ink-2)" }}
        >
          Already have an account?{" "}
          <span className="link" onClick={() => onNavigate("login")}>
            Sign In
          </span>
        </p>
      </div>
    </div>
  );
}

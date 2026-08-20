import React, { useState } from 'react';
import { loginAdmin, registerAdmin } from '../../services/api';

export default function LoginGate({ onLoginSuccess }) {
  const [step, setStep] = useState(1); // 0 = Register, 1 = Credentials, 2 = 2FA Verification, 3 = MFA Setup
  const [name, setName] = useState('');
  const [email, setEmail] = useState('admin');
  const [password, setPassword] = useState('adminpassword');
  const [otpCode, setOtpCode] = useState('');
  const [qrBase64, setQrBase64] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await loginAdmin(email, password, '');
      if (res.require_setup) {
        setQrBase64(res.qr_base64);
        setStep(3);
      } else if (res.require_mfa) {
        setStep(2);
      } else if (res.ok) {
        localStorage.setItem('onesmarter_admin_token', res.token);
        onLoginSuccess(res);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password || !name.trim()) {
      setErrorMsg('Please enter name, email, and password.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      await registerAdmin(email, password, name);
      const res = await loginAdmin(email, password, '');
      if (res.require_setup) {
        setQrBase64(res.qr_base64);
        setStep(3);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e) => {
    if (e) e.preventDefault();
    if (!otpCode) {
      setErrorMsg('Please enter the authenticator code.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await loginAdmin(email, password, otpCode);
      if (res.ok) {
        localStorage.setItem('onesmarter_admin_token', res.token);
        onLoginSuccess(res);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please verify your credentials or code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gate" id="gate">
      <div style={{ width: 'min(400px, 100%)' }}>
        <div className="brand">
          OneSmarter <em>/ Admin</em>
        </div>
        <div className="panel">
          <div className="inner">
            {step === 0 ? (
              <form className="step0" onSubmit={handleRegister}>
                <h1>Create Admin Account</h1>
                <p className="h">Register a new administrator access account.</p>

                {errorMsg && <div className="err on">{errorMsg}</div>}

                <div className="field">
                  <label htmlFor="n">Full name</label>
                  <input
                    id="n"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="u">Work email</label>
                  <input
                    id="u"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="p">Password</label>
                  <input
                    id="p"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <button type="submit" className="full" id="go0" disabled={loading}>
                  {loading ? 'Creating account…' : 'Sign Up'}
                </button>


              </form>
            ) : step === 1 ? (
              <form className="step1" onSubmit={handleContinue}>
                <h1>Admin Sign In</h1>
                <p className="h">Administrator access to client onboarding, compliance evidence, and integrations.</p>

                {errorMsg && <div className="err on">{errorMsg}</div>}

                <div className="field">
                  <label htmlFor="u">Work email</label>
                  <input
                    id="u"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="p">Password</label>
                  <input
                    id="p"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>

                <button type="submit" className="full" id="go1" disabled={loading}>
                  {loading ? 'Signing In…' : 'Continue'}
                </button>


              </form>
            ) : step === 2 ? (
              <form className="step2 on" onSubmit={handleSignIn}>
                <h1>Second Factor</h1>
                <p className="h">Enter the 6-digit code from your authenticator app.</p>

                {errorMsg && <div className="err on">{errorMsg}</div>}

                <div className="field otp">
                  <label htmlFor="o">Authenticator code</label>
                  <input
                    id="o"
                    maxLength={6}
                    inputMode="numeric"
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    autoFocus
                  />
                </div>

                <button type="submit" className="full" id="go2" disabled={loading}>
                  {loading ? 'Verifying…' : 'Sign In'}
                </button>

                <div style={{ textAlign: 'center', marginTop: '14px' }}>
                  <button
                    type="button"
                    style={{ fontSize: '12px', color: 'var(--ink-3)', textDecoration: 'underline' }}
                    onClick={() => { setStep(1); setErrorMsg(''); setOtpCode(''); }}
                  >
                    ← Back to credentials
                  </button>
                </div>
              </form>
            ) : (
              <form className="step3 on" onSubmit={handleSignIn}>
                <h1>Set Up Authenticator</h1>
                <p className="h">Scan the QR code below with your mobile authenticator app (like Google Authenticator).</p>

                <div style={{ textAlign: 'center', margin: '20px 0' }}>
                  {qrBase64 && <img src={`data:image/png;base64,${qrBase64}`} alt="QR Code" style={{ width: '150px', height: '150px' }} />}
                </div>

                {errorMsg && <div className="err on">{errorMsg}</div>}

                <div className="field otp">
                  <label htmlFor="o">Enter 6-digit code to verify</label>
                  <input
                    id="o"
                    maxLength={6}
                    inputMode="numeric"
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    autoFocus
                  />
                </div>

                <button type="submit" className="full" id="go3" disabled={loading}>
                  {loading ? 'Verifying…' : 'Complete Setup & Sign In'}
                </button>

                <div style={{ textAlign: 'center', marginTop: '14px' }}>
                  <button
                    type="button"
                    style={{ fontSize: '12px', color: 'var(--ink-3)', textDecoration: 'underline' }}
                    onClick={() => { setStep(1); setErrorMsg(''); setOtpCode(''); }}
                  >
                    ← Cancel and go back
                  </button>
                </div>
              </form>
            )}
          </div>
          <div className="foot">
            Access is restricted to authorized OneSmarter administrative staff.
          </div>
        </div>
      </div>
    </div>
  );
}

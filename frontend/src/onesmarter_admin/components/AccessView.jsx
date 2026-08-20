import React, { useState, useEffect } from 'react';
import { fetchAccessInfo, fetchClients, createUser } from '../services/api';
import CreateUserModal from './modals/CreateUserModal';

export default function AccessView({ currentUser }) {
  const [accessData, setAccessData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [clients, setClients] = useState([]);

  useEffect(() => {
    loadAccess();
    loadClients();
  }, []);

  async function loadClients() {
    try {
      const data = await fetchClients();
      const list = data.results || data || [];
      setClients(list);
    } catch (err) {
      console.error("Failed to fetch clients", err);
    }
  }

  async function loadAccess() {
    setLoading(true);
    setErrorMessage('');
    try {
      const data = await fetchAccessInfo();
      setAccessData(data);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load access information');
    } finally {
      setLoading(false);
    }
  }

  const handleCreateUser = async (userData) => {
    // The try/catch is removed because CreateUserModal handles the error display.
    // If createUser throws, the modal catches it and shows it in the red banner.
    await createUser(userData);
    setShowCreateModal(false);
    loadAccess(); // Reload the access matrix
  };

  function formatDate(isoStr) {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    } catch (e) {
      return isoStr;
    }
  }

  return (
    <section className="view on" id="v-access">
      <div className="hdr-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="eyebrow">Security Controls</div>
          <h1 style={{ margin: 0 }}>Access Matrix</h1>
          <p className="sub">Administrative staff role-based access and break-glass logging.</p>
        </div>
        <button className="btn primary" onClick={() => setShowCreateModal(true)}>
          + Create User
        </button>
      </div>

      <div className="metrics">
        <div className="metric">
          <div className="v">{accessData?.current_admin?.name || currentUser?.name || 'admin'}</div>
          <div className="l">Current Admin</div>
          <div className="d">{accessData?.current_admin?.role || currentUser?.role || 'Admin'}</div>
        </div>
        <div className="metric">
          <div className="v" style={{ fontSize: '18px' }}>
            {accessData?.last_login ? formatDate(accessData.last_login) : accessData ? 'Never' : 'Loading...'}
          </div>
          <div className="l">Last Login</div>
          <div className="d">Dynamic database record</div>
        </div>
        <div className="metric">
          <div className="v" style={{ fontSize: '18px' }}>
            {accessData?.current_admin?.mfa_status || (accessData ? 'Password Only' : 'Loading...')}
          </div>
          <div className="l">MFA Status</div>
          <div className="d">{accessData?.current_admin?.mfa_desc || 'Dynamic verification'}</div>
        </div>
        <div className="metric">
          <div className="v">{accessData?.current_admin?.session_state || 'Active'}</div>
          <div className="l">Session State</div>
          <div className="d">{accessData?.current_admin?.session_desc || '30-min auto-expire'}</div>
        </div>
      </div>

      {errorMessage && (
        <div className="note" style={{ background: 'var(--brick-bg)', borderColor: 'var(--brick)', color: 'var(--brick)' }}>
          <b>Error:</b> {errorMessage}
        </div>
      )}

      {loading && !accessData ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-3)' }}>
          Loading access controls &amp; login logs...
        </div>
      ) : (
        <>
          <h2 className="sec">Administrative Staff Access</h2>
          <table style={{ width: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Access Level</th>
                <th>Mobile</th>
                <th>Assigned Clients</th>
                <th>MFA Status</th>
                <th>Last Login</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(accessData?.staff || []).map((member, idx) => (
                <tr key={idx}>
                  <td><b>{member.person}</b></td>
                  <td>{member.role}</td>
                  <td><span className="tag ok">{member.access}</span></td>
                  <td>{member.mobile || '—'}</td>
                  <td>
                    {(member.clients || []).length > 0 
                      ? member.clients.join(', ')
                      : 'None'}
                  </td>
                  <td><span className="tag ok">{member.mfa}</span></td>
                  <td className="num">{formatDate(member.last_login)}</td>
                  <td><span className="tag ok">{member.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreateUser}
        clients={clients}
      />
    </section>
  );
}

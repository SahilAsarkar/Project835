import React, { useState, useEffect } from 'react';
import { fetchAccessInfo, fetchClients, createUser, updateUser, deleteUser } from '../services/api';
import CreateUserModal from './modals/CreateUserModal';
import EditUserModal from './modals/EditUserModal';
import UserDetailsModal from './modals/UserDetailsModal';

export default function AccessView({ currentUser }) {
  const [accessData, setAccessData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [clients, setClients] = useState([]);
  
  // Sorting state
  const [sortField, setSortField] = useState('person');
  const [sortDirection, setSortDirection] = useState('asc');

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

  const isSuperAdmin = currentUser?.role === 'Super Admin' || currentUser?.is_superuser;

  const handleCreateUser = async (userData) => {
    if ((userData.role === 'Admin' || userData.role === 'Super Admin') && !isSuperAdmin) {
      alert("Access Denied: Standard Admins cannot create Admin or Super Admin accounts.");
      return;
    }
    await createUser(userData);
    setShowCreateModal(false);
    loadAccess();
  };

  const handleEditUser = async (userId, updatedData) => {
    const targetUser = accessData?.staff?.find(u => u.id === userId);
    const targetIsAdmin = targetUser?.role === 'Admin' || targetUser?.role === 'Super Admin' || targetUser?.is_staff || targetUser?.is_superuser;
    const tryingToPromote = updatedData.role === 'Admin' || updatedData.role === 'Super Admin';

    if ((targetIsAdmin || tryingToPromote) && !isSuperAdmin) {
      alert("Access Denied: Standard Admins cannot modify Admin/Super Admin roles or accounts.");
      return;
    }
    await updateUser(userId, updatedData);
    setShowEditModal(false);
    loadAccess();
  };

  const handleDeleteUser = async (member) => {
    const isTargetAdmin = member.role === 'Admin' || member.role === 'Super Admin' || member.is_staff || member.is_superuser;
    if (isTargetAdmin && !isSuperAdmin) {
      alert("Access Denied: Standard Admins cannot delete Admin or Super Admin accounts.");
      return;
    }
    const isCurrentUser = member.email === currentUser?.email;
    const confirmMsg = isCurrentUser
      ? `WARNING: You are about to delete your own administrative account (${member.email}). Are you sure you want to proceed?`
      : `Are you sure you want to delete the ${member.role.toLowerCase()} account (${member.email})?`;
      
    if (window.confirm(confirmMsg)) {
      try {
        setLoading(true);
        await deleteUser(member.id);
        loadAccess();
      } catch (err) {
        setErrorMessage(err.message || 'Failed to delete user.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) return <span style={{ marginLeft: '4px', opacity: 0.3, fontSize: '10px' }}>⇅</span>;
    return sortDirection === 'asc' 
      ? <span style={{ marginLeft: '4px', color: 'var(--teal)', fontSize: '10px' }}>▲</span>
      : <span style={{ marginLeft: '4px', color: 'var(--teal)', fontSize: '10px' }}>▼</span>;
  };

  const getSortedMembers = () => {
    if (!accessData || !accessData.staff) return [];
    const members = [...accessData.staff];
    if (!sortField) return members;

    return members.sort((a, b) => {
      let valA = '';
      let valB = '';

      if (sortField === 'person') {
        valA = a.person || '';
        valB = b.person || '';
      } else if (sortField === 'email') {
        valA = a.email || '';
        valB = b.email || '';
      } else if (sortField === 'role') {
        valA = a.role || '';
        valB = b.role || '';
      } else if (sortField === 'mobile') {
        valA = a.mobile || '';
        valB = b.mobile || '';
      } else if (sortField === 'client') {
        valA = (a.clients && a.clients[0]) || '';
        valB = (b.clients && b.clients[0]) || '';
      }

      valA = valA.toString().toLowerCase();
      valB = valB.toString().toLowerCase();

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
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

  const sortedMembers = getSortedMembers();

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
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th onClick={() => handleSort('person')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Person {renderSortIcon('person')}
                </th>
                <th onClick={() => handleSort('email')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Email {renderSortIcon('email')}
                </th>
                <th onClick={() => handleSort('role')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Role {renderSortIcon('role')}
                </th>
                <th onClick={() => handleSort('mobile')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Mobile {renderSortIcon('mobile')}
                </th>
                <th onClick={() => handleSort('client')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Client {renderSortIcon('client')}
                </th>
                <th>MFA Status</th>
                <th>Last Login</th>
                <th>Status</th>
                <th style={{ textAlign: 'center', width: '80px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map((member, idx) => (
                <tr key={member.id || idx}>
                  <td>
                    <b 
                      style={{ cursor: 'pointer', color: 'var(--teal)', textDecoration: 'underline' }} 
                      onClick={() => { setSelectedUser(member); setShowDetailsModal(true); }}
                      title="View user details"
                    >
                      {member.person}
                    </b>
                  </td>
                  <td><span style={{ fontSize: '12.5px', fontFamily: 'monospace' }}>{member.email}</span></td>
                  <td>{member.role}</td>
                  <td>{member.mobile || '—'}</td>
                  <td>
                    {(member.clients || []).length > 0 
                      ? member.clients.join(', ')
                      : 'None'}
                  </td>
                  <td>
                    <span className={`tag ${member.mfa === 'Enabled' ? 'ok' : 'err'}`}>
                      {member.mfa}
                    </span>
                  </td>
                  <td className="num">{formatDate(member.last_login)}</td>
                  <td><span className="tag ok">{member.status}</span></td>
                  <td style={{ textAlign: 'center' }}>
                    {((member.role === 'Admin' || member.role === 'Super Admin') && !(currentUser?.role === 'Super Admin' || currentUser?.is_superuser)) ? (
                      <span style={{ color: 'var(--ink-3)', fontSize: '12px' }} title="Admins cannot manage other Admins/Super Admins">🔒</span>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <button 
                          className="btn icon-btn" 
                          title="Edit Account"
                          onClick={() => {
                            setSelectedUser({
                              ...member,
                              client_id: clients.find(c => c.name === member.clients?.[0])?.id || ''
                            });
                            setShowEditModal(true);
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                        >
                          <svg width="15" height="15" fill="var(--teal)" viewBox="0 0 16 16">
                            <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </td>
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
        currentUser={currentUser}
      />

      <EditUserModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedUser(null); }}
        onSave={handleEditUser}
        onDelete={handleDeleteUser}
        clients={clients}
        user={selectedUser}
        currentUser={currentUser}
      />

      <UserDetailsModal
        isOpen={showDetailsModal}
        onClose={() => { setShowDetailsModal(false); setSelectedUser(null); }}
        user={selectedUser}
      />
    </section>
  );
}

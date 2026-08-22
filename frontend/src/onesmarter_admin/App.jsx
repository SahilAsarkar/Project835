import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ClientsTable from './components/ClientsTable';
import OnboardingLadder from './components/OnboardingLadder';
import DocumentsView from './components/DocumentsView';
import FilesView from './components/FilesView';
import GoLiveView from './components/GoLiveView';
import AccessView from './components/AccessView';
import AddClientModal from './components/modals/AddClientModal';
import NotesModal from './components/modals/NotesModal';
import AddRoleModal from './components/modals/AddRoleModal';
import RedoConfirmModal from './components/modals/RedoConfirmModal';
import RevokeClientModal from './components/modals/RevokeClientModal';
import FeedbackModal from './components/modals/FeedbackModal';
import LoginGate from './components/login/LoginGate';
import MappingApp from './components/MappingTool/MappingApp';

import { fetchClients, fetchClientState, createClient, deleteClient, redoStep, fetchEmployeeRoles, fetchAuditLogs, fetchAccessInfo, logoutAdmin } from './services/api';

function formatDateTime(isoStr) {
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

function renderAuditDetails(details) {
  if (!details) return '—';
  const match = details.match(/^(.*?) changed from '(.*?)' to '(.*?)'(.*)$/i);
  if (match) {
    const [, prefix, oldVal, newVal, suffix] = match;
    return (
      <span>
        {prefix && <span>{prefix} </span>}
        <span style={{ textDecoration: 'line-through', color: 'var(--brick)', opacity: 0.85, marginRight: '4px' }}>
          '{oldVal}'
        </span>
        <span style={{ color: 'var(--ink-2)', marginRight: '4px', fontWeight: 600 }}>→</span>
        <span style={{ fontWeight: 600, color: 'var(--teal)' }}>
          '{newVal}'
        </span>
        {suffix && <span> {suffix}</span>}
      </span>
    );
  }
  return details;
}

export default function App({ user, onLogout }) {
  const isMappingRoute = window.location.pathname.startsWith('/mapping');
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentUser, setCurrentUser] = useState(() => {
    return user || { name: "Sahil Asarkar", email: "admin@onesmarter.com", role: "Admin", client: "OneSmarter" };
  });

  const [clients, setClients] = useState([]);
  const [activeClientId, setActiveClientId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('client') || '';
  });
  const [clientState, setClientState] = useState(null);
  const [activeNav, setActiveNav] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const n = params.get('nav');
    if (n === 'onboarding' || n === 'onboard') return 'onboard';
    if (n) return n;
    if (params.get('client')) return 'onboard';
    return 'clients';
  });
  const [roles, setRoles] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [recentLogins, setRecentLogins] = useState([]);
  const [auditClientFilter, setAuditClientFilter] = useState('');
  const [auditModuleFilter, setAuditModuleFilter] = useState('');
  const [auditSortField, setAuditSortField] = useState('timestamp');
  const [auditSortDirection, setAuditSortDirection] = useState('desc');

  // Modal states
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [activeNoteTarget, setActiveNoteTarget] = useState({ stepKey: '', stepTitle: '' });
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [appFeedback, setAppFeedback] = useState({ isOpen: false, kind: 'ok', title: '', content: '' });
  const [isRedoOpen, setIsRedoOpen] = useState(false);
  const [redoTarget, setRedoTarget] = useState({ stepKey: '', stepNum: null });
  const [redoLoading, setRedoLoading] = useState(false);
  const [isRevokeOpen, setIsRevokeOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeLoading, setRevokeLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadClients();
    loadRoles();
    loadAuditLogs();

    // Auto-update client status in real-time every 3 seconds
    const interval = setInterval(() => {
      loadClients();
      if (activeClientId) {
        loadClientWorkflow(activeClientId);
      }
    }, 3000);

    const onFocus = () => {
      loadClients();
      if (activeClientId) {
        loadClientWorkflow(activeClientId);
      }
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [isAuthenticated, activeClientId]);

  // Sync state to URL for persistence on refresh
  useEffect(() => {
    if (!activeNav && !activeClientId) return;
    const url = new URL(window.location.href);
    let changed = false;
    
    if (activeNav) {
      if (url.searchParams.get('nav') !== activeNav) {
        url.searchParams.set('nav', activeNav);
        changed = true;
      }
    } else if (url.searchParams.has('nav')) {
      url.searchParams.delete('nav');
      changed = true;
    }
    
    if (activeClientId) {
      if (url.searchParams.get('client') !== activeClientId) {
        url.searchParams.set('client', activeClientId);
        changed = true;
      }
    } else if (url.searchParams.has('client')) {
      url.searchParams.delete('client');
      changed = true;
    }
    
    if (changed) {
      window.history.replaceState({}, '', url.toString());
    }
  }, [activeNav, activeClientId]);

  const loadClients = async () => {
    try {
      const data = await fetchClients();
      const list = data.results || data || [];
      setClients(list);
      if (list.length > 0 && !activeClientId) {
        setActiveClientId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load clients:', err);
    }
  };

  const loadRoles = async () => {
    try {
      const data = await fetchEmployeeRoles();
      setRoles(data.roles || []);
    } catch (err) {
      console.error('Failed to load employee roles:', err);
    }
  };

  const loadAuditLogs = async (cid = auditClientFilter, mod = auditModuleFilter) => {
    try {
      const logs = await fetchAuditLogs(cid, mod);
      setAuditLogs(logs);
      const accessData = await fetchAccessInfo();
      setRecentLogins(accessData.recent_logins || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  const handleAuditSort = (field) => {
    if (auditSortField === field) {
      setAuditSortDirection(auditSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setAuditSortField(field);
      setAuditSortDirection('asc');
    }
  };

  const getSortedAuditLogs = () => {
    if (!auditLogs) return [];
    const logs = [...auditLogs];
    if (!auditSortField) return logs;
    return logs.sort((a, b) => {
      let valA = '';
      let valB = '';
      if (auditSortField === 'timestamp') {
        valA = a.timestamp || '';
        valB = b.timestamp || '';
      } else if (auditSortField === 'module') {
        valA = a.module || '';
        valB = b.module || '';
      } else if (auditSortField === 'action') {
        valA = a.action || '';
        valB = b.action || '';
      } else if (auditSortField === 'client') {
        valA = a.client_name || a.client || '';
        valB = b.client_name || b.client || '';
      } else if (auditSortField === 'performed_by') {
        valA = a.performed_by || '';
        valB = b.performed_by || '';
      }
      valA = valA.toString().toLowerCase();
      valB = valB.toString().toLowerCase();
      if (valA < valB) return auditSortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return auditSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const renderAuditSortIcon = (field) => {
    if (auditSortField !== field) return <span style={{ marginLeft: '4px', opacity: 0.3, fontSize: '10px' }}>⇅</span>;
    return auditSortDirection === 'asc' 
      ? <span style={{ marginLeft: '4px', color: 'var(--teal)', fontSize: '10px' }}>▲</span>
      : <span style={{ marginLeft: '4px', color: 'var(--teal)', fontSize: '10px' }}>▼</span>;
  };

  const loadClientWorkflow = async (clientId) => {
    try {
      const state = await fetchClientState(clientId);
      setClientState(state);
    } catch (err) {
      console.error('Failed to load client workflow:', err);
    }
  };

  const handleSelectClient = (clientId) => {
    setActiveClientId(clientId);
    loadClientWorkflow(clientId);
  };

  const handleSelectClientInGoLive = (clientId) => {
    setActiveClientId(clientId);
    loadClientWorkflow(clientId);
  };

  const handleOpenRevoke = (client) => {
    const target = typeof client === 'string' 
      ? clients.find(c => c.id === client) || { id: client, name: client } 
      : client;
    setRevokeTarget(target);
    setIsRevokeOpen(true);
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget?.id) return;
    setRevokeLoading(true);
    try {
      await deleteClient(revokeTarget.id);
      await loadClients();
      if (activeClientId === revokeTarget.id) {
        setActiveClientId(null);
        setClientState(null);
        setActiveNav('clients');
      }
      setIsRevokeOpen(false);
      setRevokeTarget(null);
    } catch (err) {
      console.error('Failed to revoke client:', err);
      setAppFeedback({ isOpen: true, kind: 'bad', title: 'Revocation Failed', content: err.message });
    } finally {
      setRevokeLoading(false);
    }
  };

  const handleClientCreated = (newClient) => {
    loadClients();
    setActiveClientId(newClient.id);
    loadClientWorkflow(newClient.id);
  };

  const handleOpenNotes = (stepKey, stepTitle) => {
    setActiveNoteTarget({ stepKey, stepTitle });
    setIsNotesOpen(true);
  };

  const handleOpenRedo = (stepKey, stepNum) => {
    setRedoTarget({ stepKey, stepNum });
    setIsRedoOpen(true);
  };

  const handleConfirmRedo = async () => {
    if (!redoTarget.stepKey || !activeClientId) return;
    setRedoLoading(true);
    try {
      await redoStep(activeClientId, redoTarget.stepKey);
      await loadClientWorkflow(activeClientId);
      await loadClients();
      setIsRedoOpen(false);
    } catch (err) {
      setAppFeedback({ isOpen: true, kind: 'bad', title: 'Redo Failed', content: err.message });
    } finally {
      setRedoLoading(false);
    }
  };

  const handleLoginSuccess = (res) => {
    if (res && res.user) {
      localStorage.setItem('onesmarter_admin_user', JSON.stringify(res.user));
      setCurrentUser(res.user);
    }
    setIsAuthenticated(true);
  };

  const handleSignOut = async () => {
    if (onLogout) {
      await onLogout();
    } else {
      await logoutAdmin();
      localStorage.removeItem('onesmarter_admin_token');
      localStorage.removeItem('onesmarter_admin_user');
      setCurrentUser(null);
      setIsAuthenticated(false);
    }
  };

  const currentClient = clients.find(c => c.id === activeClientId) || clients[0];

  if (!isAuthenticated) {
    return <LoginGate onLoginSuccess={handleLoginSuccess} />;
  }

  if (isMappingRoute) {
    return (
      <MappingApp
        clients={clients}
        activeClientId={activeClientId}
        currentClient={currentClient}
        onSelectClient={handleSelectClient}
        onSignOut={handleSignOut}
        currentUser={currentUser}
      />
    );
  }

  return (
    <>
      <Header
        onSignOut={handleSignOut}
        currentUser={currentUser}
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
      />

      <div className="shell">
        {/* Left Navigation Sidebar matching POC exactly */}
        <nav className="rail" style={{ display: isSidebarOpen ? 'block' : 'none' }}>
          <div className="grp eyebrow">Clients</div>
          <button className={`navitem ${activeNav === 'clients' ? 'on' : ''}`} onClick={() => setActiveNav('clients')}>
            <span>All Clients</span>
            <span className="count">{clients.length}</span>
          </button>
          <button className={`navitem ${activeNav === 'onboard' ? 'on' : ''}`} onClick={() => setActiveNav('onboard')}>
            <span>Onboarding</span>
          </button>
          <button className={`navitem ${activeNav === 'docs' ? 'on' : ''}`} onClick={() => setActiveNav('docs')}>
            <span>Documents</span>
          </button>
          <button className={`navitem ${activeNav === 'files' ? 'on' : ''}`} onClick={() => setActiveNav('files')}>
            <span>Files</span>
          </button>

          <div className="grp eyebrow" style={{ paddingTop: '18px' }}>Pre-Production</div>
          <button className={`navitem ${activeNav === 'promote' ? 'on' : ''}`} onClick={() => setActiveNav('promote')}>
            <span>Go Live</span>
          </button>

          <div className="grp eyebrow" style={{ paddingTop: '18px' }}>Governance</div>
          <button className={`navitem ${activeNav === 'trust' ? 'on' : ''}`} onClick={() => setActiveNav('trust')}>
            <span>Trust Center</span>
          </button>
          <button className={`navitem ${activeNav === 'access' ? 'on' : ''}`} onClick={() => setActiveNav('access')}>
            <span>Access</span>
          </button>
          <button className={`navitem ${activeNav === 'audit' ? 'on' : ''}`} onClick={() => setActiveNav('audit')}>
            <span>Audit Log</span>
          </button>

          <div className="grp eyebrow" style={{ paddingTop: '18px' }}>Operations</div>
          <button className={`navitem ${activeNav === 'ops' ? 'on' : ''}`} onClick={() => setActiveNav('ops')}>
            <span>Operations</span>
          </button>
          <button className={`navitem ${activeNav === 'offboard' ? 'on' : ''}`} onClick={() => setActiveNav('offboard')}>
            <span>Offboarding</span>
          </button>
        </nav>

        <main className="main">
          {activeNav === 'clients' && (
            <ClientsTable
              clients={clients}
              onSelectClient={(clientId) => {
                handleSelectClient(clientId);
                setActiveNav('onboard');
              }}
              onOpenAddClient={() => setIsAddClientOpen(true)}
              onDeleteClient={handleOpenRevoke}
            />
          )}

          {(activeNav === 'onboard' || activeNav === 'onboarding') && (
            <OnboardingLadder
              client={clientState?.client || clients.find(c => c.id === activeClientId)}
              steps={clientState?.steps || []}
              roles={roles}
              clients={clients}
              onSelectClient={handleSelectClient}
              onRefresh={() => { loadClients(); loadClientWorkflow(activeClientId); }}
              onOpenNotes={handleOpenNotes}
              onOpenRedo={handleOpenRedo}
              onOpenAddRole={() => setIsAddRoleOpen(true)}
            />
          )}

          {activeNav === 'docs' && (
            <DocumentsView
              clients={clients}
              activeClientId={activeClientId}
              onSelectClient={handleSelectClient}
            />
          )}

          {activeNav === 'files' && (
            <FilesView
              clients={clients}
              activeClientId={activeClientId}
              onSelectClient={handleSelectClient}
            />
          )}

          {activeNav === 'promote' && (
            <GoLiveView
              clients={clients}
              activeClientId={activeClientId}
              onSelectClient={handleSelectClientInGoLive}
              onClientUpdated={() => { loadClients(); loadClientWorkflow(activeClientId); }}
              onOpenNotes={handleOpenNotes}
            />
          )}

          {activeNav === 'trust' && (
            <section className="view on" id="v-trust">
              <div className="hdr-row">
                <div>
                  <div className="eyebrow">Compliance Assurance</div>
                  <h1>Trust Center</h1>
                  <p className="sub">Security, encryption, HIPAA safeguards, and compliance attestations.</p>
                </div>
              </div>
              <div className="metrics">
                <div className="metric">
                  <div className="v" style={{ fontSize: '20px', fontWeight: 600 }}>SOC 2 Type II</div>
                  <div className="l">
                    <span className="tag ok">Attested</span>
                  </div>
                  <div className="d">Report available under NDA</div>
                </div>
                <div className="metric">
                  <div className="v" style={{ fontSize: '20px', fontWeight: 600 }}>ISO 27001</div>
                  <div className="l">
                    <span className="tag ok">Certified</span>
                  </div>
                  <div className="d">Surveillance audit Q1 2026</div>
                </div>
                <div className="metric">
                  <div className="v" style={{ fontSize: '20px', fontWeight: 600 }}>HIPAA Audit</div>
                  <div className="l">
                    <span className="tag ok">Audited</span>
                  </div>
                  <div className="d">Safeguards verified</div>
                </div>
                <div className="metric">
                  <div className="v" style={{ fontSize: '20px', fontWeight: 600 }}>Post-Quantum</div>
                  <div className="l">
                    <span className="tag ok">Encrypted</span>
                  </div>
                  <div className="d">ML-DSA-65 signatures</div>
                </div>
              </div>

              <h2 className="sec">Security Policies &amp; Standards</h2>
              <table style={{ width: '100%', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th>Policy / Document</th>
                    <th>Standard</th>
                    <th>Status</th>
                    <th>Last Reviewed</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><b>Information Security Policy</b></td>
                    <td>ISO 27001:2022</td>
                    <td><span className="tag ok">Published</span></td>
                    <td className="num">15 Jan 2026</td>
                  </tr>
                  <tr>
                    <td><b>Incident Response Plan</b></td>
                    <td>NIST SP 800-61</td>
                    <td><span className="tag ok">Active</span></td>
                    <td className="num">10 Feb 2026</td>
                  </tr>
                  <tr>
                    <td><b>HIPAA Security Rule Safeguards</b></td>
                    <td>45 CFR Part 160/164</td>
                    <td><span className="tag ok">Compliant</span></td>
                    <td className="num">02 Feb 2026</td>
                  </tr>
                  <tr>
                    <td><b>Access Control Policy</b></td>
                    <td>SOC 2 CC6.0</td>
                    <td><span className="tag ok">Published</span></td>
                    <td className="num">18 Jan 2026</td>
                  </tr>
                </tbody>
              </table>
            </section>
          )}

          {activeNav === 'access' && (
            <AccessView currentUser={currentUser} />
          )}

          {activeNav === 'audit' && (
            <section className="view on" id="v-audit">
              <div className="hdr-row">
                <div>
                  <div className="eyebrow">Append Only Audit</div>
                  <h1>Audit Log</h1>
                  <p className="sub">Immutable audit trail of all client onboarding, document, test, go-live, and administrative actions.</p>
                </div>
              </div>

              <div className="filters" style={{ borderBottom: '1px solid var(--line)', marginBottom: '16px' }}>
                <select
                  value={auditClientFilter}
                  onChange={e => setAuditClientFilter(e.target.value)}
                >
                  <option value="">All Clients</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={auditModuleFilter}
                  onChange={e => setAuditModuleFilter(e.target.value)}
                >
                  <option value="">All Modules</option>
                  <option value="CLIENTS">Clients</option>
                  <option value="DOCUMENTS">Documents</option>
                  <option value="ONBOARDING">Onboarding</option>
                  <option value="TEST_ENV">Test Environment</option>
                  <option value="GO_LIVE">Go Live</option>
                  <option value="AUTH">Authentication</option>
                  <option value="SYSTEM">System</option>
                </select>

                <span className="n">{auditLogs.length} Events Recorded</span>
              </div>

              <table>
                <thead>
                  <tr>
                    <th onClick={() => handleAuditSort('timestamp')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      When {renderAuditSortIcon('timestamp')}
                    </th>
                    <th onClick={() => handleAuditSort('module')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Module {renderAuditSortIcon('module')}
                    </th>
                    <th onClick={() => handleAuditSort('action')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Action {renderAuditSortIcon('action')}
                    </th>
                    <th onClick={() => handleAuditSort('client')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Client {renderAuditSortIcon('client')}
                    </th>
                    <th>Details</th>
                    <th onClick={() => handleAuditSort('performed_by')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Who {renderAuditSortIcon('performed_by')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--ink-3)' }}>
                        No audit log entries found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    getSortedAuditLogs().map((log) => (
                      <tr key={log.id}>
                        <td className="num">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                        <td><span className="tag" style={{ textTransform: 'uppercase', fontSize: '10px' }}>{log.module || 'SYSTEM'}</span></td>
                        <td><span className="tag ok">{log.action}</span></td>
                        <td><b>{log.client_name || log.client || 'System'}</b></td>
                        <td>{renderAuditDetails(log.details)}</td>
                        <td className="num">{log.performed_by || 'Admin User'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <h2 className="sec" style={{ marginTop: '28px' }}>Recent Administrator Login History</h2>
              <table style={{ width: '100%', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th>Login Timestamp</th>
                    <th>Admin Username</th>
                    <th>IP Address</th>
                    <th>Client User Agent</th>
                    <th>Status</th>
                    <th>Logout Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogins.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: 'var(--ink-3)', padding: '16px' }}>
                        No recent logins recorded.
                      </td>
                    </tr>
                  ) : (
                    recentLogins.map((log) => (
                      <tr key={log.id}>
                        <td className="num">{formatDateTime(log.login_time)}</td>
                        <td><b>{log.username}</b></td>
                        <td><code>{log.ip_address}</code></td>
                        <td style={{ fontSize: '12px', color: 'var(--ink-2)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.user_agent}
                        </td>
                        <td>
                          <span className={`tag ${log.status === 'SUCCESS' ? 'ok' : 'bad'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="num">{formatDateTime(log.logout_time)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          )}

          {activeNav === 'ops' && (
            <section className="view on" id="v-ops">
              <div className="eyebrow">Reliability</div>
              <h1>Operations &amp; Delivery</h1>
              <p className="sub">File delivery metrics, silent folder monitoring, and SLA tracking.</p>
              <div className="metrics">
                <div className="metric"><div className="v">99.98%</div><div className="l">Delivery Success</div><div className="d">90-day average</div></div>
                <div className="metric"><div className="v">12m</div><div className="l">Restore Drill</div><div className="d">Completed successfully</div></div>
                <div className="metric"><div className="v">0</div><div className="l">Open Incidents</div><div className="d">Healthy operation</div></div>
              </div>
            </section>
          )}

          {activeNav === 'offboard' && (
            <section className="view on" id="v-offboard">
              <div className="eyebrow">Lifecycle Termination</div>
              <h1>Offboarding Procedures</h1>
              <p className="sub">Cryptographic key destruction and certified data return upon client contract conclusion.</p>
              <div className="ladder">
                <div className="rung"><div className="mark">1</div><div className="txt"><h3>Termination Notice Recorded</h3><div className="meta">Effective date registered in database</div></div></div>
                <div className="rung"><div className="mark">2</div><div className="txt"><h3>Archive Returned to Client</h3><div className="meta">Exported in standard format with intact digital signatures</div></div></div>
                <div className="rung"><div className="mark">3</div><div className="txt"><h3>Tenant Key Destruction</h3><div className="meta">Permanent erasure of wrapped post-quantum tenant keys</div></div></div>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Viewport Centered Modals */}
      <AddClientModal
        isOpen={isAddClientOpen}
        onClose={() => setIsAddClientOpen(false)}
        onClientCreated={handleClientCreated}
        existingClients={clients}
      />

      <NotesModal
        isOpen={isNotesOpen}
        onClose={() => setIsNotesOpen(false)}
        clientId={activeClientId}
        stepKey={activeNoteTarget.stepKey}
        stepTitle={activeNoteTarget.stepTitle}
      />

      <AddRoleModal
        isOpen={isAddRoleOpen}
        onClose={() => setIsAddRoleOpen(false)}
        onRoleAdded={loadRoles}
      />

      <RedoConfirmModal
        isOpen={isRedoOpen}
        onClose={() => setIsRedoOpen(false)}
        stepNum={redoTarget.stepNum}
        onConfirm={handleConfirmRedo}
        loading={redoLoading}
      />

      <RevokeClientModal
        isOpen={isRevokeOpen}
        onClose={() => { if (!revokeLoading) setIsRevokeOpen(false); }}
        client={revokeTarget}
        onConfirm={handleConfirmRevoke}
        loading={revokeLoading}
      />

      <FeedbackModal
        isOpen={appFeedback.isOpen}
        onClose={() => setAppFeedback({ ...appFeedback, isOpen: false })}
        kind={appFeedback.kind}
        title={appFeedback.title}
        content={appFeedback.content}
        checks={[]}
      />
    </>
  );
}

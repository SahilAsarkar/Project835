import React, { useState } from 'react';

/**
 * Format ISO date string into DD/MM/YYYY
 */
function formatDate(dateVal) {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return dateVal;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Stage Badge Renderer matching compliance status design tokens
 */
function getStageBadge(stage) {
  const s = (stage || '').toLowerCase().replace(/[\s-]/g, '_');
  if (s === 'production') {
    return <span className="tag ok">Production</span>;
  }
  if (s === 'production_pending') {
    return <span className="tag amber">Production Pending</span>;
  }
  if (s === 'golive_pending' || s === 'go_live_pending') {
    return <span className="tag purple">Go Live Pending</span>;
  }
  if (s === 'onboarding_completed' || s === 'onboarding_complete') {
    return <span className="tag blue">Onboarding Completed</span>;
  }
  if (s === 'go_live_incomplete' || s === 'golive_incomplete') {
    return <span className="tag work">Go Live Incomplete</span>;
  }
  if (s.startsWith('onboarding_step_')) {
    const stepNum = s.split('_').pop();
    return <span className="tag work">Step {stepNum} In Progress</span>;
  }
  return <span className="tag work">Onboarding Pending</span>;
}

export default function ClientsTable({ clients = [], onSelectClient, onOpenAddClient, onDeleteClient }) {
  const [filterStage, setFilterStage] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Real-time metric counters driven by database state
  const totalCount = clients.length;
  const inOnbCount = clients.filter(c => {
    const s = (c.stage || '').toLowerCase().replace(/[\s-]/g, '_');
    return s.startsWith('onboarding_step_') || s === 'onboarding_pending';
  }).length;
  const preFlightCount = clients.filter(c => {
    const s = (c.stage || '').toLowerCase().replace(/[\s-]/g, '_');
    return s === 'onboarding_completed' || s === 'golive_pending' || s === 'go_live_pending' || s === 'production_pending';
  }).length;
  const prodCount = clients.filter(c => (c.stage || '').toLowerCase() === 'production').length;

  // Filter clients dynamically by stage and search input
  const filteredClients = clients.filter((c) => {
    const s = (c.stage || '').toLowerCase().replace(/[\s-]/g, '_');
    let matchesStage = true;
    if (filterStage === 'onboarding_pending') matchesStage = s === 'onboarding_pending' || s === 'onboarding' || s.startsWith('onboarding_step_');
    else if (filterStage === 'onboarding_completed') matchesStage = s === 'onboarding_completed';
    else if (filterStage === 'golive_pending') matchesStage = s === 'golive_pending' || s === 'go_live_pending';
    else if (filterStage === 'production_pending') matchesStage = s === 'production_pending';
    else if (filterStage === 'production') matchesStage = s === 'production';

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(searchLower) ||
      (c.id && c.id.toLowerCase().includes(searchLower)) ||
      (c.code && c.code.toLowerCase().includes(searchLower)) ||
      (c.owner && c.owner.toLowerCase().includes(searchLower)) ||
      (c.claimsSystem && c.claimsSystem.toLowerCase().includes(searchLower)) ||
      (c.claims_system && c.claims_system.toLowerCase().includes(searchLower));

    return matchesStage && matchesSearch;
  });

  return (
    <section className="view on" id="v-clients">
      {/* Header & Primary Action */}
      <div className="hdr-row">
        <div>
          <div className="eyebrow">Tenants</div>
          <h1>All Clients</h1>
          <p className="sub">
            Dynamic relational database-driven client registry for administrative management and lifecycle tracking.
          </p>
        </div>
        <button className="btn primary" id="btn-add-client" onClick={onOpenAddClient}>
          + Add Client
        </button>
      </div>

      {/* Database KPI Metric Cards */}
      <div className="metrics">
        <div className="metric">
          <div className="v" id="stat-total">{totalCount}</div>
          <div className="l">Total Tenants</div>
          <div className="d">Active Accounts in Registry</div>
        </div>
        <div className="metric">
          <div className="v" id="stat-onb">{inOnbCount}</div>
          <div className="l">In Onboarding</div>
          <div className="d">Completing Initial Setup</div>
        </div>
        <div className="metric">
          <div className="v" id="stat-golive">{preFlightCount}</div>
          <div className="l">Go-Live &amp; Pre-Flight</div>
          <div className="d">Verified &amp; Cutover Scheduled</div>
        </div>
        <div className="metric">
          <div className="v" id="stat-prod">{prodCount}</div>
          <div className="l">In Production</div>
          <div className="d">Delivering MIR to MPL</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filters">
        <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)}>
          <option value="all">All Stages</option>
          <option value="onboarding_pending">Onboarding Pending</option>
          <option value="onboarding_completed">Onboarding Completed</option>
          <option value="golive_pending">Go Live Pending</option>
          <option value="production_pending">Production Pending</option>
          <option value="production">Production</option>
        </select>
        <input
          placeholder="Filter clients by name, owner, or identifier…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span className="n">{filteredClients.length} of {clients.length} shown</span>
      </div>

      {/* Relational Client Grid */}
      <table className="clickable">
        <thead>
          <tr>
            <th style={{ width: '24%' }}>Client</th>
            <th style={{ width: '15%' }}>Stage</th>
            <th style={{ width: '14%' }}>Claims System</th>
            <th style={{ width: '13%' }}>Live Since / Started</th>
            <th style={{ width: '18%' }}>Onboarding Progress</th>
            <th style={{ width: '10%' }}>Owner</th>
            {/* <th style={{ width: '6%', textAlign: 'center' }}>Actions</th> */}
          </tr>
        </thead>
        <tbody id="clients-body">
          {filteredClients.length === 0 ? (
            <tr>
              <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--ink-3)' }}>
                No clients match the current filter or search criteria.
              </td>
            </tr>
          ) : (
            filteredClients.map((c) => {
              const isProd = (c.stage || '').toLowerCase() === 'production';
              const displayOwner = c.owner || 'Unassigned';
              const displayClaims = c.claimsSystem || c.claims_system || 'Unknown';
              const displayDate = formatDate(c.liveSince || c.live_since || c.created_at);
              const progressPct = c.progress_pct || 0;

              return (
                <tr key={c.id} onClick={() => onSelectClient(c.id)} title={`Click to view ${c.name} workspace`}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '13px' }}>{c.name}</div>
                    <div className="mono" style={{ fontSize: '11px', color: 'var(--ink-3)', marginTop: '2px' }}>
                      {c.code || c.client_code || c.id}
                    </div>
                  </td>
                  <td>{getStageBadge(c.stage)}</td>
                  <td>
                    <span style={{ color: 'var(--ink-2)' }}>{displayClaims}</span>
                  </td>
                  <td className="num" style={{ color: 'var(--ink-2)' }}>{displayDate}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, background: 'var(--line-soft)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${progressPct}%`,
                            background: isProd ? 'var(--teal)' : 'var(--ochre)',
                            height: '100%',
                            borderRadius: '3px'
                          }}
                        />
                      </div>
                      <span className="mono" style={{ fontSize: '11px', minWidth: '32px', color: 'var(--ink-2)', textAlign: 'right' }}>
                        {progressPct}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{displayOwner}</span>
                  </td>
                  {/* <td style={{ textAlign: 'center' }}>
                    <button
                      className="btn tiny"
                      style={{
                        border: '1px solid #E2B2AD',
                        background: 'var(--brick-bg)',
                        color: 'var(--brick)',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: '3px'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteClient && onDeleteClient(c);
                      }}
                      title="Revoke / Delete Client"
                    >
                      Revoke
                    </button>
                  </td> */}
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <div className="note">
        <b>Client-Aware Architecture:</b> Every client maintains an isolated sequential compliance workflow, notes, contacts, transfer setup, and audit records in the database.
      </div>
    </section>
  );
}

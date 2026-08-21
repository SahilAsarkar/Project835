import React, { useState, useEffect, useRef } from 'react';
import './mapping.css';
import { MappingPreview } from './MappingPreview';
import { postStepData, fetchMappings as apiFetchMappings, saveMappings as apiSaveMappings, resetMappings as apiResetMappings, checkMappings as apiCheckMappings } from '../../services/api';
import ConfirmModal from '../modals/ConfirmModal';
import FeedbackModal from '../modals/FeedbackModal';
import Header from '../Header';

const SOURCES = [
  {id:'CLP01',label:'CLP01 — Claim Submitter Identifier / Claim Number',rule:'Claim loop: CLP01',scope:'Claim loop',sample:'12345678901234567'},
  {id:'CLP02',label:'CLP02 — Claim Status Code',rule:'Claim loop: CLP02',scope:'Claim loop',sample:'1'},
  {id:'CLP03',label:'CLP03 — Total Claim Charge Amount',rule:'Claim loop: CLP03',scope:'Claim loop',sample:'100.00'},
  {id:'CLP04',label:'CLP04 — Claim Payment Amount',rule:'Claim loop: CLP04',scope:'Claim loop',sample:'80.00'},
  {id:'CLP05',label:'CLP05 — Patient Responsibility Amount',rule:'Claim loop: CLP05',scope:'Claim loop',sample:'20.00'},
  {id:'CLP07',label:'CLP07 — Payer Claim Control Number / Reference',rule:'Claim loop: CLP07',scope:'Claim loop',sample:'ABC123'},
  {id:'CLP08',label:'CLP08 — Facility Type Code',rule:'Claim loop: CLP08',scope:'Claim loop',sample:'11'},
  {id:'CLP09',label:'CLP09 — Claim Frequency Code',rule:'Claim loop: CLP09',scope:'Claim loop',sample:'1'},
  {id:'NM1[QC].NM103',label:'NM1*QC → NM103 — Patient Last Name',rule:'Find NM1 where NM101 = QC; take NM103',scope:'Claim loop',sample:'DOE'},
  {id:'NM1[QC].NM104',label:'NM1*QC → NM104 — Patient First Name',rule:'Find NM1 where NM101 = QC; take NM104',scope:'Claim loop',sample:'JANE'},
  {id:'NM1[QC].NM105',label:'NM1*QC → NM105 — Patient Middle Name',rule:'Find NM1 where NM101 = QC; take NM105',scope:'Claim loop',sample:'Q'},
  {id:'NM1[IL,MI].NM109',label:'NM1*IL / NM108=MI → NM109 — Subscriber Member ID',rule:'Find NM1 where NM101 = IL and NM108 = MI; take NM109',scope:'Claim loop',sample:'MEMBER123456'},
  {id:'REF[1L].REF02',label:'REF*1L → REF02 — Group Number',rule:'Find claim-level REF where REF01 = 1L; take REF02',scope:'Claim loop',sample:'12345678'},
  {id:'DTM[036].DTM02',label:'DTM*036 → DTM02 — Date of Birth',rule:'Find claim-level DTM where DTM01 = 036; take DTM02',scope:'Claim loop',sample:'19900101'},
  {id:'DTM[050].DTM02',label:'DTM*050 → DTM02 — Claim Received Date',rule:'Find claim-level DTM where DTM01 = 050; take DTM02',scope:'Claim loop',sample:'20260814'},
  {id:'SVC01',label:'SVC01 — Composite Procedure / Revenue Code',rule:'Current service line: SVC01 composite',scope:'Service line',sample:'99214'},
  {id:'SVC02',label:'SVC02 — Service Charge Amount',rule:'Current service line: SVC02',scope:'Service line',sample:'100.00'},
  {id:'SVC03',label:'SVC03 — Service Paid Amount',rule:'Current service line: SVC03',scope:'Service line',sample:'80.00'},
  {id:'SVC05',label:'SVC05 — Paid Service Unit Count',rule:'Current service line: SVC05',scope:'Service line',sample:'1'},
  {id:'DTM[472].DTM02',label:'DTM*472 → DTM02 — Service Date',rule:'Within current service line: DTM01 = 472; take DTM02',scope:'Service line',sample:'20260814'},
  {id:'CAS.group',label:'CAS01 — Adjustment Group Code',rule:'Current service adjustment: CAS01',scope:'Current adjustment',sample:'CO'},
  {id:'CAS.reason',label:'CAS02/05/08/... — Adjustment Reason',rule:'Normalized repeating CAS reason from reason/amount/quantity triplets',scope:'Current adjustment',sample:'45'},
  {id:'CAS.amount',label:'CAS03/06/09/... — Adjustment Amount',rule:'Normalized repeating CAS amount from reason/amount/quantity triplets',scope:'Current adjustment',sample:'20.00'}
];

const TOKENS = [
  {value:'CLP03',label:'CLP03 — Claim Charge'},
  {value:'CLP04',label:'CLP04 — Claim Paid Amount'},
  {value:'CLP05',label:'CLP05 — Patient Responsibility'},
  {value:'SVC02',label:'SVC02 — Service Charge'},
  {value:'SVC03',label:'SVC03 — Service Paid Amount'},
  {value:'SVC05',label:'SVC05 — Service Units'},
  {value:'CO_ADJUSTMENTS',label:'CO Adjustments — CAS01=CO amounts'},
  {value:'PR_ADJUSTMENTS',label:'PR Adjustments — CAS01=PR amounts'},
  {value:'COVERED_AMOUNT',label:'Covered Amount — calculated'},
  {value:'MAX(',label:'MAX( — minimum/maximum helper'},
  {value:'MIN(',label:'MIN( — minimum/maximum helper'}
];



function cls(t) {
  return t === 'Direct from 835' ? 'direct' : t === 'Formula' ? 'formula' : t === 'Hardcoded Text' ? 'constant' : t === 'System / Runtime' ? 'system' : 'blank';
}

function mapSummary(f) {
  if(f.mapType === 'Direct from 835') return f.map + (f.fallbackType === 'Hardcoded' ? ` · fallback ${f.fallbackValue}` : '');
  if(f.mapType === 'Formula') return f.map;
  if(f.mapType === 'Hardcoded Text') return `"${f.map}"`;
  if(f.mapType === 'System / Runtime') return f.map;
  return 'blank';
}

function sameAsBaseline(f) {
  const b = f.baseline;
  if (!b) return true;
  return ['mapType','map','length','start','upper','trim','truncate','align','pad','fallbackType','fallbackValue','technicalRule']
    .every(k => String(f[k] || '') === String(b[k] || ''));
}

export default function MappingApp({ clients = [], activeClientId, currentClient, onSelectClient, onSignOut, currentUser }) {
  const urlParams = new URLSearchParams(window.location.search);
  const urlClientId = urlParams.get('client');
  const targetClientId = urlClientId || activeClientId || currentClient?.id;
  const targetClient = clients.find(c => c.id === targetClientId) || currentClient;
  const clientName = targetClient?.name || urlClientId || 'ABC Health Plan';

  const [fields, setFields] = useState([]);
  const [baseline, setBaseline] = useState([]);
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedField, setSelectedField] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [mappingFeedback, setMappingFeedback] = useState({ isOpen: false, kind: 'ok', title: '', content: '' });
  
  const [formulaStatus, setFormulaStatus] = useState({ status: 'idle', issue: '' });
  
  const taRef = useRef(null);
  
  useEffect(() => {
    loadServerMappings();
  }, [targetClientId]);
  
  const loadServerMappings = async () => {
    try {
      const data = await apiFetchMappings(targetClientId);
      if (!data.ok && data.detail) throw new Error(data.detail);
      
      const b = data.baseline || [];
      const sv = data.fields || [];
      const byId = new Map(sv.map(x => [x.id, x]));
      
      const merged = b.map(x => {
        const field = JSON.parse(JSON.stringify(x));
        field.baseline = JSON.parse(JSON.stringify(x));
        const s = byId.get(field.id);
        if (s) {
          ['mapType','map','length','start','upper','trim','truncate','align','pad','fallbackType','fallbackValue','technicalRule','sourceExplanation'].forEach(k => {
            if(s[k] !== undefined) field[k] = s[k];
          });
          field.end = Number(field.start) + Number(field.length) - 1;
        }
        return field;
      });
      setBaseline(b);
      setFields(merged);
    } catch (err) {
      showToast('Unable to load mappings from the server');
    }
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2000);
  };

  const saveMappings = async () => {
    setIsSaving(true);
    try {
      const payload = fields.map(f => ({
        id:f.id, section:f.section, scope:f.scope, mapType:f.mapType, map:f.map,
        length:Number(f.length), start:Number(f.start), upper:!!f.upper, trim:!!f.trim,
        truncate:!!f.truncate, align:f.align, pad:f.pad,
        fallbackType:f.fallbackType, fallbackValue:f.fallbackValue, technicalRule:f.technicalRule
      }));
      const data = await apiSaveMappings(payload, targetClientId);
      if (!data.ok && data.detail) throw new Error(data.detail);
      
      // Re-apply
      const byId = new Map((data.fields || []).map(x => [x.id, x]));
      setFields(prev => prev.map(f => {
        const s = byId.get(f.id);
        if (s) {
          ['mapType','map','length','start','upper','trim','truncate','align','pad','fallbackType','fallbackValue','technicalRule','sourceExplanation'].forEach(k => {
            if(s[k] !== undefined) f[k] = s[k];
          });
          f.end = Number(f.start) + Number(f.length) - 1;
        }
        return f;
      }));
      
      if (targetClientId) {
        try {
          await postStepData(`/clients/${encodeURIComponent(targetClientId)}/steps/step_8_mapping/complete/`, {});
          localStorage.setItem('cross_tab_refresh', Date.now().toString());
        } catch (stepErr) {
          console.error("Could not complete step automatically:", stepErr);
        }
      }

      showToast('Saved — Mapping complete! Returning to onboarding...');
      
      setTimeout(() => {
        window.location.href = targetClientId ? `/administrator?client=${encodeURIComponent(targetClientId)}&nav=onboard&step=8#step-8` : '/administrator?nav=onboard';
      }, 600);
    } catch(err) {
      setMappingFeedback({ isOpen: true, kind: 'bad', title: 'Save Failed', content: 'Could not save mappings: ' + err.message });
      setIsSaving(false);
    }
  };

  const resetAll = () => {
    setResetConfirmOpen(true);
  };

  const executeResetAll = async () => {
    setResetConfirmOpen(false);
    try {
      const data = await apiResetMappings(targetClientId);
      if (!data.ok && data.detail) throw new Error(data.detail);
      
      const byId = new Map((data.fields || []).map(x => [x.id, x]));
      setFields(prev => prev.map(f => {
        const s = byId.get(f.id);
        if (s) {
          ['mapType','map','length','start','upper','trim','truncate','align','pad','fallbackType','fallbackValue','technicalRule','sourceExplanation'].forEach(k => {
            if(s[k] !== undefined) f[k] = s[k];
          });
          f.end = Number(f.start) + Number(f.length) - 1;
        }
        return f;
      }));
      showToast('Reset to baseline');
    } catch(err) {
      setMappingFeedback({ isOpen: true, kind: 'bad', title: 'Reset Error', content: err.message });
    }
  };

  const handleFieldChange = (key, val) => {
    if (!selectedField) return;
    setFields(prev => prev.map(f => {
      if (f.id === selectedField.id) {
        const newF = { ...f, [key]: val };
        if (key === 'start' || key === 'length') newF.end = Number(newF.start) + Number(newF.length) - 1;
        setSelectedField(newF);
        return newF;
      }
      return f;
    }));
  };

  const resetField = () => {
    if(!selectedField) return;
    setFields(prev => prev.map(f => {
      if (f.id === selectedField.id) {
        const newF = JSON.parse(JSON.stringify(f.baseline));
        newF.baseline = f.baseline;
        setSelectedField(newF);
        return newF;
      }
      return f;
    }));
    showToast('Field reset to baseline');
  };

  useEffect(() => {
    if (!selectedField) return;
    if (selectedField.mapType === 'Formula') {
      const formula = (selectedField.technicalRule || selectedField.map || '').trim();
      if (!formula) {
        setFormulaStatus({ status: 'invalid', issue: 'formula is empty' });
        return;
      }
      setFormulaStatus({ status: 'pending', issue: '' });
      const timeout = setTimeout(async () => {
        try {
          const payload = fields.map(f => ({
            id:f.id, section:f.section, scope:f.scope, mapType:f.mapType, map:f.map,
            length:Number(f.length), start:Number(f.start), upper:!!f.upper, trim:!!f.trim,
            truncate:!!f.truncate, align:f.align, pad:f.pad,
            fallbackType:f.fallbackType, fallbackValue:f.fallbackValue, technicalRule:f.technicalRule
          }));
          const data = await apiCheckMappings(payload, targetClientId);
          if (!data.ok && data.detail) throw new Error();
          const prefix = selectedField.id + ': ';
          const issue = (data.issues || []).find(item => item.startsWith(prefix));
          setFormulaStatus(issue ? { status: 'invalid', issue: issue.slice(prefix.length) } : { status: 'valid', issue: '' });
        } catch(e) {
          setFormulaStatus({ status: 'unavailable', issue: '' });
        }
      }, 180);
      return () => clearTimeout(timeout);
    } else {
      setFormulaStatus({ status: 'idle', issue: '' });
    }
  }, [selectedField?.technicalRule, selectedField?.mapType, selectedField?.map]);

  const sections = [...new Set(fields.map(f => f.section))];
  const changedCount = fields.filter(f => !sameAsBaseline(f)).length;

  let filtered = fields.filter(f => {
    if (search && !(f.id + ' ' + f.name + ' ' + f.desc + ' ' + mapSummary(f)).toLowerCase().includes(search.toLowerCase())) return false;
    if (sectionFilter && f.section !== sectionFilter) return false;
    if (typeFilter && f.mapType !== typeFilter) return false;
    return true;
  });

  return (
    <>
      <Header
        clients={clients}
        activeClientId={targetClientId}
        onSelectClient={onSelectClient}
        activeClientName={clientName}
        onSignOut={onSignOut}
        showClientBadge={true}
        currentUser={currentUser}
      />

      <div className="mapping-tool-wrapper">
      <div className="shell">
        <nav className="rail">
          <div className="grp eyebrow">Clients</div>
          <button className="navitem" onClick={() => window.location.href = '/administrator?nav=clients'}>
            <span>All Clients</span>
            {clients.length > 0 && <span className="count">{clients.length}</span>}
          </button>
          <button className="navitem on" onClick={() => window.location.href = targetClientId ? `/administrator?client=${encodeURIComponent(targetClientId)}` : '/administrator'}>
            <span>Onboarding</span>
          </button>
          <button className="navitem" onClick={() => window.location.href = targetClientId ? `/administrator?client=${encodeURIComponent(targetClientId)}&nav=docs` : '/administrator?nav=docs'}>
            <span>Documents</span>
          </button>
          <button className="navitem" onClick={() => window.location.href = targetClientId ? `/administrator?client=${encodeURIComponent(targetClientId)}&nav=files` : '/administrator?nav=files'}>
            <span>Files</span>
          </button>

          <div className="grp eyebrow" style={{ paddingTop: '18px' }}>Pre-Production</div>
          <button className="navitem" onClick={() => window.location.href = targetClientId ? `/administrator?client=${encodeURIComponent(targetClientId)}&nav=sandbox` : '/administrator?nav=sandbox'}>
            <span>Test Environment</span>
          </button>
          <button className="navitem" onClick={() => window.location.href = targetClientId ? `/administrator?client=${encodeURIComponent(targetClientId)}&nav=promote` : '/administrator?nav=promote'}>
            <span>Go Live</span>
          </button>

          <div className="grp eyebrow" style={{ paddingTop: '18px' }}>Governance</div>
          <button className="navitem" onClick={() => window.location.href = '/administrator?nav=trust'}>
            <span>Trust Center</span>
          </button>
          <button className="navitem" onClick={() => window.location.href = '/administrator?nav=access'}>
            <span>Access</span>
          </button>
          <button className="navitem" onClick={() => window.location.href = '/administrator?nav=audit'}>
            <span>Audit Log</span>
          </button>

          <div className="grp eyebrow" style={{ paddingTop: '18px' }}>Operations</div>
          <button className="navitem" onClick={() => window.location.href = '/administrator?nav=ops'}>
            <span>Operations</span>
          </button>
          <button className="navitem" onClick={() => window.location.href = '/administrator?nav=offboard'}>
            <span>Offboarding</span>
          </button>
        </nav>

        <main className="main" style={{ padding: '22px 28px 60px' }}>
          <div className="hdr-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '8px' }}>
            <div>
              <h1 style={{ margin: '0 0 4px', fontSize: '22px' }}>MIR Mapping Configuration</h1>
              <p className="sub" style={{ margin: '0 0 16px', color: 'var(--ink-2)', fontSize: '13px' }}>
                Review each MIR field and change its source only when the specification or business rule changes.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn" onClick={resetAll} style={{ border: '1px solid var(--line)', background: 'var(--surface)', padding: '6px 12px', fontSize: '12px' }}>
                Reset all to baseline
              </button>
              <button className="btn primary" onClick={saveMappings} disabled={isSaving} style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600 }}>
                {isSaving ? 'Saving...' : 'Save & use'}
              </button>
            </div>
          </div>

          <div className="summary" style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <span className="pill" style={{ background: '#fff', border: '1px solid var(--line)', padding: '5px 10px', borderRadius: '999px', fontSize: '11.5px' }}>{fields.length} MIR fields configured</span>
            <span className={`pill ${changedCount ? 'warn' : 'ok'}`} style={{ border: '1px solid var(--line)', padding: '5px 10px', borderRadius: '999px', fontSize: '11.5px', background: changedCount ? 'var(--ochre-bg)' : 'var(--teal-bg)', color: changedCount ? 'var(--ochre)' : 'var(--teal)' }}>
              {changedCount ? 'Draft differs from current converter' : '✓ Same as current converter'}
            </span>
            <span className="pill" style={{ border: '1px solid var(--line)', padding: '5px 10px', borderRadius: '999px', fontSize: '11.5px', background: changedCount ? 'var(--ochre-bg)' : '#fff', color: changedCount ? 'var(--ochre)' : 'inherit' }}>{changedCount} changed</span>
          </div>

        <div className="filters">
          <input className="control" placeholder="Search MIR field or meaning" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="control" value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}>
            <option value="">All MIR sections</option>
            {sections.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="control" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All mapping types</option>
            <option>Direct from 835</option><option>Formula</option><option>Hardcoded Text</option><option>System / Runtime</option><option>Blank</option>
          </select>
        </div>

        <div className="tablewrap">
          <table>
            <thead><tr>
              <th>MIR field</th><th>Meaning</th><th>Type / Size</th><th>Position</th><th>Mapping type</th><th>Current mapping</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="7"><div className="empty">No MIR fields match this filter.</div></td></tr>
              ) : filtered.map(f => (
                <tr key={f.id} onClick={() => setSelectedField(f)}>
                  <td><span className="fieldid">{f.id}</span>{!sameAsBaseline(f) && <span className="changed">changed</span>}</td>
                  <td><span className="name" title={f.desc}>{f.name}</span><span className="descdot" title={f.desc}>i</span><div className="meta">{f.section}</div></td>
                  <td><span className="mono">{f.type} · {f.length}</span></td>
                  <td><span className="mono">{f.start}–{f.end}</span></td>
                  <td><span className={`maptype ${cls(f.mapType)}`}>{f.mapType}</span></td>
                  <td><div className="source" title={mapSummary(f)}>{mapSummary(f)}</div></td>
                  <td><button className="btn edit" onClick={(e) => { e.stopPropagation(); setSelectedField(f); }}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>

    <div className={`scrim ${selectedField ? 'on' : ''}`} onClick={() => setSelectedField(null)}></div>
      <aside className={`drawer ${selectedField ? 'on' : ''}`} aria-hidden={!selectedField}>
        {selectedField && (
          <>
            <div className="drawerhead">
              <div>
                <div className="fieldid">{selectedField.id}</div>
                <h2>{selectedField.name}</h2>
                <div className="meta">{selectedField.section}</div>
              </div>
              <button className="close" onClick={() => setSelectedField(null)}>×</button>
            </div>
            <div className="body">
              <div className="specrow">
                <div className="spec"><div className="k">Spec type</div><div className="v">{selectedField.type}</div></div>
                <div className="spec"><div className="k">Size</div><div className="v">{selectedField.length} chars</div></div>
                <div className="spec"><div className="k">Position</div><div className="v">{selectedField.start}–{selectedField.end}</div></div>
              </div>
              <p className="description">{selectedField.desc}</p>

              <div className="group">
                <label className="title">How is this MIR field populated?</label>
                <select className="control" value={selectedField.mapType} onChange={e => {
                  const t = e.target.value;
                  let m = '';
                  let tr = '';
                  if (t === 'Direct from 835') m = SOURCES[0].id;
                  else if (t === 'Formula') { m = 'Custom formula'; tr = ''; }
                  else if (t === 'System / Runtime') m = 'PROCESS_DATE';
                  handleFieldChange('mapType', t);
                  handleFieldChange('map', m);
                  if (t === 'Formula') handleFieldChange('technicalRule', tr);
                }}>
                  <option>Direct from 835</option><option>Formula</option><option>Hardcoded Text</option><option>System / Runtime</option><option>Blank</option>
                </select>
              </div>

              {selectedField.mapType === 'Direct from 835' && (
                <div id="directBox">
                  <div className="group">
                    <label className="title">835 field</label>
                    <select className="control" value={selectedField.map} onChange={e => handleFieldChange('map', e.target.value)}>
                      {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    <div className="help">{SOURCES.find(s => s.id === selectedField.map)?.rule || 'Choose the exact 835 segment/element.'}</div>
                  </div>
                  <div className="group">
                    <label className="title">If 835 value is missing</label>
                    <div className="inline">
                      <select className="control" value={selectedField.fallbackType || 'Blank'} onChange={e => {
                        handleFieldChange('fallbackType', e.target.value);
                        if (e.target.value !== 'Hardcoded') handleFieldChange('fallbackValue', '');
                      }}>
                        <option value="Blank">Leave blank</option>
                        <option value="Hardcoded">Use fixed value</option>
                      </select>
                      <input className="control mono" placeholder="Fixed fallback" disabled={selectedField.fallbackType !== 'Hardcoded'} value={selectedField.fallbackValue || ''} onChange={e => handleFieldChange('fallbackValue', e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {selectedField.mapType === 'Formula' && (
                <div id="formulaBox">
                  <div className="group">
                    <label className="title">Formula / Calculation</label>
                    <textarea ref={taRef} className="control" spellCheck="false" value={selectedField.technicalRule || ''} onChange={e => {
                      handleFieldChange('technicalRule', e.target.value);
                      if (!selectedField.map) handleFieldChange('map', 'Custom formula');
                    }}></textarea>
                    <div className="inline" style={{ marginTop: 7 }}>
                      <select className="control" id="tokenSelect">
                        {TOKENS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <button className="btn" type="button" onClick={() => {
                        const ta = taRef.current;
                        if (!ta) return;
                        const tok = document.getElementById('tokenSelect').value;
                        const pos = ta.selectionStart ?? ta.value.length;
                        const val = ta.value.slice(0, pos) + tok + ta.value.slice(pos);
                        handleFieldChange('technicalRule', val);
                        if (!selectedField.map) handleFieldChange('map', 'Custom formula');
                        ta.focus();
                      }}>Insert</button>
                    </div>
                    <div className="help">The formula stays in simple language. The exact 835 segments/elements used are shown below.</div>
                    <div className="formula-source" style={{ marginTop: 10, padding: '10px 12px', background: '#f7f9fb', border: '1px solid var(--line)', borderRadius: 3 }}>
                      <div className="title" style={{ marginBottom: 6 }}>835 values used in this formula</div>
                      <div className="help" style={{ fontSize: 12.5, lineHeight: 1.65, color: 'var(--ink)' }}>
                        {selectedField.sourceExplanation || 'The exact 835 source for this formula has not been documented yet.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedField.mapType === 'Hardcoded Text' && (
                <div id="constantBox">
                  <div className="group">
                    <label className="title">Hardcoded text/value</label>
                    <input className="control mono" value={selectedField.map || ''} onChange={e => handleFieldChange('map', e.target.value)} />
                  </div>
                </div>
              )}

              {selectedField.mapType === 'System / Runtime' && (
                <div id="systemBox">
                  <div className="group">
                    <label className="title">System value</label>
                    <select className="control" value={selectedField.map} onChange={e => handleFieldChange('map', e.target.value)}>
                      <option value="PROCESS_DATE">Processing Date (YYYYMMDD)</option>
                      <option value="RECORD_SEQUENCE">MIR Record Sequence</option>
                      <option value="MAX_RECORD_SEQUENCE">Maximum Record Sequence</option>
                      <option value="SERVICE_COUNT">Service Count</option>
                    </select>
                  </div>
                </div>
              )}

              {selectedField.mapType === 'Blank' && (
                <div id="blankBox" className="note">Keep this MIR field blank. Its fixed-width space is still preserved.</div>
              )}

              <details>
                <summary>MIR field details & formatting</summary>
                <div className="advanced">
                  <div className="grid2">
                    <div className="group"><label className="title">Start position</label><input type="number" min="1" className="control mono" value={selectedField.start} onChange={e => handleFieldChange('start', +e.target.value)} /></div>
                    <div className="group"><label className="title">Field size</label><input type="number" min="1" className="control mono" value={selectedField.length} onChange={e => handleFieldChange('length', +e.target.value)} /></div>
                    <div className="group"><label className="title">Alignment</label><select className="control" value={selectedField.align} onChange={e => handleFieldChange('align', e.target.value)}><option value="left">Left</option><option value="right">Right</option></select></div>
                    <div className="group"><label className="title">Pad character</label><input maxLength="1" className="control mono" value={selectedField.pad} onChange={e => handleFieldChange('pad', e.target.value || ' ')} /></div>
                  </div>
                  <div className="checks">
                    <label><input type="checkbox" checked={selectedField.upper} onChange={e => handleFieldChange('upper', e.target.checked)} /> Uppercase</label>
                    <label><input type="checkbox" checked={selectedField.trim} onChange={e => handleFieldChange('trim', e.target.checked)} /> Trim</label>
                    <label><input type="checkbox" checked={selectedField.truncate} onChange={e => handleFieldChange('truncate', e.target.checked)} /> Truncate to field size</label>
                  </div>
                  {selectedField.mapType === 'Formula' && selectedField.technicalRule && (
                    <div className="group" style={{ marginTop: 12 }}>
                      <label className="title">Technical rule (developer reference)</label>
                      <div className="pre mono">{selectedField.technicalRule}</div>
                    </div>
                  )}
                </div>
              </details>

              <div className="preview">
                <div className="fieldid">EXAMPLE</div>
                {(() => {
                  const preview = MappingPreview.buildPreview(selectedField, SOURCES, {
                    formulaStatus: formulaStatus.status,
                    formulaIssue: formulaStatus.issue
                  });
                  return (
                    <>
                      <div className="pre">{preview.details}</div>
                      <div className="output">{preview.output}</div>
                      <div className="help">{preview.help}</div>
                    </>
                  );
                })()}
              </div>

            </div>
            <div className="drawerfoot">
              <button className="btn leftbtn" onClick={resetField}>Reset field</button>
              <button className="btn primary" onClick={() => setSelectedField(null)}>Done</button>
            </div>
          </>
        )}
      </aside>

      <div className={`toast ${toastMsg ? 'on' : ''}`}>{toastMsg}</div>

      <ConfirmModal
        isOpen={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={executeResetAll}
        title="Reset Mappings to Baseline"
        message="Reset every mapping to the current converter baseline? Custom modifications will be replaced."
        confirmText="Reset Baseline"
        kind="danger"
      />

      <FeedbackModal
        isOpen={mappingFeedback.isOpen}
        onClose={() => setMappingFeedback({ ...mappingFeedback, isOpen: false })}
        kind={mappingFeedback.kind}
        title={mappingFeedback.title}
        content={mappingFeedback.content}
        checks={[]}
      />
      </div>
    </>
  );
}

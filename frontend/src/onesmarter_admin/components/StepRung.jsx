import React, { useState, useRef } from 'react';
import { uploadStepFile, validateStaged835, postStepData, downloadTemplateFile, fetchStepUploadFile, createUser } from '../services/api';
import FeedbackModal from './modals/FeedbackModal';
import FileViewerModal from './modals/FileViewerModal';
import ClientSftpModal from './ClientSftpModal';

function formatDateTime(dateVal) {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return dateVal;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function toISODate(val) {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  if (/^\d{2}-\d{2}-\d{4}$/.test(val)) {
    const [m, d, y] = val.split('-');
    return `${y}-${m}-${d}`;
  }
  const dt = new Date(val);
  if (isNaN(dt.getTime())) return '';
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatToMMDDYYYY(val) {
  if (!val) return '';
  if (/^\d{2}-\d{2}-\d{4}$/.test(val)) return val;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-');
    return `${m}-${d}-${y}`;
  }
  const dt = new Date(val);
  if (isNaN(dt.getTime())) return val;
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${mm}-${dd}-${yyyy}`;
}

export default function StepRung({ step, clientId, roles, onRefresh, onOpenNotes, onOpenRedo, onOpenAddRole }) {
  const [feedback, setFeedback] = useState({ isOpen: false, kind: 'ok', title: '', content: '', checks: [] });
  const [viewerFile, setViewerFile] = useState(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [validating835, setValidating835] = useState(false);
  const [showSftpModal, setShowSftpModal] = useState(false);

  const [s4Name, setS4Name] = useState('');
  const [s4Role, setS4Role] = useState('Technical Contact');
  const [s4Email, setS4Email] = useState('');
  const [s4CountryCode, setS4CountryCode] = useState('+1');
  const [s4Phone, setS4Phone] = useState('');
  const [showAllContacts, setShowAllContacts] = useState(false);
  const [s4Touched, setS4Touched] = useState({ name: false, email: false, phone: false });
  const [s4SubmitError, setS4SubmitError] = useState('');

  // Step 4 Real-time inline field validations
  const s4Existing = step.extra?.contacts || [];
  
  const s4NameError = (() => {
    if (!s4Touched.name && !s4Name) return '';
    const trimmed = s4Name.trim();
    if (!trimmed) return s4Touched.name ? 'Contact name is required.' : '';
    if (s4Existing.some(c => (c.employee_name || c.name || '').toLowerCase() === trimmed.toLowerCase())) {
      return 'Contact name already exists.';
    }
    return '';
  })();

  const s4EmailError = (() => {
    const trimmed = s4Email.trim();
    if (!trimmed) return '';
    const emailPattern = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
    if (!emailPattern.test(trimmed)) {
      return 'Invalid email address format.';
    }
    if (s4Existing.some(c => (c.email || '').toLowerCase() === trimmed.toLowerCase())) {
      return 'Email address already exists.';
    }
    return '';
  })();

  const s4PhoneError = (() => {
    const trimmed = s4Phone.trim();
    if (!trimmed) return '';
    const fullPhone = `${s4CountryCode}${trimmed}`;
    const digits = fullPhone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      return 'Phone must have 7 to 15 digits.';
    }
    if (s4Existing.some(c => (c.phone || '').trim() === fullPhone)) {
      return 'Phone number already exists.';
    }
    return '';
  })();

  const [s5Text, setS5Text] = useState(step.latestNote?.note_text || step.extra?.verification?.verification_text || '');
  const [s6Method, setS6Method] = useState(step.extra?.transferConfig?.method || 'SFTP');
  const [s6SftpMode, setS6SftpMode] = useState(step.extra?.transferConfig?.notes?.includes('Pull') ? 'Pull' : 'Push');
  const [s6ApiUrl, setS6ApiUrl] = useState(step.extra?.transferConfig?.notes?.startsWith('https') ? step.extra.transferConfig.notes : '');
  const [s6ApiTouched, setS6ApiTouched] = useState(false);
  const [s6Watched, setS6Watched] = useState(Boolean(step.extra?.transferConfig?.watched_folder_sftp));
  const [s6Keys, setS6Keys] = useState(Boolean(step.extra?.transferConfig?.keys_exchanged));
  const [s6NoChange, setS6NoChange] = useState(Boolean(step.extra?.transferConfig?.no_change_to_client_system));
  const [s6SftpVerified, setS6SftpVerified] = useState(false);
  const [s6SftpConfig, setS6SftpConfig] = useState(null);

  // Step 6 HTTPS API validation
  const s6ApiError = (() => {
    if (s6Method !== 'HTTPS API') return '';
    if (!s6ApiTouched && !s6ApiUrl) return '';
    const trimmed = s6ApiUrl.trim();
    if (!trimmed) return s6ApiTouched ? 'HTTPS endpoint URL is required.' : '';
    const urlPattern = /^https:\/\/[^\s/$.?#].[^\s]*$/i;
    if (!urlPattern.test(trimmed)) {
      return 'Please enter a valid HTTPS URL (e.g. https://api.client.com/v1/claims).';
    }
    return '';
  })();

  const [s10Notes, setS10Notes] = useState(step.extra?.submission?.submission_text || '');
  const [s11Email, setS11Email] = useState('');
  const [s11Password, setS11Password] = useState('');
  const [s11Sending, setS11Sending] = useState(false);

  const [s9Name, setS9Name] = useState('');
  const [s9Email, setS9Email] = useState('');
  const [s9Password, setS9Password] = useState('');
  const [s9Mobile, setS9Mobile] = useState('');

  const datePickerRef = useRef(null);
  const [s13Date, setS13Date] = useState(() => formatToMMDDYYYY(step.extra?.schedule?.scheduled_date) || '');
  const [s13Time, setS13Time] = useState(step.extra?.schedule?.scheduled_time || '10:00');
  const [s13Notes, setS13Notes] = useState(step.extra?.schedule?.notes || '');

  const [stText, setStText] = useState(step.extra?.submission?.submission_text || '');

  const handleStandardFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const res = await uploadStepFile(clientId, step.key, file);
      setFeedback({
        isOpen: true,
        kind: 'ok',
        title: 'Evidence Validated & Stored',
        content: `Uploaded ${file.name} for Step ${step.id}.`,
        checks: res.checks || []
      });
      await onRefresh();
    } catch (err) {
      setFeedback({
        isOpen: true,
        kind: 'bad',
        title: 'Validation Failed',
        content: err.message,
        checks: err.checks || []
      });
    }
  };

  const handleStep7Upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
    const allowed = ['835', 'x12', 'edi', 'txt', 'dat', '35', 'ansi', 'rem'];
    if (!allowed.includes(ext)) {
      setFeedback({
        isOpen: true,
        kind: 'bad',
        title: 'Upload Error',
        content: `Unsupported file type (.${ext}). Upload a valid 835/X12 file (.835, .x12, .edi, .txt, .dat, .35, .ansi, .rem).`,
        checks: []
      });
      return;
    }
    try {
      setValidating835(true);
      const res = await validateStaged835(clientId, file);
      setFeedback({
        isOpen: true,
        kind: 'ok',
        title: '835 Structural Validation Passed',
        content: 'Step 7 Complete: Deep X12 835 structural and balance checks passed.',
        checks: res.checks || []
      });
      await onRefresh();
    } catch (err) {
      setFeedback({
        isOpen: true,
        kind: 'bad',
        title: '835 Validation Failed',
        content: err.message,
        checks: err.checks || []
      });
      await onRefresh();
    } finally {
      setValidating835(false);
    }
  };

  const handleValidate835 = async () => {
    setValidating835(true);
    try {
      const res = await validateStaged835(clientId);
      setFeedback({
        isOpen: true,
        kind: 'ok',
        title: '835 Structural Validation Passed',
        content: 'Step 7 Complete: Deep X12 835 structural and balance checks passed.',
        checks: res.checks || []
      });
      await onRefresh();
    } catch (err) {
      setFeedback({
        isOpen: true,
        kind: 'bad',
        title: '835 Validation Failed',
        content: err.message,
        checks: err.checks || []
      });
      await onRefresh();
    } finally {
      setValidating835(false);
    }
  };

  const handleStep4Save = async () => {
    setS4Touched({ name: true, email: true, phone: true });
    setS4SubmitError('');

    const trimmedName = s4Name.trim();
    if (!trimmedName || s4NameError || s4EmailError || s4PhoneError) {
      return;
    }

    const fullPhone = s4Phone.trim() ? `${s4CountryCode}${s4Phone.trim()}` : '';

    try {
      await postStepData(`/clients/${encodeURIComponent(clientId)}/steps/step_4_contacts/save/`, {
        role_name: s4Role,
        employee_name: trimmedName,
        email: s4Email.trim(),
        phone: fullPhone
      });
      setS4Name('');
      setS4Email('');
      setS4Phone('');
      setS4Touched({ name: false, email: false, phone: false });
      setS4SubmitError('');
      await onRefresh();
    } catch (err) { 
      setS4SubmitError(err.message || 'Failed to save contact.');
    }
  };

  const handleStep5Save = async () => {
    if (!s5Text.trim()) { 
      setFeedback({ isOpen: true, kind: 'bad', title: 'Input Required', content: 'Please enter verification text.', checks: [] }); 
      return; 
    }
    try {
      await postStepData(`/clients/${encodeURIComponent(clientId)}/steps/step_5_claim_sys/save/`, { verification_text: s5Text });
      await onRefresh();
    } catch (err) { 
      setFeedback({ isOpen: true, kind: 'bad', title: 'Submission Error', content: err.message, checks: [] }); 
    }
  };

  const handleStep6Save = async () => {
    if (s6Method === 'HTTPS API') {
      setS6ApiTouched(true);
      const trimmed = s6ApiUrl.trim();
      const urlPattern = /^https:\/\/[^\s/$.?#].[^\s]*$/i;
      if (!trimmed || !urlPattern.test(trimmed)) {
        return;
      }
    }
    if (s6Method === 'SFTP' && !s6SftpVerified) {
      setFeedback({ isOpen: true, kind: 'bad', title: 'SFTP Not Configured', content: 'Please configure and verify the SFTP connection before completing this step. All 3 folders must be set and the connection must pass.', checks: [] });
      return;
    }

    try {
      const notesPayload = s6Method === 'SFTP'
        ? `SFTP Direction: ${s6SftpMode}${s6SftpConfig ? ` | Host: ${s6SftpConfig.host} | 835: ${s6SftpConfig.inbound_835_folder} | 837: ${s6SftpConfig.inbound_837_folder} | MIR: ${s6SftpConfig.outbound_mir_folder}` : ''}`
        : (s6Method === 'HTTPS API' ? s6ApiUrl.trim() : 'Manual Upload Direct');

      await postStepData(`/clients/${encodeURIComponent(clientId)}/steps/step_6_transfer_method/save/`, {
        method: s6Method,
        setup_status: 'Configured',
        watched_folder_sftp: s6Watched,
        keys_exchanged: s6Keys,
        no_change_to_client_system: s6NoChange,
        notes: notesPayload
      });
      await onRefresh();
    } catch (err) { 
      setFeedback({ isOpen: true, kind: 'bad', title: 'Save Failed', content: err.message, checks: [] }); 
    }
  };

  const handleStep9CreateUser = async () => {
    if (!s9Name.trim() || !s9Email.trim() || !s9Password) {
      setFeedback({ isOpen: true, kind: 'bad', title: 'Input Required', content: 'Name, Email, and Password are required.', checks: [] });
      return;
    }
    try {
      await createUser({
        name: s9Name,
        email: s9Email,
        password: s9Password,
        mobile: s9Mobile,
        role: 'User',
        clients: [clientId]
      });
      await postStepData(`/clients/${encodeURIComponent(clientId)}/steps/step_9_sftp/complete/`, {});
      setFeedback({ isOpen: true, kind: 'ok', title: 'User Created', content: `Successfully created user ${s9Email} and linked to ${clientId}. Step 9 completed.`, checks: [] });
      await onRefresh();
    } catch (err) {
      setFeedback({ isOpen: true, kind: 'bad', title: 'Creation Error', content: err.message, checks: [] });
    }
  };

  const handleStep13Save = async () => {
    if (!s13Date.trim() || !s13Time.trim()) { 
      setFeedback({ isOpen: true, kind: 'bad', title: 'Input Required', content: 'Please select scheduled date and time.', checks: [] }); 
      return; 
    }
    try {
      await postStepData(`/clients/${encodeURIComponent(clientId)}/steps/step_13_schedule/save/`, {
        scheduled_date: s13Date.trim(),
        scheduled_time: s13Time.trim(),
        timezone: 'Eastern (ET)',
        notes: s13Notes.trim()
      });
      await onRefresh();
    } catch (err) { 
      setFeedback({ isOpen: true, kind: 'bad', title: 'Schedule Error', content: err.message, checks: [] }); 
    }
  };

  const handleTextSubmission = async () => {
    if (!stText.trim()) { 
      setFeedback({ isOpen: true, kind: 'bad', title: 'Input Required', content: 'Please enter required details.', checks: [] }); 
      return; 
    }
    try {
      await postStepData(`/clients/${encodeURIComponent(clientId)}/steps/${encodeURIComponent(step.key)}/submit-text/`, { submission_text: stText });
      await onRefresh();
    } catch (err) { 
      setFeedback({ isOpen: true, kind: 'bad', title: 'Submission Error', content: err.message, checks: [] }); 
    }
  };

  const launchRedirect = (url, pendingKey) => {
    sessionStorage.setItem('pending_return_step', pendingKey);
    window.open(url, '_blank');
  };

  const latestUp = step.latestUpload;
  const isFailed = latestUp && latestUp.validation_status === 'FAILED';
  const hasValidUpload = Boolean(latestUp && latestUp.validation_status !== 'FAILED');

  const handleViewUploadedFile = async () => {
    if (!hasValidUpload) return;
    setViewerLoading(true);
    try {
      const data = await fetchStepUploadFile(clientId, step.key);
      setViewerFile(data);
      setIsViewerOpen(true);
    } catch (err) {
      setFeedback({
        isOpen: true,
        kind: 'bad',
        title: 'Preview Error',
        content: err.message || 'Failed to load uploaded file.',
        checks: []
      });
    } finally {
      setViewerLoading(false);
    }
  };

  const stateClass = step.done ? 'done' : (step.inProgress ? 'now' : 'locked');
  const markContent = step.done ? '✓' : (step.inProgress ? step.id : '🔒');
  const statusTag = step.done ? (
    <span className="tag ok">Complete</span>
  ) : step.inProgress ? (
    <span className="tag work">In Progress</span>
  ) : (
    <span className="tag idle">Locked</span>
  );

  return (
    <div className={`rung ${stateClass}`} id={`step-${step.id}`} data-step-id={step.id}>
      <div className="mark">{markContent}</div>

      <div className="txt">
        <h3>Step {step.id}: {step.title}</h3>
        <div className="meta">{step.desc}</div>

        {latestUp && (
          <div className="ev">
            📄 Filed: <b>{latestUp.original_filename}</b> ({formatDateTime(latestUp.uploaded_at)})
          </div>
        )}

        {step.latestNote && (
          <div className="ev" style={{ color: 'var(--ochre)' }}>
            Note: "{step.latestNote.note_text}" — <i>{step.latestNote.author}</i>
          </div>
        )}

        {(step.inProgress || step.done) && (
          <>
            {step.actionType === 'contact_manager' && (
              <div className="step-custom-box" style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '4px', border: '1px solid var(--line-soft)', marginTop: '10px' }}>
                {step.extra?.contacts && step.extra.contacts.length > 0 && (
                  <div style={{ marginBottom: '16px', background: '#fff', border: '1px solid var(--line-soft)', borderRadius: '4px', padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, color: '#475569', marginBottom: '12px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Recorded Contacts ({step.extra.contacts.length})</span>
                      {step.extra.contacts.length > 2 && (
                        <button
                          type="button"
                          style={{ background: '#fff', border: '1px solid #CBD5E1', borderRadius: '3px', padding: '4px 8px', fontSize: '11px', color: '#334155', cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => setShowAllContacts(!showAllContacts)}
                        >
                          {showAllContacts ? '▲ Show Less' : `▼ Show More (${step.extra.contacts.length - 2} more)`}
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {(showAllContacts ? step.extra.contacts : step.extra.contacts.slice(0, 2)).map((c, idx) => (
                        <div key={c.id || idx} style={{ padding: '10px 0', borderBottom: idx < (showAllContacts ? step.extra.contacts.length : Math.min(2, step.extra.contacts.length)) - 1 ? '1px solid #F1F5F9' : 'none', display: 'flex', alignItems: 'center', fontSize: '13px', color: '#1E293B' }}>
                          <svg width="14" height="14" fill="#334155" viewBox="0 0 16 16" style={{ marginRight: '8px', flexShrink: 0 }}>
                            <path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
                          </svg>
                          <span style={{ fontWeight: 600 }}>{c.employee_name || c.name}</span>
                          <span style={{ marginLeft: '12px', padding: '3px 8px', background: '#E2E8F0', color: '#64748B', fontSize: '10px', borderRadius: '3px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            {c.role_name}
                          </span>
                          <div style={{ marginLeft: '16px', display: 'flex', alignItems: 'center', color: '#64748B', fontSize: '13px', gap: '8px' }}>
                            {c.email && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414.05 3.555ZM0 4.697v7.104l5.803-3.558L0 4.697ZM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586l-1.239-.757Zm3.436-.586L16 11.801V4.697l-5.803 3.546Z"/></svg>
                                {c.email}
                              </span>
                            )}
                            {c.email && c.phone && <span>·</span>}
                            {c.phone && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 0 0 4.168 6.608 17.569 17.569 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328z"/></svg>
                                {c.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
                    <div style={{ display: 'flex', gap: '3px' }}>
                      <select 
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: '3px', fontSize: '12px', background: 'var(--surface)', color: 'var(--ink)' }}
                        value={s4Role}
                        onChange={(e) => setS4Role(e.target.value)}
                      >
                        <option value="Technical Contact">Technical Contact</option>
                        <option value="Billing Contact">Billing Contact</option>
                        <option value="Administrative Contact">Administrative Contact</option>
                        <option value="Project Sponsor">Project Sponsor</option>
                        {roles.map((r) => {
                          const val = r.role_name || r.name;
                          if (['Technical Contact', 'Billing Contact', 'Administrative Contact', 'Project Sponsor'].includes(val)) return null;
                          return <option key={r.id || val} value={val}>{val}</option>;
                        })}
                      </select>
                      <button type="button" className="btn tiny icon-btn" onClick={onOpenAddRole} title="Add New Role" style={{ minWidth: '26px', height: '28px' }}>+</button>
                    </div>
                  </div>

                  <div style={{ flex: '1 1 145px', minWidth: '145px' }}>
                    <input 
                      style={{ 
                        width: '100%', 
                        padding: '6px 8px', 
                        border: s4NameError ? '1px solid var(--brick)' : '1px solid var(--line)', 
                        background: s4NameError ? 'var(--brick-bg)' : 'var(--surface)',
                        borderRadius: '3px', 
                        fontSize: '12px', 
                        color: 'var(--ink)' 
                      }}
                      placeholder="Contact Name *"
                      value={s4Name}
                      onBlur={() => setS4Touched(prev => ({ ...prev, name: true }))}
                      onChange={(e) => {
                        setS4Name(e.target.value);
                        setS4Touched(prev => ({ ...prev, name: true }));
                      }}
                      required
                    />
                    {s4NameError && (
                      <div style={{ color: 'var(--brick)', fontSize: '10.5px', marginTop: '2px', lineHeight: 1.2 }}>
                        {s4NameError}
                      </div>
                    )}
                  </div>

                  <div style={{ flex: '1 1 175px', minWidth: '175px' }}>
                    <input 
                      style={{ 
                        width: '100%', 
                        padding: '6px 8px', 
                        border: s4EmailError ? '1px solid var(--brick)' : '1px solid var(--line)', 
                        background: s4EmailError ? 'var(--brick-bg)' : 'var(--surface)',
                        borderRadius: '3px', 
                        fontSize: '12px', 
                        color: 'var(--ink)' 
                      }}
                      type="email"
                      placeholder="Email address"
                      value={s4Email}
                      onBlur={() => setS4Touched(prev => ({ ...prev, email: true }))}
                      onChange={(e) => {
                        setS4Email(e.target.value);
                        setS4Touched(prev => ({ ...prev, email: true }));
                      }}
                    />
                    {s4EmailError && (
                      <div style={{ color: 'var(--brick)', fontSize: '10.5px', marginTop: '2px', lineHeight: 1.2 }}>
                        {s4EmailError}
                      </div>
                    )}
                  </div>

                  <div style={{ flex: '1 1 185px', minWidth: '185px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <select 
                        style={{ padding: '6px 4px', border: '1px solid var(--line)', borderRadius: '3px', fontSize: '11.5px', background: 'var(--surface)', color: 'var(--ink)' }}
                        value={s4CountryCode}
                        onChange={(e) => setS4CountryCode(e.target.value)}
                      >
                        <option value="+1">+1 (US)</option>
                        <option value="+44">+44 (UK)</option>
                        <option value="+91">+91 (IN)</option>
                        <option value="+61">+61 (AU)</option>
                      </select>
                      <input 
                        style={{ 
                          flex: 1, 
                          padding: '6px 8px', 
                          border: s4PhoneError ? '1px solid var(--brick)' : '1px solid var(--line)', 
                          background: s4PhoneError ? 'var(--brick-bg)' : 'var(--surface)',
                          borderRadius: '3px', 
                          fontSize: '12px', 
                          color: 'var(--ink)', 
                          minWidth: '60px' 
                        }}
                        placeholder="Phone number"
                        value={s4Phone}
                        onBlur={() => setS4Touched(prev => ({ ...prev, phone: true }))}
                        onChange={(e) => {
                          setS4Phone(e.target.value);
                          setS4Touched(prev => ({ ...prev, phone: true }));
                        }}
                      />
                    </div>
                    {s4PhoneError && (
                      <div style={{ color: 'var(--brick)', fontSize: '10.5px', marginTop: '2px', lineHeight: 1.2 }}>
                        {s4PhoneError}
                      </div>
                    )}
                  </div>

                  <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'flex-start' }}>
                    <button 
                      type="button" 
                      className="btn tiny primary" 
                      onClick={handleStep4Save}
                      style={{ padding: '6px 12px', fontWeight: 600, whiteSpace: 'nowrap', height: '29px' }}
                    >
                      {step.extra?.contacts && step.extra.contacts.length > 0 ? '+ Add Contact' : 'Save & Complete'}
                    </button>
                  </div>
                </div>

                {s4SubmitError && (
                  <div style={{ color: 'var(--brick)', fontSize: '11px', marginTop: '6px', fontWeight: 500 }}>
                    ✕ {s4SubmitError}
                  </div>
                )}
              </div>
            )}

            {step.actionType === 'claim_verify' && (
              <div className="step-custom-box" style={{ padding: '8px 12px' }}>
                <label style={{ fontWeight: 600, fontSize: 11.5, display: 'block', marginBottom: 6, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Claim System Verification Information</label>
                <textarea rows={1} style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--line)', borderRadius: '3px', fontSize: 12, resize: 'vertical', minHeight: '28px' }} value={s5Text} onChange={(e) => setS5Text(e.target.value)} placeholder="e.g. Vendor hosted ClaimsCore Enterprise, SFTP outbound nightly 835 drops verified." />
                <div style={{ marginTop: 6, textAlign: 'right' }}>
                  <button className="btn tiny primary" onClick={handleStep5Save}>Submit &amp; Complete Step 5</button>
                </div>
              </div>
            )}

            {step.actionType === 'transfer_config' && (
              <div className="step-custom-box" style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '4px', border: '1px solid var(--line-soft)', marginTop: '10px' }}>
                <div style={{ fontWeight: 600, fontSize: '11.5px', color: 'var(--ink-2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Delivery / Transfer Mechanism:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-start' }}>
                  <div style={{ width: '135px' }}>
                    <select 
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: '3px', fontSize: '12px', background: 'var(--surface)', color: 'var(--ink)' }} 
                      value={s6Method} 
                      onChange={(e) => {
                        setS6Method(e.target.value);
                        setS6ApiTouched(false);
                      }}
                    >
                      <option value="SFTP">SFTP</option>
                      <option value="HTTPS API">HTTPS API</option>
                      <option value="Manual Upload">Manual Upload</option>
                    </select>
                  </div>

                  {s6Method === 'SFTP' && (
                    <div style={{ width: '95px' }}>
                      <select 
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: '3px', fontSize: '12px', background: 'var(--surface)', color: 'var(--ink)' }} 
                        value={s6SftpMode} 
                        onChange={(e) => setS6SftpMode(e.target.value)}
                      >
                        <option value="Push">Push</option>
                        <option value="Pull">Pull</option>
                      </select>
                    </div>
                  )}

                  {s6Method === 'SFTP' && (
                    <div>
                      <button 
                        type="button" 
                        className="btn tiny primary" 
                        onClick={() => setShowSftpModal(true)} 
                        style={{ padding: '6px 12px', fontWeight: 600, whiteSpace: 'nowrap', height: '29px' }}
                      >
                        {s6SftpVerified ? '✓ SFTP Configured' : 'Configure SFTP'}
                      </button>
                    </div>
                  )}

                  {s6Method === 'SFTP' && s6SftpVerified && (
                    <div>
                      <button 
                        type="button" 
                        className="btn tiny success" 
                        onClick={handleStep6Save}
                        style={{ padding: '6px 14px', fontWeight: 600, whiteSpace: 'nowrap', height: '29px' }}
                      >
                        ✓ Complete Step 6
                      </button>
                    </div>
                  )}

                  {s6Method === 'HTTPS API' && (
                    <>
                      <div style={{ width: '270px', maxWidth: '100%' }}>
                        <input 
                          style={{ 
                            width: '100%', 
                            padding: '6px 8px', 
                            border: s6ApiError ? '1px solid var(--brick)' : '1px solid var(--line)', 
                            background: s6ApiError ? 'var(--brick-bg)' : 'var(--surface)',
                            borderRadius: '3px', 
                            fontSize: '12px', 
                            color: 'var(--ink)' 
                          }}
                          placeholder="https://api.client.com/v1/claims"
                          value={s6ApiUrl}
                          onBlur={() => setS6ApiTouched(true)}
                          onChange={(e) => {
                            setS6ApiUrl(e.target.value);
                            setS6ApiTouched(true);
                          }}
                        />
                        {s6ApiError && (
                          <div style={{ color: 'var(--brick)', fontSize: '10.5px', marginTop: '2px', lineHeight: 1.2 }}>
                            {s6ApiError}
                          </div>
                        )}
                      </div>
                      <div>
                        <button 
                          type="button" 
                          className="btn tiny primary" 
                          onClick={handleStep6Save}
                          disabled={Boolean(s6ApiError) || !s6ApiUrl.trim()}
                          style={{ padding: '6px 14px', fontWeight: 600, whiteSpace: 'nowrap', height: '29px' }}
                        >
                          ✓ Save API &amp; Complete
                        </button>
                      </div>
                    </>
                  )}

                  {s6Method === 'Manual Upload' && (
                    <div>
                      <button 
                        type="button" 
                        className="btn tiny primary" 
                        onClick={handleStep6Save}
                        style={{ padding: '6px 14px', fontWeight: 600, whiteSpace: 'nowrap', height: '29px' }}
                      >
                        ✓ Complete Step 6
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step.actionType === 'x12_835_validate' && (
              <div className="step-custom-box">
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>Sample 835 EDI Validation:</div>
                {latestUp ? (
                  <div style={{ fontSize: 12, marginBottom: 8 }}>📄 File: <b>{latestUp.original_filename}</b> ({latestUp.validation_status || 'PENDING'})</div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>No 835 EDI file uploaded yet. Upload a valid .835, .x12, .edi, .txt, or .dat file.</div>
                )}
                {isFailed && <div style={{ color: 'var(--brick)', fontSize: 12, marginBottom: 8 }}>✕ Validation Failed. Please inspect X12 structure or re-upload a valid 835 file.</div>}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label className={`btn tiny ${step.done ? 'success' : 'primary'}`} style={{ cursor: validating835 ? 'not-allowed' : 'pointer' }}>
                    {validating835 ? (
                      <>
                        <span className="spinner-icon" /> Validating...
                      </>
                    ) : (
                      '⬆ Upload & Validate 835'
                    )}
                    <input type="file" hidden accept=".835,.x12,.edi,.txt,.dat,.35,.ansi,.rem" onChange={handleStep7Upload} disabled={validating835} />
                  </label>
                </div>
              </div>
            )}

            {step.actionType === 'mapping_redirect' && (
              <div className="step-custom-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div><b>Mapping Application:</b> Launch rules engine to configure 835 mapping.</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button 
                    type="button" 
                    className="btn tiny primary" 
                    onClick={() => {
                      window.location.href = `/mapping?client=${encodeURIComponent(clientId)}`;
                    }}
                  >
                    Start Mapping ↗
                  </button>
                </div>
              </div>
            )}

            {step.actionType === 'sftp_redirect' && (
              <div className="step-custom-box" style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '4px', border: '1px solid var(--line-soft)' }}>
                <div style={{ fontWeight: 600, fontSize: '11.5px', color: 'var(--ink-2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Create User:
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 180px', minWidth: '180px' }}>
                    <input 
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: '3px', fontSize: '12px', background: '#fff' }}
                      type="text"
                      placeholder="Name *"
                      value={s9Name}
                      onChange={(e) => setS9Name(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: '1 1 180px', minWidth: '180px' }}>
                    <input 
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: '3px', fontSize: '12px', background: '#fff' }}
                      type="email"
                      placeholder="Email Address *"
                      value={s9Email}
                      onChange={(e) => setS9Email(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: '1 1 180px', minWidth: '180px' }}>
                    <input 
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: '3px', fontSize: '12px', background: '#fff' }}
                      type="password"
                      placeholder="Password *"
                      value={s9Password}
                      onChange={(e) => setS9Password(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: '1 1 180px', minWidth: '180px' }}>
                    <input 
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: '3px', fontSize: '12px', background: '#fff' }}
                      type="tel"
                      placeholder="Mobile"
                      value={s9Mobile}
                      onChange={(e) => setS9Mobile(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'flex-start' }}>
                    <button 
                      className="btn tiny primary" 
                      onClick={handleStep9CreateUser}
                      style={{ padding: '6px 14px', fontWeight: 600, height: '29px' }}
                    >
                      ✓ Create User & Complete
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step.actionType === 'side_by_side_done' && (
              <div className="step-custom-box">
                <label style={{ fontWeight: 600, fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Side-by-Side 835 Conversion Review Notes *:
                </label>
                <textarea
                  rows={2}
                  style={{ width: '100%', padding: 6, border: '1px solid var(--line)', fontSize: 12.5 }}
                  placeholder="e.g. Verified side-by-side 835 conversion claim totals CLP, BPR, and TRN against MIR format."
                  value={s10Notes}
                  onChange={(e) => setS10Notes(e.target.value)}
                />
                <div style={{ marginTop: 6, textAlign: 'right' }}>
                  <button className="btn tiny success" onClick={async () => {
                    if (!s10Notes.trim()) { 
                      setFeedback({ isOpen: true, kind: 'bad', title: 'Evidence Required', content: 'Step 10 Evidence Required: Please enter side-by-side 835 conversion review notes.', checks: [] }); 
                      return; 
                    }
                    try {
                      await postStepData(`/clients/${encodeURIComponent(clientId)}/steps/step_10_test_review/complete/`, { submission_text: s10Notes });
                      onRefresh();
                    } catch (err) { 
                      setFeedback({ isOpen: true, kind: 'bad', title: 'Submission Error', content: err.message, checks: [] }); 
                    }
                  }}>✓ Complete Step 10</button>
                </div>
              </div>
            )}

            {step.actionType === 'send_ftp_action' && (
              <div className="step-custom-box" style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '4px', border: '1px solid var(--line-soft)' }}>
                <div style={{ fontWeight: 600, fontSize: '11.5px', color: 'var(--ink-2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Company Sender Configuration:
                </div>
                <div style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--ink)' }}>
                  Configure the global admin email account to send the onboarding notification to the client. This will be securely saved to the server configuration.
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 180px', minWidth: '180px' }}>
                    <input 
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: '3px', fontSize: '12px', background: '#fff' }}
                      type="email"
                      placeholder="Sender Email Address *"
                      value={s11Email}
                      onChange={(e) => setS11Email(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: '1 1 180px', minWidth: '180px' }}>
                    <input 
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: '3px', fontSize: '12px', background: '#fff' }}
                      type="password"
                      placeholder="Email App Password *"
                      value={s11Password}
                      onChange={(e) => setS11Password(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'flex-start' }}>
                    <button 
                      className="btn tiny primary" 
                      disabled={!s11Email.trim() || !s11Password.trim() || s11Sending}
                      onClick={async () => {
                        setS11Sending(true);
                        try {
                          const res = await postStepData(`/clients/${encodeURIComponent(clientId)}/steps/step_11_send_ftp/send/`, {
                            sender_email: s11Email.trim(),
                            sender_password: s11Password.trim()
                          });
                          setFeedback({
                            isOpen: true,
                            kind: 'ok',
                            title: res.title || 'Email Notification Sent',
                            content: res.message || `Hello ${clientId}, we have sent the email notification.`,
                            checks: res.checks || [
                              { ok: true, label: 'Configuration Updated', detail: `Global sender email configured as ${s11Email.trim()}` },
                              { ok: true, label: 'Notification Sent', detail: 'Email message successfully sent to the client. Step 11 marked as complete.' }
                            ]
                          });
                          await onRefresh();
                        } catch (err) { 
                          setFeedback({ isOpen: true, kind: 'bad', title: 'Transmission Error', content: err.message, checks: [] }); 
                        } finally {
                          setS11Sending(false);
                        }
                      }}
                      style={{ 
                        padding: '6px 14px', 
                        fontWeight: 600, 
                        height: '29px',
                        opacity: s11Sending ? 0.6 : 1,
                        filter: s11Sending ? 'blur(0.5px)' : 'none',
                        transition: 'opacity 0.2s, filter 0.2s'
                      }}
                    >
                      {s11Sending ? '⏳ Sending...' : '🚀 Send Email Notification'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step.actionType === 'schedule_action' && (
              <div className="step-custom-box" style={{ padding: '8px 12px', background: '#F8FAFC', borderRadius: '4px', border: '1px solid var(--line-soft)', marginTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>Date *:</label>
                    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="MM-DD-YYYY"
                        maxLength={10}
                        style={{
                          width: '125px',
                          padding: '4px 26px 4px 8px',
                          border: '1px solid var(--line)',
                          borderRadius: '3px',
                          fontSize: '12px',
                          background: '#fff',
                          color: 'var(--ink)',
                          height: '28px',
                          fontFamily: 'var(--mono), inherit'
                        }}
                        value={s13Date}
                        onChange={(e) => setS13Date(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (datePickerRef.current) {
                            if (typeof datePickerRef.current.showPicker === 'function') {
                              datePickerRef.current.showPicker();
                            } else {
                              datePickerRef.current.focus();
                              datePickerRef.current.click();
                            }
                          }
                        }}
                        title="Open Calendar Picker"
                        style={{
                          position: 'absolute',
                          right: '2px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          fontSize: '13px',
                          lineHeight: 1,
                          color: 'var(--ink-2)'
                        }}
                      >
                        📅
                      </button>
                      <input
                        ref={datePickerRef}
                        type="date"
                        style={{
                          position: 'absolute',
                          opacity: 0,
                          pointerEvents: 'none',
                          width: '1px',
                          height: '1px',
                          bottom: 0,
                          left: 0
                        }}
                        value={toISODate(s13Date)}
                        onChange={(e) => {
                          if (e.target.value) {
                            setS13Date(formatToMMDDYYYY(e.target.value));
                          }
                        }}
                        tabIndex={-1}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>Time (EST) *:</label>
                    <input
                      type="time"
                      style={{ width: '110px', padding: '4px 6px', border: '1px solid var(--line)', borderRadius: '3px', fontSize: '12px', background: '#fff', color: 'var(--ink)', height: '28px' }}
                      value={s13Time}
                      onChange={(e) => setS13Time(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <input
                      style={{ width: '100%', padding: '4px 8px', border: '1px solid var(--line)', borderRadius: '3px', fontSize: '12px', background: '#fff', color: 'var(--ink)', height: '28px' }}
                      placeholder="Meeting notes / calendar details (optional)"
                      value={s13Notes}
                      onChange={(e) => setS13Notes(e.target.value)}
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      className="btn tiny primary"
                      onClick={handleStep13Save}
                      style={{ padding: '5px 12px', fontWeight: 600, whiteSpace: 'nowrap', height: '28px' }}
                    >
                      Save Schedule &amp; Complete
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(step.actionType === 'text_submission' || step.actionType === 'text_submission_final') && (
              <div className="step-custom-box">
                <label style={{ fontWeight: 600, fontSize: 12, display: 'block', marginBottom: 4 }}>
                  {step.actionType === 'text_submission_final' ? 'Production Delivery Sign-Off Notes:' : 'Go-Live Safeguards Verification:'}
                </label>
                <textarea rows={2} style={{ width: '100%', padding: 6, border: '1px solid var(--line)', fontSize: 12.5 }} placeholder={step.actionType === 'text_submission_final' ? 'First production file delivered and monitored without error.' : 'All cutover checks and security safeguards passed.'} value={stText} onChange={(e) => setStText(e.target.value)} />
                <div style={{ marginTop: 6, textAlign: 'right' }}>
                  <button className="btn tiny primary" onClick={handleTextSubmission}>
                    {step.actionType === 'text_submission_final' ? 'Conclude Onboarding' : `Submit & Complete Step ${step.id}`}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="side">
        {statusTag}
        <div className="rup">
          {hasValidUpload && (
            <button
              type="button"
              className="btn tiny icon-btn"
              onClick={handleViewUploadedFile}
              title={`View Uploaded File (${latestUp?.original_filename || 'Evidence'})`}
              aria-label="View Uploaded File"
              disabled={viewerLoading}
              style={{ background: 'var(--blue-bg)', borderColor: 'var(--blue)', color: 'var(--blue)' }}
            >
              {viewerLoading ? '…' : '👁'}
            </button>
          )}

          {step.file && (
            <button
              type="button"
              className="btn tiny icon-btn"
              onClick={() => downloadTemplateFile(clientId, step.key, step.title, step.ext)}
              title={`Download Template (${step.downloadName || step.title})`}
              aria-label={`Download Template (${step.downloadName || step.title})`}
            >
              ⬇
            </button>
          )}

          {(step.actionType === 'upload_template' || step.actionType === 'email_upload') && (
            <label
              className={`btn tiny icon-btn ${step.done ? 'success' : 'primary'}`}
              style={{ cursor: 'pointer' }}
              title={step.actionType === 'email_upload' ? "Upload Email Confirmation (Images & Documents)" : "Upload File"}
              aria-label="Upload File"
            >
              ⬆
              <input
                type="file"
                hidden
                onChange={handleStandardFileUpload}
                accept={step.actionType === 'email_upload' ? "image/*,.png,.jpg,.jpeg,.webp,.gif,.svg,.bmp,.tiff,.tif,.ico,.avif,.pdf,.eml,.msg,.txt,.doc,.docx" : (step.ext ? `.${step.ext}` : undefined)}
              />
            </label>
          )}

          <button
            type="button"
            className="btn tiny icon-btn"
            onClick={() => onOpenNotes(step.key, step.title)}
            title="Notes"
            aria-label="Notes"
          >
            💬
          </button>

          {(step.done || step.inProgress) && (
            <button
              type="button"
              className="btn tiny danger icon-btn"
              onClick={() => onOpenRedo(step.key, step.id)}
              title={`Redo Step ${step.id}`}
              aria-label={`Redo Step ${step.id}`}
            >
              🔄
            </button>
          )}
        </div>
      </div>

      <FileViewerModal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        fileData={viewerFile}
        stepTitle={step.title}
        stepNum={step.id}
      />

      <FeedbackModal
        isOpen={feedback.isOpen}
        onClose={() => setFeedback({ ...feedback, isOpen: false })}
        kind={feedback.kind}
        title={feedback.title}
        content={feedback.content}
        checks={feedback.checks}
      />
      
      {showSftpModal && (
        <ClientSftpModal
          clientId={clientId}
          onClose={() => setShowSftpModal(false)}
          onConfigured={(cfg) => {
            setS6SftpVerified(true);
            setS6SftpConfig(cfg);
          }}
        />
      )}
    </div>
  );
}

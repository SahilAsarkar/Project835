import React, { useState, useEffect, useRef } from 'react';
import ClientSelectDropdown from './ClientSelectDropdown';
import {
  fetchGoLiveState, uploadGoLiveDoc, downloadGoLiveTemplate,
  saveGoLiveSFTP, saveGoLiveSchedule, saveGoLiveComment,
  completeGoLiveStep6, redoGoLiveStep
} from '../services/api';
import FeedbackModal from './modals/FeedbackModal';
import ConfirmModal from './modals/ConfirmModal';

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

export default function GoLiveView({ clients = [], activeClientId, onSelectClient, onClientUpdated, onOpenNotes }) {
  const [selectedClientId, setSelectedClientId] = useState(activeClientId || (clients[0]?.id || ''));
  const [goliveState, setGoliveState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [feedback, setFeedback] = useState({ isOpen: false, kind: 'ok', title: '', content: '', checks: [] });
  const [redoConfirm, setRedoConfirm] = useState({ isOpen: false, stepNum: null });

  // Step 3 SFTP
  const [sftpSameAsTest, setSftpSameAsTest] = useState(false);

  // Step 4 Schedule
  const [productionDate, setProductionDate] = useState('');
  const [productionTime, setProductionTime] = useState('');
  const step4DatePickerRef = useRef(null);

  // Step 5 Comment
  const [specialComment, setSpecialComment] = useState('');

  // File refs
  const fileInputStep1Ref = useRef(null);
  const fileInputStep2Ref = useRef(null);

  const currentClient = clients.find(c => c.id === selectedClientId) || clients[0];

  useEffect(() => {
    if (activeClientId && activeClientId !== selectedClientId) {
      setSelectedClientId(activeClientId);
    }
  }, [activeClientId]);

  useEffect(() => {
    if (selectedClientId) {
      loadState(selectedClientId);
    }
  }, [selectedClientId]);

  async function loadState(clientId) {
    if (!clientId) return;
    setLoading(true);
    setErrorMessage('');
    try {
      const state = await fetchGoLiveState(clientId);
      setGoliveState(state);

      const step3 = state.steps.find(s => s.step_number === 3);
      if (step3?.extra?.sftp) {
        setSftpSameAsTest(Boolean(step3.extra.sftp.same_as_test));
      } else {
        setSftpSameAsTest(false);
      }

      const step4 = state.steps.find(s => s.step_number === 4);
      if (step4?.extra?.schedule) {
        setProductionDate(formatToMMDDYYYY(step4.extra.schedule.production_date) || '');
        setProductionTime(step4.extra.schedule.production_time || '');
      }

      const step5 = state.steps.find(s => s.step_number === 5);
      if (step5?.extra?.comment) {
        setSpecialComment(step5.extra.comment.comment_text || '');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load Go Live state');
      setGoliveState(null);
    } finally {
      setLoading(false);
    }
  }

  function handleClientChange(e) {
    const newId = e.target.value;
    setSelectedClientId(newId);
    if (onSelectClient) {
      onSelectClient(newId);
    }
  }

  async function handleStepFileUpload(stepNum, e) {
    const file = e.target.files?.[0];
    if (!file || !selectedClientId) return;

    setActionLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await uploadGoLiveDoc(selectedClientId, stepNum, file);
      setGoliveState(res.state);
      setFeedback({
        isOpen: true,
        kind: 'ok',
        title: 'Evidence Validated & Stored',
        content: `Uploaded ${file.name} for Go Live Step ${stepNum}.`,
        checks: res.checks || []
      });
    } catch (err) {
      setFeedback({
        isOpen: true,
        kind: 'bad',
        title: 'Validation Failed',
        content: err.message,
        checks: err.checks || []
      });
    } finally {
      setActionLoading(false);
      if (stepNum === 1 && fileInputStep1Ref.current) fileInputStep1Ref.current.value = '';
      if (stepNum === 2 && fileInputStep2Ref.current) fileInputStep2Ref.current.value = '';
    }
  }

  async function handleStepDownload(stepNum, filename) {
    setErrorMessage('');
    try {
      await downloadGoLiveTemplate(selectedClientId, stepNum, filename);
    } catch (err) {
      setErrorMessage(`Failed to download Step ${stepNum} template: ${err.message}`);
    }
  }

  async function handleSaveStep3SFTP(isConfigured = false) {
    setActionLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await saveGoLiveSFTP(selectedClientId, {
        watched_folder_sftp: true,
        keys_exchanged: true,
        no_change_to_client_system: true,
        same_as_test: sftpSameAsTest
      });
      setGoliveState(res.state);
      setSuccessMessage(isConfigured ? 'Step 3: Production SFTP configured same as Test SFTP and completed.' : 'Step 3: Production SFTP Setup completed.');
      if (onClientUpdated) {
        onClientUpdated();
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save Step 3 SFTP settings');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveStep4Schedule(e) {
    e.preventDefault();
    if (!productionDate.trim()) {
      setErrorMessage('Production Date is REQUIRED for Go Live Step 4.');
      return;
    }

    setActionLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const newState = await saveGoLiveSchedule(selectedClientId, productionDate.trim(), productionTime.trim());
      setGoliveState(newState);
      setSuccessMessage(`Step 4: Production Schedule set for ${productionDate} ${productionTime ? `at ${productionTime}` : '(time TBD)'}.`);
      if (onClientUpdated) {
        onClientUpdated();
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save production schedule');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveStep5Comment(e) {
    e.preventDefault();
    setActionLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const newState = await saveGoLiveComment(selectedClientId, specialComment.trim());
      setGoliveState(newState);
      setSuccessMessage('Step 5: Special Comment saved and step marked complete.');
      if (onClientUpdated) {
        onClientUpdated();
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save special comment');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleFinalizeGoLive() {
    setActionLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await completeGoLiveStep6(selectedClientId);
      setGoliveState(res.state);
      setSuccessMessage(`🎉 Production Successful! ${currentClient?.name} is now promoted to Live Production!`);
      if (onClientUpdated) {
        onClientUpdated();
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to finalize Go Live');
    } finally {
      setActionLoading(false);
    }
  }

  function handleRedo(stepNum) {
    setRedoConfirm({ isOpen: true, stepNum });
  }

  async function executeRedo() {
    const stepNum = redoConfirm.stepNum;
    setRedoConfirm({ isOpen: false, stepNum: null });
    if (!stepNum) return;

    setActionLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const newState = await redoGoLiveStep(selectedClientId, stepNum);
      setGoliveState(newState);
      setSuccessMessage(`Step ${stepNum} reset to In Progress.`);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to reset step');
    } finally {
      setActionLoading(false);
    }
  }

  const steps = goliveState?.steps || [];
  const doneCount = steps.filter(s => s.done).length;
  const inProgressStep = steps.find(s => s.inProgress);
  const activeStepNum = inProgressStep ? `Step ${inProgressStep.step_number}` : (doneCount === 6 ? 'Complete' : '—');
  const activeStepTitle = inProgressStep ? inProgressStep.title : (doneCount === 6 ? 'All 6 Steps Complete' : '—');
  const isStep6Done = steps.find(s => s.step_number === 6)?.done;

  return (
    <section className="view on" id="v-promote">
      <div className="hdr-row">
        <div>
          <div className="eyebrow">Stage Promotion</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '2px 0 4px' }}>
            <ClientSelectDropdown
              clients={clients}
              value={selectedClientId}
              onChange={(val) => {
                setSelectedClientId(val);
                if (onSelectClient) {
                  onSelectClient(val);
                }
              }}
            />
            <h1 style={{ margin: 0 }}>Go Live Readiness</h1>
          </div>
          <p className="sub">Sequential 6-step compliance ladder to promote <b>{currentClient?.name}</b> to full production operations.</p>
        </div>
      </div>

      <div className="metrics">
        <div className="metric">
          <div className="v">{doneCount} / 6</div>
          <div className="l">Steps Complete</div>
          <div className="d">Go Live Progress</div>
        </div>
        <div className="metric">
          <div className="v">{activeStepNum}</div>
          <div className="l">Active Action</div>
          <div className="d">{activeStepTitle}</div>
        </div>
        <div className="metric">
          <div className="v">{goliveState?.progress_pct || 0}%</div>
          <div className="l">Completion</div>
          <div className="d">Stage: {isStep6Done ? 'Production' : 'Pre-Production'}</div>
        </div>
        <div className="metric">
          <div className="v">{isStep6Done ? 'Healthy' : 'In Cutover'}</div>
          <div className="l">Readiness State</div>
          <div className="d">Live operations status</div>
        </div>
      </div>

      {errorMessage && (
        <div className="note" style={{ background: 'var(--brick-bg)', borderColor: 'var(--brick)', color: 'var(--brick)' }}>
          <b>Error:</b> {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="good">
          ✓ {successMessage}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-3)' }}>
          Loading Go Live workflow for {currentClient?.name}...
        </div>
      ) : (
        <div className="ladder">
          <div className="phase">
            Phase Live · Production Cutover &amp; Activation
          </div>

          {steps.map((step) => {
            const isDone = step.done;
            const isInProgress = step.inProgress;
            const isWaiting = !isDone && !isInProgress;
            const rungClass = isDone ? 'done' : isInProgress ? 'now' : 'locked';

            return (
              <div key={step.id} className={`rung ${rungClass}`}>
                <div className="mark">
                  {isDone ? '✓' : step.step_number}
                </div>

                <div className="txt">
                  <h3>{step.title}</h3>
                  <div className="meta">{step.desc}</div>

                  {/* Step 1 & 2 Filed Document Evidence */}
                  {isDone && (step.step_number === 1 || step.step_number === 2) && (
                    <div className="ev" style={{ marginTop: '4px', fontSize: '11.5px', color: 'var(--ink-2)' }}>
                      📄 Filed: <b>{step.step_number === 1 ? 'OneSmarter_CutoverAuthorization_Signed.pdf' : 'OneSmarter_ProductionBaseline_Signed.pdf'}</b>
                    </div>
                  )}

                  {/* Latest Note Evidence */}
                  {step.latestNote && (
                    <div className="ev" style={{ color: 'var(--ochre)', marginTop: '4px', fontSize: '11.5px' }}>
                      💬 Latest Note: "{step.latestNote.note_text}" — <i>{step.latestNote.author}</i>
                    </div>
                  )}

                  {/* Step 3 Content (SFTP Setup) */}
                  {step.step_number === 3 && (
                    <div className="step-custom-box">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer', marginBottom: '12px' }}>
                        <input
                          type="checkbox"
                          checked={sftpSameAsTest}
                          disabled={isWaiting || actionLoading}
                          onChange={e => setSftpSameAsTest(e.target.checked)}
                        />
                        Production SFTP same as test SFTP
                      </label>

                      {sftpSameAsTest ? (
                        <button
                          type="button"
                          className="btn tiny primary"
                          disabled={isWaiting || actionLoading}
                          onClick={() => handleSaveStep3SFTP(true)}
                        >
                          {actionLoading ? 'Configuring...' : '⚙ Configure SFTP'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn tiny primary"
                          disabled={isWaiting || actionLoading}
                          onClick={() => handleSaveStep3SFTP(false)}
                        >
                          {actionLoading ? 'Completing...' : '✓ Complete Step 3'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Step 4 Content (Production Schedule) */}
                  {step.step_number === 4 && (
                    <div className="step-custom-box">
                      <form onSubmit={handleSaveStep4Schedule} style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '3px' }}>
                            Production Date <span style={{ color: 'var(--brick)' }}>* (Required)</span>:
                          </label>
                          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                            <input
                              type="text"
                              required
                              placeholder="MM-DD-YYYY"
                              maxLength={10}
                              value={productionDate}
                              disabled={isWaiting || actionLoading}
                              onChange={e => setProductionDate(e.target.value)}
                              style={{ padding: '6px 28px 6px 9px', border: '1px solid var(--line)', borderRadius: '2px', fontSize: '12.5px', width: '130px', fontFamily: 'var(--mono), inherit' }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (step4DatePickerRef.current) {
                                  if (typeof step4DatePickerRef.current.showPicker === 'function') {
                                    step4DatePickerRef.current.showPicker();
                                  } else {
                                    step4DatePickerRef.current.focus();
                                    step4DatePickerRef.current.click();
                                  }
                                }
                              }}
                              disabled={isWaiting || actionLoading}
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
                              ref={step4DatePickerRef}
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
                              value={toISODate(productionDate)}
                              onChange={(e) => {
                                if (e.target.value) {
                                  setProductionDate(formatToMMDDYYYY(e.target.value));
                                }
                              }}
                              tabIndex={-1}
                            />
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '3px' }}>
                            Production Time (Optional):
                          </label>
                          <input
                            type="time"
                            value={productionTime}
                            disabled={isWaiting || actionLoading}
                            onChange={e => setProductionTime(e.target.value)}
                            style={{ padding: '6px 9px', border: '1px solid var(--line)', borderRadius: '2px', fontSize: '12.5px', width: '115px' }}
                          />
                        </div>
                        <button
                          type="submit"
                          className="btn tiny primary"
                          disabled={isWaiting || actionLoading || !productionDate.trim()}
                        >
                          {actionLoading ? 'Saving...' : '✓ Save & Complete Step 4'}
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Step 5 Content (Any Special Comment) */}
                  {step.step_number === 5 && (
                    <div className="step-custom-box">
                      <form onSubmit={handleSaveStep5Comment}>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '4px' }}>
                          Special Instructions / Overrides (Optional — leave blank if none):
                        </label>
                        <textarea
                          rows="2"
                          placeholder="Enter any client-specific operational notes, escalation contacts, or cutover window comments..."
                          value={specialComment}
                          disabled={isWaiting || actionLoading}
                          onChange={e => setSpecialComment(e.target.value)}
                          style={{ width: '100%', padding: '7px 9px', border: '1px solid var(--line)', borderRadius: '2px', fontSize: '12.5px', marginBottom: '8px' }}
                        />
                        <button
                          type="submit"
                          className="btn tiny primary"
                          disabled={isWaiting || actionLoading}
                        >
                          {actionLoading ? 'Saving...' : '✓ Save & Complete Step 5'}
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Step 6 Content (Production Successful) */}
                  {step.step_number === 6 && (
                    <div style={{ marginTop: '10px' }}>
                      {isDone ? (
                        <div className="good" style={{ margin: '6px 0 0' }}>
                          <b>✓ Live Production Active:</b> All 6 Go Live gates complete. Real-time EDI 835 translation and delivery are verified.
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn tiny primary"
                          disabled={doneCount < 5 || actionLoading}
                          onClick={handleFinalizeGoLive}
                          style={{
                            background: doneCount >= 5 ? 'var(--teal)' : undefined,
                            borderColor: doneCount >= 5 ? 'var(--teal)' : undefined
                          }}
                        >
                          {actionLoading ? 'Finalizing...' : '🚀 Finalize Production Successful'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="side">
                  <span className={`tag ${isDone ? 'ok' : isInProgress ? 'work' : 'idle'}`}>
                    {isDone ? 'Complete' : isInProgress ? 'In Process' : 'Pending'}
                  </span>

                  <div className="rup">
                    {/* Download Template button */}
                    {(step.downloadFilename || step.download_filename || (step.step_number === 1 ? 'OneSmarter_CutoverAuthorization_Template.pdf' : step.step_number === 2 ? 'OneSmarter_ProductionBaseline_Template.pdf' : null)) && (
                      <button
                        type="button"
                        className="btn tiny icon-btn"
                        onClick={() => handleStepDownload(
                          step.step_number,
                          step.downloadFilename || step.download_filename || (step.step_number === 1 ? 'OneSmarter_CutoverAuthorization_Template.pdf' : 'OneSmarter_ProductionBaseline_Template.pdf')
                        )}
                        title={`Download Template (${step.downloadFilename || step.download_filename || (step.step_number === 1 ? 'OneSmarter_CutoverAuthorization_Template.pdf' : 'OneSmarter_ProductionBaseline_Template.pdf')})`}
                        aria-label="Download Template"
                      >
                        ⬇
                      </button>
                    )}

                    {/* Upload Document button */}
                    {(step.step_number === 1 || step.step_number === 2) && (
                      <label
                        className={`btn tiny icon-btn ${isDone ? 'success' : 'primary'}`}
                        style={{
                          cursor: isWaiting || actionLoading ? 'not-allowed' : 'pointer',
                          opacity: isWaiting || actionLoading ? 0.6 : 1
                        }}
                        title={`Upload Step ${step.step_number} Document`}
                        aria-label="Upload File"
                      >
                        ⬆
                        <input
                          type="file"
                          hidden
                          disabled={isWaiting || actionLoading}
                          onChange={e => handleStepFileUpload(step.step_number, e)}
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                        />
                      </label>
                    )}

                    {/* Notes icon button */}
                    {onOpenNotes && (
                      <button
                        type="button"
                        className="btn tiny icon-btn"
                        onClick={() => onOpenNotes(step.key, step.title)}
                        title={`Notes for Step ${step.step_number}`}
                        aria-label="Notes"
                      >
                        💬
                      </button>
                    )}

                    {/* Redo icon button */}
                    {(isDone || isInProgress) && step.step_number < 6 && (
                      <button
                        type="button"
                        className="btn tiny danger icon-btn"
                        disabled={actionLoading}
                        onClick={() => handleRedo(step.step_number)}
                        title={`Redo Step ${step.step_number}`}
                        aria-label={`Redo Step ${step.step_number}`}
                      >
                        🔄
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="note">
        <b>Go Live Ladder:</b> Sequential 6-step promotion process. Once all 6 steps are completed, the client's status is officially promoted to <b>Production</b>.
      </div>

      <FeedbackModal
        isOpen={feedback.isOpen}
        onClose={() => setFeedback({ ...feedback, isOpen: false })}
        kind={feedback.kind}
        title={feedback.title}
        content={feedback.content}
        checks={feedback.checks}
      />

      <ConfirmModal
        isOpen={redoConfirm.isOpen}
        onClose={() => setRedoConfirm({ isOpen: false, stepNum: null })}
        onConfirm={executeRedo}
        title="Redo Go Live Step"
        message={`Reset Go Live Step ${redoConfirm.stepNum} to In Progress? This will reset all subsequent steps to waiting.`}
        confirmText="Redo Step"
        kind="danger"
        loading={actionLoading}
      />
    </section>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import StepRung from './StepRung';
import ClientSelectDropdown from './ClientSelectDropdown';
import { postStepData } from '../services/api';
import ConfirmModal from './modals/ConfirmModal';
import FeedbackModal from './modals/FeedbackModal';

function formatDate(dateVal) {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return dateVal;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default function OnboardingLadder({ client, steps, roles, clients, onSelectClient, onRefresh, onOpenNotes, onOpenRedo, onOpenAddRole }) {
  const [returnPrompt, setReturnPrompt] = useState({ isOpen: false, pendingKey: '', stepName: '' });
  const [ladderFeedback, setLadderFeedback] = useState({ isOpen: false, kind: 'ok', title: '', content: '' });
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'cross_tab_refresh') {
        sessionStorage.removeItem('pending_return_step');
        onRefresh();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [onRefresh]);

  useEffect(() => {
    if (hasScrolledRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const focusStep = params.get('step') || (window.location.hash ? window.location.hash.replace('#step-', '') : null);
    if (focusStep && steps && steps.length > 0) {
      hasScrolledRef.current = true;
      const scrollTimer = setTimeout(() => {
        const el = document.getElementById(`step-${focusStep}`) || document.getElementById(`step-rung-${focusStep}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('highlight-flash');
          setTimeout(() => el.classList.remove('highlight-flash'), 2500);
        }
        try {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('step');
          cleanUrl.hash = '';
          window.history.replaceState({}, document.title, cleanUrl.toString());
        } catch (e) {}
      }, 300);
      return () => clearTimeout(scrollTimer);
    }
  }, [client?.id, steps]);

  useEffect(() => {
    const handleFocus = async () => {
      const pendingKey = sessionStorage.getItem('pending_return_step');
      if (pendingKey && client) {
        if (pendingKey === 'step_8_mapping') {
          // Do not prompt for step 8! It completes itself via the Save button.
          return;
        }
        sessionStorage.removeItem('pending_return_step');
        setReturnPrompt({
          isOpen: true,
          pendingKey,
          stepName: pendingKey.replace(/_/g, ' ').toUpperCase()
        });
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [client, onRefresh]);

  const handleConfirmPendingReturn = async () => {
    const pKey = returnPrompt.pendingKey;
    setReturnPrompt({ isOpen: false, pendingKey: '', stepName: '' });
    if (pKey && client) {
      try {
        await postStepData(`/clients/${encodeURIComponent(client.id)}/steps/${encodeURIComponent(pKey)}/complete/`, {});
        await onRefresh();
      } catch (err) {
        setLadderFeedback({ isOpen: true, kind: 'bad', title: 'Step Completion Error', content: err.message });
      }
    }
  };

  if (!client || !steps) {
    return (
      <section className="view on" id="v-onboard">
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-2)' }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>⏳ Loading Onboarding Ladder...</div>
          <p>Fetching client compliance state and onboarding steps...</p>
        </div>
      </section>
    );
  }

  const totalSteps = steps.length || 15;
  const doneCount = steps.filter(s => s.done).length;
  const inProgressStep = steps.find(s => s.inProgress);
  const activeStepNum = inProgressStep ? `Step ${inProgressStep.id}` : (doneCount === totalSteps ? 'Complete' : '—');
  const activeStepTitle = inProgressStep ? inProgressStep.title : (doneCount === totalSteps ? `All ${totalSteps} Steps Complete` : '—');
  const stageName = (() => {
    const s = (client.stage || '').toLowerCase().replace(/[\s-]/g, '_');
    if (s === 'production') return 'Production';
    if (s === 'production_pending') return 'Production Pending';
    if (s === 'golive_pending' || s === 'go_live_pending') return 'Go Live Pending';
    if (s === 'onboarding_completed') return 'Onboarding Completed';
    return 'Onboarding Pending';
  })();

  let currentPhase = null;

  return (
    <section className="view on" id="v-onboard">
      <div className="hdr-row">
        <div>
          <div className="eyebrow" id="ob-eyebrow">Selected Client</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '2px 0 4px' }}>
            <ClientSelectDropdown
              id="client-select-hdr"
              clients={clients}
              value={client.id}
              onChange={(value) => onSelectClient(value)}
            />
            <h1 id="ob-title" style={{ margin: 0 }}>Onboarding Workflow</h1>
          </div>
          <p className="sub">Sequential {totalSteps}-step compliance ladder. Completing the active step automatically unlocks the next step.</p>
        </div>
      </div>

      <div className="metrics">
        <div className="metric">
          <div className="v" id="m-complete">{doneCount} / {totalSteps}</div>
          <div className="l">Steps Complete</div>
          <div className="d" id="m-started">Started — {formatDate(client.created_at)}</div>
        </div>
        <div className="metric">
          <div className="v" id="m-waiting">{activeStepNum}</div>
          <div className="l">Active Action</div>
          <div className="d" id="m-waiting-d">{activeStepTitle}</div>
        </div>
        <div className="metric">
          <div className="v" id="m-pct">{client.progress_pct}%</div>
          <div className="l">Completion</div>
          <div className="d" id="m-stage">Stage: {stageName}</div>
        </div>
        <div className="metric">
          <div className="v" id="m-move">{formatDate(client.updated_at)}</div>
          <div className="l">Last Activity</div>
          <div className="d" id="m-move-d">Activity logged</div>
        </div>
      </div>

      <div className="ladder" id="ladder">
        {steps.map((step) => {
          let renderPhaseHeader = false;
          let phaseText = step.phase;
          if (phaseText !== currentPhase) {
            currentPhase = phaseText;
            renderPhaseHeader = true;
          }

          return (
            <React.Fragment key={`${client.id}-${step.id}`}>
              {renderPhaseHeader && (
                <div className="phase">
                  {phaseText}
                </div>
              )}
              <StepRung
                step={step}
                clientId={client.id}
                roles={roles}
                onRefresh={onRefresh}
                onOpenNotes={onOpenNotes}
                onOpenRedo={onOpenRedo}
                onOpenAddRole={onOpenAddRole}
              />
            </React.Fragment>
          );
        })}
      </div>

      <div className="note">
        <b>Sequential Workflow:</b> Steps unlock one by one. Use the <b>💬 Notes</b> icon on any step to record internal notes. Steps can be completed via document uploads, structured forms, or integration callbacks.
      </div>

      <ConfirmModal
        isOpen={returnPrompt.isOpen}
        onClose={() => setReturnPrompt({ isOpen: false, pendingKey: '', stepName: '' })}
        onConfirm={handleConfirmPendingReturn}
        title="Complete Step Action"
        message={`Welcome back! Did you finish work in the external tool for ${returnPrompt.stepName}? Click below to mark this step complete.`}
        confirmText="Mark Step Complete"
        cancelText="Not Yet"
      />

      <FeedbackModal
        isOpen={ladderFeedback.isOpen}
        onClose={() => setLadderFeedback({ ...ladderFeedback, isOpen: false })}
        kind={ladderFeedback.kind}
        title={ladderFeedback.title}
        content={ladderFeedback.content}
        checks={[]}
      />
    </section>
  );
}

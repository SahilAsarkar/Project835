import React, { useState } from 'react';
import CenteredModal from './CenteredModal';
import { createClient } from '../../services/api';

export default function AddClientModal({ isOpen, onClose, onClientCreated, existingClients = [] }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const trimmedName = name.trim();
    const trimmedCode = code.trim();

    if (!trimmedName) {
      setErrorMsg('Client legal name is required.');
      return;
    }

    // Client-side duplicate check (case-insensitive name & code)
    if (existingClients.some(c => c.name && c.name.toLowerCase() === trimmedName.toLowerCase())) {
      setErrorMsg(`Duplicate client: A client named "${trimmedName}" already exists in the system.`);
      return;
    }
    if (trimmedCode && existingClients.some(c => (c.code && c.code.toLowerCase() === trimmedCode.toLowerCase()) || (c.id && c.id.toLowerCase() === trimmedCode.toLowerCase()))) {
      setErrorMsg(`Duplicate client identifier: Client code "${trimmedCode}" is already in use.`);
      return;
    }

    setLoading(true);
    try {
      const response = await createClient({
        name: trimmedName,
        code: trimmedCode || undefined
      });
      
      await onClientCreated(response.client);
      setName('');
      setCode('');
      setErrorMsg('');
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create client.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setErrorMsg('');
    onClose();
  };

  return (
    <CenteredModal isOpen={isOpen} onClose={handleCloseModal}>
      <div className="modal-t">Add New Client</div>
      <p className="modal-b">Create a client record in the database and automatically generate their sequential onboarding compliance workflow.</p>
      
      {errorMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444',
          borderRadius: '6px',
          padding: '10px 14px',
          fontSize: '13px',
          marginBottom: '16px',
          fontWeight: 500
        }}>
          ⚠️ {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Client Legal Name *</label>
          <input
            placeholder="e.g. Apex Health Plan, Inc."
            value={name}
            onChange={(e) => { setName(e.target.value); setErrorMsg(''); }}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label>Client Code / Identifier</label>
          <input
            placeholder="e.g. APEXHP"
            value={code}
            onChange={(e) => { setCode(e.target.value); setErrorMsg(''); }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
          <button type="button" className="btn" onClick={handleCloseModal}>Cancel</button>
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Client'}
          </button>
        </div>
      </form>
    </CenteredModal>
  );
}

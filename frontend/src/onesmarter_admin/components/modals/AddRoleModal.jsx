import React, { useState } from 'react';
import CenteredModal from './CenteredModal';
import { addEmployeeRole } from '../../services/api';

export default function AddRoleModal({ isOpen, onClose, onRoleAdded }) {
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [loading, setLoading] = useState(false);

  const [roleError, setRoleError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roleName.trim()) return;
    setLoading(true);
    setRoleError('');
    try {
      await addEmployeeRole(roleName.trim(), roleDesc.trim());
      setRoleName('');
      setRoleDesc('');
      setRoleError('');
      if (onRoleAdded) onRoleAdded();
      onClose();
    } catch (err) {
      setRoleError(err.message || 'Failed to add role.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CenteredModal isOpen={isOpen} onClose={onClose}>
      <div className="modal-t">Add Employee Post / Role</div>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Role Name *</label>
          <input
            placeholder="e.g. EDI Support Engineer"
            value={roleName}
            onChange={(e) => {
              setRoleName(e.target.value);
              if (roleError) setRoleError('');
            }}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label>Description</label>
          <input
            placeholder="Role description or escalation tier"
            value={roleDesc}
            onChange={(e) => setRoleDesc(e.target.value)}
          />
        </div>
        {roleError && (
          <div style={{ color: 'var(--brick)', fontSize: '11.5px', marginTop: '6px' }}>
            ✕ {roleError}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? 'Adding...' : 'Save Role'}
          </button>
        </div>
      </form>
    </CenteredModal>
  );
}

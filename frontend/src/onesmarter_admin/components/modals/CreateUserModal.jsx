import React, { useState } from 'react';
import Select from 'react-select';
import CenteredModal from './CenteredModal';

export default function CreateUserModal({ isOpen, onClose, onSave, clients }) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('User');
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const clientOptions = clients.map(c => ({ value: c.id, label: c.name }));
  const selectedOptions = clientOptions.filter(o => selectedClientIds.includes(o.value));

  const handleCloseModal = () => {
    setErrorMsg('');
    setName('');
    setEmail('');
    setMobile('');
    setPassword('');
    setRole('User');
    setSelectedClientIds([]);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim() || !email.trim() || !password) {
      setErrorMsg("Name, Email, and Password are required.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await onSave({
        name: name.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        password,
        role,
        clients: selectedClientIds
      });
      // the onSave usually resets state and closes if successful
      handleCloseModal();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CenteredModal isOpen={isOpen} onClose={handleCloseModal}>
      <div className="modal-t">Create New User</div>
      <p className="modal-b">Create a new administrative user with assigned roles and client access.</p>
      
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
          <label>Name *</label>
          <input
            placeholder="e.g. John Doe"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrorMsg(''); }}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label>Email *</label>
          <input
            type="email"
            placeholder="e.g. john@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }}
            required
          />
        </div>
        <div className="field">
          <label>Mobile</label>
          <input
            placeholder="e.g. +1 555-0192"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Password *</label>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }}
            required
          />
        </div>
        <div className="field">
          <label>Role</label>
          <select value={role} onChange={e => setRole(e.target.value)}>
            <option value="User">User (Standard Access)</option>
            <option value="Admin">Admin (Full Access)</option>
          </select>
        </div>
        <div className="field">
          <label>Assign Clients</label>
          <Select 
            isMulti 
            options={clientOptions} 
            value={selectedOptions} 
            onChange={opts => setSelectedClientIds(opts ? opts.map(o => o.value) : [])} 
            placeholder="Select one or multiple clients..."
            styles={{
              control: (base) => ({ 
                ...base, 
                minHeight: '38px', 
                borderRadius: '4px', 
                borderColor: 'var(--line)',
                fontFamily: 'var(--body)',
                fontSize: '14px'
              }),
              menu: (base) => ({ 
                ...base, 
                zIndex: 9999,
                fontFamily: 'var(--body)',
                fontSize: '14px'
              })
            }}
          />
        </div>

        <div className="modal-actions" style={{ marginTop: '24px' }}>
          <button type="button" className="btn" onClick={handleCloseModal}>Cancel</button>
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </form>
    </CenteredModal>
  );
}

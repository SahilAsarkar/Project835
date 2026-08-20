import React from 'react';
import Select from 'react-select';

export default function ClientSelectDropdown({ clients, value, onChange, id }) {
  const options = clients.map(c => ({ value: c.id, label: c.name }));
  const selectedOption = options.find(o => o.value === value) || null;

  const customStyles = {
    control: (base) => ({
      ...base,
      minHeight: '34px',
      fontFamily: 'var(--body)',
      fontSize: '14px',
      border: '1px solid var(--line)',
      borderRadius: '3px',
      background: 'var(--surface)',
      color: 'var(--ink)',
      fontWeight: 600,
      cursor: 'pointer',
      boxShadow: 'none',
      minWidth: '220px',
      '&:hover': {
        borderColor: 'var(--ink-3)'
      }
    }),
    singleValue: (base) => ({
      ...base,
      color: 'var(--ink)',
    }),
    menu: (base) => ({
      ...base,
      fontFamily: 'var(--body)',
      fontSize: '14px',
      zIndex: 9999,
      color: 'var(--ink)'
    }),
    option: (base, state) => ({
      ...base,
      background: state.isFocused ? 'rgba(0,0,0,0.05)' : 'transparent',
      color: 'var(--ink)',
      cursor: 'pointer'
    })
  };

  return (
    <Select
      id={id}
      options={options}
      value={selectedOption}
      onChange={(option) => onChange(option ? option.value : '')}
      styles={customStyles}
      isSearchable={true}
      placeholder="Search client..."
    />
  );
}

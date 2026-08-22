const BASE_URL = '/admin-panel/api';

function getAuthHeaders(extraHeaders = {}) {
  const token = localStorage.getItem('onesmarter_admin_token');
  const headers = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Token ${token}`;
  }
  return headers;
}

export async function loginAdmin(email, password, code) {
  const res = await fetch(`${BASE_URL}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, code })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Authentication failed');
  return data;
}

export async function registerAdmin(email, password, name) {
  const res = await fetch(`${BASE_URL}/auth/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  return data;
}

export async function logoutAdmin() {
  try {
    await fetch(`${BASE_URL}/auth/logout/`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } catch (e) {
    // ignore
  }
}

export async function fetchClients() {
  const res = await fetch(`${BASE_URL}/clients/`, {
    headers: getAuthHeaders()
  });
  // Bypass 401 logout reload
  if (!res.ok) throw new Error('Failed to fetch clients');
  return res.json();
}

export async function fetchClientState(clientId) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/state/`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch client state');
  const data = await res.json();
  return data.state;
}

export async function createClient(clientPayload) {
  const payload = typeof clientPayload === 'string' ? { name: clientPayload } : clientPayload;
  
  let res;
  try {
    res = await fetch('/admin-panel/api/clients/create/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    res = null;
  }

  if (!res || !res.ok) {
    try {
      res = await fetch('/admin-panel/api/clients/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      res = null;
    }
  }

  if (!res) {
    throw new Error('Network error. Failed to reach server.');
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('Unexpected server response: ' + (text ? text.substring(0, 80) : 'empty response'));
  }

  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to create client.');
  }

  const clientObj = data.client || data.data || {
    id: data.id || 'CLT-' + Date.now(),
    name: payload.name,
    code: payload.code || payload.client_code || 'CLT-001',
    status: 'ACTIVE',
    stage: 'IN_PRODUCTION'
  };

  return { success: true, client: clientObj };
}

export async function deleteClient(clientId) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete client');
  return true;
}

export async function downloadTemplateFile(clientId, stepKey, title, ext) {
  const res = await fetch(`${BASE_URL}/download/${encodeURIComponent(clientId)}/${encodeURIComponent(stepKey)}/`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Download failed');
  const rawBlob = await res.blob();
  // Force octet-stream to prevent Adobe Acrobat extension from intercepting and losing the filename
  const blob = new Blob([rawBlob], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const headerFilename = res.headers.get('X-OneSmarter-Filename');
  const filename = headerFilename || `OneSmarter_${(title || '').replace(/[^A-Za-z0-9]+/g, '')}.${ext || 'pdf'}`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

export async function fetchStepUploadFile(clientId, stepKey) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/steps/${encodeURIComponent(stepKey)}/file/`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to load uploaded file');
  }
  const filename = res.headers.get('X-OneSmarter-Filename') || 'evidence_file';
  let contentType = res.headers.get('Content-Type') || '';
  if (!contentType || contentType === 'application/octet-stream') {
    const ext = (filename.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') contentType = 'application/pdf';
    else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    else if (['txt', 'log', 'csv', 'json', 'xml', 'edi', '835', 'x12'].includes(ext)) contentType = 'text/plain';
    else contentType = 'application/pdf';
  }
  const rawBlob = await res.blob();
  const blob = new Blob([rawBlob], { type: contentType });
  const fileUrl = URL.createObjectURL(blob);
  return { fileUrl, contentType, filename, blob };
}

export async function uploadStepFile(clientId, stepKey, file) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/steps/${encodeURIComponent(stepKey)}/upload/`, {
    method: 'POST',
    headers: getAuthHeaders({
      'X-Filename': file.name
    }),
    body: file
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Upload failed');
    err.checks = data.checks || [];
    throw err;
  }
  return data;
}

export async function validateStaged835(clientId, file) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/steps/step_7_835_val/validate-uploaded/`, {
    method: 'POST',
    headers: getAuthHeaders({
      'X-Filename': file.name
    }),
    body: file
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || '835 validation failed');
    err.checks = data.checks || [];
    throw err;
  }
  return data;
}

export async function redoStep(clientId, stepKey) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/steps/${encodeURIComponent(stepKey)}/redo/`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Redo failed');
  return data;
}

export async function postStepData(endpoint, body) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Action failed');
  return data;
}

export async function fetchNotes(clientId, stepKey) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/steps/${encodeURIComponent(stepKey)}/notes/`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch notes');
  return res.json();
}

export async function addNote(clientId, stepKey, noteText) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/steps/${encodeURIComponent(stepKey)}/notes/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ note_text: noteText })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add note');
  return data;
}

export async function fetchEmployeeRoles() {
  const res = await fetch(`${BASE_URL}/employee-roles/`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch roles');
  return res.json();
}

export async function addEmployeeRole(roleName, description = '') {
  const res = await fetch(`${BASE_URL}/employee-roles/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ role_name: roleName, description: description })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add role');
  return data;
}

export async function fetchAuditLogs(clientId = '', module = '') {
  const params = new URLSearchParams();
  if (clientId) params.append('client_id', clientId);
  if (module) params.append('module', module);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${BASE_URL}/audit-logs/${qs}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch audit logs');
  const data = await res.json();
  return data.logs || [];
}

// --- 1. Client Documents Service ---
export async function fetchClientDocuments(clientId) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/documents/`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch client documents');
  const data = await res.json();
  return data.documents || [];
}

export async function fetchClientEdiFiles(clientId) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/edi-files/`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch client EDI 835 archive files');
  const data = await res.json();
  return data.files || [];
}

export async function uploadClientDocument(clientId, file, docName = '', docType = 'General Document') {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/documents/upload/`, {
    method: 'POST',
    headers: getAuthHeaders({
      'X-Filename': file.name,
      'X-Doc-Name': docName || file.name,
      'X-Doc-Type': docType
    }),
    body: file
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Document upload failed');
  return data;
}

export async function fetchDocumentFile(docId, defaultFilename = 'document.pdf') {
  const res = await fetch(`${BASE_URL}/documents/${encodeURIComponent(docId)}/download/`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Document download failed');
  const filename = res.headers.get('X-OneSmarter-Filename') || defaultFilename;
  let contentType = res.headers.get('Content-Type') || '';
  if (!contentType || contentType === 'application/octet-stream') {
    const ext = (filename.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') contentType = 'application/pdf';
    else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    else if (['txt', 'log', 'csv', 'json', 'xml', 'edi', '835', 'x12'].includes(ext)) contentType = 'text/plain';
    else contentType = 'application/pdf';
  }
  const rawBlob = await res.blob();
  const blob = new Blob([rawBlob], { type: contentType });
  const fileUrl = URL.createObjectURL(blob);
  return { fileUrl, contentType, filename, blob };
}

export async function downloadDocumentFile(docId, defaultFilename = 'document.pdf') {
  const res = await fetch(`${BASE_URL}/documents/${encodeURIComponent(docId)}/download/`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Document download failed');
  const filename = res.headers.get('X-OneSmarter-Filename') || defaultFilename;
  const rawBlob = await res.blob();
  const blob = new Blob([rawBlob], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

export async function deleteDocumentFile(docId) {
  const res = await fetch(`${BASE_URL}/documents/${encodeURIComponent(docId)}/`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Document deletion failed');
  return res.json();
}

// --- 2. Test Environment Service ---
export async function fetchClientTestEnvironment(clientId) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/test-environment/`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch test environment');
  const data = await res.json();
  return data.test_environment;
}

export async function updateClientTestEnvironment(clientId, payload) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/test-environment/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update test environment');
  return data.test_environment;
}

export async function runClientSandboxTest(clientId) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/test-environment/run-test/`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Sandbox test failed');
  return data;
}

// --- 3. Go Live 6-Step Service ---
export async function fetchGoLiveState(clientId) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/golive/state/`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch Go Live state');
  const data = await res.json();
  return data.state;
}

export async function uploadGoLiveDoc(clientId, stepNum, file) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/golive/steps/${stepNum}/upload/`, {
    method: 'POST',
    headers: getAuthHeaders({
      'X-Filename': file.name
    }),
    body: file
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Go Live document upload failed');
    err.checks = data.checks || [];
    throw err;
  }
  return data;
}

export async function downloadGoLiveTemplate(clientId, stepNum, filename) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/golive/steps/${stepNum}/download/`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Template download failed');
  const rawBlob = await res.blob();
  const blob = new Blob([rawBlob], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename || `OneSmarter_GoLive_Step${stepNum}_Template.pdf`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

export async function saveGoLiveSFTP(clientId, payload) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/golive/steps/3/sftp/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save SFTP settings');
  return data;
}

export async function saveGoLiveSchedule(clientId, productionDate, productionTime, notes) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/golive/steps/4/schedule/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      production_date: productionDate,
      production_time: productionTime,
      notes: notes
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save production schedule');
  return data.state;
}

export async function saveGoLiveComment(clientId, commentText) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/golive/steps/5/comment/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      comment_text: commentText
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save special comment');
  return data.state;
}

export async function completeGoLiveStep6(clientId) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/golive/steps/6/complete/`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to complete Go Live');
  return data;
}

export async function redoGoLiveStep(clientId, stepNum) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/golive/steps/${stepNum}/redo/`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to reset Go Live step');
  return data.state;
}

// --- 4. Access Matrix & Dynamic Last Login Service ---
export async function fetchAccessInfo() {
  const res = await fetch(`${BASE_URL}/access/info/`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch access matrix');
  return res.json();
}

export async function createUser(userData) {
  let res;
  try {
    res = await fetch('/admin-panel/api/users/create/', {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
  } catch (err) {
    res = null;
  }

  if (!res || !res.ok) {
    try {
      res = await fetch('/admin-panel/api/users/', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
    } catch (err) {
      res = null;
    }
  }

  if (!res) {
    throw new Error('Network error. Failed to connect to user creation service.');
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('Server returned invalid user response: ' + (text ? text.substring(0, 80) : 'empty response'));
  }

  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to create user credentials.');
  }

  return data;
}

// --- 5. MIR Mapper Service ---
export async function fetchMappings(clientId) {
  const url = clientId ? `${BASE_URL}/mappings/?client_id=${encodeURIComponent(clientId)}` : `${BASE_URL}/mappings/`;
  const res = await fetch(url, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch mappings');
  return res.json();
}

export async function saveMappings(fields, clientId) {
  const url = clientId ? `${BASE_URL}/mappings/?client_id=${encodeURIComponent(clientId)}` : `${BASE_URL}/mappings/`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ fields })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Save failed');
  return data;
}

export async function checkMappings(fields, clientId) {
  const url = clientId ? `${BASE_URL}/mappings/check/?client_id=${encodeURIComponent(clientId)}` : `${BASE_URL}/mappings/check/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ fields })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Check failed');
  return data;
}

export async function resetMappings(clientId) {
  const url = clientId ? `${BASE_URL}/mappings/reset/?client_id=${encodeURIComponent(clientId)}` : `${BASE_URL}/mappings/reset/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Reset failed');
  return data;
}

export async function updateUser(userId, userData) {
  const res = await fetch(`/admin-panel/api/users/${userId}/update/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(userData)
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update user.');
  return data;
}

export async function deleteUser(userId) {
  const res = await fetch(`/admin-panel/api/users/${userId}/delete/`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete user.');
  return data;
}

export async function fetchClientSmtpConfig(clientId) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/smtp/`, {
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch SMTP config');
  return data.config; // null if not yet configured
}

export async function saveClientSmtpConfig(clientId, payload) {
  const res = await fetch(`${BASE_URL}/clients/${encodeURIComponent(clientId)}/smtp/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save SMTP config');
  return data;
}


// ------------------------------------------------------------------
// Offboarding API
// ------------------------------------------------------------------
export const fetchOffboardingState = async (clientId) => {
  const res = await fetch(`/admin-panel/api/clients/${clientId}/offboarding/state/`);
  if (!res.ok) throw new Error('Failed to fetch offboarding state');
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch offboarding state');
  return data.state;
};

export const completeOffboardingStep = async (clientId, stepNum, file = null) => {
  let headers = {};
  let body = null;

  if (file) {
    headers['X-Filename'] = file.name;
    body = file;
  } else {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`/admin-panel/api/clients/${clientId}/offboarding/steps/${stepNum}/complete/`, {
    method: 'POST',
    headers,
    body
  });
  
  if (!res.ok) throw new Error('Failed to complete offboarding step');
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to complete offboarding step');
  return data.state;
};

export const redoOffboardingStep = async (clientId, stepNum) => {
  const res = await fetch(`/admin-panel/api/clients/${clientId}/offboarding/steps/${stepNum}/redo/`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to redo offboarding step');
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to redo offboarding step');
  return data.state;
};

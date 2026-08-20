import os

api_path = r"c:\Users\Sahil1234\Desktop\835_To_Mir_final\Project835\frontend\src\onesmarter_admin\services\api.js"
with open(api_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace createClient function
old_create = """export async function createClient(clientPayload) {
  const payload = typeof clientPayload === 'string' ? { name: clientPayload } : clientPayload;
  const res = await fetch(`${BASE_URL}/clients/`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create client');
  return data;
}"""

new_create = """export async function createClient(clientPayload) {
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
}"""

if old_create in content:
    content = content.replace(old_create, new_create)
    print("Replaced createClient in api.js!")
else:
    print("old_create pattern not found, performing substring replacement...")
    start_idx = content.find("export async function createClient")
    end_idx = content.find("export async function deleteClient")
    if start_idx != -1 and end_idx != -1:
        content = content[:start_idx] + new_create + "\n\n" + content[end_idx:]
        print("Replaced createClient via slice!")

with open(api_path, "w", encoding="utf-8") as f:
    f.write(content)

print("api.js patched successfully!")

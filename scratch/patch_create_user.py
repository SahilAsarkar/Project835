import os

api_path = r"c:\Users\Sahil1234\Desktop\835_To_Mir_final\Project835\frontend\src\onesmarter_admin\services\api.js"
with open(api_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace createUser function
old_create_user = """export async function createUser(userData) {
  const res = await fetch(`${BASE_URL}/users/create/`, {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create user');
  return data;
}"""

new_create_user = """export async function createUser(userData) {
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
}"""

if old_create_user in content:
    content = content.replace(old_create_user, new_create_user)
    print("Replaced createUser in api.js!")
else:
    start_idx = content.find("export async function createUser")
    end_idx = content.find("export async function fetchMappings")
    if start_idx != -1 and end_idx != -1:
        content = content[:start_idx] + new_create_user + "\n\n" + content[end_idx:]
        print("Replaced createUser via slice!")

with open(api_path, "w", encoding="utf-8") as f:
    f.write(content)

print("api.js patched for createUser successfully!")
